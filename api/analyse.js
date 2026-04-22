// Vercel Serverless Function — proxies requests to Google Gemini API (FREE tier)
// This avoids CORS issues and keeps your API key secure server-side.
//
// Setup: In Vercel → Settings → Environment Variables, add:
//   GEMINI_API_KEY = your free key from https://aistudio.google.com/apikey
//
// Free tier: 15 requests/min, 1M tokens/day — more than enough for personal use.

export default async function handler(req, res) {
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
        // Simple text message
        parts.push({ text: msg.content });
      } else if (Array.isArray(msg.content)) {
        // Multi-part message (text + images)
        for (const block of msg.content) {
          if (block.type === "text") {
            parts.push({ text: block.text });
          } else if (block.type === "image") {
            // Anthropic base64 image → Gemini inline_data
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

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

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

    if (!response.ok) {
      console.error("Gemini API error:", JSON.stringify(data));
      return res.status(response.status).json({ error: data.error?.message || "Gemini API error" });
    }

    // Convert Gemini response → Anthropic-compatible format
    // so the frontend code doesn't need any changes
    const geminiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    const anthropicResponse = {
      content: [{ type: "text", text: geminiText }],
      model: "gemini-2.0-flash",
      role: "assistant",
    };

    return res.status(200).json(anthropicResponse);
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Internal proxy error" });
  }
}
