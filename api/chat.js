import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function systemForLocale(localeVariant) {
  if (localeVariant === "es-ES") {
    return "Eres Brenda. Responde en español de España (castellano peninsular), con tono cálido y natural.";
  }
  if (localeVariant === "es-419") {
    return "Eres Brenda. Responde en español latinoamericano neutro, con tono cálido y natural.";
  }
  if (localeVariant === "en-GB") {
    return "You are Brenda. Respond in British English with a warm, natural tone.";
  }
  return "You are Brenda. Respond in American English with a warm, natural tone.";
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

    const { localeVariant = "en-US", messages = [] } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages[] required" });
    }

    const sys = systemForLocale(localeVariant);

    // Use a small/cheap model for text mode during testing
    const model = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: sys },
        ...messages.map(m => ({ role: m.role, content: m.content }))
      ],
      max_output_tokens: 400
    });

    // Extract text safely
    const text = response.output_text || "";
    return res.status(200).json({ reply: text });
  } catch (err) {
    console.error("[/api/chat] error", err);
    return res.status(500).json({ error: "Chat failed", detail: String(err?.message || err) });
  }
}
