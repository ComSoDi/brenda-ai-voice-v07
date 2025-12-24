import crypto from 'crypto';

function base64url(input) {
  return Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
function sign(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const h = base64url(JSON.stringify(header));
  const p = base64url(JSON.stringify(payload));
  const data = `${h}.${p}`;
  const sig = crypto
    .createHmac('sha256', secret)
    .update(data)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  return `${data}.${sig}`;
}

export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.VOICE_SESSION_SECRET;
  if (!secret) return res.status(500).json({ error: 'VOICE_SESSION_SECRET not set' });

  const userId = req.body?.userId || 'anon';
  const now = Math.floor(Date.now() / 1000);
  const ttlSeconds = 10 * 60;
  const token = sign({ uid: userId, iat: now, exp: now + ttlSeconds }, secret);

  res.status(200).json({ sessionToken: token, expiresIn: ttlSeconds });
}
