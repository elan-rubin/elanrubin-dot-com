const MAX = 24;
const MATERIALS = { glass: 0, black: 1, white: 2, green: 3 };

const VERT = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`;

const FRAG = `#version 300 es
precision highp float;
uniform vec2 uRes;
uniform float uDpr;
uniform float uTime;
uniform vec2 uMouse;
uniform int uCount;
uniform vec4 uBox[${MAX}];
uniform vec4 uProp[${MAX}];
out vec4 outColor;

const vec3 ACC = vec3(0.38, 0.92, 0.45);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
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

float sdBox(vec2 p, vec2 h, float r) {
  vec2 q = abs(p) - h + r;
  return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

float smin(float a, float b, float k) {
  float h = max(k - abs(a - b), 0.0) / k;
  return min(a, b) - h * h * k * 0.25;
}

vec2 scene(vec2 p) {
  float d = 1e4;
  float mat = 0.0;
  float best = 1e4;
  for (int i = 0; i < ${MAX}; i++) {
    if (i >= uCount) break;
    vec4 b = uBox[i];
    vec4 pr = uProp[i];
    float di = sdBox(p - b.xy, b.zw, pr.x) + (1.0 - pr.w) * 80.0;
    if (di < best) { best = di; mat = pr.z; }
    d = (i == 0) ? di : smin(d, di, pr.y);
  }
  return vec2(d, mat);
}

vec3 art(vec2 p, float m, float soft) {
  vec2 q = p * uDpr / uRes.y;
  float t = uTime * 0.025;
  vec2 w = vec2(fbm(q * 1.7 + t), fbm(q * 1.7 - t + 9.0));
  float n = fbm(q * 1.5 + w * 0.9 + vec2(t, -t * 0.6));
  float mo = exp(-length(p - uMouse) / 170.0) * 0.22;
  float f = (n * 1.6 + m * 0.9 + mo) * 13.0;
  float w1 = abs(fract(f - 0.5) - 0.5) / max(fwidth(f), 1e-4);
  float line = 1.0 - smoothstep(0.0, 1.1 + soft * 7.0, w1);
  float major = step(abs(mod(floor(f + 0.5), 5.0)), 0.5);
  float inten = mix(0.2, 0.55, major) * mix(1.0, 0.45, soft);
  vec3 bg = vec3(0.035, 0.045, 0.038)
    + vec3(0.0, 0.035, 0.012) * exp(-length(q - vec2(0.3, 0.35)) * 1.2);
  return bg + ACC * line * inten;
}

void main() {
  vec2 p = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y) / uDpr;
  vec2 sc = scene(p);
  float D = sc.x;
  float mat = sc.y;
  float m = exp(-max(D, 0.0) / 240.0);
  vec3 col = art(p, m, 0.0);

  float shadow = smoothstep(48.0, -8.0, scene(p - vec2(0.0, 16.0)).x) * 0.5;
  col *= 1.0 - shadow * smoothstep(-2.0, 6.0, D);

  if (D < 1.0) {
    vec2 g = vec2(dFdx(D), dFdy(D));
    vec2 n = normalize(g + 1e-5);
    float edge = clamp(-D / 20.0, 0.0, 1.0);
    float lit = dot(n, normalize(vec2(-0.55, -0.85)));
    float rim = pow(1.0 - edge, 3.0);
    float band = 1.0 - smoothstep(0.0, 1.6, abs(D + 1.2));
    vec3 s;
    if (mat < 0.5) {
      vec2 p2 = p + n * (1.0 - edge) * (1.0 - edge) * 30.0;
      vec3 b = art(p2, m, 1.0);
      s = b * 0.5 + vec3(0.03, 0.045, 0.035) + ACC * 0.035;
      s += vec3(0.05) * smoothstep(0.6, -0.8, n.y) * (1.0 - edge);
      s += rim * (0.25 + 0.75 * max(lit, 0.0)) * 0.6;
      s -= rim * max(-lit, 0.0) * 0.12;
      s += band * 0.4 * (0.35 + 0.65 * max(lit, 0.0));
    } else if (mat < 1.5) {
      s = vec3(0.045, 0.05, 0.046) + vec3(0.03) * (1.0 - edge) * max(lit, 0.0);
      s += band * 0.22 * (0.4 + 0.6 * max(lit, 0.0));
    } else if (mat < 2.5) {
      s = vec3(0.935, 0.955, 0.94) * (1.0 - 0.05 * rim);
      s = mix(s, vec3(0.62), band * 0.55);
    } else {
      s = ACC * 0.95 * (1.0 - 0.1 * rim);
      s = mix(s, vec3(0.1, 0.3, 0.14), band * 0.5);
    }
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
  const uDpr = u("uDpr");
  const uTime = u("uTime");
  const uMouse = u("uMouse");
  const uCount = u("uCount");
  const uBox = u("uBox");
  const uProp = u("uProp");

  root.prepend(canvas);
  document.documentElement.classList.add("gl");

  let dpr = 1;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
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

  const boxes = new Float32Array(MAX * 4);
  const props = new Float32Array(MAX * 4);
  const stiff = calm ? 900 : 260;
  const damp = calm ? 60 : 15;
  const sStiff = calm ? 900 : 300;
  const sDamp = calm ? 60 : 16;

  let last = performance.now();

  const frame = (now) => {
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;
    mouse.x += (mouse.tx - mouse.x) * Math.min(1, dt * 8);
    mouse.y += (mouse.ty - mouse.y) * Math.min(1, dt * 8);

    items.forEach((item) => {
      item.visible = item.el.getClientRects().length > 0;
      if (!item.visible) return;
      const rect = item.el.getBoundingClientRect();
      const w = rect.width / (item.sx * item.s) || rect.width;
      const h = rect.height / (item.sy * item.s) || rect.height;
      item.w = w;
      item.h = h;
      item.cx = rect.left + rect.width / 2 - item.dx;
      item.cy = rect.top + rect.height / 2 - item.dy;
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
        targetScale = item.el.closest(".app-icon--disabled") ? 1 : 1.14;
      }
      const ax = stiff * (item.cx - item.x) - damp * item.vx;
      const ay = stiff * (item.cy - item.y) - damp * item.vy;
      item.vx += ax * dt;
      item.vy += ay * dt;
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      const as = sStiff * (targetScale - item.s) - sDamp * item.vs;
      item.vs += as * dt;
      item.s += item.vs * dt;
      const targetAlpha = closing ? 0 : 1;
      item.alpha += (targetAlpha - item.alpha) * Math.min(1, dt * 10);

      const squash = calm
        ? 0
        : clamp(
            Math.abs(item.vx) * 0.00022 - Math.abs(item.vy) * 0.00012,
            -0.08,
            0.08,
          );
      const squashY = calm
        ? 0
        : clamp(
            Math.abs(item.vy) * 0.00022 - Math.abs(item.vx) * 0.00012,
            -0.08,
            0.08,
          );
      item.sx = 1 + squash - squashY * 0.5;
      item.sy = 1 + squashY - squash * 0.5;
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
      boxes.set([item.box.cx, item.box.cy, item.box.hw, item.box.hh], i * 4);
      props.set([14, item.isWindow ? 36 : 12, item.mat, item.alpha], i * 4);
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

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uDpr, dpr);
    gl.uniform1f(uTime, now / 1000);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1i(uCount, count);
    gl.uniform4fv(uBox, boxes);
    gl.uniform4fv(uProp, props);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    requestAnimationFrame(frame);
  };

  requestAnimationFrame(frame);
}

const root = document.querySelector("[data-scene]");
if (root) start(root);
