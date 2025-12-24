import crypto from 'crypto';

function base64urlToBuf(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  return Buffer.from(s, 'base64');
}
function verify(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false, error: 'Bad token' };
  const [h, p, sig] = parts;
  const data = `${h}.${p}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  if (expected !== sig) return { ok: false, error: 'Bad signature' };
  const payload = JSON.parse(base64urlToBuf(p).toString('utf-8'));
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && now > payload.exp) return { ok: false, error: 'Expired token' };
  return { ok: true, payload };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.OPENAI_API_KEY;
  const secret = process.env.VOICE_SESSION_SECRET;
  if (!apiKey) return res.status(500).json({ error: 'OPENAI_API_KEY not set' });
  if (!secret) return res.status(500).json({ error: 'VOICE_SESSION_SECRET not set' });

  const { sessionToken, model, voice, instructions } = req.body || {};
  if (!sessionToken) return res.status(400).json({ error: 'sessionToken is required' });

  const v = verify(sessionToken, secret);
  if (!v.ok) return res.status(401).json({ error: v.error });

  const useModel = model || process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-mini-realtime-preview';
  const useVoice = voice || process.env.OPENAI_VOICE || 'alloy';
  const useInstructions =
    instructions ||
    process.env.OPENAI_REALTIME_INSTRUCTIONS ||
    'You are a helpful voice assistant. Be conversational, friendly, and concise.';

  const r = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'realtime=v1',
    },
    body: JSON.stringify({
      model: useModel,
      modalities: ['audio', 'text'],
      voice: useVoice,
      input_audio_format: 'pcm16',
      output_audio_format: 'pcm16',
      instructions: useInstructions,
      turn_detection: {
        type: 'server_vad',
        threshold: 0.9,
        prefix_padding_ms: 200,
        silence_duration_ms: 900,
        create_response: true,
        interrupt_response: true,
      },
    }),
  });

  const text = await r.text();
  let json;
  try { json = JSON.parse(text); } catch { json = null; }

  if (!r.ok) {
    return res.status(502).json({ error: 'OpenAI error', status: r.status, detail: text.slice(0, 1500) });
  }

  const ek = json?.client_secret?.value;
  if (!ek) return res.status(502).json({ error: 'No client_secret', detail: json || text });

  res.status(200).json({
    ephemeralKey: ek,
    sessionId: json?.id,
    expiresAt: json?.client_secret?.expires_at || null,
    userId: v.payload.uid,
  });
}
