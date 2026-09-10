const TRUSTED_PUBLIC_ORIGINS = new Set([
  'https://clydeagnew-max.github.io',
  'https://clydeagnew-max-github-io.vercel.app'
]);

const buckets = new Map();
const LIMIT = 12;
const WINDOW_MS = 60_000;

const MODE_INSTRUCTIONS = {
  ielts: `You are the Knight School IELTS Coach. Create accurate, original IELTS-style practice without claiming questions are predicted or official. Give a compact practice set, a useful response strategy, and one coaching tip. Match the user's CEFR/band level. Do not invent or guarantee official band scores.`,
  speaking: `You are the Knight School Speaking Coach. Help the learner sound clear, natural and confident while preserving their meaning and personality. Give: (1) quick diagnosis, (2) improved response, (3) three targeted language upgrades, and (4) one delivery tip. Avoid overcomplicated vocabulary.`,
  workplace: `You are the Knight School Workplace English Coach. Help multilingual professionals communicate effectively in English-speaking workplaces. Explain tone, pragmatic meaning, politeness, power dynamics and likely interpretation without pretending to read minds. Give a ready-to-use version plus a short explanation of why it works.`,
  lesson: `You are Knight School Lesson Studio, assisting an experienced ESL teacher. Create a practical one-to-one lesson with a clear objective, warm-up, input/model, guided practice, communicative activity, game/challenge, differentiation, quick assessment and next-step feedback. Keep materials realistic for online teaching.`
};

function originAllowed(req, origin) {
  if (!origin) return true;
  if (TRUSTED_PUBLIC_ORIGINS.has(origin)) return true;
  try {
    const url = new URL(origin);
    const requestHost = String(req.headers.host || '').toLowerCase();
    return url.protocol === 'https:' && url.host.toLowerCase() === requestHost;
  } catch {
    return false;
  }
}

function rateLimited(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
  const now = Date.now();
  const current = buckets.get(ip);
  if (!current || now - current.started > WINDOW_MS) {
    buckets.set(ip, { started: now, count: 1 });
    return false;
  }
  current.count += 1;
  if (buckets.size > 500) {
    for (const [key, value] of buckets) if (now - value.started > WINDOW_MS) buckets.delete(key);
  }
  return current.count > LIMIT;
}

function extractText(data) {
  if (typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text.trim();
  const pieces = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if ((content.type === 'output_text' || content.type === 'text') && typeof content.text === 'string') pieces.push(content.text);
    }
  }
  return pieces.join('\n').trim();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  const origin = req.headers.origin || '';
  if (!originAllowed(req, origin)) return res.status(403).json({ error: 'Origin not allowed.' });

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    return res.status(200).json({
      service: 'Knight School AI',
      status: process.env.OPENAI_API_KEY ? 'ready' : 'configuration-required',
      model: process.env.OPENAI_MODEL || 'gpt-5.6-luna'
    });
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST.' });
  if (rateLimited(req)) return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'The Knight School AI service is not configured yet.' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  } catch {
    return res.status(400).json({ error: 'Invalid request data.' });
  }

  const mode = String(body.mode || 'ielts').slice(0, 20);
  const level = String(body.level || 'B2').slice(0, 40);
  const topic = String(body.topic || '').trim().slice(0, 500);
  const context = String(body.context || '').trim().slice(0, 2500);
  const response = String(body.response || '').trim().slice(0, 5000);

  if (!MODE_INSTRUCTIONS[mode]) return res.status(400).json({ error: 'Unknown coaching mode.' });
  if (!topic) return res.status(400).json({ error: 'Please provide a topic or situation.' });
  if ((mode === 'speaking' || mode === 'workplace') && !response) return res.status(400).json({ error: 'Please add the response or message you want to work on.' });

  const userInput = [
    `Level: ${level}`,
    `Topic / situation: ${topic}`,
    context ? `Context: ${context}` : '',
    response ? `Learner draft: ${response}` : ''
  ].filter(Boolean).join('\n\n');

  try {
    const openai = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-5.6-luna',
        instructions: MODE_INSTRUCTIONS[mode],
        input: userInput,
        max_output_tokens: 1200,
        store: false
      })
    });

    const data = await openai.json().catch(() => ({}));
    if (!openai.ok) {
      console.error('OpenAI error', openai.status, data?.error?.message || 'Unknown API error');
      return res.status(502).json({ error: 'The AI coach is temporarily unavailable.' });
    }

    const text = extractText(data);
    if (!text) return res.status(502).json({ error: 'The AI coach returned an empty response.' });

    return res.status(200).json({ text, model: data.model || process.env.OPENAI_MODEL || 'gpt-5.6-luna' });
  } catch (error) {
    console.error('Knight School API error', error);
    return res.status(500).json({ error: 'Unexpected server error.' });
  }
}