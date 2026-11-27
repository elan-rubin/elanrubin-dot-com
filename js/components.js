document.addEventListener("pointermove", (event) => {
  const glass = event.target.closest?.(".glass");
  if (!glass) return;
  const box = glass.getBoundingClientRect();
  glass.style.setProperty("--mx", `${event.clientX - box.left}px`);
  glass.style.setProperty("--my", `${event.clientY - box.top}px`);
});

document.querySelectorAll("[role=tablist]").forEach((list) => {
  const tabs = [...list.querySelectorAll("[role=tab]")];
  const select = (tab) => {
    tabs.forEach((other) => {
      const on = other === tab;
      other.setAttribute("aria-selected", on);
      document.getElementById(other.getAttribute("aria-controls")).hidden = !on;
    });
  };
  tabs.forEach((tab) => tab.addEventListener("click", () => select(tab)));
});

document.querySelectorAll("[data-open]").forEach((button) => {
  button.addEventListener("click", () => {
    document.getElementById(button.dataset.open).showModal();
  });
});

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => button.closest("dialog").close());
});

document.querySelectorAll("dialog").forEach((dialog) => {
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
});

document.querySelectorAll("input[type=range].range").forEach((range) => {
  const paint = () => {
    const span = range.max - range.min;
    range.style.setProperty(
      "--fill",
      `${((range.value - range.min) / span) * 100}%`,
    );
  };
  range.addEventListener("input", paint);
  paint();
});

function toast(message, led = true) {
  const host = document.querySelector(".toasts");
  if (!host) return;
  const item = document.createElement("div");
  item.className = "toast glass";
  item.innerHTML = led ? '<span class="led led--on"></span>' : "";
  item.append(message);
  host.append(item);
  setTimeout(() => {
    item.dataset.leaving = "";
    setTimeout(() => item.remove(), 300);
  }, 2800);
}

document.querySelectorAll("[data-toast]").forEach((button) => {
  button.addEventListener("click", () => toast(button.dataset.toast));
});

const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) entry.target.dataset.in = "";
  });
});

document.querySelectorAll(".reveal").forEach((node) => observer.observe(node));
