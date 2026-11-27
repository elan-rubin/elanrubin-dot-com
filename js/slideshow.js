const SLIDES = [
  {
    kind: "link",
    title: "LinkedIn",
    meta: "linkedin.com/in/elan-rubin",
    icon: "fa-brands fa-linkedin",
    tint: "#0a66c2",
    href: "https://www.linkedin.com/in/elan-rubin/",
  },
  {
    kind: "link",
    title: "GitHub",
    meta: "github.com/Elan-Rubin",
    icon: "fa-brands fa-github",
    tint: "#6e7681",
    href: "https://github.com/Elan-Rubin",
  },
  {
    kind: "link",
    title: "itch.io",
    meta: "elanmakesgames.itch.io",
    icon: "fa-brands fa-itch-io",
    tint: "#fa5c5c",
    href: "https://elanmakesgames.itch.io/",
  },
  {
    kind: "link",
    title: "Etsy",
    meta: "etsy.com/shop/Legoco",
    icon: "fa-brands fa-etsy",
    tint: "#f16521",
    href: "https://www.etsy.com/shop/Legoco",
  },
  {
    kind: "link",
    title: "Instagram",
    meta: "instagram.com/elan_rubin",
    icon: "fa-brands fa-instagram",
    tint: "#c13584",
    href: "https://www.instagram.com/elan_rubin/",
  },
  {
    kind: "mail",
    title: "Email",
    meta: "no address yet",
    icon: "fa-solid fa-envelope",
    tint: "#2f7fd6",
    disabled: true,
  },
];

const TINT_L = 0.37;
const TINT_DEEP_L = 0.2;
const TINT_MAX_C = 0.085;
const AUTO_MS = 6000;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function toOklch(hex) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = [
    (n >> 16) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ].map(lin);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { c: Math.hypot(a, bb), h: Math.atan2(bb, a) };
}

function fromOklch(L, C, h) {
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const enc = (c) =>
    Math.round(
      clamp(c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055, 0, 1) *
        255,
    );
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ].join(" ");
}

function emit(type, detail) {
  document.dispatchEvent(new CustomEvent(`site:${type}`, { detail }));
}

function build(root) {
  const slides = SLIDES;

  const track = document.createElement("div");
  track.className = "slides";

  slides.forEach((slide, index) => {
    const { c, h } = toOklch(slide.tint);
    const chroma = Math.min(c, TINT_MAX_C);
    const tag = slide.href ? "a" : "div";
    const card = document.createElement(tag);
    card.className = "capsule";
    card.dataset.index = index;
    card.dataset.title = slide.title.toLowerCase();
    card.style.setProperty("--tint", fromOklch(TINT_L, chroma, h));
    card.style.setProperty("--tint-deep", fromOklch(TINT_DEEP_L, chroma, h));
    card.style.setProperty("--tint-lift", fromOklch(0.5, chroma, h));
    if (slide.href) {
      card.href = slide.href;
      card.target = "_blank";
      card.rel = "noopener";
    }
    if (slide.disabled) card.setAttribute("aria-disabled", "true");
    card.innerHTML = `
      <i class="capsule__art ${slide.icon}" aria-hidden="true"></i>
      <span class="capsule__kind"><span class="dotsq"></span>${slide.kind}</span>
      <span class="capsule__copy">
        <span class="capsule__title font-swap">${slide.title}</span>
        <span class="capsule__meta">${slide.meta}</span>
      </span>
      <span class="capsule__ticks" aria-hidden="true"></span>
      ${slide.disabled ? '<i class="dnd" aria-hidden="true"></i>' : ""}`;
    track.append(card);
  });

  const nav = document.createElement("div");
  nav.className = "slide-nav";
  nav.innerHTML = `
    <button type="button" class="slide-arrow slide-arrow--prev" aria-label="previous slide"></button>
    <div class="slide-dots"></div>
    <button type="button" class="slide-arrow slide-arrow--next" aria-label="next slide"></button>`;
  const dots = nav.querySelector(".slide-dots");
  slides.forEach((slide, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "slide-dot";
    dot.setAttribute("aria-label", `go to ${slide.title}`);
    dot.dataset.index = index;
    dots.append(dot);
  });

  const viewport = document.createElement("div");
  viewport.className = "slide-viewport";
  viewport.append(track);
  root.replaceChildren(viewport, nav);

  let current = 0;
  let paused = false;
  let timer;

  const show = (index, source) => {
    current = (index + slides.length) % slides.length;
    track.style.transform = `translateX(calc(${-current} * (100% + var(--slide-gap))))`;
    dots.querySelectorAll(".slide-dot").forEach((dot, i) => {
      dot.classList.toggle("is-on", i === current);
    });
    track.querySelectorAll(".capsule").forEach((card, i) => {
      card.tabIndex = i === current ? 0 : -1;
      card.setAttribute("aria-hidden", i === current ? "false" : "true");
    });
    if (source === "user") {
      emit("slide", {
        index: current,
        total: slides.length,
        title: slides[current].title,
        meta: slides[current].meta,
      });
    }
  };

  const restart = () => {
    clearInterval(timer);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = setInterval(() => {
      if (!paused && root.closest(".window")?.getClientRects().length !== 0) {
        show(current + 1, "auto");
      }
    }, AUTO_MS);
  };

  nav.querySelector(".slide-arrow--prev").addEventListener("click", () => {
    show(current - 1, "user");
    restart();
  });
  nav.querySelector(".slide-arrow--next").addEventListener("click", () => {
    show(current + 1, "user");
    restart();
  });
  dots.addEventListener("click", (event) => {
    const dot = event.target.closest(".slide-dot");
    if (!dot) return;
    show(Number(dot.dataset.index), "user");
    restart();
  });

  root.addEventListener("pointerenter", () => (paused = true));
  root.addEventListener("pointerleave", () => (paused = false));
  root.addEventListener("focusin", () => (paused = true));
  root.addEventListener("focusout", () => (paused = false));
  root.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") show(current - 1, "user");
    else if (event.key === "ArrowRight") show(current + 1, "user");
    else return;
    restart();
  });

  let startX = null;
  let dragged = false;
  viewport.addEventListener("pointerdown", (event) => {
    startX = event.clientX;
    dragged = false;
  });
  viewport.addEventListener("pointermove", (event) => {
    if (startX !== null && Math.abs(event.clientX - startX) > 8) dragged = true;
  });
  viewport.addEventListener("pointerup", (event) => {
    if (startX === null) return;
    const dx = event.clientX - startX;
    startX = null;
    if (Math.abs(dx) > 44) {
      show(current + (dx < 0 ? 1 : -1), "user");
      restart();
    }
  });
  viewport.addEventListener(
    "click",
    (event) => {
      if (dragged) {
        event.preventDefault();
        event.stopPropagation();
        dragged = false;
      }
    },
    true,
  );

  show(0);
  restart();
}

document.querySelectorAll("[data-slideshow]").forEach(build);
