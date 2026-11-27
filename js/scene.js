const MAX = 24;
const OVERLAP_LIMIT = 0.4;
const NODE_SPACING = 150;
const NODE_K = 2;
const DEV_K = 2;
const GLOW_RANGE = 130;
const TILE_L = 0.37;
const TILE_MAX_C = 0.085;
const KIND = { glass: 0, matte: 1, tile: 2, dock: 3 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    clamp(c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055, 0, 1);
  return [
    enc(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    enc(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    enc(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  ];
}

function tintsFor(hex) {
  const { c, h } = toOklch(hex);
  const css = (rgb) => rgb.map((v) => Math.round(v * 255)).join(" ");
  return {
    fill: fromOklch(TILE_L, Math.min(c, TILE_MAX_C), h),
    vivid: fromOklch(0.78, Math.min(Math.max(c, 0.02), 0.17), h),
    ink: `oklch(0.2 ${(Math.min(c, TILE_MAX_C) * 0.55).toFixed(3)} ${((h * 180) / Math.PI).toFixed(1)})`,
    css,
  };
}

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform vec2 uVP;
uniform float uDpr;
uniform float uTime;
uniform int uCount;
uniform vec4 uBox[${MAX}];
uniform vec4 uProp[${MAX}];
uniform vec4 uTint[${MAX}];
uniform sampler2D uWeb;
out vec4 outColor;

const vec3 ACC = vec3(0.38, 0.92, 0.45);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float sdBox(vec2 p, vec2 h, float r) {
  vec2 q = abs(p) - h + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

float sdItem(vec2 p, int i) {
  vec4 b = uBox[i];
  vec4 pr = uProp[i];
  float d = sdBox(p - b.xy, b.zw, pr.x);
  if (pr.y > 2.5) {
    for (int j = 0; j < ${MAX}; j++) {
      if (j >= uCount) break;
      if (uProp[j].y > 1.5 && uProp[j].y < 2.5) {
        d = smin(d, sdBox(p - uBox[j].xy, uBox[j].zw, uProp[j].x), 24.0);
      }
    }
  }
  return d;
}

vec4 web(vec2 p, float soft) {
  vec2 uv = p / uVP;
  if (soft < 0.5) return texture(uWeb, uv);
  vec2 o = vec2(5.0) / uVP;
  return (texture(uWeb, uv + vec2(o.x, 0.0)) + texture(uWeb, uv - vec2(o.x, 0.0))
    + texture(uWeb, uv + vec2(0.0, o.y)) + texture(uWeb, uv - vec2(0.0, o.y))) * 0.18;
}

float starForm(vec2 p, vec2 c, float R, float k, float sharp, float twist, float phase) {
  vec2 d = p - c;
  float r = length(d);
  if (r > R * 1.3) return 0.0;
  float th = atan(d.y, d.x) + phase + twist * r / R;
  float lobe = pow(abs(cos(k * 0.5 * th)), sharp);
  float Rt = R * (0.36 + 0.64 * lobe) * (1.0 + 0.07 * sin(uTime * 0.6 + th * 3.0));
  float u = r / Rt;
  if (u >= 1.0) return 0.0;
  float h = sqrt(1.0 - u * u);
  vec3 n = normalize(vec3(d / Rt, h * 1.25));
  float lit = clamp(dot(n, normalize(vec3(-0.5, -0.6, 0.65))) * 0.85 + 0.18, 0.0, 1.0);
  lit += pow(max(dot(n, normalize(vec3(-0.3, -0.4, 0.86))), 0.0), 16.0) * 0.55;
  vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p / 6.5;
  float dist = length(fract(g) - 0.5);
  float rad = sqrt(clamp(lit, 0.0, 1.0)) * 0.56;
  float dotm = 1.0 - smoothstep(rad - 0.1, rad + 0.04, dist);
  return dotm * smoothstep(1.0, 0.93, u);
}

vec3 base(vec2 p, float soft) {
  vec2 rough = vec2(sin(p.y * 0.021 + uTime * 0.18), sin(p.x * 0.019 - uTime * 0.14)) * 1.4;
  vec2 pr = p + rough;
  vec2 n = p / uVP;
  float s = min(uVP.x, uVP.y);
  vec3 c = vec3(0.03, 0.034, 0.032);
  c += ACC * 0.04 * exp(-length((n - vec2(0.2, 0.2)) * vec2(uVP.x / uVP.y, 1.0)) * 2.4);

  vec2 g = mod(p, 18.0) - 9.0;
  float dotp = 1.0 - smoothstep(0.7, 1.4, length(g));
  c += vec3(0.05) * dotp * (1.0 - soft * 0.6);

  float t = uTime * 0.05;
  float f = 0.0;
  f += starForm(p, uVP * vec2(0.64 + 0.04 * sin(t), 0.2 + 0.03 * cos(t * 1.3)), s * 0.2, 8.0, 3.2, 0.0, t);
  f += starForm(p, uVP * vec2(0.5 + 0.05 * cos(t * 0.8), 0.78 + 0.03 * sin(t)), s * 0.17, 4.0, 1.6, 0.0, -t * 0.7);
  f += starForm(p, uVP * vec2(0.93, 0.5 + 0.06 * sin(t * 0.9)), s * 0.15, 5.0, 1.2, 2.6, t * 0.5);
  c += vec3(0.78, 0.84, 0.8) * f * 0.5 * (1.0 - soft * 0.45);

  vec4 wv = web(pr, soft);
  return c * (1.0 - wv.a) + wv.rgb;
}

vec3 shade(vec2 p, int i, float d) {
  vec4 b = uBox[i];
  vec4 pr = uProp[i];
  vec4 tn = uTint[i];
  float kind = pr.y;
  vec2 gr = vec2(
    sdItem(p + vec2(1.0, 0.0), i) - sdItem(p - vec2(1.0, 0.0), i),
    sdItem(p + vec2(0.0, 1.0), i) - sdItem(p - vec2(0.0, 1.0), i)
  );
  vec2 n = normalize(gr + 1e-5);
  float edge = clamp(-d / 20.0, 0.0, 1.0);
  float lit = max(dot(n, normalize(vec2(-0.55, -0.85))), 0.0);
  float band = 1.0 - smoothstep(0.0, 1.5, abs(d + 1.1));
  float inner = 1.0 - smoothstep(0.0, 0.9, abs(d + 6.0));
  vec2 gg = mod(p, 14.0) - 7.0;
  float glyph = 1.0 - smoothstep(0.7, 1.3, length(gg));
  vec3 edgeCol = mix(vec3(1.0), tn.rgb, tn.a);
  vec3 s;

  if (kind < 0.5 || kind > 2.5) {
    vec2 p2 = p + n * (1.0 - edge) * (1.0 - edge) * 26.0;
    s = base(p2, 1.0) * 0.4 + vec3(0.016, 0.018, 0.017);
    s += vec3(0.028) * glyph * (0.4 + 0.6 * edge);
    s += pow(1.0 - edge, 3.0) * (0.15 + 0.85 * lit) * 0.16;
    s += vec3(1.0) * band * (0.3 + 0.7 * lit) * 0.34;
    s += vec3(1.0) * inner * 0.06;
  } else if (kind < 1.5) {
    s = vec3(0.028, 0.031, 0.029) + vec3(0.02) * glyph;
    s += edgeCol * band * (0.3 + 0.7 * lit) * 0.62;
    s += edgeCol * inner * 0.07;
    vec2 q = abs(p - b.xy) - (b.zw - vec2(11.0));
    s += edgeCol * (1.0 - smoothstep(1.1, 2.1, length(q))) * 0.5;
  } else {
    s = tn.rgb * 0.95 + vec3(0.05) * lit * (1.0 - edge);
    s += vec3(1.0) * band * (0.3 + 0.7 * lit) * 0.4;
    s += vec3(0.03) * glyph;
  }
  return s;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec3 col = base(p, 0.0);

  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 pr = uProp[i];
    float d = sdItem(p, i);
    float tile = step(1.5, pr.y) * step(pr.y, 2.5);
    float sh = smoothstep(34.0, -6.0, sdItem(p - vec2(0.0, 12.0), i)) * 0.5 * pr.w * (1.0 - tile);
    col *= 1.0 - sh * smoothstep(-1.0, 5.0, d);
    float cov = smoothstep(0.9, -0.9, d) * pr.w;
    if (cov < 0.003) continue;
    col = mix(col, shade(p, i, d), cov);
  }

  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader));
    return null;
  }
  return shader;
}

