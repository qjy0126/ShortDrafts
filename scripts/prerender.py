#!/usr/bin/env python3
"""Enrich article JSON with citations and write crawler-visible HTML pages."""

from __future__ import annotations

import html
import json
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
USE_PATH = ROOT / "assets" / "use-cases.json"
FAQ_PATH = ROOT / "assets" / "faq-articles.json"
USE_DIR = ROOT / "use"
GUIDE_DIR = ROOT / "guides"

YOUTUBE_SHORTS = {
    "quote": "YouTube Shorts is a way for anyone to connect with a new audience using just a smartphone and the Shorts camera in the YouTube app. YouTube’s Shorts creation tools makes it easy to create short-form videos that are up to 3 minutes long with our multi-segment camera.",
    "attribution": "YouTube Help, Get started creating YouTube Shorts",
    "url": "https://support.google.com/youtube/answer/10059070",
}
YOUTUBE_TITLE = {
    "quote": "From this screen, add a title (max 100 characters), and choose settings, like video privacy.",
    "attribution": "YouTube Help, Get started creating YouTube Shorts",
    "url": "https://support.google.com/youtube/answer/10059070",
}
YOUTUBE_HOOK = {
    "quote": "Get feedback: Tap the Get feedback button to get an analysis of your video's hook, pacing, and more.",
    "attribution": "YouTube Help, Get started creating YouTube Shorts",
    "url": "https://support.google.com/youtube/answer/10059070",
}
YOUTUBE_VIEWS = {
    "quote": "Views will count the number of times a Short starts to play or replay, with no minimum watch time requirement.",
    "attribution": "YouTube Help, Get started creating YouTube Shorts",
    "url": "https://support.google.com/youtube/answer/10059070",
}
YOUTUBE_THREE = {
    "quote": "You can now create YouTube Shorts up to three minutes in length. This gives you more time to tell your stories, showcase your creativity, and captivate your audience.",
    "attribution": "YouTube Help, Understand three-minute YouTube Shorts",
    "url": "https://support.google.com/youtube/answer/15424877",
}
TIKTOK_CAPTIONS = {
    "quote": "Auto-generated captions use speech recognition technology to generate text for audio or video content. Captions will be automatically generated for videos that you upload. This can help people who are deaf or hard of hearing to access content on TikTok.",
    "attribution": "TikTok Support, Accessibility for your videos",
    "url": "https://support.tiktok.com/en/using-tiktok/creating-videos/accessibility",
}
FTC_ADS = {
    "quote": "If there is a connection between an endorser and the seller that consumers would not expect, that connection should be disclosed clearly and conspicuously.",
    "attribution": "U.S. Federal Trade Commission, Endorsement Guides",
    "url": "https://www.ftc.gov/business-guidance/resources/ftcs-endorsement-guides-what-people-are-asking",
}

SOURCES = {
    "faceless": [YOUTUBE_SHORTS],
    "story": [YOUTUBE_THREE, YOUTUBE_HOOK],
    "education": [YOUTUBE_SHORTS, YOUTUBE_HOOK],
    "product": [FTC_ADS, YOUTUBE_TITLE],
    "podcast": [YOUTUBE_THREE],
    "platforms": [YOUTUBE_TITLE, TIKTOK_CAPTIONS],
    "faceless-note-20260908": [YOUTUBE_SHORTS],
    "what-is-pack": [YOUTUBE_SHORTS],
    "not-a-finished-video": [YOUTUBE_SHORTS],
    "faceless-scripts": [YOUTUBE_SHORTS, TIKTOK_CAPTIONS],
    "free-daily": [YOUTUBE_VIEWS],
    "hooks": [YOUTUBE_HOOK],
    "how-to-use": [YOUTUBE_SHORTS, YOUTUBE_TITLE],
}

# Guide id "platforms" collides with use-case id; sources dict is per-file.
GUIDE_SOURCES = {
    "platforms": [YOUTUBE_TITLE, TIKTOK_CAPTIONS],
}

DEPTH_HEADING = "What the platforms actually say"

