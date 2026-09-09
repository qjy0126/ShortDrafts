(function loadAnalytics() {
  if (window.__sdAnalytics) return;
  window.__sdAnalytics = true;
  const src = document.currentScript && document.currentScript.src;
  const s = document.createElement("script");
  s.src = (src ? new URL("firebase-analytics.js", src).href : "/assets/firebase-analytics.js") + "?v=2";
  s.async = true;
  document.head.appendChild(s);
})();

document.getElementById("year") && (document.getElementById("year").textContent = new Date().getFullYear());

const menuBtn = document.getElementById("menu-btn");
const navLinks = document.getElementById("nav-links");
menuBtn.addEventListener("click", () => {
  navLinks.classList.toggle("is-open");
});

function bindChips(id) {
  const root = document.getElementById(id);
  root.addEventListener("click", (e) => {
    const btn = e.target.closest(".chip");
    if (!btn || btn.disabled) return;
    root.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-on"));
    btn.classList.add("is-on");
  });
}

bindChips("platform-chips");
bindChips("style-chips");
bindChips("length-chips");

function selected(id) {
  return document.querySelector(`#${id} .chip.is-on`).dataset.value;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function apiUrls(path) {
  return [path];
}

async function postJson(path, body) {
  let lastError = new Error("Failed to fetch");
  for (const url of apiUrls(path)) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));
      return { response, data };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

const CARDS = [
  { key: "ideas", num: "01", label: "Idea" },
  { key: "hooks", num: "02", label: "Hooks" },
  { key: "script", num: "03", label: "Script" },
  { key: "titles", num: "04", label: "Titles" },
  { key: "caption", num: "05", label: "Caption" },
  { key: "onscreen_text", num: "06", label: "On-screen text" },
];

const form = document.getElementById("gen-form");
const thinking = document.getElementById("thinking");
const thinkingText = document.getElementById("thinking-text");
const result = document.getElementById("result");
const genBtn = document.getElementById("gen-btn");
const quota = document.getElementById("quota");

let lastPack = emptyPack();
let lastBrief = {};
let generating = false;
const STATE_KEY = "aishorts-gen-v1";

function persist() {
  try {
    sessionStorage.setItem(
      STATE_KEY,
      JSON.stringify({
        topic: document.getElementById("topic").value,
        platform: selected("platform-chips"),
        style: selected("style-chips"),
        length: selected("length-chips"),
        pack: lastPack,
      })
    );
  } catch (_) {
    /* ignore */
  }
}

function setChip(id, value) {
  const root = document.getElementById(id);
  if (!root || !value) return;
  root.querySelectorAll(".chip").forEach((chip) => {
    chip.classList.toggle("is-on", chip.dataset.value === value);
  });
}

