const FREE_LIMIT = 10;

const SYSTEM_PROMPT = `You are a short-form content writer for YouTube Shorts, TikTok, and Instagram Reels.
Write a posting-ready content pack. Do not generate a video. Do not mention being an AI.
Return ONLY valid JSON in this exact shape, in this key order:
{
  "ideas": ["", "", ""],
  "hooks": ["", "", "", "", ""],
  "script": "full spoken script",
  "titles": ["", "", "", "", ""],
  "caption": "post caption",
  "cta": "call to action",
  "onscreen_text": ["", "", ""]
}
Rules:
- ideas: exactly 3
- hooks: exactly 5, under 16 words, first 3 seconds
- script: one spoken script matching the requested length, no stage directions
- titles: exactly 5
- caption: one caption, no hashtag dump in the caption string
- cta: one line
- onscreen_text: 3-5 short lines for 9:16, all caps ok
Match the platform, style, and length. Sound spoken, not bloggy.`;

const FIELD_SPECS = {
  ideas: "exactly 3 short video ideas as a JSON array of strings",
  hooks: "exactly 5 scroll-stopping hooks as a JSON array of strings",
  script: "one spoken script as a JSON string, timed for the requested length",
  titles: "exactly 5 titles as a JSON array of strings",
  caption: "one post caption as a JSON string",
  cta: "one spoken or on-screen call to action as a JSON string",
  onscreen_text: "3 to 5 short 9:16 lines as a JSON array of strings",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Cache-Control": "no-store",
    },
  });
}

function extractJson(text) {
  const raw = String(text || "").trim();
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model did not return JSON");
  return JSON.parse(body.slice(start, end + 1));
}

function normalizePack(raw) {
  let script = raw.script;
  if (script && typeof script === "object") script = script.spoken || "";
  return {
    ideas: (raw.ideas || []).slice(0, 3),
    hooks: (raw.hooks || []).slice(0, 5),
    script: script || "",
    titles: (raw.titles || []).slice(0, 5),
    caption: raw.caption || "",
    cta: raw.cta || "",
    onscreen_text: raw.onscreen_text || raw.on_screen_text || [],
  };
}

function clientIp(request) {
  return (
    request.headers.get("CF-Connecting-IP") ||
    (request.headers.get("X-Forwarded-For") || "").split(",")[0].trim() ||
    "unknown"
  );
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

async function remaining(ip) {
  const cache = caches.default;
  const hit = await cache.match(new Request(`https://quota.internal/${ip}/${todayStamp()}`));
  if (!hit) return FREE_LIMIT;
  const count = Number.parseInt(await hit.text(), 10) || 0;
  return Math.max(0, FREE_LIMIT - count);
}

async function consume(ip) {
  const cache = caches.default;
  const req = new Request(`https://quota.internal/${ip}/${todayStamp()}`);
  const hit = await cache.match(req);
  let count = hit ? Number.parseInt(await hit.text(), 10) || 0 : 0;
  if (count >= FREE_LIMIT) return { ok: false, left: 0 };
  count += 1;
  await cache.put(
    req,
    new Response(String(count), { headers: { "Cache-Control": "max-age=90000" } })
  );
  return { ok: true, left: Math.max(0, FREE_LIMIT - count) };
}

function clip(value, n) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  return text.length <= n ? text : `${text.slice(0, n - 1).trim()}…`;
}