DEPTH = {
    "faceless": [
        "YouTube’s own help pages treat Shorts as something you record or upload from a phone, then title, then publish. The writing still has to exist before that camera roll. A faceless pack is the spoken and on-screen layer so you are not inventing lines while the ring light is already on.",
        "Keep the script shorter than the platform maximum. Three minutes is allowed on Shorts; a faceless niche clip usually dies if the voiceover wanders. One claim, one proof, one recap is enough for a day of posting.",
    ],
    "story": [
        "YouTube now allows Shorts up to three minutes, which tempts people to write a cold open that takes twenty seconds. That extra room is for a turn and a landing, not a greeting. If the story can be told in 30 seconds, leave the rest unshot.",
        "YouTube even offers in-app feedback on hook and pacing. Use that after you shoot, not as a reason to skip writing the first line. The pack’s five hooks exist so you can pick one claim before you open the camera.",
    ],
    "education": [
        "An explainer Short is still a phone video. YouTube describes Shorts as short-form clips you record or upload, then title in 100 characters or less. The lesson has to fit that container: one outcome, one proof, one recap.",
        "If you need a syllabus, record a long video. If you need a 30-second correction a nurse or intern can use before the clip ends, stay in the pack length you picked. Padding a one-move lesson to three minutes usually adds throat-clearing, not proof.",
    ],
    "product": [
        "A promo pack is advertising copy. If you were paid, given the product, or related to the brand, U.S. endorsement rules expect that connection to be obvious in the clip or caption. ShortDrafts will not write a fake “not a paid ad” line to hide a deal.",
        "YouTube still wants a title of at most 100 characters when you upload a Short. Use one of the pack titles; do not paste a paragraph into that field. Show the product in the first seconds if the script names it.",
    ],
    "podcast": [
        "A feed clip is not the episode. YouTube’s longer Shorts limit is useful when a take needs a second of air, not when you try to recap a 40-minute interview. Paste the one paragraph that is the clip, then let the pack write a standalone 15–30 second script.",
        "Do not invent a guest quote. If the original line is messy, the Short can be cleaner without becoming a different claim.",
    ],
    "platforms": [
        "YouTube asks for a Short title of up to 100 characters. TikTok can auto-generate captions from speech so deaf and hard-of-hearing viewers can follow the clip. Those are different jobs. One spoken script can travel; the title, caption, and on-screen lines should be retuned per app.",
        "Generate once for the app you will post first. If you upload the same cut elsewhere, run the pack again with that platform selected instead of pasting the same caption three times.",
    ],
    "faceless-note-20260908": [
        "A faceless brief should name what the viewer will see if you are not on camera: hands, a product, a screen, B-roll you already have rights to. YouTube still expects you to record or upload a Short and add a title. The generator only writes the words for that upload.",
        "Keep ‘no face’ as a constraint in the topic box. Vague prompts like ‘faceless empire’ produce generic hooks. Concrete niches produce scripts you can batch.",
    ],
    "what-is-pack": [
        "YouTube’s help center describes Shorts as short-form videos you create on a phone, then title and upload. ShortDrafts sits one step before that: the ideas, hooks, spoken script, titles, and captions. There is no MP4 at the end of a generate run, because the shoot is still yours.",
        "If a tool promises a finished clip from one prompt, that is a different product. This one is the writing layer so you can open the YouTube, TikTok, or Reels camera with a script in hand.",
    ],
    "not-a-finished-video": [
        "Creating a Short, in YouTube’s own wording, means recording or uploading a vertical clip, then adding a title and publishing. ShortDrafts does not do those last steps. It writes the spoken and on-screen copy you take into that flow.",
        "Use an editor or a voice tool after you copy the pack. Do not wait here for an export button. There is not one.",
    ],
    "faceless-scripts": [
        "Faceless still means a real clip: voice plus picture. YouTube Shorts are uploaded videos; TikTok can auto-caption speech so the words stay readable if the sound is off. Write the voiceover first, then lay picture, then check captions against the script so they match what you said.",
        "The pack will not license B-roll or clone a voice. Bring footage and a mic you already have.",
    ],
    "free-daily": [
        "The 10-pack cap is a hosting limit on this site, not a YouTube rule. YouTube counts Shorts views when a clip starts to play or replay, with no minimum watch time. That metric is about their feed, not about how many drafts you generate here.",
        "If you hit the daily wall, wait until tomorrow. Email contact@shortdrafts.com only if a run failed and the count looks wrong.",
    ],
    "hooks": [
        "YouTube now lets creators request in-app feedback on a Short’s hook and pacing after they record. That is a post-shoot check. The pack still leads with several hook lines so you choose a cold open before the camera rolls.",
        "A greeting wastes the first three seconds. Open on a claim, a tension, or a picture. If a hook oversells the script, throw the hook away and keep the rest.",
    ],
    "how-to-use": [
        "YouTube’s create flow is record or upload, then add a title of up to 100 characters, then publish. ShortDrafts fills the writing you need before that flow: topic, platform, style, length, then a pack you can speak and paste.",
        "Pick one idea and one hook. Shoot or voice it in the app you actually post to. Come back only for a second angle or a caption retune.",
    ],
}