function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function scatter(width, height) {
  const rand = seeded(1337);
  const nodes = [];
  const tries =
    Math.round((width * height) / (NODE_SPACING * NODE_SPACING)) * 14;
  for (let t = 0; t < tries; t++) {
    const x = rand() * width;
    const y = rand() * height;
    if (nodes.every((n) => Math.hypot(n.hx - x, n.hy - y) >= NODE_SPACING)) {
      nodes.push({
        hx: x,
        hy: y,
        x,
        y,
        a: rand() * 6.28,
        b: rand() * 6.28,
        f: 0.15 + rand() * 0.25,
        glow: 0,
        kind: rand() < 0.6 ? 0 : rand() < 0.65 ? 1 : 2,
      });
    }
  }
  const seen = new Set();
  const edges = [];
  nodes.forEach((n, i) => {
    nodes
      .map((m, j) => ({ j, d: Math.hypot(n.hx - m.hx, n.hy - m.hy) }))
      .filter((o) => o.j !== i)
      .sort((p, q) => p.d - q.d)
      .slice(0, NODE_K)
      .forEach(({ j }) => {
        const key = i < j ? `${i}-${j}` : `${j}-${i}`;
        if (!seen.has(key)) {
          seen.add(key);
          edges.push([i, j, (rand() - 0.5) * 0.6, rand() * 6.28]);
        }
      });
  });
  return { nodes, edges };
}