function draftPack(topic, platform, style, length) {
  const t = clip(topic, 80);
  const where = platform || "TikTok";
  const funny = /funny/i.test(style);
  const story = /story/i.test(style);
  const short = /15/.test(length);
  const hookStart = funny
    ? `Nobody asked for this ${t} take, but`
    : story
      ? `I ignored ${t} for months, then`
      : `If you still think ${t} is simple,`;
  const ideas = [
    `A ${where} breakdown of ${t} people will save and replay`,
    `Three ${t} moves that look small on camera but change the whole video`,
    `The ${t} mistake everyone makes, then the 10-second fix`,
  ];
  const hooks = [
    `${hookStart} watch this.`,
    `Stop scrolling if ${t} keeps failing.`,
    `This ${t} line is the whole video.`,
    `I tested ${t} the wrong way first.`,
    `Save this before you post about ${t}.`,
  ].map((line) => clip(line, 90));
  const spoken = short
    ? `Okay, ${t}. Most people open with a weak first line, then wonder why nobody stays. Lead with one specific claim, show one proof, and end on one action. That is a full ${where} in under 30 seconds.`
    : story
      ? `I used to overexplain ${t}. The video that actually worked started with the mistake, showed the moment it clicked, then gave one next step. Tell it like a story, but cut every sentence that does not move the plot.`
      : `Here is ${t} in a way you can post today. Open with the tension, give three tight points, and close with one CTA. No extra lore. If a line would not sound good out loud, cut it.`;
  const titles = [
    `${t}: the version people actually watch`,
    `Do this before you post about ${t}`,
    `The ${t} mistake killing your ${where}`,
    `${t} in 20 seconds, no fluff`,
    `Watch this, then rewrite your ${t} hook`,
  ].map((line) => clip(line, 70));
  return {
    ideas,
    hooks,
    script: spoken,
    titles,
    caption: clip(
      `${t} for ${where}. Steal the hook, say the script out loud, and post the on-screen lines as-is.`,
      180
    ),
    cta: `Follow for the next ${t} pack, then post this today.`,
    onscreen_text: [clip(t, 24).toUpperCase(), "WATCH THIS", "POST IT TODAY", "FOLLOW FOR MORE"],
  };
}

function draftField(field, topic, platform, style, length) {
  return draftPack(topic, platform, style, length)[field];
}

