//

let zIndex = 1;

function focusWindow(win) {
  const previous = document.querySelector(".window[data-top]");
  win.style.zIndex = ++zIndex;
  document.querySelectorAll(".window[data-top]").forEach((other) => {
    delete other.dataset.top;
  });
  win.dataset.top = "";
  return previous !== win;
}

function dragElement(elmnt) {
  const header = elmnt.querySelector(".window-header");
  let grabX = 0;
  let grabY = 0;
  let moved = false;

  header.style.touchAction = "none";

  header.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".window-button")) return;
    e.preventDefault();
    grabX = e.clientX - elmnt.offsetLeft;
    grabY = e.clientY - elmnt.offsetTop;
    header.setPointerCapture(e.pointerId);
    focusWindow(elmnt);
    elmnt.dataset.dragging = "";
    moved = false;
  });

  const release = () => {
    if (elmnt.dataset.dragging === undefined) return;
    delete elmnt.dataset.dragging;
    if (moved) {
      emit("move", {
        name: elmnt.querySelector(".window-title").textContent.trim(),
        x: Math.round(elmnt.offsetLeft),
        y: Math.round(elmnt.offsetTop),
      });
    }
  };
  header.addEventListener("pointerup", release);
  header.addEventListener("pointercancel", release);
  header.addEventListener("lostpointercapture", release);

  header.addEventListener("pointermove", (e) => {
    if (!header.hasPointerCapture(e.pointerId)) return;
    moved = true;
    const maxX = window.innerWidth - elmnt.offsetWidth;
    const maxY = window.innerHeight - elmnt.offsetHeight;
    elmnt.style.left = Math.max(0, Math.min(e.clientX - grabX, maxX)) + "px";
    elmnt.style.top = Math.max(0, Math.min(e.clientY - grabY, maxY)) + "px";
  });
}

// function setupWindowControls(window) {
//   const minimizeBtn = window.querySelector(".minimize-btn");
//   const maximizeBtn = window.querySelector(".maximize-btn");
//   const closeBtn = window.querySelector(".close-btn");
//   const content = window.querySelector(".window-content");

//   minimizeBtn.addEventListener("click", function () {
//     this.style.animation = "bounce 0.3s";
//     setTimeout(() => (this.style.animation = ""), 300);
//   });

//   maximizeBtn.addEventListener("click", function () {
//     this.style.animation = "bounce 0.3s";
//     setTimeout(() => (this.style.animation = ""), 300);
//   });

//   closeBtn.addEventListener("click", function () {
//     this.style.animation = "bounce 0.3s";
//     setTimeout(() => (this.style.animation = ""), 300);
//   });
// }

function animateTyping(element, text, speed) {
  let i = 0;
  function typing() {
    if (i < text.length) {
      element.innerHTML += text.charAt(i);
      i++;
      setTimeout(typing, speed);
    }
  }
  typing();
}

document.addEventListener("DOMContentLoaded", function () {
  var windows = document.getElementsByClassName("window");
  for (var i = 0; i < windows.length; i++) {
    dragElement(windows[i]);
    setupWindowControls(windows[i]);
    windows[i].style.zIndex = ++zIndex;
    const raise = windows[i];
    raise.addEventListener(
      "pointerdown",
      () => {
        if (focusWindow(raise)) {
          emit("window", {
            name: raise.querySelector(".window-title").textContent.trim(),
            action: "focus",
          });
        }
      },
      true,
    );
  }

  const notepadContent = document.getElementById("notepadContent");
  const notepadText =
    "Hello!\nMy name is Elan, and I'm a student.\nMy interests lie in the intersection between technology and art.";
  animateTyping(notepadContent, notepadText, 25);
});

const CALC_MAX = 18;

function calcDisplay() {
  return document.getElementById("display");
}

function evaluateExpression(text) {
  const clean = text.replace(/\s/g, "");
  const tokens = clean.match(/\d+\.?\d*|\.\d+|[-+*/()]/g);
  if (!tokens || tokens.join("") !== clean) throw new Error("bad input");
  let i = 0;
  const peek = () => tokens[i];
  const next = () => tokens[i++];
  const expr = () => {
    let value = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const rhs = term();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };
  const term = () => {
    let value = factor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const rhs = factor();
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  };
  const factor = () => {
    const token = next();
    if (token === "-") return -factor();
    if (token === "+") return factor();
    if (token === "(") {
      const value = expr();
      if (next() !== ")") throw new Error("unclosed");
      return value;
    }
    const number = Number(token);
    if (token === undefined || Number.isNaN(number))
      throw new Error("bad input");
    return number;
  };
  const result = expr();
  if (i !== tokens.length || !Number.isFinite(result))
    throw new Error("bad input");
  return result;
}

