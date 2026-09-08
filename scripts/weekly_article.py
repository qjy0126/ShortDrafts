#!/usr/bin/env python3
"""Publish one FAQ guide for the next homepage use-case lane."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FAQ_PATH = ROOT / "assets" / "faq-articles.json"
FAQ_JS = ROOT / "assets" / "faq.js"

LANES = [
    {
        "slug": "faceless",
        "name": "Faceless channels",
        "image": "assets/images/guide-faceless.jpg",
        "alt": "Hands filming a product, no face on camera",
        "brief": "Batch ideas, hooks, and voiceover scripts for a niche you can post every day without putting your face on camera.",
    },
    {
        "slug": "story",
        "name": "Story and listicle Shorts",
        "image": "assets/images/guide-howto.jpg",
        "alt": "A marked-up short-form script on a desk",
        "brief": "Reddit-style stories, ranked lists, and fun-fact scripts with a hard open in the first three seconds.",
    },
    {
        "slug": "education",
        "name": "Educational explainers",
        "image": "assets/images/guide-pack.jpg",
        "alt": "A marked-up script on a wooden desk",
        "brief": "Turn one concept into a 30-second lesson with a hook, proof, and recap.",
    },
    {
        "slug": "product",
        "name": "Product and promo",
        "image": "assets/images/guide-camera.jpg",
        "alt": "A camera on a tripod waiting to shoot",
        "brief": "Paste a brief and get a short ad script, titles, and caption variants.",
    },
    {
        "slug": "podcast",
        "name": "Podcast clip scripts",
        "image": "assets/images/guide-hooks.jpg",
        "alt": "Notes for a short spoken hook",
        "brief": "Turn a long idea into a tight 20-second cut-down you can film or voice.",
    },
    {
        "slug": "platforms",
        "name": "Multi-platform captions",
        "image": "assets/images/guide-platforms.jpg",
        "alt": "Phones showing Shorts, TikTok, and Reels",
        "brief": "One script, then titles and hashtags tuned for Shorts, TikTok, and Reels.",
    },
]

ANGLES = [
    "how to brief the generator for this lane",
    "hooks that work in the first three seconds",
    "what to keep after you generate, and what to throw away",
    "a weekly posting habit using one pack a day",
]


def load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ[key.strip()] = value.strip().strip('"').strip("'")


def published_label(today: date) -> str:
    return f"{today.strftime('%b')} {today.day}, {today.year}"


def extract_json(text: str) -> dict:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fenced:
        text = fenced.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("No JSON object in model output")
    return json.loads(text[start : end + 1])


def agnes_guide(lane: dict, angle: str, guide_id: str, published: str) -> dict | None:
    key = os.environ.get("AGNES_API_KEY", "")
    if not key:
        return None
    base = os.environ.get("AGNES_BASE_URL", "https://apihub.agnes-ai.com/v1").rstrip("/")
    model = os.environ.get("AGNES_MODEL", "agnes-2.5-flash")
    payload = {
        "model": model,
        "temperature": 0.5,
        "max_tokens": 1200,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You write FAQ guides for ShortDrafts, a short-form writing tool. "
                    "It returns ideas, hooks, a timed script, titles, a caption, a CTA, and on-screen text. "
                    "It does not render video, clone voices, or promise virality. English only. "
                    "Return ONLY a JSON object."
                ),
            },
            {
                "role": "user",
                "content": (
                    f"Write one FAQ guide for the homepage lane “{lane['name']}”.\n"
                    f"Lane brief: {lane['brief']}\n"
                    f"This week's angle: {angle}\n"
                    "JSON keys: id, category, title, excerpt, image, alt, published, sections.\n"
                    f"id must be exactly {guide_id}\n"
                    f"published must be exactly {published}\n"
                    f"image must be exactly {lane['image']}\n"
                    f"alt must be exactly {lane['alt']}\n"
                    'category must be "Use case".\n'
                    "title under 70 characters. excerpt one sentence.\n"
                    "sections: exactly 3 objects, each with heading, paragraphs (1-2 strings), "
                    "and optional bullets (3 strings max).\n"
                    "Mention ShortDrafts once. Link readers to generate.html in plain words, not markdown."
                ),
            },
        ],
    }
    req = urllib.request.Request(
        f"{base}/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None
    content = ((body.get("choices") or [{}])[0].get("message") or {}).get("content") or ""
    try:
        data = extract_json(content)
    except (ValueError, json.JSONDecodeError):
        return None
    data["id"] = guide_id
    data["published"] = published
    data["image"] = lane["image"]
    data["alt"] = lane["alt"]
    data["category"] = "Use case"
    if not data.get("title") or not data.get("excerpt") or not data.get("sections"):
        return None
    return data


def fallback_guide(lane: dict, angle: str, guide_id: str, published: str) -> dict:
    name = lane["name"]
    title_map = {
        "how to brief the generator for this lane": f"How to brief a {name} pack",
        "hooks that work in the first three seconds": f"First-three-second hooks for {name}",
        "what to keep after you generate, and what to throw away": f"What to keep from a {name} pack",
        "a weekly posting habit using one pack a day": f"A week of {name} from one habit",
    }
    title = title_map.get(angle, f"{name} field note")
    return {
        "id": guide_id,
        "category": "Use case",
        "title": title,
        "excerpt": lane["brief"],
        "image": lane["image"],
        "alt": lane["alt"],
        "published": published,
        "sections": [
            {
                "heading": "Stay in this lane",
                "paragraphs": [
                    f"{name} on ShortDrafts is a writing lane, not a finished clip. {lane['brief']}",
                    "Open Write, type one concrete topic, pick the matching style and length, then generate. You still shoot, cut, and post.",
                ],
            },
            {
                "heading": "This week’s angle",
                "paragraphs": [
                    f"Use the pack to work {angle}. One idea and one hook is enough. Do not stack the whole pack into a single take."
                ],
                "bullets": [
                    "Keep the first three seconds as a spoken claim, not a greeting",
                    "Read the script out loud once and cut any line you would not say",
                    "Paste titles and captions after the cut, not before",
                ],
            },
            {
                "heading": "What still has to be yours",
                "paragraphs": [
                    "Footage, voice, music, and the edit. ShortDrafts will not export an MP4 or promise the clip performs. If a claim needs a license or a lab, leave it out of a 30-second script.",
                ],
            },
        ],
    }


def bump_faq_cache() -> None:
    text = FAQ_JS.read_text(encoding="utf-8")
    match = re.search(r"faq-articles\.json\?v=(\d+)", text)
    version = int(match.group(1)) + 1 if match else 6
    if match:
        text = re.sub(r"faq-articles\.json\?v=\d+", f"faq-articles.json?v={version}", text)
    else:
        text = text.replace("faq-articles.json", f"faq-articles.json?v={version}", 1)
    FAQ_JS.write_text(text, encoding="utf-8")


def main() -> None:
    load_env()
    today = datetime.now(timezone.utc).date()
    faq = json.loads(FAQ_PATH.read_text(encoding="utf-8"))
    guides = faq.get("guides") or []
    existing = {str(item.get("id") or "") for item in guides}
    notes = [item for item in guides if re.search(r"-note-\d{8}$", str(item.get("id") or ""))]
    index = len(notes)
    lane = LANES[index % len(LANES)]
    angle = ANGLES[(index // len(LANES)) % len(ANGLES)]
    guide_id = f"{lane['slug']}-note-{today.isoformat().replace('-', '')}"
    if guide_id in existing:
        print(f"skip existing {guide_id}")
        return

    published = published_label(today)
    guide = agnes_guide(lane, angle, guide_id, published) or fallback_guide(
        lane, angle, guide_id, published
    )
    faq["guides"] = [guide] + guides
    FAQ_PATH.write_text(json.dumps(faq, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    bump_faq_cache()
    print(f"published {guide_id} lane={lane['slug']}")


if __name__ == "__main__":
    main()
