// Vercel Serverless Function — proxies requests to Groq API (FREE tier)
//
// Setup: In Vercel → Settings → Environment Variables, add:
//   GROQ_API_KEY = your free key from https://console.groq.com
//
// Free tier: 30 req/min, 14,400 req/day — very generous

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({
      error: "GROQ_API_KEY not configured. Get a FREE key at https://console.groq.com then add it in Vercel → Settings → Environment Variables.",
    });
  }

  try {
    const { messages, max_tokens = 1000 } = req.body;

    // Detect if any message contains an image
    const hasImage = messages.some(
      (m) => Array.isArray(m.content) && m.content.some((b) => b.type === "image")
    );

    // Pick model: vision model for images, fast model for text
    const model = hasImage ? "meta-llama/llama-4-scout-17b-16e-instruct" : "llama-3.3-70b-versatile";

    // Convert Anthropic-style messages to OpenAI/Groq format
    const groqMessages = messages.map((msg) => {
      if (typeof msg.content === "string") {
        return { role: msg.role, content: msg.content };
      }

      // Multi-part content (text + images)
      const parts = [];
      for (const block of msg.content) {
        if (block.type === "text") {
          parts.push({ type: "text", text: block.text });
        } else if (block.type === "image") {
          parts.push({
            type: "image_url",
            image_url: {
              url: `data:${block.source.media_type};base64,${block.source.data}`,
            },
          });
        }
      }
      return { role: msg.role, content: parts };
    });

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: groqMessages,
        max_tokens,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Groq error:", JSON.stringify(data));
      return res.status(response.status).json({
        error: data.error?.message || `Groq API error: ${response.status}`,
      });
    }

    // Convert Groq/OpenAI response → Anthropic-compatible format
    const text = data.choices?.[0]?.message?.content || "";

    return res.status(200).json({
      content: [{ type: "text", text }],
      model,
      role: "assistant",
    });
  } catch (err) {
    console.error("Proxy error:", err);
    return res.status(500).json({ error: "Proxy error: " + err.message });
  }
}
