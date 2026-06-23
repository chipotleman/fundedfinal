// Original Piks analysis for a news story, generated with Gemini.
//
// We never republish the source article body. Instead we take the public
// headline + summary and have Gemini write a SHORT, original Piks-voice take:
// a quick "gist", a few key points, and a betting/market angle (what bettors
// should watch). Results are cached in-memory per article id so we don't
// regenerate on every view.

const GEMINI_TEXT_MODEL = 'gemini-2.5-flash';
const AI_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const aiCache = new Map(); // id -> { at, analysis }

function stripCodeFences(text) {
  let t = String(text || '').trim();
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
  }
  return t;
}

function safeParse(text) {
  try {
    return JSON.parse(stripCodeFences(text));
  } catch {
    // Last resort: pull the first {...} block out of the response.
    const m = String(text || '').match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

async function callGeminiText(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_TEXT_MODEL}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Gemini error ${resp.status}: ${text.slice(0, 300)}`);
  }

  const json = await resp.json();
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

function buildPrompt(article) {
  return [
    'You are a sharp, concise sports-betting editor for "Piks", a 1v1 sports betting platform.',
    'Using ONLY the headline and summary below, write an ORIGINAL short take in your own words.',
    'Do NOT copy phrasing from the summary. Do NOT invent specific stats, injuries, odds, or quotes that are not implied.',
    'Keep it punchy and useful for someone deciding how to bet.',
    '',
    `LEAGUE: ${article.league || 'Sports'}`,
    `HEADLINE: ${article.headline}`,
    `SUMMARY: ${article.description || '(no summary provided)'}`,
    '',
    'Return STRICT JSON with this exact shape:',
    '{',
    '  "gist": "2-3 sentence original summary of what happened and why it matters",',
    '  "keyPoints": ["3 to 4 short bullet strings, each under 18 words"],',
    '  "bettingAngle": "2-3 sentences on what bettors should watch — momentum, matchups, value. General, no fabricated numbers."',
    '}',
  ].join('\n');
}

function fallbackAnalysis(article) {
  const desc = (article.description || '').trim();
  return {
    gist: desc || `${article.headline}. Read the full story for all the details.`,
    keyPoints: [
      `${article.league || 'Sports'} story worth tracking`,
      'Check the source for the latest details',
      'Weigh recent form before betting',
    ],
    bettingAngle:
      'Live odds move fast on news like this — watch line movement and recent form before locking a pick.',
    degraded: true,
  };
}

export async function getArticleAnalysis(article) {
  if (!article || !article.id) return fallbackAnalysis(article || {});

  const cached = aiCache.get(article.id);
  if (cached && Date.now() - cached.at < AI_CACHE_TTL_MS) {
    return cached.analysis;
  }

  let analysis;
  try {
    const text = await callGeminiText(buildPrompt(article));
    const parsed = safeParse(text);
    if (parsed && (parsed.gist || Array.isArray(parsed.keyPoints))) {
      analysis = {
        gist: String(parsed.gist || '').trim() || fallbackAnalysis(article).gist,
        keyPoints: Array.isArray(parsed.keyPoints)
          ? parsed.keyPoints.map((p) => String(p).trim()).filter(Boolean).slice(0, 4)
          : fallbackAnalysis(article).keyPoints,
        bettingAngle:
          String(parsed.bettingAngle || '').trim() || fallbackAnalysis(article).bettingAngle,
      };
    } else {
      analysis = fallbackAnalysis(article);
    }
  } catch {
    analysis = fallbackAnalysis(article);
  }

  // Only cache successful (non-degraded) analyses so a transient outage doesn't
  // pin a low-quality fallback for an hour.
  if (!analysis.degraded) {
    aiCache.set(article.id, { at: Date.now(), analysis });
  }
  return analysis;
}
