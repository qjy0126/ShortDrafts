#!/usr/bin/env python3
"""Write sitemap.xml for Google Search Console."""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
SITE = "https://shortdrafts.com"
SITEMAP = ROOT / "sitemap.xml"
FAQ_PATH = ROOT / "assets" / "faq-articles.json"
USE_PATH = ROOT / "assets" / "use-cases.json"

STATIC_PAGES = [
    ("/", "1.0", "weekly"),
    ("/generate.html", "0.9", "weekly"),
    ("/faq.html", "0.8", "weekly"),
    ("/about.html", "0.6", "monthly"),
    ("/contact.html", "0.6", "monthly"),
    ("/privacy.html", "0.3", "yearly"),
    ("/terms.html", "0.3", "yearly"),
]


def parse_published(value: str) -> str | None:
    text = (value or "").strip()
    for fmt in ("%b %d, %Y", "%B %d, %Y"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return None


def url_block(path: str, lastmod: str, changefreq: str, priority: str) -> str:
    loc = f"{SITE}/" if path == "/" else f"{SITE}{path}"
    return (
        "  <url>\n"
        f"    <loc>{escape(loc)}</loc>\n"
        f"    <lastmod>{lastmod}</lastmod>\n"
        f"    <changefreq>{changefreq}</changefreq>\n"
        f"    <priority>{priority}</priority>\n"
        "  </url>"
    )


def write_sitemap() -> Path:
    today = date.today().isoformat()
    blocks = [url_block(path, today, freq, pri) for path, pri, freq in STATIC_PAGES]

    faq = json.loads(FAQ_PATH.read_text(encoding="utf-8"))
    for guide in faq.get("guides") or []:
        guide_id = str(guide.get("id") or "").strip()
        if not guide_id:
            continue
        lastmod = parse_published(str(guide.get("published") or "")) or today
        blocks.append(url_block(f"/guides/{guide_id}.html", lastmod, "monthly", "0.7"))

    uses = json.loads(USE_PATH.read_text(encoding="utf-8"))
    for article in uses.get("articles") or []:
        article_id = str(article.get("id") or "").strip()
        if not article_id:
            continue
        lastmod = parse_published(str(article.get("published") or "")) or today
        blocks.append(url_block(f"/use/{article_id}.html", lastmod, "monthly", "0.7"))

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "\n".join(blocks)
        + "\n</urlset>\n"
    )
    SITEMAP.write_text(xml, encoding="utf-8")
    return SITEMAP


if __name__ == "__main__":
    path = write_sitemap()
    print(f"wrote {path}")
