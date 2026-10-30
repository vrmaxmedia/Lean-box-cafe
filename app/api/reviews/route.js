import { NextResponse } from 'next/server';

const MODEL = 'gemini-3.5-flash';

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const chance = (p) => Math.random() < p;

function pickWeighted(items) {
  const total = items.reduce((s, i) => s + i.w, 0);
  let r = Math.random() * total;
  for (const i of items) {
    if ((r -= i.w) <= 0) return i;
  }
  return items[0];
}

// ~8 words = 1 line on phone
const LENGTHS = [
  { w: 8,  lines: 1, min: 7,  max: 11, rule: 'ONE short line, 7 to 10 words' },
  { w: 8,  lines: 2, min: 13, max: 21, rule: 'TWO lines, 14 to 20 words' },
  { w: 34, lines: 3, min: 21, max: 31, rule: 'THREE lines, 22 to 30 words' },
  { w: 34, lines: 4, min: 30, max: 42, rule: 'FOUR lines, 32 to 40 words' },
  { w: 16, lines: 5, min: 40, max: 52, rule: 'FIVE lines, 42 to 50 words' },
];

function chooseLength(recent) {
  const lens = recent.map((r) => r.lines).filter(Boolean);
  const l1 = lens[lens.length - 1];
  const l2 = lens[lens.length - 2];
  const l3 = lens[lens.length - 3];
  let pool = LENGTHS;

  const mid = (n) => n === 3 || n === 4;
  if (lens.length >= 3 && mid(l1) && mid(l2) && mid(l3)) {
    pool = LENGTHS.filter((x) => !mid(x.lines)); // 1, 2 ya 5
  } else if (l1 && !mid(l1)) {
    pool = LENGTHS.filter((x) => mid(x.lines)); // off-pattern ke baad wapas 3-4
  }
  if (l1 && l1 === l2) {
    const f = pool.filter((x) => x.lines !== l1);
    if (f.length) pool = f;
  }
  return pickWeighted(pool);
}

const VOICES = [
  {
    id: 'desi',
    text: 'a simple desi Delhi person, speaks plain and rough, short sentences, no fancy words, a little loose grammar is fine',
  },
  {
    id: 'family',
    text: 'a middle class family person who came for a family dinner, practical and careful with money, honest and simple',
  },
  {
    id: 'professional',
    text: 'an educated working professional, polished and clear, well-structured sentences, calm and respectful tone',
  },
  {
    id: 'young',
    text: 'a college-age youngster who came with friends, casual and slangy, quick typing style, energetic',
  },
  {
    id: 'uncle',
    text: 'an older respectful person (uncle ji), polite, simple words, thanks the staff warmly',
  },
  {
    id: 'blunt',
    text: 'a straightforward no-nonsense person, few words, says only what mattered to him',
  },
];

function chooseVoice(recent) {
  const last = recent.map((r) => r.voice).filter(Boolean).slice(-2);
  const pool = VOICES.filter((v) => !last.includes(v.id));
  return pick(pool.length ? pool : VOICES);
}

