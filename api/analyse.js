// Vercel Serverless Function — proxies requests to Google Gemini API (FREE tier)
//
// Setup: In Vercel → Settings → Environment Variables, add:
//   GEMINI_API_KEY = your free key from https://aistudio.google.com/apikey
//
// Free tier: 30 requests/min with gemini-2.0-flash-lite

export default async function handler(req, res) {
  // CORS headers for browser requests
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY not configured. Get a FREE key at https://aistudio.google.com/apikey then add it in Vercel → Settings → Environment Variables.",
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

      return {
        role: msg.role === "assistant" ? "model" : "user",
        parts,
      };
    });

    // Try multiple models in order: flash-lite (most free), flash, then pro
    const models = [
      "gemini-2.0-flash-lite",
      "gemini-2.0-flash",
      "gemini-1.5-flash-latest",
    ];

    let lastError = null;

    for (const model of models) {
      const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      try {
        const response = await fetch(geminiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: geminiContents,
            generationConfig: {
              maxOutputTokens: max_tokens,
              temperature: 0.7,
            },
          }),
        });

        const data = await response.json();

        if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
          const geminiText = data.candidates[0].content.parts[0].text;

          // Convert to Anthropic-compatible response format
          return res.status(200).json({
            content: [{ type: "text", text: geminiText }],
            model: model,
            role: "assistant",
          });
        }

        lastError = data.error?.message || `${model} failed: ${response.status}`;
        console.log(`Model ${model} failed, trying next...`, lastError);
      } catch (fetchErr) {
        lastError = fetchErr.message;
        console.log(`Model ${model} fetch error, trying next...`, lastError);
      }
    }

    // All models failed
    return res.status(500).json({
      error: `All AI models failed. Last error: ${lastError}. Make sure your GEMINI_API_KEY is valid — get one free at https://aistudio.google.com/apikey`,
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal proxy error: " + err.message });
  }
}