function packHasContent(pack) {
  if (!pack) return false;
  return CARDS.some((card) => {
    const value = pack[card.key];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

function restore() {
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return;
    const state = JSON.parse(raw);
    const topicBox = document.getElementById("topic");
    if (state.topic) topicBox.value = state.topic;
    setChip("platform-chips", state.platform);
    setChip("style-chips", state.style);
    setChip("length-chips", state.length);
    if (packHasContent(state.pack)) {
      lastPack = { ...emptyPack(), ...state.pack };
      ensureCards();
      applyPack(lastPack);
    }
  } catch (_) {
    /* ignore */
  }
}

function emptyPack() {
  return {
    ideas: [],
    hooks: [],
    script: "",
    titles: [],
    caption: "",
    cta: "",
    onscreen_text: [],
  };
}

function brief() {
  return {
    topic: document.getElementById("topic").value.trim(),
    platform: selected("platform-chips"),
    style: selected("style-chips"),
    length: selected("length-chips"),
  };
}

function setBusy(on) {
  genBtn.classList.toggle("is-busy", on);
  genBtn.disabled = on;
}

function setQuota(remaining, limit = 10) {
  if (remaining == null) return;
  quota.textContent = `Free: ${remaining} of ${limit} content packs left today. No login.`;
}

function asLines(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join("\n");
  return String(value || "");
}

function fieldText(key, pack) {
  if (key === "caption") {
    const bits = [pack.caption, pack.cta ? `CTA: ${pack.cta}` : ""].filter(Boolean);
    return bits.join("\n\n");
  }
  return asLines(pack[key]);
}

function renderBody(key, pack, pending) {
  if (pending) {
    return `
      <div class="pack-loading">
        <p class="pack-cta"><span class="spinner"></span>Writing this block…</p>
        <div class="skeleton" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
      </div>`;
  }
  if (key === "script" || key === "caption") {
    const extra =
      key === "caption" && pack.cta
        ? `<p class="pack-cta"><strong>CTA:</strong> ${escapeHtml(pack.cta)}</p>`
        : "";
    return `<div>${escapeHtml(pack[key] || pack.caption || "")}</div>${extra}`;
  }
  const items = pack[key] || [];
  if (!items.length) return `<p class="pack-cta">—</p>`;
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function ensureCards() {
  result.classList.add("is-open");
  result.classList.remove("is-error");
  if (result.querySelector(".pack-list")) return;
  result.innerHTML = `<div class="pack-list">${CARDS.map(
    (card) => `
    <article class="pack-card is-pending" data-field="${card.key}">
      <div class="pack-head">
        <div class="pack-title"><b>${card.num}</b><h3>${card.label}</h3></div>
        <div class="pack-actions">
          <button type="button" data-act="copy">Copy</button>
          <button type="button" data-act="edit">Edit</button>
          <button type="button" data-act="regen">Regenerate</button>
        </div>
      </div>
      <div class="pack-body" data-body>${renderBody(card.key, lastPack, true)}</div>
    </article>`
  ).join("")}</div>`;
}

function paintField(key, pack, pending = false) {
  const card = result.querySelector(`[data-field="${key}"]`);
  if (!card) return;
  card.classList.toggle("is-pending", pending);
  const body = card.querySelector("[data-body]");
  if (card.classList.contains("is-editing")) return;
  body.innerHTML = renderBody(key, pack, pending);
}

function applyPack(pack) {
  const incoming = pack && typeof pack === "object" ? pack : {};
  const next = { ...emptyPack(), ...lastPack };
  const skip = new Set(["remaining", "limit", "error", "writer"]);
  for (const [key, value] of Object.entries(incoming)) {
    if (skip.has(key) || value == null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    if (value === "") continue;
    next[key] = value;
  }
  lastPack = next;
  CARDS.forEach((card) => {
    const value = lastPack[card.key];
    const filled = Array.isArray(value) ? value.length > 0 : Boolean(value);
    if (filled) paintField(card.key, lastPack, false);
  });
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

result.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const card = btn.closest(".pack-card");
  const key = card.dataset.field;
  const body = card.querySelector("[data-body]");
  const act = btn.dataset.act;

  if (act === "copy") {
    const ok = await copyText(fieldText(key, lastPack));
    btn.textContent = ok ? "Copied" : "Copy failed";
    window.setTimeout(() => {
      btn.textContent = "Copy";
    }, 1200);
    return;
  }

  if (act === "edit") {
    const editing = card.classList.toggle("is-editing");
    btn.classList.toggle("is-on", editing);
    btn.textContent = editing ? "Save" : "Edit";
    body.contentEditable = editing ? "true" : "false";
    if (editing) {
      body.innerText = fieldText(key, lastPack);
      body.focus();
      return;
    }
    const text = body.innerText.trim();
    if (["ideas", "hooks", "titles", "onscreen_text"].includes(key)) {
      lastPack[key] = text.split("\n").map((line) => line.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean);
    } else if (key === "caption") {
      const parts = text.split(/\nCTA:\s*/i);
      lastPack.caption = (parts[0] || "").trim();
      if (parts[1]) lastPack.cta = parts[1].trim();
    } else {
      lastPack[key] = text;
    }
    paintField(key, lastPack, false);
    return;
  }

  if (act === "regen") {
    btn.disabled = true;
    btn.textContent = "…";
    paintField(key, lastPack, true);
    try {
      const { response, data } = await postJson("/api/regenerate", {
        ...lastBrief,
        field: key,
        pack: lastPack,
      });
      if (!response.ok) throw new Error(data.error || "Regenerate failed");
      lastPack[key] = data.value;
      if (key === "caption" && typeof data.value === "object") {
        lastPack.caption = data.value.caption || lastPack.caption;
        lastPack.cta = data.value.cta || lastPack.cta;
      }
      setQuota(data.remaining);
      paintField(key, lastPack, false);
    } catch (err) {
      body.innerHTML = `<p class="pack-cta">${escapeHtml(err.message)}</p>`;
    } finally {
      btn.disabled = false;
      btn.textContent = "Regenerate";
      card.classList.remove("is-pending");
    }
  }
});

async function readSSE(response, onEvent) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const emit = (chunk) => {
    const line = chunk.split("\n").find((row) => row.startsWith("data:"));
    if (!line) return;
    try {
      onEvent(JSON.parse(line.slice(5).trim()));
    } catch {
      /* skip a torn SSE chunk */
    }
  };
  while (true) {
    const { value, done } = await reader.read();
    if (value) buf += decoder.decode(value, { stream: !done });
    const chunks = buf.split("\n\n");
    buf = chunks.pop() || "";
    chunks.forEach(emit);
    if (done) {
      if (buf.trim()) emit(buf);
      break;
    }
  }
}

function stopPending(message) {
  result.querySelectorAll(".pack-card.is-pending").forEach((card) => {
    card.classList.remove("is-pending");
    const body = card.querySelector("[data-body]");
    if (body && !card.classList.contains("is-editing")) {
      body.innerHTML = `<p class="pack-cta">${escapeHtml(message)}</p>`;
    }
  });
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  e.stopPropagation();
  return false;
});
document.getElementById("topic").addEventListener("input", persist);
window.addEventListener("beforeunload", persist);
genBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();
  runGenerate();
});

