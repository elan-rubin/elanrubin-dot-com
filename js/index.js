//

let zIndex = 1;

function focusWindow(win) {
  win.style.zIndex = ++zIndex;
  document.querySelectorAll(".window[data-top]").forEach((other) => {
    delete other.dataset.top;
  });
  win.dataset.top = "";
}

function dragElement(elmnt) {
  const header = elmnt.querySelector(".window-header");
  let grabX = 0;
  let grabY = 0;

  header.style.touchAction = "none";

  header.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".window-button")) return;
    e.preventDefault();
    grabX = e.clientX - elmnt.offsetLeft;
    grabY = e.clientY - elmnt.offsetTop;
    header.setPointerCapture(e.pointerId);
    focusWindow(elmnt);
    elmnt.dataset.dragging = "";
  });

  const release = () => {
    delete elmnt.dataset.dragging;
  };
  header.addEventListener("pointerup", release);
  header.addEventListener("pointercancel", release);
  header.addEventListener("lostpointercapture", release);

  header.addEventListener("pointermove", (e) => {
    if (!header.hasPointerCapture(e.pointerId)) return;
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
    raise.addEventListener("pointerdown", () => focusWindow(raise), true);
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
    display.value = String(Number(result.toPrecision(12)));
    display.dataset.state = "done";
  } catch {
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

//app icon code

document.addEventListener("DOMContentLoaded", function () {
  const appIcons = document.querySelectorAll(".app-icon");
  appIcons.forEach((icon) => {
    icon.addEventListener("click", function (e) {
      const url = this.getAttribute("href");
      // Only handle if there's an href attribute (skip desktop icons)
      if (url && url !== "#") {
        e.preventDefault();

        // Get the name of the link from the span text
        const linkName = this.querySelector("span")?.textContent.toLowerCase();

        window.open(url, "_blank");
        if (linkName) {
          addTerminalCommand(`visit ${linkName}`);
        }
      }
    });
  });
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
  Calculator: true,
  Notepad: true,
  Playlist: true,
  Clicker: false,
};

async function toggleWindow(windowName) {
  const windowElement = findWindowByTitle(windowName);
  if (windowElement) {
    windowStates[windowName] = !windowStates[windowName];
    if (windowStates[windowName]) {
      windowElement.style.display = "block";
      windowElement.style.animation = "openWindow 0.3s";
      focusWindow(windowElement);
      addTerminalCommand(`launch ${windowName.toLowerCase()}.exe`);
    } else {
      windowElement.style.animation = "closeWindow 0.3s";
      setTimeout(() => {
        windowElement.style.display = "none";
      }, 280);
      addTerminalCommand(`kill ${windowName.toLowerCase()}.exe`);
    }
    updateTerminalList();
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

// Update window controls to include visibility toggle
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

function updateTerminalList() {
  const terminalList = document.querySelector(".terminal-list");
  if (!terminalList) return;

  terminalList.innerHTML = Object.keys(windowStates)
    .map(
      (name) => `
        <li class="terminal-item">
            <span class="status-dot ${
              windowStates[name] ? "active" : ""
            }"></span>
            ${name}
        </li>
    `,
    )
    .join("");

  // Reattach click handlers
  const items = terminalList.querySelectorAll(".terminal-item");
  items.forEach((item) => {
    item.addEventListener("click", () => {
      const windowName = item.textContent.trim();
      toggleWindow(windowName);
    });
  });
}

// Terminal command display with typing animation
function addTerminalCommand(command) {
  const terminalCommands = document.getElementById("terminalCommands");
  if (!terminalCommands) return;

  // Get the current active line (the last one with just the prompt)
  const currentLine = terminalCommands.lastChild;
  const promptText = "C:\\Users\\Elan> ";

  // Typing animation
  let i = 0;
  function typeChar() {
    if (i < command.length) {
      currentLine.textContent = promptText + command.substring(0, i + 1);
      i++;
      setTimeout(typeChar, 30);
    } else {
      // After typing is complete, add a new empty prompt line
      const newCommandLine = document.createElement("div");
      newCommandLine.className = "terminal-line";
      newCommandLine.textContent = promptText;
      terminalCommands.appendChild(newCommandLine);

      // Keep only last 4 lines (3 completed + 1 empty prompt)
      const allChildren = Array.from(terminalCommands.children);
      if (allChildren.length > 4) {
        terminalCommands.removeChild(allChildren[0]);
      }

      // Auto-scroll to bottom
      terminalCommands.scrollTop = terminalCommands.scrollHeight;
    }
  }
  typeChar();
}

// Initialize terminal when DOM is loaded
// document.addEventListener('DOMContentLoaded', function() {
//     createTerminal();
// });

// Update time every second
setInterval(updateTime, 1000);

// Initial time update
document.addEventListener("DOMContentLoaded", function () {
  updateTime();
  updateTerminalList();

  // Initialize terminal with welcome message and first prompt
  const terminalCommands = document.getElementById("terminalCommands");
  if (terminalCommands) {
    // Add welcome message
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, "0");
    const minutes = now.getMinutes().toString().padStart(2, "0");
    const timeString = `${hours}:${minutes}:${now.getSeconds().toString().padStart(2, "0")}`;

    const welcomeLine = document.createElement("div");
    welcomeLine.className = "terminal-line";
    welcomeLine.textContent = `connected at ${timeString}`;
    terminalCommands.appendChild(welcomeLine);

    // Add first empty prompt
    const commandLine = document.createElement("div");
    commandLine.className = "terminal-line";
    commandLine.textContent = "C:\\Users\\Elan> ";
    terminalCommands.appendChild(commandLine);
  }

  // Setup desktop icon click handlers
  const desktopIcons = document.querySelectorAll(".desktop-icon");
  desktopIcons.forEach((icon) => {
    icon.addEventListener("click", function () {
      const windowName = this.getAttribute("data-window");
      toggleWindow(windowName);
    });
  });
});
//sometiemes this doesnt work
