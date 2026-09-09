---
name: update-articles
description: Add or refresh ShortDrafts FAQ guides and use-case articles in JSON, then commit and push to GitHub so the repo shows fresh published dates. Use when the user asks to update articles, add a guide, publish a use case, keep the site looking active, or push content to GitHub.
---

# Update ShortDrafts articles

ShortDrafts articles are static JSON, not a CMS. GitHub stores the files. The local site at `http://127.0.0.1:4173/` shows them after refresh. A public domain only updates if that host pulls this repo (for example GitHub Pages). Pushing to GitHub does not by itself change a live custom domain.

GitHub Actions runs `scripts/weekly_article.py` twice a week (Monday and Thursday, 10:00 China time). Each run adds one FAQ guide that rotates through the six homepage lanes: Faceless, Story/listicle, Education, Product, Podcast, Multi-platform. Homepage cards stay as those six lanes. New pieces go to `faq.html`.

Do not invent a deploy or fake empty commits. Write a real article, then commit and push.

To change the cadence, edit `.github/workflows/weekly-articles.yml`. Manual run: GitHub → Actions → Weekly articles → Run workflow. Add repo secret `AGNES_API_KEY` so the script can write a fresh guide; without it, a on-brand fallback still publishes.

## Which file

| Kind | File | List page | Detail page |
|---|---|---|---|
| FAQ / guide | `assets/faq-articles.json` key `guides` | `faq.html` | `guide.html?id=` |
| Use case | `assets/use-cases.json` key `articles` | `index.html#use-cases` | `article.html?id=` |

Reuse an existing `assets/images/guide-*.jpg` or `use-*.jpg`. Do not add a new photo unless the user provides one.

## Article shape

Match neighbors. English only. Brand is **ShortDrafts**. Email is `contact@shortdrafts.com`. The product writes packs (ideas, hooks, script, titles, caption, CTA, on-screen text). It does not render video.

```json
{
  "id": "kebab-case-unique",
  "category": "Product | Use case | Platforms | Access | Craft | How to",
  "title": "Short title",
  "excerpt": "One sentence.",
  "image": "assets/images/guide-pack.jpg",
  "alt": "Plain description of the photo",
  "published": "Sep 8, 2026",
  "author": "Maya Ellison",
  "authorId": "maya-ellison",
  "sections": [
    {
      "heading": "Heading",
      "paragraphs": ["..."],
      "bullets": ["optional"]
    }
  ]
}
```

`published` uses `Mon D, YYYY` in English (example: `Sep 8, 2026`). Use today's date from the user context. New `id` values must not collide.

Keep the same voice: direct, no viral promises, no MP4, no avatar studio.

## Workflow

1. Read the target JSON and pick add vs edit.
2. Write or revise one article (or a small set the user named). Put new guides at the top of `guides` / `articles`.
3. Validate JSON parses.
4. If the user asked to put it on GitHub, commit the JSON, `sitemap.xml` if URLs changed, and images if added. Message like `Add guide on batching faceless scripts.` Then push `main` to `origin`.
5. Tell the user: GitHub commit is live at https://github.com/qjy0126/ShortDrafts ; local preview is `http://127.0.0.1:4173/faq.html` or the use-case card.

## Push notes

Never commit `.env`. If `git push` to github.com times out, use the GitHub API Contents/Git Data flow against `qjy0126/ShortDrafts` on `main`, same as this repo's first upload.

GitHub Actions can publish twice a week via `.github/workflows/weekly-articles.yml`. This skill is for extra articles between those runs, or for edits.
