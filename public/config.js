// public/config.js (browser)
// WebRTC Realtime client using server-minted ephemeral keys (ek_...).
// Browser never sees OPENAI_API_KEY.

function buildInstructions(localeVariant) {
  if (localeVariant === "es-ES") {
    return `
Eres una asistente de voz. Habla en español de España (castellano peninsular).
- Pronunciación y entonación propias de España.
- Usa “vosotros”, “vale”, “de acuerdo”.
- Vocabulario preferido: “ordenador”, “móvil”, “coche”, “zumo”.
- Pronuncia los términos técnicos en español: "Wüifi", "CeDe", "GePeEse".
- Evita voseo (“vos”) y expresiones típicas de Latinoamérica (“chévere”, “computadora”, “carro”, etc.).
Responde de forma natural, cálida y concisa.`;
  }

  if (localeVariant === "es-419") {
    return `
Eres una asistente de voz. Habla en español latinoamericano neutro.
- Usa “ustedes” (no “vosotros”).
- Vocabulario preferido: “computadora”, “celular”, “carro”, “jugo”, "Guayfay"
- Pronuncia los términos técnicos en inglés: "Güayfai", "SiDi", "Yipies".
- Evita modismos muy locales de un solo país.
Responde de forma natural, cálida y concisa.`;
  }

  if (localeVariant === "en-GB") {
    return `
You are a voice assistant. Speak British English.
- Prefer UK vocabulary (mobile, lift, lorry, petrol).
- Use natural UK phrasing and spelling when transcribing.
Be warm, natural, and concise.`;
  }

  return `
You are a voice assistant. Speak American English.
- Prefer US vocabulary (cell phone, elevator, truck, gas).
Be warm, natural, and concise.`;
}

const Config = {
  OPENAI: {
    REALTIME_HTTP_URL: "https://api.openai.com/v1/realtime",
    MODEL: "gpt-4o-mini-realtime-preview",
    VOICE: "alloy",
    MODALITIES: ["audio", "text"]
  },

  WEBRTC: {
    ICE_SERVERS: [{ urls: "stun:stun.l.google.com:19302" }]
  },

  buildInstructions,

  async mintEphemeralKey({ userId = "anon", localeVariant = "en-US" } = {}) {
    const s = await fetch("/api/voice/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId })
    });
    if (!s.ok) {
      const t = await s.text().catch(() => "");
      throw new Error(`Failed to create voice session (${s.status}): ${t}`);
    }
    const session = await s.json();
    const sessionToken = session.sessionToken;
    if (!sessionToken) throw new Error("Voice session did not return sessionToken");

    const instructions = buildInstructions(localeVariant);

    const r = await fetch("/api/voice/realtime-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionToken,
        model: Config.OPENAI.MODEL,
        voice: Config.OPENAI.VOICE,
        instructions
      })
    });

    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`Failed to mint ephemeral key (${r.status}): ${t}`);
    }
    const data = await r.json();
    if (!data.ephemeralKey) throw new Error("No ephemeralKey returned from server");
    return data.ephemeralKey;
  }
};