async function runGenerate() {
  if (generating || genBtn.disabled) return;
  generating = true;
  const topicBox = document.getElementById("topic");
  lastBrief = brief();
  if (!lastBrief.topic) lastBrief.topic = (topicBox.value || "").trim();
  topicBox.classList.remove("is-need");
  persist();
  if (!lastBrief.topic) {
    generating = false;
    topicBox.classList.add("is-need");
    topicBox.focus();
    result.classList.add("is-open", "is-error");
    result.innerHTML = `<p>Enter a topic or idea first, then click Generate.</p>`;
    return;
  }
  lastPack = emptyPack();
  result.classList.remove("is-error");
  result.innerHTML = "";
  thinking.hidden = false;
  thinking.classList.add("is-on");
  thinkingText.textContent = "Writing your pack…";
  setBusy(true);
  ensureCards();
  persist();

  try {
    const { response, data } = await postJson("/api/generate", lastBrief);
    if (data.remaining != null) setQuota(data.remaining, data.limit);
    if (!response.ok) {
      const quotaMsg =
        response.status === 429
          ? "Today’s 10 free packs are used up. Come back tomorrow."
          : response.status === 404
            ? "The public site is missing the generate API. Redeploy the Worker with worker.js."
            : data.error || "Generation failed";
      throw new Error(quotaMsg);
    }
    applyPack(data);
    if (data.writer === "draft") {
      result.insertAdjacentHTML(
        "afterbegin",
        `<p>Backup draft while the main writer was busy. Copy, edit, and post.</p>`
      );
    }
    CARDS.forEach((card) => paintField(card.key, lastPack, false));
  } catch (err) {
    result.classList.add("is-error");
    const message =
      err.message === "Failed to fetch"
        ? "Cannot reach the generator. Refresh, or open this page after the API worker is deployed."
        : err.message;
    if (!result.querySelector(".pack-list")) {
      result.innerHTML = `<p>${escapeHtml(message)}</p>`;
    } else {
      result.insertAdjacentHTML("afterbegin", `<p>${escapeHtml(message)}</p>`);
      stopPending("Stopped");
    }
    result.classList.add("is-open");
  } finally {
    generating = false;
    thinking.classList.remove("is-on");
    thinking.hidden = true;
    setBusy(false);
    result.classList.add("is-open");
    persist();
  }
}

function applyQueryChips() {
  const params = new URLSearchParams(window.location.search);
  const platformRaw = (params.get("platform") || "").trim().toLowerCase();
  const styleRaw = (params.get("style") || "").trim().toLowerCase();
  const lengthRaw = (params.get("length") || "").trim().toLowerCase();
  const platforms = {
    shorts: "YouTube Shorts",
    "youtube shorts": "YouTube Shorts",
    youtube: "YouTube Shorts",
    tiktok: "TikTok",
    reels: "Reels",
    "instagram reels": "Reels",
  };
  const styles = {
    explainer: "explainer",
    funny: "funny",
    story: "story",
    listicle: "listicle",
    faceless: "faceless",
  };
  const lengths = {
    "15-30": "15-30 seconds",
    "15-30 seconds": "15-30 seconds",
    "30-45": "30-45 seconds",
    "30-45 seconds": "30-45 seconds",
    "45-60": "45-60 seconds",
    "45-60 seconds": "45-60 seconds",
  };
  if (platforms[platformRaw]) setChip("platform-chips", platforms[platformRaw]);
  if (styles[styleRaw]) setChip("style-chips", styles[styleRaw]);
  if (lengths[lengthRaw]) setChip("length-chips", lengths[lengthRaw]);
}

restore();
applyQueryChips();
