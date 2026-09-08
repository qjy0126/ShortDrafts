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

  function renderList(guides) {
    const list = document.getElementById("guide-list");
    if (!list) return;
    list.innerHTML = guides
      .map(
        (guide) => `
      <a class="guide-row" href="guide.html?id=${encodeURIComponent(guide.id)}">
        <img src="${esc(guide.image)}" width="184" height="184" alt="${esc(guide.alt)}">
        <div class="guide-row__copy">
          <span class="guide-kicker">${esc(guide.category)}</span>
          <h2>${esc(guide.title)}</h2>
          <p>${esc(guide.excerpt)}</p>
        </div>
        <span class="guide-open">Open →</span>
      </a>`
      )
      .join("");
  }

  function renderArticle(guides) {
    const root = document.getElementById("guide-article");
    if (!root) return;
    const guide = guides.find((item) => item.id === queryId());
    if (!guide) {
      document.title = "Guide not found — ShortDrafts";
      root.innerHTML = `
        <p class="guide-kicker">FAQ</p>
        <h1>This guide is not here.</h1>
        <p class="guide-dek">It may have been renamed. Back to <a href="faq.html">all guides</a>.</p>`;
      return;
    }
    document.title = `${guide.title} — ShortDrafts`;
    const meta = document.querySelector('meta[name="description"]');
    if (meta) meta.setAttribute("content", guide.excerpt);
    root.innerHTML = `
      <p class="guide-kicker">${esc(guide.category)}</p>
      <h1>${esc(guide.title)}</h1>
      <p class="guide-dek">${esc(guide.excerpt)}</p>
      <p class="guide-byline">By <b>ShortDrafts</b> · Published ${esc(guide.published)}</p>
      ${renderSections(guide.sections)}`;
  }

  fetch("assets/faq-articles.json?v=6")
    .then((response) => {
      if (!response.ok) throw new Error("Could not load guides");
      return response.json();
    })
    .then((data) => {
      const guides = data.guides || [];
      renderList(guides);
      renderArticle(guides);
    })
    .catch(() => {
      const list = document.getElementById("guide-list");
      const article = document.getElementById("guide-article");
      const message = "Guides did not load. Refresh, or open this page at http://127.0.0.1:4173/faq.html";
      if (list) list.innerHTML = `<p class="lede">${esc(message)}</p>`;
      if (article) article.innerHTML = `<p class="lede">${esc(message)}</p>`;
    });
})();