NAV = """      <a href="{p}index.html">Home</a>
        <a href="{p}generate.html">Write</a>
        <a href="{p}faq.html">FAQ</a>
        <a href="{p}about.html">About</a>
        <a href="{p}privacy.html">Privacy</a>
        <a href="{p}contact.html">Contact</a>"""


def esc(value: str) -> str:
    return html.escape(str(value or ""), quote=True)


def parse_published(value: str) -> str:
    text = (value or "").strip()
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return date.today().isoformat()


def enrich_item(item: dict, sources: list[dict]) -> None:
    if sources and not item.get("sources"):
        item["sources"] = sources
    paragraphs = DEPTH.get(item.get("id") or "")
    if not paragraphs:
        return
    existing = {str(section.get("heading") or "") for section in item.get("sections") or []}
    if DEPTH_HEADING in existing:
        return
    item.setdefault("sections", []).append({"heading": DEPTH_HEADING, "paragraphs": paragraphs})


def render_sections(item: dict) -> str:
    chunks: list[str] = []
    for section in item.get("sections") or []:
        if section.get("heading"):
            chunks.append(f"        <h2>{esc(section['heading'])}</h2>")
        for paragraph in section.get("paragraphs") or []:
            chunks.append(f"        <p>{esc(paragraph)}</p>")
        bullets = section.get("bullets") or []
        if bullets:
            items = "".join(f"<li>{esc(bullet)}</li>" for bullet in bullets)
            chunks.append(f"        <ul>{items}</ul>")
    sources = item.get("sources") or []
    if sources:
        chunks.append("        <h2>Sources</h2>")
        for source in sources:
            chunks.append(
                "        <blockquote cite=\""
                + esc(source["url"])
                + "\">\n          <p>"
                + esc(source["quote"])
                + "</p>\n          <footer>— <cite><a href=\""
                + esc(source["url"])
                + "\" rel=\"noopener noreferrer\">"
                + esc(source["attribution"])
                + "</a></cite></footer>\n        </blockquote>"
            )
    return "\n".join(chunks)


def page_html(item: dict, *, kind: str, prefix: str) -> str:
    back = f"{prefix}index.html#use-cases" if kind == "article" else f"{prefix}faq.html"
    back_label = "← Use cases" if kind == "article" else "← All guides"
    image = item.get("image") or ""
    if image and not image.startswith(("http://", "https://", "../", "/")):
        image_src = prefix + image
    else:
        image_src = image
    canonical_path = f"use/{item['id']}.html" if kind == "article" else f"guides/{item['id']}.html"
    published_iso = parse_published(str(item.get("published") or ""))
    nav = NAV.format(p=prefix)
    json_ld = {
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": item.get("title"),
        "description": item.get("excerpt"),
        "datePublished": published_iso,
        "author": {"@type": "Person", "name": item.get("author") or "ShortDrafts Editors"},
        "publisher": {
            "@type": "Organization",
            "name": "ShortDrafts",
            "url": "https://shortdrafts.com/",
        },
        "mainEntityOfPage": f"https://shortdrafts.com/{canonical_path}",
        "citation": [source["url"] for source in item.get("sources") or []],
    }
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{esc(item.get("title"))} — ShortDrafts</title>
  <meta name="description" content="{esc(item.get("excerpt"))}">
  <meta name="author" content="{esc(item.get("author") or "ShortDrafts Editors")}">
  <link rel="canonical" href="https://shortdrafts.com/{esc(canonical_path)}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap" rel="stylesheet">
  <link rel="icon" href="{prefix}favicon.ico">
  <link rel="icon" type="image/png" sizes="32x32" href="{prefix}assets/favicon-32.png?v=10">
  <link rel="icon" type="image/png" sizes="16x16" href="{prefix}assets/favicon-16.png?v=10">
  <link rel="apple-touch-icon" href="{prefix}assets/apple-touch-icon.png?v=10">
  <link rel="stylesheet" href="{prefix}assets/styles.css?v=32">
  <script type="application/ld+json">{json.dumps(json_ld, ensure_ascii=False)}</script>