// Topics: "All" me random, baaki chips me chip ka apna topic
const TOPICS = {
  health: {
    id: 'health',
    text: 'healthy food: fresh, light, wholesome meals that feel good to eat and suit a healthier lifestyle (no medical, diet or calorie claims)',
    must: /health|healthy|fit|fitness|diet|nutri|light|wholesome|fresh|clean eating|guilt|sehat|lifestyle|balanced/i,
  },
  vegan: {
    id: 'vegan',
    text: 'the vegan dishes and plant-based options: good variety, tasty and satisfying',
    must: /vegan|plant|veg|dairy|option|variety|sehat|healthy/i,
  },
  food: {
    id: 'food',
    text: 'the taste and freshness of the food: tasty, fresh ingredients, nicely served, would order again',
    must: /food|taste|tasty|flavou?r|swad|khana|delicious|fresh|dish|meal|menu|portion|yummy|mazedar|zayka|served|order|ingredient/i,
  },
  ambience: {
    id: 'ambience',
    text: 'the ambience: cozy rustic interior with plants and wooden decor, comfortable seating, calm pleasant vibe',
    must: /ambience|ambiance|interior|decor|seating|vibe|cozy|comfortable|sitting|mahaul|baith|plant|green|wood|rustic|aesthetic|peaceful|space|environment|atmosphere|jagah|look/i,
  },
  politeness: {
    id: 'politeness',
    text: 'the behaviour of the staff: polite, friendly, attentive, quick service, made us feel welcome',
    must: /staff|service|behav|polite|friendly|attentive|patient|respect|welcom|prompt|quick|baat|nature|attend|samjhaya|serve|team/i,
  },
  pricing: {
    id: 'pricing',
    text: 'the price: pocket-friendly, good portions, great value for the money, no hidden charges',
    must: /price|rate|daam|paise|budget|cheap|sasta|saste|pocket|kimat|value|worth|portion|affordable|reasonable|bill/i,
  },
  hygiene: {
    id: 'hygiene',
    text: 'cleanliness: clean tables, neat and hygienic place, well maintained',
    must: /clean|hygien|safai|saaf|neat|tidy|fresh|washroom|table|utensil|sanitiz|maintain/i,
  },
  delivery: {
    id: 'delivery',
    text: 'ordering online: easy to order, neat packaging, food arrived fresh and well packed',
    must: /order|online|deliver|pack|packaging|app|arriv|fresh|home|tak/i,
  },
  location: {
    id: 'location',
    text: 'the location: easy to find in Yamuna Vihar, Block C, Delhi, convenient to reach',
    must: /yamuna|vihar|block|location|jagah|rasta|nazdik|paas|easy to find|aasani|area|locality|bhajanpura|reach|convenient/i,
  },
};

const CHIP_TOPIC = {
  'Healthy Food': 'health',
  'Vegan Options': 'vegan',
  'Taste & Freshness': 'food',
  'Cozy Ambience': 'ambience',
  'Staff & Service': 'politeness',
  'Value for Money': 'pricing',
  'Clean & Hygienic': 'hygiene',
  'Online Order': 'delivery',
};

// health & food zyada baar aaye (duplicate = zyada weight)
const ALL_TOPICS = ['health', 'health', 'food', 'food', 'vegan', 'ambience', 'politeness', 'pricing', 'hygiene', 'delivery', 'location'];

function chooseTopic(selectedService, recent) {
  const label = String(selectedService || '').split(' (Context')[0].trim();
  if (CHIP_TOPIC[label]) return TOPICS[CHIP_TOPIC[label]];
  const last = recent.map((r) => r.topic).filter(Boolean).slice(-2);
  const pool = ALL_TOPICS.filter((t) => !last.includes(t));
  return TOPICS[pick(pool.length ? pool : ALL_TOPICS)];
}

const OPENERS = [
  'start with the food or what you ordered',
  'start with the café or the area',
  'start with the staff or service',
  'start with how you feel now',
  'start with why you came here',
  'start in the middle of a thought, casually',
];

// sirf general visit context, koi dish ya fact invent nahi
const VISITS = [
  'came here with family',
  'came here with friends',
  'visited for lunch',
  'visited for dinner',
  'dropped by on a weekend',
  'ordered online',
];

const SEO_KEYWORDS = [
  'healthy café in Yamuna Vihar',
  'vegan food in Yamuna Vihar Delhi',
  'health food cafe in Delhi',
  'healthy food near Bhajanpura',
  'vegan friendly cafe in North East Delhi',
  'healthy meals at affordable price in Delhi',
  'cafe in Yamuna Vihar Block C',
  'healthy food delivery in Yamuna Vihar',
];

const BANNED_OPENINGS = ['Great', 'Best', 'Amazing', 'Excellent', 'Highly recommend', 'Bhai', 'Superb', 'Awesome', 'The staff here', 'Wow'];