function packPayload(env, topic, platform, style, length) {
  return {
    model: env.AGNES_MODEL || "agnes-2.5-flash",
    temperature: 0.7,
    max_tokens: 1800,
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Topic: ${topic}\nPlatform: ${platform}\nStyle: ${style}\nLength: ${length}\nWrite the full content pack now as JSON.`,
      },
    ],
  };
}

function regenPayload(env, field, topic, platform, style, length, pack) {
  return {
    model: env.AGNES_MODEL || "agnes-2.5-flash",
    temperature: 0.8,
    max_tokens: 800,
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      {
        role: "system",
        content:
          "Rewrite only one field of a Shorts content pack. Return ONLY JSON: {\"value\": ...}. " +
          `The value must be ${FIELD_SPECS[field]}. Do not repeat the other fields.`,
      },
      {
        role: "user",
        content: JSON.stringify({
          topic,
          platform,
          style,
          length,
          field,
          current_pack: pack,
        }),
      },
    ],
  };
}

function aiText(out) {
  if (!out) return "";
  if (typeof out === "string") return out;
  if (typeof out.response === "string") return out.response;
  return (((out.choices || [])[0] || {}).message || {}).content || "";
}

async function agnesOnce(env, payload) {
  const key = env.AGNES_API_KEY;
  if (!key) throw new Error("AGNES_API_KEY is missing");
  const base = (env.AGNES_BASE_URL || "https://apihub.agnes-ai.com/v1").replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(14000),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Agnes HTTP ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  const content = (((body.choices || [])[0] || {}).message || {}).content || "";
  if (!String(content).trim()) throw new Error("Agnes returned an empty response");
  return String(content);
}

async function workersAiOnce(env, payload) {
  if (!env.AI) throw new Error("Workers AI unavailable");
  const models = ["@cf/meta/llama-3.1-8b-instruct", "@cf/meta/llama-3.3-70b-instruct-fp8-fast"];
  let lastError = new Error("Workers AI failed");
  for (const model of models) {
    try {
      const out = await env.AI.run(model, {
        messages: payload.messages,
        max_tokens: Math.min(payload.max_tokens || 1800, 1800),
        temperature: payload.temperature || 0.7,
      });
      const content = aiText(out);
      if (String(content).trim()) return String(content);
      lastError = new Error("Workers AI empty");
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function completeText(env, payload) {
  try {
    return { text: await agnesOnce(env, payload), writer: "agnes" };
  } catch (agnesErr) {
    try {
      return { text: await workersAiOnce(env, payload), writer: "backup" };
    } catch {
      throw agnesErr;
    }
  }
}

function readBrief(data) {
  const topic = String(data.topic || "").trim();
  const platform = String(data.platform || "YouTube Shorts").trim();
  const style = String(data.style || "explainer").trim();
  const length = String(data.length || "30-45 seconds").trim();
  if (!topic) return { error: json({ error: "Enter a topic first" }, 400) };
  if (topic.length > 500) return { error: json({ error: "Topic is too long" }, 400) };
  return { topic, platform, style, length };
}

async function handleGenerate(request, env) {
  const data = await request.json().catch(() => null);
  if (!data) return json({ error: "Invalid JSON" }, 400);
  const brief = readBrief(data);
  if (brief.error) return brief.error;
  const ip = clientIp(request);
  const leftBefore = await remaining(ip);
  if (leftBefore <= 0) {
    return json(
      { error: `Free limit reached: ${FREE_LIMIT} generations per day. Come back tomorrow.`, remaining: 0 },
      429
    );
  }
  const payload = packPayload(env, brief.topic, brief.platform, brief.style, brief.length);
  let pack;
  let writer = "draft";
  try {
    const out = await completeText(env, payload);
    pack = normalizePack(extractJson(out.text));
    writer = out.writer;
  } catch {
    pack = draftPack(brief.topic, brief.platform, brief.style, brief.length);
  }
  const quota = await consume(ip);
  return json({ ...pack, remaining: quota.left, limit: FREE_LIMIT, writer });
}

async function handleRegenerate(request, env) {
  const data = await request.json().catch(() => null);
  if (!data) return json({ error: "Invalid JSON" }, 400);
  const brief = readBrief(data);
  if (brief.error) return brief.error;
  const field = String(data.field || "").trim();
  if (!FIELD_SPECS[field]) return json({ error: "Unknown field" }, 400);
  const ip = clientIp(request);
  const leftBefore = await remaining(ip);
  if (leftBefore <= 0) {
    return json(
      { error: `Free limit reached: ${FREE_LIMIT} generations per day. Come back tomorrow.`, remaining: 0 },
      429
    );
  }
  const pack = data.pack && typeof data.pack === "object" ? data.pack : {};
  const payload = regenPayload(env, field, brief.topic, brief.platform, brief.style, brief.length, pack);
  let value;
  let writer = "draft";
  try {
    const out = await completeText(env, payload);
    const parsed = extractJson(out.text);
    value = parsed.value ?? parsed[field];
    if (value == null) throw new Error("Could not regenerate that field");
    writer = out.writer;
  } catch {
    value = draftField(field, brief.topic, brief.platform, brief.style, brief.length);
  }
  const quota = await consume(ip);
  return json({ field, value, remaining: quota.left, writer });
}

async function proxyGoogleTag(request, url) {
  if (url.pathname === "/gtag/js") {
    const res = await fetch("https://www.googletagmanager.com/gtag/js" + url.search);
    return new Response(res.body, {
      status: res.status,
      headers: {
        "Content-Type": "application/javascript; charset=UTF-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }
  if (url.pathname === "/g/collect" || url.pathname === "/j/collect") {
    const dest = "https://www.google-analytics.com" + url.pathname + url.search;
    const headers = new Headers();
    const contentType = request.headers.get("Content-Type");
    if (contentType) headers.set("Content-Type", contentType);
    headers.set("User-Agent", request.headers.get("User-Agent") || "Mozilla/5.0");
    const init = { method: request.method, headers };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.arrayBuffer();
    }
    const res = await fetch(dest, init);
    return new Response(null, { status: res.status, headers: { "Cache-Control": "no-store" } });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const proxied = await proxyGoogleTag(request, url);
    if (proxied) return proxied;
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }
    if (url.pathname === "/api/generate") {
      if (request.method === "GET") {
        const left = await remaining(clientIp(request));
        return json({ remaining: left, limit: FREE_LIMIT });
      }
      if (request.method === "POST") return handleGenerate(request, env);
    }
    if (request.method === "POST" && url.pathname === "/api/regenerate") {
      return handleRegenerate(request, env);
    }
    if (env.ASSETS) {
      const path = url.pathname.replace(/\/$/, "") || "/";
      const id = (url.searchParams.get("id") || "").replace(/[^a-z0-9-]/gi, "");
      if (id && (path === "/article" || path === "/article.html")) {
        const page = await env.ASSETS.fetch(new URL(`/use/${id}.html`, url.origin));
        if (page.ok) return page;
      }
      if (id && (path === "/guide" || path === "/guide.html")) {
        const page = await env.ASSETS.fetch(new URL(`/guides/${id}.html`, url.origin));
        if (page.ok) return page;
      }
      return env.ASSETS.fetch(request);
    }
    return new Response("Not found", { status: 404 });
  },
};
