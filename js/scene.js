const MAX = 24;
const MATERIALS = { glass: 0, black: 1 };
const OVERLAP_LIMIT = 0.4;
const NODE_SPACING = 118;
const NODE_K = 2;
const DEV_K = 2;
const NODE_R = 2.2;
const GLOW_RANGE = 130;
const TINT_L = 0.37;
const TINT_MAX_C = 0.085;

function toOklch([r, g, b]) {
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const [lr, lg, lb] = [lin(r), lin(g), lin(b)];
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    Math.hypot(a, bb),
    Math.atan2(bb, a),
  ];
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

function normalizeTint(hex) {
  const n = parseInt(hex.slice(1), 16);
  const [, c, h] = toOklch([
    (n >> 16) / 255,
    ((n >> 8) & 255) / 255,
    (n & 255) / 255,
  ]);
  const chroma = Math.min(c, TINT_MAX_C);
  return {
    rgb: fromOklch(TINT_L, chroma, h),
    ink: `oklch(0.9 ${(chroma * 0.55).toFixed(3)} ${((h * 180) / Math.PI).toFixed(1)})`,
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

float scene(vec2 p) {
  float d = 1e4;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 b = uBox[i];
    vec4 pr = uProp[i];
    float di = sdBox(p - b.xy, b.zw, pr.x) + (1.0 - pr.w) * 80.0;
    d = (i == 0) ? di : smin(d, di, pr.y);
  }
  return d;
}

vec2 mats(vec2 p, out vec3 tintCol, out float tintAmt) {
  float ws = 0.0;
  float black = 0.0;
  float tile = 0.0;
  vec3 tintSum = vec3(0.0);
  float tintW = 0.0;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 b = uBox[i];
    vec4 pr = uProp[i];
    float di = sdBox(p - b.xy, b.zw, pr.x) + (1.0 - pr.w) * 80.0;
    float w = exp(-max(di, 0.0) / 22.0);
    float isTile = step(9.5, pr.z);
    float m = pr.z - isTile * 10.0;
    ws += w;
    black += w * step(0.5, m) * step(m, 1.5);
    tile += w * isTile;
    tintSum += w * uTint[i].rgb * uTint[i].a;
    tintW += w * uTint[i].a;
  }
  tintCol = tintSum / max(tintW, 1e-4);
  tintAmt = tintW / max(ws, 1e-4);
  return vec2(black, tile) / max(ws, 1e-4);
}

vec4 web(vec2 p, float soft) {
  vec2 uv = p / uVP;
  if (soft < 0.5) return texture(uWeb, uv);
  vec2 o = vec2(5.0) / uVP;
  return (texture(uWeb, uv + vec2(o.x, 0.0)) + texture(uWeb, uv - vec2(o.x, 0.0))
    + texture(uWeb, uv + vec2(0.0, o.y)) + texture(uWeb, uv - vec2(0.0, o.y))) * 0.18;
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vnoise(p);
    p = p * 2.03 + 17.1;
    a *= 0.5;
  }
  return s;
}