const DANGLING = new Set([
  'to', 'aur', 'ki', 'ke', 'ka', 'se', 'me', 'mein', 'par', 'pe', 'ko', 'toh',
  'and', 'but', 'the', 'a', 'an', 'of', 'in', 'on', 'for', 'with', 'at', 'that',
  'so', 'if', 'or', 'because', 'jo', 'jab', 'agar', 'lekin', 'ya', 'jaise', 'kyunki',
]);

const HINDI_WORDS = new Set([
  'hai', 'hain', 'nahi', 'nahin', 'bahut', 'bohot', 'bhot', 'mera', 'meri', 'mere', 'mujhe', 'hume',
  'aur', 'ki', 'ke', 'ka', 'ko', 'se', 'par', 'pe', 'tha', 'thi', 'the', 'kiya', 'mila', 'mil', 'gaya', 'gayi',
  'liya', 'wala', 'wale', 'jo', 'kaafi', 'accha', 'acha', 'achha', 'sach', 'yahan', 'yaha', 'kar', 'karke', 'raha',
  'rahe', 'rahi', 'laga', 'lagi', 'bilkul', 'ekdum', 'sab', 'kuch', 'koi', 'phir', 'fir', 'bhi', 'toh', 'lekin',
  'isliye', 'abhi', 'dekh', 'dekha', 'diya', 'dikhaya', 'samjhaya', 'sahi', 'dukaan', 'dukan', 'aap', 'aapne',
  'paise', 'kam', 'jyada', 'zyada', 'badhiya', 'mast', 'yaar', 'khana', 'swad', 'mahaul', 'safai', 'saaf', 'dost', 'jagah', 'zayka', 'mazedar', 'sehat', 'sehatmand', 'halka',
]);

async function callGemini(apiKey, payload) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  const data = await res.json();
  return { res, data };
}

