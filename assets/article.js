(function () {
  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function queryId() {
    return new URLSearchParams(window.location.search).get("id") || "";
  }

  function renderSources(sources) {
    if (!sources || !sources.length) return "";
    return (
      "<h2>Sources</h2>" +
      sources
        .map(
          (source) => `
      <blockquote cite="${esc(source.url)}">
        <p>${esc(source.quote)}</p>
        <footer>— <cite><a href="${esc(source.url)}" rel="noopener noreferrer">${esc(source.attribution)}</a></cite></footer>
      </blockquote>`
        )
        .join("")
    );
  }

  function renderSections(sections) {
    return (sections || [])
      .map((section) => {
        let html = "";
        if (section.heading) html += `<h2>${esc(section.heading)}</h2>`;
        (section.paragraphs || []).forEach((paragraph) => {
          html += `<p>${esc(paragraph)}</p>`;
        });
        if (section.bullets && section.bullets.length) {
          html += `<ul>${section.bullets.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
        }
        return html;
      })
      .join("");
  }

  const root = document.getElementById("article-root");
  if (!root) return;
  const seo = window.ShortDraftsSeo;

  Promise.all([
  fetch("assets/use-cases.json?v=5").then((response) => {
      if (!response.ok) throw new Error("Could not load article");
      return response.json();
    }),
    seo ? seo.loadPeople() : Promise.resolve([]),
  ])
    .then(([data]) => {
      const article = (data.articles || []).find((item) => item.id === queryId());
      if (!article) {
        document.title = "Article not found — ShortDrafts";
        root.innerHTML = `
          <p class="guide-kicker">Use case</p>
          <h1>This article is not here.</h1>
          <p class="guide-dek">Back to <a href="index.html#use-cases">use cases</a>.</p>`;
        return;
      }
      document.title = `${article.title} — ShortDrafts`;
      const meta = document.querySelector('meta[name="description"]');
      if (meta) meta.setAttribute("content", article.excerpt);
      if (seo) seo.applyArticle(article, { path: `article.html?id=${encodeURIComponent(article.id)}` });
      root.innerHTML = `
        <p class="guide-kicker">${esc(article.category)}</p>
        <h1>${esc(article.title)}</h1>
        <p class="guide-dek">${esc(article.excerpt)}</p>
        ${seo ? seo.bylineHtml(article) : `<p class="guide-byline">By <b>${esc(article.author)}</b> · Published ${esc(article.published)}</p>`}
        <img class="guide-hero" src="${esc(article.image)}" width="1200" height="675" alt="${esc(article.alt)}">
        ${renderSections(article.sections)}
        ${renderSources(article.sources)}
        <a class="btn btn-primary guide-cta" href="generate.html">Generate for Free →</a>`;
    })
    .catch(() => {
      root.innerHTML = `<p class="lede">Article did not load. Open this page at http://127.0.0.1:4173/article.html</p>`;
    });
})();