vec3 base(vec2 p, float soft, float m) {
  vec2 rough = vec2(sin(p.y * 0.021 + uTime * 0.5 + vnoise(p * 0.006) * 6.0), sin(p.x * 0.019 - uTime * 0.4 + vnoise(p * 0.006 + 4.0) * 6.0)) * 2.2;
  vec2 pr = p + rough;
  vec2 n = p / uVP;
  vec3 c = vec3(0.034, 0.039, 0.036);
  c += ACC * 0.055 * exp(-length((n - vec2(0.2, 0.2)) * vec2(uVP.x / uVP.y, 1.0)) * 2.4);
  c += ACC * 0.025 * exp(-length((n - vec2(0.85, 0.75)) * vec2(uVP.x / uVP.y, 1.0)) * 2.4);

  vec2 g = mod(p, 18.0) - 9.0;
  float dotp = 1.0 - smoothstep(0.7, 1.4, length(g));
  float mask = smoothstep(1.0, 0.1, length((n - vec2(0.5, 0.4)) / vec2(0.85, 0.9)));
  c += vec3(0.085) * dotp * mask * (1.0 - soft * 0.6);

  vec2 q = p / uVP.y;
  float t = uTime * 0.02;
  vec2 w = vec2(fbm(q * 1.6 + t), fbm(q * 1.6 - t + 9.0));
  float nz = fbm(q * 1.4 + w * 0.9 + vec2(t, -t * 0.6));
  float f = (nz * 1.5 + m * 0.8) * 11.0 + sin(p.x * 0.012 + p.y * 0.009 + uTime * 0.3) * 0.06;
  float line = 1.0 - smoothstep(0.0, 1.1 + soft * 6.0, abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4));
  float major = step(abs(mod(floor(f + 0.5), 5.0)), 0.5);
  c += vec3(0.5, 0.72, 0.56) * line * mix(0.085, 0.19, major) * mix(1.0, 0.5, soft);

  vec4 wv = web(pr, soft);
  return c * (1.0 - wv.a) + wv.rgb;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  float D = scene(p);
  vec3 tintCol;
  float tintAmt;
  vec2 mix3 = mats(p, tintCol, tintAmt);
  float fBlack = mix3.x;
  float tile = mix3.y;
  float m = exp(-max(D, 0.0) / 240.0);
  vec3 col = base(p, 0.0, m);

  float shadow = smoothstep(44.0, -8.0, scene(p - vec2(0.0, 14.0))) * 0.55;
  col *= 1.0 - shadow * smoothstep(-2.0, 6.0, D);

  if (D > 0.0) {
    col *= 1.0 - tile * (1.0 - smoothstep(0.0, 5.0, D)) * 0.75;
    col = mix(col, ACC, tile * (1.0 - smoothstep(0.0, 1.3, abs(D - 5.5))) * 0.32);
  }

  if (D < 1.0) {
    vec2 n = normalize(vec2(dFdx(D), dFdy(D)) + 1e-5);
    float edge = clamp(-D / 20.0, 0.0, 1.0);
    float lit = max(dot(n, normalize(vec2(-0.55, -0.85))), 0.0);
    float rim = pow(1.0 - edge, 3.0);
    float band = 1.0 - smoothstep(0.0, 1.4, abs(D + 1.0));
    float inner = 1.0 - smoothstep(0.0, 0.9, abs(D + 6.0));
    vec3 bandCol = mix(vec3(1.0), ACC, tile * 0.85);
    vec2 gg = mod(p, 14.0) - 7.0;
    float glyph = 1.0 - smoothstep(0.7, 1.3, length(gg));

    vec2 p2 = p + n * (1.0 - edge) * (1.0 - edge) * 26.0;
    vec3 glass = base(p2, 1.0, m) * 0.4 + vec3(0.016, 0.018, 0.017);
    glass += vec3(0.028) * glyph * (0.4 + 0.6 * edge);
    glass += rim * (0.15 + 0.85 * lit) * 0.16;

    vec3 tinted = base(p2, 1.0, m) * 0.2 + tintCol * 0.95 + vec3(0.03) * glyph * (0.4 + 0.6 * edge);
    tinted += rim * (0.15 + 0.85 * lit) * 0.14;
    glass = mix(glass, tinted, tintAmt);

    vec3 black = vec3(0.03, 0.033, 0.031) + vec3(0.022) * glyph * 0.6;
    vec3 s = mix(glass, black, fBlack);
    float lines = mix(0.34, 0.3, fBlack);
    s += bandCol * band * (0.3 + 0.7 * lit) * lines;
    s += bandCol * inner * 0.06;
    col = mix(col, s, smoothstep(0.8, -0.8, D));
  }

  col += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const calm = matchMedia("(prefers-reduced-motion: reduce)").matches;

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

