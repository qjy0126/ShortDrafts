(function () {
  if (window.__sdGtag) return;
  window.__sdGtag = true;
  const id = "G-NSY7CFTQTE";
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("js", new Date());
  window.gtag("config", id, { transport_url: location.origin });
  const s = document.createElement("script");
  s.async = true;
  s.src = "/gtag/js?id=" + id;
  document.head.appendChild(s);
})();