function cleanReview(text) {
  return text
    .replace(/^["'`\s]+|["'`\s]+$/g, '')
    .replace(/\s*\n+\s*/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/\.{2,}/g, ' ')
    .replace(/\.\s+/g, ', ')
    .replace(/\.+$/g, '')
    .replace(/,\s*,/g, ',')
    .trim();
}

function looksCutOff(text) {
  const last = text.split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '');
  return DANGLING.has(last) || /[,\-]$/.test(text.trim());
}

function hindiCount(text) {
  return text.toLowerCase().replace(/[^a-z\s]/g, ' ').split(/\s+/).filter((w) => HINDI_WORDS.has(w)).length;
}

function languageOk(text, language, words) {
  const h = hindiCount(text);
  if (language === 'HINGLISH') return h >= Math.max(3, Math.floor(words * 0.2));
  return h <= 2;
}

function buildPrompt(body, recent) {
  const { businessName, category, description, city, selectedService, language } = body;

  const length = chooseLength(recent);
  const voice = chooseVoice(recent);
  const topic = chooseTopic(selectedService, recent);
  const opener = pick(OPENERS);

  const mentionName = chance(0.5);
    const useEmoji = chance(0.08);
  const visit = chance(0.4) ? pick(VISITS) : null;
  const seo = chance(0.8) ? pick(SEO_KEYWORDS) : null;
  const secondPoint = length.lines >= 4 && chance(0.5);

  const languageBlock =
    language === 'HINGLISH'
      ? `LANGUAGE (MOST IMPORTANT): Write in HINGLISH = Hindi sentences typed in English/Roman letters, like a Delhi person on WhatsApp. Grammar must be Hindi (hai, tha, kiya, mila, nahi, bahut, aur, ke liye, wala etc.) with common English words like food, taste, staff, price, ambience mixed in. Product names and keywords can stay in English. Never write a full English sentence. Never use Devanagari.`
      : `LANGUAGE (MOST IMPORTANT): Write in simple natural English like an Indian customer. Do not use Hindi words.`;

  const prompt = `${languageBlock}

You are ${voice.text}. You are a customer of this healthy food café and are writing a Google Maps review.

Business: ${businessName} (${city}), a healthy food café
Category: ${category}
About: ${description || ''}

REVIEW RULES:
- Main topic of the review: ${topic.text}. The review must clearly be about this.
${secondPoint ? '- You may add one small extra point at the end, from any other area.' : '- Stick to the main topic only.'}
- Voice: write exactly like the person described above, so this review sounds different from other customers.
- Opening: ${opener}
- Length: ${length.rule}. Stay inside this range.
${mentionName ? `- Mention the name "${businessName}" once, naturally.` : '- Do not repeat the full name.'}
${seo ? `- If it fits naturally, include the phrase "${seo}".` : ''}
${visit ? `- You may mention that you ${visit}.` : ''}
- Do not name any person.
${useEmoji ? '- One emoji at the very end is allowed.' : '- No emojis.'}

HARD RULES:
- ONE single paragraph. No line breaks, bullets or title.
- Do NOT use a full stop (.) anywhere. Use commas, "aur"/"and", or just flow.
- Never start with: ${BANNED_OPENINGS.join(', ')}.
- Sound like a real customer, not an advertisement. No hashtags, slogans or keyword stuffing.
- Do not invent facts: no specific dish names, no exact prices, no discounts, no offers, no other restaurant names, no calorie or nutrition numbers, no medical or weight-loss claims. Speak generally (healthy food, fresh meals, vegan options, drinks).
- End with a COMPLETE thought. Never stop mid-sentence.
- Output only the review text.`;

  return { prompt, length, voice, topic };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'API Key not configured.' }, { status: 500 });
    }

    const recent = (Array.isArray(body.recentLengths) ? body.recentLengths : [])
      .filter((r) => r && typeof r === 'object')
      .slice(-6);

    let lastError = 'Failed to generate review draft.';

    for (let attempt = 0; attempt < 4; attempt++) {
      const { prompt, length, voice, topic } = buildPrompt(body, recent);

      const payload = {
        contents: [{ role: 'user', parts: [{ text: `Write the review for ${body.businessName} now.` }] }],
        systemInstruction: { parts: [{ text: prompt }] },
        generationConfig: {
          temperature: 1.0,
          topP: 0.95,
          maxOutputTokens: 1024,
          thinkingConfig: { thinkingBudget: 0 },
        },
      };

      let { res, data } = await callGemini(apiKey, payload);

      if (!res.ok && /thinking/i.test(data.error?.message || '')) {
        delete payload.generationConfig.thinkingConfig;
        ({ res, data } = await callGemini(apiKey, payload));
      }

      if (!res.ok) {
        lastError = data.error?.message || 'Gemini API request failed.';
        continue;
      }

      const candidate = data.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      const raw = parts.filter((p) => !p.thought).map((p) => p.text || '').join('');
      const review = cleanReview(raw);
      const words = review.split(/\s+/).filter(Boolean).length;

      if (!review) { lastError = 'Empty response from Gemini.'; continue; }
      if (candidate?.finishReason === 'MAX_TOKENS') { lastError = 'Response was cut off.'; continue; }
      if (looksCutOff(review)) { lastError = 'Review ended mid-sentence.'; continue; }
      if (words > length.max + 8) { lastError = 'Review too long.'; continue; }
      if (words < Math.floor(length.min * 0.75)) { lastError = 'Review too short.'; continue; }
      if (!languageOk(review, body.language, words)) { lastError = 'Wrong language style.'; continue; }
      if (!topic.must.test(review)) { lastError = 'Review missed the selected topic.'; continue; }

      return NextResponse.json({
        review,
        meta: { lines: length.lines, voice: voice.id, topic: topic.id },
      });
    }

    throw new Error(lastError);
  } catch (error) {
    console.error('API Review Generation Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate review draft.' },
      { status: 500 }
    );
  }
}
