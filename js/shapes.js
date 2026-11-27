const SHAPES = ["ring", "half", "square", "grid", "cross", "triangle", "slab"];
const SLOTS = [
  [0.2, 0.28],
  [0.8, 0.26],
  [0.22, 0.78],
  [0.78, 0.76],
  [0.5, 0.5],
];
const DRIFT_MS = 26000;

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (list) => list[Math.floor(Math.random() * list.length)];

function layout(width, height) {
  const count = 1 + Math.floor(Math.random() * 3);
  const span = Math.min(width, height);
  const scale = [0.8, 0.55, 0.42][count - 1];
  const slots = [...SLOTS].sort(() => Math.random() - 0.5).slice(0, count);
  return slots.map(([sx, sy]) => {
    const size = span * scale * rand(0.7, 1.05);
    const cx = width * sx + rand(-0.08, 0.08) * width;
    const cy = height * sy + rand(-0.08, 0.08) * height;
    return {
      size,
      left: cx - size / 2,
      top: cy - size / 2,
      turn: pick([0, 0, 45, 90, -90, 15, -15]),
    };
  });
}

function place(node, spot) {
  node.style.width = `${spot.size}px`;
  node.style.height = `${spot.size}px`;
  node.style.left = `${spot.left}px`;
  node.style.top = `${spot.top}px`;
  node.style.transform = `rotate(${spot.turn}deg)`;
}

function grow(stage) {
  const field = document.createElement("div");
  field.className = "shape-field";
  stage.prepend(field);
  const nodes = [0, 1, 2].map(() => {
    const node = document.createElement("div");
    node.className = "shape";
    node.style.opacity = "0";
    field.append(node);
    return node;
  });

  let active = 0;

  const drift = (instant) => {
    const box = field.getBoundingClientRect();
    const spots = layout(box.width, box.height);
    nodes.forEach((node, index) => {
      const spot = spots[index];
      if (!spot) {
        node.style.opacity = "0";
        return;
      }
      if (index >= active || instant) {
        node.style.transition = "none";
        node.className = `shape shape--${pick(SHAPES)}`;
        place(node, spot);
        node.getBoundingClientRect();
        node.style.transition = "";
      } else {
        place(node, spot);
      }
      node.style.opacity = "1";
    });
    active = spots.length;
  };

  drift(true);
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  setInterval(drift, DRIFT_MS);

  let resizing;
  addEventListener("resize", () => {
    clearTimeout(resizing);
    resizing = setTimeout(() => drift(true), 250);
  });
}

document.querySelectorAll("[data-shapes]").forEach(grow);