</head>
<body>
  <a class="skip" href="#main">Skip to content</a>
  <header class="nav">
    <div class="nav-inner">
      <a class="brand" href="{prefix}index.html">
        <img src="{prefix}assets/images/logo.png?v=9" width="1200" height="316" alt="ShortDrafts">
      </a>
      <nav class="nav-links" id="nav-links" aria-label="Primary">
{nav}
      </nav>
      <a class="nav-cta" href="{prefix}generate.html">Generate for Free</a>
      <button class="menu-btn" type="button" id="menu-btn" aria-label="Open menu">Menu</button>
    </div>
  </header>
  <main id="main">
    <article class="guide-article">
      <a class="page-back" href="{esc(back)}">{back_label}</a>
      <p class="guide-kicker">{esc(item.get("category"))}</p>
      <h1>{esc(item.get("title"))}</h1>
      <p class="guide-dek">{esc(item.get("excerpt"))}</p>
      <p class="guide-byline">By <b>{esc(item.get("author"))}</b> · Published {esc(item.get("published"))}</p>
      <img class="guide-hero" src="{esc(image_src)}" width="1200" height="675" alt="{esc(item.get("alt"))}">
{render_sections(item)}
      <a class="btn btn-primary guide-cta" href="{prefix}generate.html">Generate for Free →</a>
    </article>
  </main>
  <footer>
    <div class="wrap footer-inner">
      <div class="footer-brand">
        <img src="{prefix}assets/images/logo.png?v=9" width="1200" height="316" alt="ShortDrafts">
        <p>© <span id="year"></span> ShortDrafts</p>
        <p class="footer-legal"><a href="{prefix}terms.html">Terms</a></p>
      </div>
      <nav class="footer-nav" aria-label="Footer">{nav}
      </nav>
    </div>
  </footer>
  <script src="{prefix}assets/site.js?v=4"></script>
</body>
</html>
"""


def write_json(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def prerender() -> None:
    uses = json.loads(USE_PATH.read_text(encoding="utf-8"))
    for item in uses.get("articles") or []:
        enrich_item(item, SOURCES.get(item.get("id") or "", []))
    write_json(USE_PATH, uses)

    faq = json.loads(FAQ_PATH.read_text(encoding="utf-8"))
    for item in faq.get("guides") or []:
        guide_id = item.get("id") or ""
        sources = GUIDE_SOURCES.get(guide_id) or SOURCES.get(guide_id, [])
        enrich_item(item, sources)
    write_json(FAQ_PATH, faq)

    USE_DIR.mkdir(exist_ok=True)
    GUIDE_DIR.mkdir(exist_ok=True)
    for item in uses.get("articles") or []:
        (USE_DIR / f"{item['id']}.html").write_text(page_html(item, kind="article", prefix="../"), encoding="utf-8")
    for item in faq.get("guides") or []:
        (GUIDE_DIR / f"{item['id']}.html").write_text(page_html(item, kind="guide", prefix="../"), encoding="utf-8")
    print(f"wrote {len(uses.get('articles') or [])} use pages and {len(faq.get('guides') or [])} guide pages")


if __name__ == "__main__":
    prerender()