function start(root) {
  const canvas = document.createElement("canvas");
  canvas.className = "scene-canvas";
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
  if (!gl) return;

  const vs = compile(gl, gl.VERTEX_SHADER, VERT);
  const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(program));
    return;
  }
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(program, name);
  const uRes = u("uRes");
  const uVP = u("uVP");
  const uDpr = u("uDpr");
  const uTime = u("uTime");
  const uCount = u("uCount");
  const uBox = u("uBox");
  const uProp = u("uProp");
  const uTint = u("uTint");
  gl.uniform1i(u("uWeb"), 0);

  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

  const webCanvas = document.createElement("canvas");
  const ctx = webCanvas.getContext("2d");

  root.prepend(canvas);
  document.documentElement.classList.add("gl");

  let quality = 1;
  let needSettle = true;
  let web = scatter(innerWidth, innerHeight);
  const webScale = 0.6;
  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5) * quality;
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const resizeAll = () => {
    resize();
    webCanvas.width = Math.round(innerWidth * webScale);
    webCanvas.height = Math.round(innerHeight * webScale);
    web = scatter(innerWidth, innerHeight);
    needSettle = true;
  };
  resizeAll();
  addEventListener("resize", resizeAll);

  const mouse = { x: -999, y: -999, tx: -999, ty: -999 };
  addEventListener("pointermove", (event) => {
    mouse.tx = event.clientX;
    mouse.ty = event.clientY;
    if (mouse.x < -900) {
      mouse.x = mouse.tx;
      mouse.y = mouse.ty;
    }
  });

  document.addEventListener("site:window", () => (needSettle = true));
  document.addEventListener("site:move", () => (needSettle = true));

  const items = [
    ...root.querySelectorAll(".window, .app-dock, .app-icon__tile"),
  ].map((el) => {
    const isWindow = el.classList.contains("window");
    const isTile = el.classList.contains("app-icon__tile");
    const isDock = el.classList.contains("app-dock");
    const tint = el.dataset.tint ? tintsFor(el.dataset.tint) : null;
    if (tint && isTile) el.style.color = tint.ink;
    if (tint && isWindow) {
      el.style.setProperty("--accent", `rgb(${tint.css(tint.vivid)})`);
      el.style.setProperty(
        "--accent-glow",
        `rgb(${tint.css(tint.vivid)} / 0.38)`,
      );
      el.style.setProperty(
        "--accent-soft",
        `rgb(${tint.css(tint.vivid)} / 0.14)`,
      );
    }
    return {
      el,
      isWindow,
      isTile,
      isDock,
      kind: isDock
        ? KIND.dock
        : isTile
          ? KIND.tile
          : el.dataset.pane === "glass"
            ? KIND.glass
            : KIND.matte,
      tint,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      s: 1,
      vs: 0,
      alpha: 0,
      shown: false,
      dx: 0,
      dy: 0,
      mask: "",
      box: null,
      target: null,
    };
  });

  const boxes = new Float32Array(MAX * 4);
  const props = new Float32Array(MAX * 4);
  const tints = new Float32Array(MAX * 4);
  const stiff = calm ? 900 : 280;
  const damp = calm ? 60 : 26;
  const sStiff = calm ? 900 : 320;
  const sDamp = calm ? 60 : 26;
  const amp = calm ? 0 : 14;

  const drawWeb = (now, live) => {
    const t = now / 1000;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, webCanvas.width, webCanvas.height);
    ctx.setTransform(webScale, 0, 0, webScale, 0, 0);

    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, innerWidth, innerHeight);
    live.forEach((box) => {
      ctx.roundRect(
        box.cx - box.hw,
        box.cy - box.hh,
        box.hw * 2,
        box.hh * 2,
        12,
      );
    });
    ctx.clip("evenodd");

    web.nodes.forEach((n) => {
      let tx = n.hx + Math.sin(t * n.f + n.a) * amp;
      let ty = n.hy + Math.cos(t * n.f * 0.8 + n.b) * amp;
      let near = 0;
      live.forEach((box) => {
        const qx = Math.abs(tx - box.cx) - box.hw;
        const qy = Math.abs(ty - box.cy) - box.hh;
        const d =
          Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) +
          Math.min(Math.max(qx, qy), 0);
        if (d < 70) {
          const push = Math.min(70 - d, 90) * 0.5;
          if (qx > qy) tx += Math.sign(tx - box.cx || 1) * push;
          else ty += Math.sign(ty - box.cy || 1) * push;
        }
        near = Math.max(near, 1 - clamp(d / GLOW_RANGE, 0, 1));
      });
      near = Math.max(
        near,
        1 - clamp(Math.hypot(tx - mouse.x, ty - mouse.y) / GLOW_RANGE, 0, 1),
      );
      n.x += (tx - n.x) * 0.1;
      n.y += (ty - n.y) * 0.1;
      n.glow += (near - n.glow) * 0.08;
    });

    const curve = (x0, y0, x1, y1, bend) => {
      const mx = (x0 + x1) / 2;
      const my = (y0 + y1) / 2;
      const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(
        mx - ((y1 - y0) / len) * len * bend,
        my + ((x1 - x0) / len) * len * bend,
        x1,
        y1,
      );
      ctx.stroke();
    };

    ctx.lineCap = "round";
    ctx.lineWidth = 1.3;
    web.edges.forEach(([i, j, bend, phase]) => {
      const a = web.nodes[i];
      const b = web.nodes[j];
      const g = Math.max(a.glow, b.glow);
      ctx.strokeStyle = `rgba(120, 160, 128, ${0.09 + g * 0.4})`;
      curve(
        a.x,
        a.y,
        b.x,
        b.y,
        bend * (0.85 + 0.15 * Math.sin(t * 0.3 + phase)),
      );
    });

    ctx.strokeStyle = "rgba(110, 200, 125, 0.26)";
    live.forEach((box) => {
      web.nodes
        .map((n) => ({ n, d: Math.hypot(n.x - box.cx, n.y - box.cy) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, DEV_K)
        .forEach(({ n }, k) =>
          curve(box.cx, box.cy, n.x, n.y, k ? -0.18 : 0.22),
        );
    });

    web.nodes.forEach((n) => {
      const lift = n.glow;
      ctx.strokeStyle = `rgba(${150 - lift * 53}, ${170 + lift * 65}, ${155 - lift * 40}, ${0.4 + lift * 0.5})`;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      if (n.kind === 0) {
        ctx.arc(n.x, n.y, 1.8 + lift * 1.2, 0, 6.2832);
        ctx.fill();
      } else if (n.kind === 1) {
        ctx.arc(n.x, n.y, 4.2 + lift * 2, 0, 6.2832);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(n.x, n.y, 1.2, 0, 6.2832);
        ctx.fill();
      } else {
        const r = 4 + lift * 2;
        ctx.moveTo(n.x - r, n.y);
        ctx.lineTo(n.x + r, n.y);
        ctx.moveTo(n.x, n.y - r);
        ctx.lineTo(n.x, n.y + r);
        ctx.stroke();
      }
    });
    ctx.restore();

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      webCanvas,
    );
  };

  const settle = (windows) => {
    const stack = windows
      .map((item, order) => ({
        item,
        order,
        z: Number(item.el.style.zIndex) || 0,
        x: item.el.offsetLeft,
        y: item.el.offsetTop,
        w: item.el.offsetWidth,
        h: item.el.offsetHeight,
      }))
      .sort((a, b) => a.z - b.z || a.order - b.order);
    const coverage =
      stack.reduce((sum, win) => sum + win.w * win.h, 0) /
      (innerWidth * innerHeight * 0.75);
    const limit = clamp(
      OVERLAP_LIMIT + (0.95 - OVERLAP_LIMIT) * clamp(coverage, 0, 1) ** 1.3,
      OVERLAP_LIMIT,
      0.95,
    );

    for (let pass = 0; pass < 8; pass++) {
      let moved = false;
      stack.forEach((lower, index) => {
        if (lower.item.el.dataset.dragging !== undefined) return;
        for (let j = index + 1; j < stack.length; j++) {
          const upper = stack[j];
          const ox =
            Math.min(lower.x + lower.w, upper.x + upper.w) -
            Math.max(lower.x, upper.x);
          const oy =
            Math.min(lower.y + lower.h, upper.y + upper.h) -
            Math.max(lower.y, upper.y);
          if (ox <= 0 || oy <= 0) continue;
          const area = lower.w * lower.h;
          if ((ox * oy) / area <= limit + 0.05) continue;
          const allowed = limit * area;
          const dirX =
            Math.sign(lower.x + lower.w / 2 - (upper.x + upper.w / 2)) || 1;
          const dirY =
            Math.sign(lower.y + lower.h / 2 - (upper.y + upper.h / 2)) || 1;
          const pushX = ox - allowed / oy;
          const pushY = oy - allowed / ox;
          const roomX = dirX > 0 ? innerWidth - lower.w - lower.x : lower.x;
          const roomY = dirY > 0 ? innerHeight - lower.h - lower.y : lower.y;
          const useX =
            roomX >= pushX * 0.6 && (pushX <= pushY || roomY < pushY * 0.6);
          if (useX)
            lower.x = clamp(
              lower.x + dirX * pushX,
              0,
              Math.max(0, innerWidth - lower.w),
            );
          else
            lower.y = clamp(
              lower.y + dirY * pushY,
              0,
              Math.max(0, innerHeight - lower.h),
            );
          moved = true;
          break;
        }
      });
      if (!moved) break;
    }

    stack.forEach((win) => {
      const dx = win.x - win.item.el.offsetLeft;
      const dy = win.y - win.item.el.offsetTop;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        win.item.target = {
          x: win.x,
          y: win.y,
          fx: win.item.el.offsetLeft,
          fy: win.item.el.offsetTop,
        };
      }
    });
  };

  let last = performance.now();
  let avg = 16.7;
  let tick = 0;
  let fastFrames = 0;

  const frame = (now) => {
    const raw = now - last;
    const dt = clamp(raw / 1000, 0, 1 / 40);
    last = now;
    avg = avg * 0.94 + raw * 0.06;
    if (++tick % 40 === 0) {
      if (avg > 24 && quality > 0.5) {
        quality = Math.max(0.5, quality - 0.125);
        resize();
        fastFrames = 0;
      } else if (avg < 17.6 && quality < 1 && ++fastFrames > 6) {
        quality = Math.min(1, quality + 0.0625);
        resize();
        fastFrames = 0;
      }
    }

    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 8);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 8);

    items.forEach((item) => {
      item.visible = item.el.getClientRects().length > 0;
      item.closing = item.isWindow && item.el.style.animation.includes("close");
      if (!item.visible) return;
      const rect = item.el.getBoundingClientRect();
      item.w = item.el.offsetWidth;
      item.h = item.el.offsetHeight;
      item.cx = rect.left + rect.width / 2 - item.dx;
      item.cy = rect.top + rect.height / 2 - item.dy;
    });

    const windows = items.filter(
      (item) => item.isWindow && item.visible && !item.closing,
    );
    const anyDrag = windows.some(
      (item) => item.el.dataset.dragging !== undefined,
    );
    if (needSettle && !anyDrag) {
      needSettle = false;
      settle(windows);
    }
    items.forEach((item) => {
      if (!item.target) return;
      if (item.el.dataset.dragging !== undefined) {
        item.target = null;
        return;
      }
      const t = item.target;
      t.fx += (t.x - t.fx) * Math.min(1, dt * 5);
      t.fy += (t.y - t.fy) * Math.min(1, dt * 5);
      item.el.style.left = `${t.fx}px`;
      item.el.style.top = `${t.fy}px`;
      if (Math.abs(t.x - t.fx) < 0.4 && Math.abs(t.y - t.fy) < 0.4) {
        item.el.style.left = `${t.x}px`;
        item.el.style.top = `${t.y}px`;
        item.target = null;
      }
    });

    items.forEach((item) => {
      if (!item.visible) {
        item.shown = false;
        item.alpha = 0;
        item.box = null;
        return;
      }
      if (!item.shown) {
        item.shown = true;
        item.x = item.cx;
        item.y = item.cy;
        item.vx = item.vy = 0;
        const booting = now < 1600;
        item.s = item.isWindow && !booting ? 0.84 : 1;
        item.vs = 0;
        item.alpha = item.isWindow && !booting ? 0 : 1;
      }
      let targetScale = 1;
      if (item.closing) targetScale = 0.84;
      else if (item.isTile && item.el.closest(".app-icon")?.matches(":hover"))
        targetScale = 1.1;
      if (item.el.dataset.dragging !== undefined || item.target) {
        item.x = item.cx;
        item.y = item.cy;
        item.vx = item.vy = 0;
      }
      item.vx += (stiff * (item.cx - item.x) - damp * item.vx) * dt;
      item.vy += (stiff * (item.cy - item.y) - damp * item.vy) * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vs += (sStiff * (targetScale - item.s) - sDamp * item.vs) * dt;
      item.s = clamp(item.s + item.vs * dt, 0.5, 1.4);
      item.alpha +=
        ((item.closing ? 0 : 1) - item.alpha) * Math.min(1, dt * 10);
      item.dx = item.x - item.cx;
      item.dy = item.y - item.cy;
      item.el.style.transform = `translate(${item.dx}px, ${item.dy}px) scale(${item.s})`;
      if (item.isWindow) item.el.style.opacity = item.alpha.toFixed(3);
      item.box =
        item.alpha < 0.01
          ? null
          : {
              cx: item.x,
              cy: item.y,
              hw: (item.w * item.s) / 2,
              hh: (item.h * item.s) / 2,
            };
    });

    const stacked = windows
      .filter((item) => item.box)
      .map((item, order) => ({
        item,
        z: Number(item.el.style.zIndex) || 0,
        order,
      }))
      .sort((a, b) => a.z - b.z || a.order - b.order)
      .map(({ item }) => item);

    stacked.forEach((item, index) => {
      const own = item.box;
      const holes = [];
      for (let j = index + 1; j < stacked.length; j++) {
        const other = stacked[j].box;
        const x0 = Math.max(own.cx - own.hw, other.cx - other.hw);
        const x1 = Math.min(own.cx + own.hw, other.cx + other.hw);
        const y0 = Math.max(own.cy - own.hh, other.cy - other.hh);
        const y1 = Math.min(own.cy + own.hh, other.cy + other.hh);
        if (x1 - x0 < 6 || y1 - y0 < 6) continue;
        const cx = (x0 + x1) / 2 - (own.cx - own.hw);
        const cy = (y0 + y1) / 2 - (own.cy - own.hh);
        const rx = ((x1 - x0) / 2) * 1.42 + 10;
        const ry = ((y1 - y0) / 2) * 1.42 + 10;
        holes.push(
          `radial-gradient(ellipse ${rx.toFixed(0)}px ${ry.toFixed(0)}px at ${cx.toFixed(0)}px ${cy.toFixed(0)}px, rgb(0 0 0 / 0.06) 0%, rgb(0 0 0 / 0.06) 66%, #000 100%)`,
        );
      }
      const mask = holes.join(",");
      if (mask !== item.mask) {
        item.mask = mask;
        item.el.style.maskImage = mask || "";
        item.el.style.webkitMaskImage = mask || "";
        item.el.style.maskComposite = "intersect";
        item.el.style.webkitMaskComposite = "source-in";
      }
    });
    items
      .filter((item) => item.isWindow && !item.box && item.mask)
      .forEach((item) => {
        item.mask = "";
        item.el.style.maskImage = "";
        item.el.style.webkitMaskImage = "";
      });

    const ordered = [
      ...items.filter((item) => item.isDock && item.box),
      ...items.filter((item) => item.isTile && item.box),
      ...stacked,
    ].slice(0, MAX);
    ordered.forEach((item, i) => {
      boxes.set([item.box.cx, item.box.cy, item.box.hw, item.box.hh], i * 4);
      props.set(
        [item.isWindow ? 12 : item.isDock ? 30 : 16, item.kind, 0, item.alpha],
        i * 4,
      );
      tints.set(
        item.tint
          ? [
              ...(item.isTile ? item.tint.fill : item.tint.vivid),
              item.isTile ? 1 : 0.85,
            ]
          : [0, 0, 0, 0],
        i * 4,
      );
    });

    if (tick % 2 === 0 || anyDrag) {
      drawWeb(
        now,
        ordered.map((item) => item.box),
      );
    }

    const dpr = canvas.width / innerWidth;
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uVP, innerWidth, innerHeight);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform1i(uCount, ordered.length);
    gl.uniform4fv(uBox, boxes);
    gl.uniform4fv(uProp, props);
    gl.uniform4fv(uTint, tints);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

const root = document.querySelector("[data-scene]");
if (root) start(root);