function outside(box, x, y) {
  const dx = Math.max(Math.abs(x - box.cx) - box.hw, 0);
  const dy = Math.max(Math.abs(y - box.cy) - box.hh, 0);
  return { d: Math.hypot(dx, dy), dx, dy };
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

  let dpr = 1;
  let web = scatter(innerWidth, innerHeight);
  let webScale = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    webScale = Math.min(dpr, 1);
    webCanvas.width = Math.round(innerWidth * webScale);
    webCanvas.height = Math.round(innerHeight * webScale);
    gl.viewport(0, 0, canvas.width, canvas.height);
    web = scatter(innerWidth, innerHeight);
  };
  resize();
  addEventListener("resize", resize);

  const mouse = { x: -999, y: -999, tx: -999, ty: -999 };
  addEventListener("pointermove", (event) => {
    mouse.tx = event.clientX;
    mouse.ty = event.clientY;
    if (mouse.x < -900) {
      mouse.x = mouse.tx;
      mouse.y = mouse.ty;
    }
  });

  const items = [...root.querySelectorAll(".window, .app-icon__tile")].map(
    (el) => ({
      el,
      isWindow: el.classList.contains("window"),
      mat: MATERIALS[(el.closest("[data-pane]") ?? el).dataset.pane] ?? 0,
      tint: el.dataset.tint ? normalizeTint(el.dataset.tint) : null,
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
      sx: 1,
      sy: 1,
      mask: "",
      box: null,
    }),
  );

  items.forEach((item) => {
    if (item.tint) item.el.style.color = item.tint.ink;
  });

  const boxes = new Float32Array(MAX * 4);
  const props = new Float32Array(MAX * 4);
  const tints = new Float32Array(MAX * 4);
  const stiff = calm ? 900 : 260;
  const damp = calm ? 60 : 15;
  const sStiff = calm ? 900 : 300;
  const sDamp = calm ? 60 : 16;
  const amp = calm ? 0 : 16;

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
        const o = outside(box, tx, ty);
        if (o.d < 70) {
          const push = (70 - o.d) * 0.55;
          const len = o.d || 1;
          tx += (o.dx / len) * Math.sign(tx - box.cx) * push;
          ty += (o.dy / len) * Math.sign(ty - box.cy) * push;
        }
        near = Math.max(near, 1 - clamp(o.d / GLOW_RANGE, 0, 1));
      });
      const md = Math.hypot(tx - mouse.x, ty - mouse.y);
      if (md < 120 && !calm) {
        const push = ((120 - md) / 120) * 10;
        tx += ((tx - mouse.x) / (md || 1)) * push;
        ty += ((ty - mouse.y) / (md || 1)) * push;
      }
      near = Math.max(near, 1 - clamp(md / GLOW_RANGE, 0, 1));
      n.x += (tx - n.x) * 0.12;
      n.y += (ty - n.y) * 0.12;
      n.glow += (near - n.glow) * 0.12;
    });

    ctx.lineCap = "round";
    ctx.lineWidth = 1.3;
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

    web.edges.forEach(([i, j, bend, phase]) => {
      const a = web.nodes[i];
      const b = web.nodes[j];
      const g = Math.max(a.glow, b.glow);
      ctx.strokeStyle = `rgba(120, 160, 128, ${0.12 + g * 0.45})`;
      curve(
        a.x,
        a.y,
        b.x,
        b.y,
        bend * (0.85 + 0.15 * Math.sin(t * 0.3 + phase)),
      );
    });

    ctx.lineWidth = 1.3;
    ctx.strokeStyle = "rgba(110, 200, 125, 0.3)";
    live.forEach((box) => {
      web.nodes
        .map((n) => ({ n, d: Math.hypot(n.x - box.cx, n.y - box.cy) }))
        .sort((p, q) => p.d - q.d)
        .slice(0, DEV_K)
        .forEach(({ n }, k) => {
          curve(box.cx, box.cy, n.x, n.y, k ? -0.18 : 0.22);
        });
    });

    web.nodes.forEach((n) => {
      const lift = n.glow;
      ctx.strokeStyle = `rgba(${150 - lift * 53}, ${170 + lift * 65}, ${155 - lift * 40}, ${0.45 + lift * 0.5})`;
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

  let last = performance.now();

  const frame = (now) => {
    const dt = clamp((now - last) / 1000, 0, 1 / 40);
    last = now;
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

    const stack = items
      .filter((item) => item.isWindow && item.visible && !item.closing)
      .map((item, order) => ({
        item,
        z: Number(item.el.style.zIndex) || 0,
        order,
      }))
      .sort((a, b) => a.z - b.z || a.order - b.order)
      .map(({ item }) => item);

    stack.forEach((lower, index) => {
      if (lower.el.dataset.dragging !== undefined) return;
      if (Math.abs((lower.fx ?? 1e9) - lower.el.offsetLeft) > 1.5)
        lower.fx = lower.el.offsetLeft;
      if (Math.abs((lower.fy ?? 1e9) - lower.el.offsetTop) > 1.5)
        lower.fy = lower.el.offsetTop;
      for (let j = index + 1; j < stack.length; j++) {
        const upper = stack[j];
        const ox =
          Math.min(lower.cx + lower.w / 2, upper.cx + upper.w / 2) -
          Math.max(lower.cx - lower.w / 2, upper.cx - upper.w / 2);
        const oy =
          Math.min(lower.cy + lower.h / 2, upper.cy + upper.h / 2) -
          Math.max(lower.cy - lower.h / 2, upper.cy - upper.h / 2);
        if (ox <= 0 || oy <= 0) continue;
        const area = lower.w * lower.h;
        if ((ox * oy) / area <= OVERLAP_LIMIT) continue;
        const allowed = OVERLAP_LIMIT * area;
        const dirX = Math.sign(lower.cx - upper.cx) || 1;
        const dirY = Math.sign(lower.cy - upper.cy) || 1;
        const pushX = ox - allowed / oy;
        const pushY = oy - allowed / ox;
        const roomX = dirX > 0 ? innerWidth - lower.w - lower.fx : lower.fx;
        const roomY = dirY > 0 ? innerHeight - lower.h - lower.fy : lower.fy;
        const useX =
          roomX >= pushX * 0.6 && (pushX <= pushY || roomY < pushY * 0.6);
        const ease = Math.min(1, dt * 5);
        if (useX) lower.fx += dirX * pushX * ease;
        else lower.fy += dirY * pushY * ease;
        lower.fx = clamp(lower.fx, 0, Math.max(0, innerWidth - lower.w));
        lower.fy = clamp(lower.fy, 0, Math.max(0, innerHeight - lower.h));
        lower.el.style.left = `${lower.fx}px`;
        lower.el.style.top = `${lower.fy}px`;
        break;
      }
    });

    let count = 0;
    items.forEach((item) => {
      if (!item.visible) {
        item.shown = false;
        item.alpha = 0;
        item.box = null;
        return;
      }
      const closing =
        item.isWindow && item.el.style.animation.includes("close");
      if (!item.shown) {
        item.shown = true;
        item.x = item.cx;
        item.y = item.cy;
        item.vx = item.vy = 0;
        item.s = item.isWindow ? 0.84 : 1;
        item.vs = 0;
        item.alpha = item.isWindow ? 0 : 1;
      }
      let targetScale = 1;
      if (closing) targetScale = 0.84;
      else if (
        !item.isWindow &&
        item.el.closest(".app-icon")?.matches(":hover")
      ) {
        targetScale = item.el.closest(".app-icon--disabled") ? 1 : 1.06;
      }
      item.vx += (stiff * (item.cx - item.x) - damp * item.vx) * dt;
      item.vy += (stiff * (item.cy - item.y) - damp * item.vy) * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.vs += (sStiff * (targetScale - item.s) - sDamp * item.vs) * dt;
      item.s = clamp(item.s + item.vs * dt, 0.5, 1.4);
      item.alpha += ((closing ? 0 : 1) - item.alpha) * Math.min(1, dt * 10);

      const sq = calm
        ? 0
        : clamp(
            Math.abs(item.vx) * 0.00022 - Math.abs(item.vy) * 0.00012,
            -0.08,
            0.08,
          );
      const sqY = calm
        ? 0
        : clamp(
            Math.abs(item.vy) * 0.00022 - Math.abs(item.vx) * 0.00012,
            -0.08,
            0.08,
          );
      item.sx = clamp(1 + sq - sqY * 0.5, 0.9, 1.1);
      item.sy = clamp(1 + sqY - sq * 0.5, 0.9, 1.1);
      item.dx = item.x - item.cx;
      item.dy = item.y - item.cy;

      const sw = item.sx * item.s;
      const sh = item.sy * item.s;
      item.el.style.transform = `translate(${item.dx}px, ${item.dy}px) scale(${sw}, ${sh})`;
      if (item.isWindow) item.el.style.opacity = item.alpha.toFixed(3);

      if (item.alpha < 0.01 || count >= MAX) {
        item.box = null;
        return;
      }
      item.box = {
        cx: item.x,
        cy: item.y,
        hw: (item.w * sw) / 2,
        hh: (item.h * sh) / 2,
      };
      const i = count++;
      tints.set(item.tint ? [...item.tint.rgb, 1] : [0, 0, 0, 0], i * 4);
      boxes.set([item.box.cx, item.box.cy, item.box.hw, item.box.hh], i * 4);
      props.set(
        [
          item.isWindow ? 12 : item.h / 2,
          item.isWindow ? 36 : 12,
          item.mat + (item.isWindow ? 0 : 10),
          item.alpha,
        ],
        i * 4,
      );
    });

    const windows = items
      .filter((item) => item.isWindow && item.box)
      .map((item, order) => ({
        item,
        z: Number(item.el.style.zIndex) || 0,
        order,
      }))
      .sort((a, b) => a.z - b.z || a.order - b.order);

    windows.forEach(({ item }, index) => {
      const own = item.box;
      const holes = [];
      for (let j = index + 1; j < windows.length; j++) {
        const other = windows[j].item.box;
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

    drawWeb(
      now,
      items.filter((item) => item.box).map((item) => item.box),
    );

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform2f(uVP, innerWidth, innerHeight);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform1i(uCount, count);
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
