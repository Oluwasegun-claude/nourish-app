// Vercel Serverless Function — proxies requests to Google Gemini API (FREE tier)
//
// Setup: In Vercel → Settings → Environment Variables, add:
//   GEMINI_API_KEY = your free key from https://aistudio.google.com/apikey

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY not configured. Get a FREE key at https://aistudio.google.com/apikey",
    });
  }

  try {
    const { messages, max_tokens = 1000 } = req.body;

    // Convert Anthropic-style messages to Gemini format
    const geminiContents = messages.map((msg) => {
      const parts = [];
      if (typeof msg.content === "string") {
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        for (const block of msg.content) {
          if (block.type === "text") {
            parts.push({ text: block.text });
          } else if (block.type === "image") {
            parts.push({
              inline_data: {
                mime_type: block.source.media_type,
                data: block.source.data,
              },
            });
          }
        }
      }
      return { role: msg.role === "assistant" ? "model" : "user", parts };
    });

    const model = "gemini-2.0-flash";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Retry up to 3 times with backoff for rate limits
    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, 2000 * attempt)); // 2s, 4s backoff
      }

      try {
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: geminiContents,
            generationConfig: { maxOutputTokens: max_tokens, temperature: 0.7 },
          }),
        });

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          return res.status(200).json({
            content: [{ type: "text", text: data.candidates[0].content.parts[0].text }],
            model,
            role: "assistant",
          });
        }

        if (response.status === 429) {
          lastError = "Rate limited — retrying...";
          continue; // retry
        }

        // Non-retryable error
        lastError = data.error?.message || `Error ${response.status}`;
        break;
      } catch (fetchErr) {
        lastError = fetchErr.message;
      }
    }

    return res.status(500).json({ error: lastError || "AI request failed" });
  } catch (err) {
    return res.status(500).json({ error: "Proxy error: " + err.message });
  }
}
