const HOST = "elanrubin";
const USER = "elan";
const MAX_LINES = 400;
const PIDS = {
  slideshow: 3141,
  calculator: 4271,
  notepad: 5009,
  playlist: 6122,
  clicker: 7340,
};
const APPS = ["slideshow", "calculator", "notepad", "playlist", "clicker"];
const LINKS = {
  linkedin: "https://www.linkedin.com/in/elan-rubin/",
  github: "https://github.com/Elan-Rubin",
  itch: "https://elanmakesgames.itch.io/",
  etsy: "https://www.etsy.com/shop/Legoco",
  instagram: "https://www.instagram.com/elan_rubin/",
};
const BORN = Date.now();

const root = document.getElementById("terminalCommands");

function start() {
  const scroll = document.createElement("div");
  scroll.className = "term-scroll";
  const inputLine = document.createElement("label");
  inputLine.className = "term-input";
  inputLine.innerHTML = `<span class="term-prompt">${USER}@${HOST}:~$</span><input class="term-field" spellcheck="false" autocomplete="off" autocapitalize="off" aria-label="terminal input" />`;
  const field = inputLine.querySelector("input");
  root.replaceChildren(scroll, inputLine);

  const queue = [];
  let busy = false;
  let cookieBurst = { count: 0, timer: null };
  const history = [];
  let historyAt = 0;

  const trim = () => {
    while (scroll.childElementCount > MAX_LINES)
      scroll.firstElementChild.remove();
  };
  const bottom = () => {
    root.scrollTop = root.scrollHeight;
  };

  const line = (text, cls = "term-out") => {
    const el = document.createElement("div");
    el.className = `term-line ${cls}`;
    el.textContent = text;
    scroll.append(el);
    trim();
    bottom();
    return el;
  };

  const run = () => {
    if (busy) return;
    const next = queue.shift();
    if (!next) return;
    busy = true;
    const el = document.createElement("div");
    el.className = "term-line term-cmd";
    el.innerHTML = `<span class="term-prompt">${USER}@${HOST}:~$</span> <span class="term-text"></span>`;
    scroll.append(el);
    const text = el.querySelector(".term-text");
    const step = Math.max(6, Math.min(18, 520 / next.cmd.length));
    let i = 0;
    const type = () => {
      text.textContent = next.cmd.slice(0, ++i);
      bottom();
      if (i < next.cmd.length) setTimeout(type, step);
      else {
        (next.out ?? []).forEach((out) => line(out));
        trim();
        busy = false;
        run();
      }
    };
    type();
  };

  const log = (cmd, out) => {
    queue.push({ cmd, out: Array.isArray(out) ? out : out ? [out] : [] });
    run();
  };

  const echo = (cmd) => {
    const el = line("", "term-cmd");
    el.innerHTML = `<span class="term-prompt">${USER}@${HOST}:~$</span> <span class="term-text"></span>`;
    el.querySelector(".term-text").textContent = cmd;
  };

  const launch = (name, action, silent = true) => {
    document.dispatchEvent(
      new CustomEvent("site:launch", { detail: { name, action, silent } }),
    );
  };

  const stamp = () => new Date().toString().replace(/ GMT.*\((.*)\)/, " $1");

  const commands = {
    help: () => [
      "GNU bash, version 5.2.26(1)-release",
      "commands:",
      "  ls  cat  pwd  whoami  hostname  uname  uptime  date  echo  clear  history",
      "  ps  neofetch  open <app>  close <app>  focus <app>  xdg-open <link>",
      "  playerctl play|pause|next|previous|status",
      "apps: " + APPS.join("  "),
      "links: " + Object.keys(LINKS).join("  "),
    ],
    ls: (args) =>
      args[0] === "apps" || args[0] === "/usr/share/applications"
        ? APPS.map((a) => `${a}.desktop`)
        : ["about.txt  links.txt  apps  music  notes"],
    cat: (args) => {
      const file = args[0];
      if (file === "about.txt")
        return [
          "hello. my name is elan, and i'm a student.",
          "my interests lie in the intersection between technology and art.",
        ];
      if (file === "links.txt")
        return Object.entries(LINKS).map(([k, v]) => `${k.padEnd(10)} ${v}`);
      if (!file) return [];
      return [`cat: ${file}: No such file or directory`];
    },
    pwd: () => [`/home/${USER}`],
    whoami: () => [USER],
    hostname: () => [HOST],
    uname: (args) =>
      args.includes("-a")
        ? [`Linux ${HOST} 6.12.0-site #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`]
        : ["Linux"],
    uptime: () => {
      const s = Math.floor((Date.now() - BORN) / 1000);
      const up = s < 90 ? `${s} sec` : `${Math.floor(s / 60)} min`;
      const d = new Date();
      const t = d.toTimeString().slice(0, 8);
      return [` ${t} up ${up},  1 user,  load average: 0.08, 0.04, 0.01`];
    },
    date: () => [stamp()],
    echo: (args) => [args.join(" ")],
    history: () => history.map((h, i) => `${String(i + 1).padStart(4)}  ${h}`),
    ps: () => {
      const open = APPS.filter((a) => {
        const win = [...document.querySelectorAll(".window")].find(
          (w) =>
            w
              .querySelector(".window-title")
              ?.textContent.trim()
              .toLowerCase() === a,
        );
        return win && win.getClientRects().length > 0;
      });
      return [
        "  PID TTY          TIME CMD",
        "  1024 pts/0   00:00:00 bash",
        ...open.map(
          (a) => `${String(PIDS[a]).padStart(5)} pts/0   00:00:00 ${a}`,
        ),
      ];
    },
    neofetch: () => [
      `${USER}@${HOST}`,
      "-----------------",
      "OS: elanrubin.com x86_64",
      "Kernel: 6.12.0-site",
      "Shell: bash 5.2.26",
      "WM: glass (webgl2)",
      "Theme: black / green",
      "Font: Geist Mono",
      `Uptime: ${Math.max(1, Math.floor((Date.now() - BORN) / 60000))} min`,
    ],
    clear: () => {
      scroll.replaceChildren();
      return [];
    },
    open: (args) => openApp(args[0], "open"),
    start: (args) => openApp(args[0], "open"),
    close: (args) => openApp(args[0], "close"),
    kill: (args) => openApp(args[args.length - 1], "close"),
    focus: (args) => openApp(args[0], "focus"),
    "xdg-open": (args) => {
      const key = (args[0] ?? "").toLowerCase().replace("itch.io", "itch");
      if (LINKS[key]) {
        window.open(LINKS[key], "_blank", "noopener");
        return [`opening ${LINKS[key]}`];
      }
      if (APPS.includes(key)) return openApp(key, "open");
      return [`xdg-open: no method available for opening '${args[0] ?? ""}'`];
    },
    playerctl: (args) => {
      const act = args[0];
      const press = (id) => document.getElementById(id)?.click();
      if (act === "play" || act === "pause" || act === "play-pause") {
        press("playButton");
        return [];
      }
      if (act === "next") {
        press("nextButton");
        return [];
      }
      if (act === "previous") {
        press("prevButton");
        return [];
      }
      if (act === "status") {
        const audio = document.getElementById("audioPlayer");
        return [audio && !audio.paused ? "Playing" : "Paused"];
      }
      return ["usage: playerctl play|pause|next|previous|status"];
    },
    sudo: () => [
      `${USER} is not in the sudoers file.  This incident will be reported.`,
    ],
    rm: (args) =>
      args.includes("/")
        ? [
            "rm: it is dangerous to operate recursively on '/'",
            "rm: use --no-preserve-root to override this failsafe",
          ]
        : [`rm: cannot remove '${args.at(-1) ?? ""}': Permission denied`],
    man: (args) => [`No manual entry for ${args[0] ?? "nothing"}`],
    cd: () => [],
    exit: () => ["logout"],
  };

  function openApp(raw, action) {
    const name = (raw ?? "").toLowerCase();
    if (name === "terminal") return ["terminal: operation not permitted"];
    if (!APPS.includes(name))
      return [`${action}: ${raw ?? ""}: no such application`];
    launch(name.charAt(0).toUpperCase() + name.slice(1), action, true);
    const pid = PIDS[name];
    if (action === "open")
      return [`[  OK  ] Started ${name}.service (pid ${pid})`];
    if (action === "close") return [`[  OK  ] Stopped ${name}.service`];
    return [`focused ${name}`];
  }

  const execute = (input) => {
    const text = input.trim();
    echo(text);
    if (!text) return;
    history.push(text);
    historyAt = history.length;
    const [cmd, ...args] = text.split(/\s+/);
    const handler = commands[cmd];
    if (!handler) {
      line(`bash: ${cmd}: command not found`);
      return;
    }
    (handler(args) ?? []).forEach((out) => line(out));
  };

  field.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      execute(field.value);
      field.value = "";
    } else if (event.key === "ArrowUp") {
      historyAt = Math.max(0, historyAt - 1);
      field.value = history[historyAt] ?? "";
      event.preventDefault();
    } else if (event.key === "ArrowDown") {
      historyAt = Math.min(history.length, historyAt + 1);
      field.value = history[historyAt] ?? "";
      event.preventDefault();
    } else if (event.key === "Tab") {
      const names = [...Object.keys(commands), ...APPS, ...Object.keys(LINKS)];
      const parts = field.value.split(/\s+/);
      const match = names.find(
        (n) => n.startsWith(parts.at(-1)) && parts.at(-1),
      );
      if (match) {
        parts[parts.length - 1] = match;
        field.value = parts.join(" ");
      }
      event.preventDefault();
    } else if (event.key === "l" && event.ctrlKey) {
      commands.clear();
      event.preventDefault();
    }
    event.stopPropagation();
  });
  root.addEventListener("pointerdown", () =>
    setTimeout(() => field.focus({ preventScroll: true }), 0),
  );

  const now = new Date();
  line(
    `Linux ${HOST} 6.12.0-site #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux`,
    "term-dim",
  );
  line(
    `Last login: ${now.toDateString()} ${now.toTimeString().slice(0, 8)} on tty1`,
    "term-dim",
  );
  log("cat /etc/motd", [
    "welcome. type 'help' for commands, or just click around.",
  ]);

  const title = (name) => name.toLowerCase();
  const on = (type, fn) =>
    document.addEventListener(`site:${type}`, (event) => fn(event.detail));

  on("window", ({ name, action, silent }) => {
    if (silent) return;
    const n = title(name);
    const pid = PIDS[n] ?? 9000;
    if (action === "open")
      log(`systemctl --user start ${n}.service`, [
        `[  OK  ] Started ${n}.service (pid ${pid})`,
      ]);
    else if (action === "close")
      log(`systemctl --user stop ${n}.service`, [
        `[  OK  ] Stopped ${n}.service`,
      ]);
    else if (action === "focus") log(`wmctrl -a "${n}"`);
  });
  on("move", ({ name, x, y }) =>
    log(`xdotool search --name "${title(name)}" windowmove ${x} ${y}`),
  );
  on("displace", ({ name, pct }) =>
    log(`wm-tile --avoid-overlap "${title(name)}"`, [
      `overlap ${pct}% exceeds 40%, window slid clear`,
    ]),
  );
  on("slide", ({ index, total, title: t, meta }) =>
    log(`slideshow --goto ${index + 1}/${total}`, [
      `${t.toLowerCase()}  ${meta}`,
    ]),
  );
  on("calc", ({ expr, result, error }) =>
    log(
      `echo "${expr}" | bc -l`,
      error ? ["(standard_in) 1: syntax error"] : [result],
    ),
  );

  document.addEventListener("click", (event) => {
    const el = event.target;
    const link = el.closest("a[href^='http']");
    if (link) {
      log(`xdg-open ${link.href}`);
      return;
    }
    if (el.closest("[aria-disabled='true']")) {
      log("mail --check", [
        "mail: no mailbox configured (address coming soon)",
      ]);
      return;
    }
    if (el.closest("#cookieButton")) {
      cookieBurst.count++;
      clearTimeout(cookieBurst.timer);
      cookieBurst.timer = setTimeout(() => {
        const total =
          document.getElementById("cookieCount")?.textContent ?? "?";
        log(`./clicker --click x${cookieBurst.count}`, [`cookies: ${total}`]);
        cookieBurst.count = 0;
      }, 700);
      return;
    }
    const upgrade = el.closest(".upgrade-button");
    if (upgrade) {
      const name =
        upgrade.id === "autoUpgrade" ? "auto-cookie" : "better-clicking";
      setTimeout(
        () =>
          log(`./clicker --buy ${name}`, [
            `cookies: ${document.getElementById("cookieCount")?.textContent ?? "?"}`,
          ]),
        0,
      );
      return;
    }
    const item = el.closest(".playlist-item");
    if (item) {
      const track = item.textContent.replace(/^\d+\s*/, "").trim();
      log(
        `mpv --playlist-start=${[...item.parentElement.children].indexOf(item)} playlist.m3u`,
        [`Playing: ${track}`],
      );
      return;
    }
    if (el.closest("#playButton")) {
      setTimeout(() => {
        const audio = document.getElementById("audioPlayer");
        const active = document
          .querySelector(".playlist-item.active")
          ?.textContent.replace(/^\d+\s*/, "")
          .trim();
        log(
          audio?.paused ? "playerctl pause" : "playerctl play",
          audio?.paused ? [] : [`Now playing: ${active ?? "unknown"}`],
        );
      }, 60);
      return;
    }
    if (el.closest("#nextButton") || el.closest("#prevButton")) {
      const forward = Boolean(el.closest("#nextButton"));
      setTimeout(() => {
        const active = document
          .querySelector(".playlist-item.active")
          ?.textContent.replace(/^\d+\s*/, "")
          .trim();
        log(forward ? "playerctl next" : "playerctl previous", [
          `Now playing: ${active ?? "unknown"}`,
        ]);
      }, 60);
      return;
    }
    if (el.closest("#progressContainer")) {
      const audio = document.getElementById("audioPlayer");
      setTimeout(
        () => log(`playerctl position ${Math.round(audio?.currentTime ?? 0)}`),
        0,
      );
      return;
    }
    if (el.closest("#desktopSection") && !el.closest(".window")) {
      log(`xev -event button`, [
        `ButtonPress  root x=${Math.round(event.clientX)} y=${Math.round(event.clientY)}`,
      ]);
    }
  });

  const audio = document.getElementById("audioPlayer");
  audio?.addEventListener("ended", () =>
    log("playerctl next", ["# track ended"]),
  );
}

if (root) start();