function appendToDisplay(value) {
  const display = calcDisplay();
  const state = display.dataset.state;
  if (state === "error" || (state === "done" && /[\d.(]/.test(value))) {
    display.value = "";
  }
  delete display.dataset.state;
  if (display.value.length >= CALC_MAX) return;
  display.value += value;
}

function backspaceDisplay() {
  const display = calcDisplay();
  if (display.dataset.state === "error") display.value = "";
  delete display.dataset.state;
  display.value = display.value.slice(0, -1);
}

function clearDisplay() {
  const display = calcDisplay();
  display.value = "";
  delete display.dataset.state;
}

function calculate() {
  const display = calcDisplay();
  if (!display.value) return;
  try {
    const result = evaluateExpression(display.value);
    const expr = display.value;
    display.value = String(Number(result.toPrecision(12)));
    display.dataset.state = "done";
    emit("calc", { expr, result: display.value });
  } catch {
    emit("calc", { expr: display.value, error: true });
    display.value = "ERR";
    display.dataset.state = "error";
  }
}

document.addEventListener("keydown", (event) => {
  const calc = document.querySelector(".window[data-top] .calculator");
  if (!calc || calc.closest(".window").style.display === "none") return;
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const key = event.key;
  if (/^[\d.+\-*/()]$/.test(key)) appendToDisplay(key);
  else if (key === "Enter" || key === "=") calculate();
  else if (key === "Backspace") backspaceDisplay();
  else if (key === "Escape" || key.toLowerCase() === "c") clearDisplay();
  else return;
  event.preventDefault();
});

//update the time and volume

function updateTime() {
  try {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const ampm = hours >= 12 ? "PM" : "AM";

    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'

    const timeString = `${hours}:${minutes} ${ampm}`;
    document.getElementById("timeDisplay").textContent = timeString;
  } catch (error) {
    console.error("issue with updating time", error);
  }
}

// Store window states
let windowStates = {
  Slideshow: true,
  Calculator: true,
  Notepad: true,
  Playlist: true,
  Clicker: false,
};

function emit(type, detail) {
  document.dispatchEvent(new CustomEvent(`site:${type}`, { detail }));
}

function syncLaunchers() {
  document.querySelectorAll("[data-launch]").forEach((button) => {
    button.classList.toggle(
      "is-open",
      Boolean(windowStates[button.dataset.launch]),
    );
  });
}

async function toggleWindow(windowName, silent = false) {
  const windowElement = findWindowByTitle(windowName);
  if (windowElement) {
    windowStates[windowName] = !windowStates[windowName];
    if (windowStates[windowName]) {
      windowElement.style.display = "block";
      windowElement.style.animation = "openWindow 0.3s";
      focusWindow(windowElement);
      emit("window", { name: windowName, action: "open", silent });
    } else {
      windowElement.style.animation = "closeWindow 0.3s";
      setTimeout(() => {
        windowElement.style.display = "none";
      }, 280);
      emit("window", { name: windowName, action: "close", silent });
    }
    syncLaunchers();
  }
}

function findWindowByTitle(title) {
  const windows = document.getElementsByClassName("window");
  for (let window of windows) {
    const titleElement = window.querySelector(".window-title");
    if (titleElement && titleElement.textContent.trim() === title) {
      return window;
    }
  }
  return null;
}

function setupWindowControls(window) {
  const closeBtn = window.querySelector(".close-btn");
  const windowTitle = window.querySelector(".window-title").textContent.trim();

  closeBtn.addEventListener("click", function () {
    this.style.animation = "bounce 0.3s";
    setTimeout(() => {
      this.style.animation = "";
      toggleWindow(windowTitle);
    }, 300);
  });
}

document.addEventListener("site:launch", (event) => {
  const { name, action, silent } = event.detail;
  const win = findWindowByTitle(name);
  if (!win) return;
  const open = windowStates[name];
  if (action === "open" || action === "launch") {
    if (!open) toggleWindow(name, silent);
    else {
      focusWindow(win);
      if (!silent) emit("window", { name, action: "focus" });
    }
  } else if (action === "close") {
    if (open) toggleWindow(name, silent);
  } else if (action === "focus") {
    if (open) focusWindow(win);
  } else if (action === "toggle") {
    toggleWindow(name, silent);
  }
});

document.addEventListener("click", (event) => {
  const launcher = event.target.closest(".task-launch");
  if (launcher) toggleWindow(launcher.dataset.launch);
  const icon = event.target.closest(".app-icon[data-launch]");
  if (icon) emit("launch", { name: icon.dataset.launch, action: "launch" });
});

setInterval(updateTime, 1000);

document.addEventListener("DOMContentLoaded", function () {
  updateTime();
  syncLaunchers();
});
