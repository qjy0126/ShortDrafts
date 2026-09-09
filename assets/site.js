if (document.currentScript && document.currentScript.src) {
  import(new URL("firebase-analytics.js", document.currentScript.src).href).catch(() => {});
}

document.getElementById("year") && (document.getElementById("year").textContent = new Date().getFullYear());

const menuBtn = document.getElementById("menu-btn");
const navLinks = document.getElementById("nav-links");
if (menuBtn && navLinks) {
  menuBtn.addEventListener("click", () => {
    navLinks.classList.toggle("is-open");
  });
}

const homeNav = document.querySelector("body.is-home .nav");
if (homeNav) {
  const hero = document.querySelector(".hero-cinema");
  const setSolid = (on) => homeNav.classList.toggle("is-solid", on);
  if (hero && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      ([entry]) => setSolid(!(entry.isIntersecting && entry.intersectionRatio >= 0.4)),
      { threshold: [0, 0.4, 1], rootMargin: "-64px 0px 0px 0px" }
    );
    io.observe(hero);
  } else {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }
}

window.ShortDraftsSeo = (function () {
  const SITE = "https://shortdrafts.com";
  const FALLBACK_AUTHOR = {
    id: "short-drafts-editors",
    name: "ShortDrafts Editors",
    jobTitle: "Short-form writing editor",
    bio: "Writes product guides and use-case notes for ShortDrafts.",
  };
  const PUBLISHER = {
    name: "ShortDrafts",
    url: `${SITE}/`,
    logo: `${SITE}/assets/images/logo.png?v=9`,
    email: "contact@shortdrafts.com",
  };
  let people = [];
  let peoplePromise = null;

  function esc(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function loadPeople() {
    if (!peoplePromise) {
      peoplePromise = fetch("assets/authors.json?v=1")
        .then((response) => {
          if (!response.ok) throw new Error("Could not load authors");
          return response.json();
        })
        .then((data) => {
          people = data.people || [];
          return people;
        })
        .catch(() => {
          people = [];
          return people;
        });
    }
    return peoplePromise;
  }

  function personFor(item) {
    const authorId = item && item.authorId;
    const authorNameValue = item && item.author;
    const byId = people.find((person) => person.id === authorId);
    if (byId) return byId;
    const byName = people.find((person) => person.name === authorNameValue);
    if (byName) return byName;
    if (authorNameValue) {
      return {
        id: String(authorId || authorNameValue).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        name: authorNameValue,
        jobTitle: "Short-form writing editor",
        bio: `${authorNameValue} writes guides for ShortDrafts.`,
      };
    }
    return people[0] || FALLBACK_AUTHOR;
  }

  function authorName(item) {
    return personFor(item).name;
  }

  function isoDate(value) {
    const text = String(value || "").trim();
    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) return new Date(parsed).toISOString().slice(0, 10);
    return "";
  }

  function pageUrl(path) {
    if (/^https?:/i.test(path)) return path;
    return `${SITE}/${String(path || "").replace(/^\//, "")}`;
  }

  function setLink(rel, href) {
    if (!href) return;
    let node = document.querySelector(`link[rel="${rel}"]`);
    if (!node) {
      node = document.createElement("link");
      node.setAttribute("rel", rel);
      document.head.appendChild(node);
    }
    node.setAttribute("href", href);
  }

  function setMeta(name, content, attr) {
    if (!content) return;
    const key = attr || "name";
    let node = document.querySelector(`meta[${key}="${name}"]`);
    if (!node) {
      node = document.createElement("meta");
      node.setAttribute(key, name);
      document.head.appendChild(node);
    }
    node.setAttribute("content", content);
  }

  function setJsonLd(id, data) {
    let node = document.getElementById(id);
    if (!node) {
      node = document.createElement("script");
      node.type = "application/ld+json";
      node.id = id;
      document.head.appendChild(node);
    }
    node.textContent = JSON.stringify(data);
  }

  function bylineHtml(item) {
    const name = authorName(item);
    const published = item && item.published ? ` · Published ${esc(item.published)}` : "";
    return `<p class="guide-byline">By <b>${esc(name)}</b>${published}</p>`;
  }

  function applyArticle(item, options) {
    const opts = options || {};
    const name = authorName(item);
    const url = pageUrl(opts.path || window.location.pathname + window.location.search);
    const published = isoDate(item && item.published);
    const person = personFor(item);
    setMeta("author", name);
    setMeta("og:title", document.title, "property");
    setMeta("og:description", (item && item.excerpt) || "", "property");
    setMeta("og:type", "article", "property");
    setMeta("og:url", url, "property");
    if (item && item.image) setMeta("og:image", pageUrl(item.image), "property");
    setLink("canonical", url);
    setJsonLd("sd-article-jsonld", {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: item && item.title,
      description: item && item.excerpt,
      datePublished: published || undefined,
      dateModified: published || undefined,
      image: item && item.image ? pageUrl(item.image) : undefined,
      mainEntityOfPage: url,
      author: {
        "@type": "Person",
        name,
        jobTitle: person.jobTitle,
      },
      publisher: {
        "@type": "Organization",
        name: PUBLISHER.name,
        url: PUBLISHER.url,
        logo: { "@type": "ImageObject", url: PUBLISHER.logo },
        email: PUBLISHER.email,
      },
    });
  }

  setJsonLd("sd-org-jsonld", {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: PUBLISHER.name,
    url: PUBLISHER.url,
    logo: PUBLISHER.logo,
    email: PUBLISHER.email,
    sameAs: ["https://github.com/qjy0126/ShortDrafts"],
  });

  return {
    SITE,
    PUBLISHER,
    loadPeople,
    personFor,
    esc,
    authorName,
    bylineHtml,
    applyArticle,
    setJsonLd,
    setMeta,
    setLink,
  };
})();

