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

