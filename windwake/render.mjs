import { WORLD, LANDMARKS, PLATFORMS, OBSTACLES, PROPS, RUNES, PLATE, heightAt, terrainColor } from './world.mjs';

// Original procedural geometry. Colors extend the local wind-worn DESIGN.md palette.
export const PALETTE = Object.freeze({
  sky: [0.67, 0.80, 0.79], paper: [0.95, 0.93, 0.86], ink: [0.10, 0.16, 0.19],
  wind: [0.55, 0.80, 0.73], amber: [0.95, 0.72, 0.37], danger: [0.92, 0.51, 0.43],
  grass: [0.29, 0.47, 0.35], rock: [0.59, 0.59, 0.49], stone: [0.74, 0.73, 0.62],
  stoneDark: [0.43, 0.47, 0.40], sand: [0.66, 0.65, 0.46], trunk: [0.30, 0.29, 0.23],
  leaf: [0.21, 0.39, 0.31], leafLight: [0.36, 0.52, 0.36], pine: [0.19, 0.33, 0.29],
  water: [0.25, 0.51, 0.55], foam: [0.68, 0.84, 0.78], cloth: [0.20, 0.38, 0.40],
  cape: [0.74, 0.34, 0.24], capeLight: [0.88, 0.47, 0.29], leather: [0.26, 0.25, 0.22],
  skin: [0.82, 0.66, 0.48], steel: [0.81, 0.87, 0.84], ranger: [0.43, 0.37, 0.51],
  armor: [0.28, 0.33, 0.33], crystal: [0.53, 0.88, 0.82], shadow: [0.11, 0.22, 0.19],
});

const TAU = Math.PI * 2;
const STRIDE = 11;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const noise = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
const tint = (c, n) => [c[0] * n, c[1] * n, c[2] * n];
const SQRT3 = Math.sqrt(3);

/** Reused CPU vertex batch. One interleaved upload draws every moving actor. */
class Mesh {
  constructor(capacity = 4096) {
    this.data = new Float32Array(capacity * STRIDE);
    this.length = 0;
    this.origin(0, 0, 0);
    this.scratch = new Float32Array(24);
  }
  clear() { this.length = 0; this.origin(0, 0, 0); }
  origin(x, y, z, yaw = 0, scale = 1) {
    this.ox = x; this.oy = y; this.oz = z;
    this.cs = Math.cos(yaw); this.sn = Math.sin(yaw); this.scale = scale;
  }
  reserve(count) {
    if (this.length + count <= this.data.length) return;
    const next = new Float32Array(Math.max(this.data.length * 2, this.length + count));
    next.set(this.data); this.data = next;
  }
  vertex(x, y, z, nx, ny, nz, c, alpha, material) {
    const a = this.data, i = this.length, s = this.scale;
    a[i] = this.ox + (x * this.cs + z * this.sn) * s;
    a[i + 1] = this.oy + y * s;
    a[i + 2] = this.oz + (z * this.cs - x * this.sn) * s;
    a[i + 3] = nx * this.cs + nz * this.sn; a[i + 4] = ny;
    a[i + 5] = nz * this.cs - nx * this.sn;
    a[i + 6] = c[0]; a[i + 7] = c[1]; a[i + 8] = c[2];
    a[i + 9] = alpha; a[i + 10] = material;
    this.length += STRIDE;
  }
  tri(ax, ay, az, bx, by, bz, cx, cy, cz, c, alpha = 1, material = 0) {
    this.reserve(3 * STRIDE);
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const d = Math.hypot(nx, ny, nz) || 1; nx /= d; ny /= d; nz /= d;
    this.vertex(ax, ay, az, nx, ny, nz, c, alpha, material);
    this.vertex(bx, by, bz, nx, ny, nz, c, alpha, material);
    this.vertex(cx, cy, cz, nx, ny, nz, c, alpha, material);
  }
  quad(ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, c, alpha = 1, material = 0) {
    this.tri(ax, ay, az, bx, by, bz, cx, cy, cz, c, alpha, material);
    this.tri(ax, ay, az, cx, cy, cz, dx, dy, dz, c, alpha, material);
  }
  prism(points, c, alpha = 1, material = 0) {
    const faces = BOX_FACES;
    for (let i = 0; i < faces.length; i += 4) {
      const a = faces[i] * 3, b = faces[i + 1] * 3, d = faces[i + 2] * 3, e = faces[i + 3] * 3;
      this.quad(points[a], points[a + 1], points[a + 2], points[b], points[b + 1], points[b + 2],
        points[d], points[d + 1], points[d + 2], points[e], points[e + 1], points[e + 2], c, alpha, material);
    }
  }
  box(x, y, z, w, h, d, c, yaw = 0, alpha = 1, material = 0) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw), p = this.scratch;
    for (let i = 0; i < 8; i++) {
      const px = ((i & 1) ? 0.5 : -0.5) * w, pz = ((i & 2) ? 0.5 : -0.5) * d;
      p[i * 3] = x + px * cs + pz * sn; p[i * 3 + 1] = y + ((i & 4) ? h : 0);
      p[i * 3 + 2] = z + pz * cs - px * sn;
    }
    this.prism(p, c, alpha, material);
  }
  beam(ax, ay, az, bx, by, bz, width, depth, c, alpha = 1, material = 0) {
    const dx = bx - ax, dy = by - ay, dz = bz - az, d = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / d, uy = dy / d, uz = dz / d;
    let rx = uz, ry = 0, rz = -ux;
    let rd = Math.hypot(rx, rz);
    if (rd < 0.01) { rx = 1; rz = 0; rd = 1; }
    rx /= rd; rz /= rd;
    const fx = ry * uz - rz * uy, fy = rz * ux - rx * uz, fz = rx * uy - ry * ux;
    const p = this.scratch;
    for (let i = 0; i < 8; i++) {
      const a = ((i & 1) ? 0.5 : -0.5) * width, b = ((i & 2) ? 0.5 : -0.5) * depth;
      p[i * 3] = ((i & 4) ? bx : ax) + rx * a + fx * b;
      p[i * 3 + 1] = ((i & 4) ? by : ay) + ry * a + fy * b;
      p[i * 3 + 2] = ((i & 4) ? bz : az) + rz * a + fz * b;
    }
    this.prism(p, c, alpha, material);
  }
  cone(x, y, z, radius, h, c, sides = 7, top = 0, yaw = 0, alpha = 1, material = 0) {
    for (let i = 0; i < sides; i++) {
      const a = yaw + i / sides * TAU, b = yaw + (i + 1) / sides * TAU;
      const ax = Math.sin(a), az = Math.cos(a), bx = Math.sin(b), bz = Math.cos(b);
      this.quad(x + ax * radius, y, z + az * radius, x + bx * radius, y, z + bz * radius,
        x + bx * top, y + h, z + bz * top, x + ax * top, y + h, z + az * top, c, alpha, material);
      if (top > 0) this.tri(x, y + h, z, x + ax * top, y + h, z + az * top,
        x + bx * top, y + h, z + bz * top, c, alpha, material);
    }
  }
  jewel(x, y, z, r, h, c, yaw = 0, material = 0) {
    this.cone(x, y, z, r, h * 0.6, c, 5, 0, yaw, 1, material);
    this.cone(x, y, z, r, -h * 0.4, c, 5, 0, yaw, 1, material);
  }
  ring(x, y, z, radius, width, c, alpha = 1, start = 0, span = TAU, material = 1, segments = 32) {
    const inner = Math.max(0, radius - width);
    for (let i = 0; i < segments; i++) {
      const a = start + span * i / segments, b = start + span * (i + 1) / segments;
      const ax = Math.sin(a), az = Math.cos(a), bx = Math.sin(b), bz = Math.cos(b);
      this.quad(x + ax * inner, y, z + az * inner, x + ax * radius, y, z + az * radius,
        x + bx * radius, y, z + bz * radius, x + bx * inner, y, z + bz * inner, c, alpha, material);
    }
  }
  get vertices() { return this.length / STRIDE; }
}
const BOX_FACES = [0, 1, 3, 2, 4, 6, 7, 5, 0, 4, 5, 1, 2, 3, 7, 6, 0, 2, 6, 4, 1, 5, 7, 3];

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec4 aColor;
attribute float aMaterial;
uniform mat4 uViewProjection;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vColor;
varying float vMaterial;
void main() {
  vWorld = aPosition; vNormal = aNormal; vColor = aColor; vMaterial = aMaterial;
  gl_Position = uViewProjection * vec4(aPosition, 1.0);
}`;
const FRAGMENT = `
precision mediump float;
varying vec3 vWorld;
varying vec3 vNormal;
varying vec4 vColor;
varying float vMaterial;
uniform vec3 uEye;
uniform vec3 uFog;
uniform float uTime;
void main() {
  vec3 normal = normalize(vNormal);
  vec3 sun = normalize(vec3(-0.48, 0.82, -0.30));
  float diffuse = max(dot(normal, sun), 0.0);
  float hemi = normal.y * 0.10 + 0.72;
  vec3 color = vColor.rgb * (hemi + diffuse * 0.34);
  color += vec3(0.06, 0.035, 0.0) * diffuse;
  if (vMaterial > 0.5 && vMaterial < 1.5) color = vColor.rgb;
  if (vMaterial > 1.5) {
    float wave = sin(vWorld.x * 0.73 + vWorld.z * 0.32 + uTime * 0.9);
    float crossWave = sin(vWorld.z * 1.42 - vWorld.x * 0.17 - uTime * 0.64);
    float sparkle = pow(max(wave * crossWave, 0.0), 12.0);
    color = vColor.rgb + vec3(0.07, 0.10, 0.10) * wave * 0.25 + vec3(0.19, 0.22, 0.17) * sparkle;
  }
  float fog = smoothstep(52.0, 155.0, length(uEye - vWorld));
  if (vMaterial > 0.5 && vMaterial < 1.5) fog *= 0.68;
  color = mix(color, uFog, fog);
  gl_FragColor = vec4(color, vColor.a);
}`;
const SKY_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() { vUv = aPosition; gl_Position = vec4(aPosition, 0.99999, 1.0); }
`;
const SKY_FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform vec2 uYawPitch;
uniform float uAspect;
uniform float uTime;
uniform vec3 uFog;
void main() {
  float yaw = uYawPitch.x, pitch = uYawPitch.y;
  vec3 forward = vec3(sin(yaw) * cos(pitch), -sin(pitch), cos(yaw) * cos(pitch));
  vec3 right = vec3(cos(yaw), 0.0, -sin(yaw));
  vec3 up = vec3(sin(yaw) * sin(pitch), cos(pitch), cos(yaw) * sin(pitch));
  vec3 ray = normalize(forward + right * vUv.x * uAspect * 0.57735 + up * vUv.y * 0.57735);
  float elevation = clamp(ray.y, 0.0, 1.0);
  vec3 color = mix(uFog, vec3(0.35, 0.59, 0.67), pow(elevation, 0.72));
  vec3 sun = normalize(vec3(-0.48, 0.82, -0.30));
  float d = max(dot(ray, sun), 0.0);
  color += vec3(0.16, 0.12, 0.055) * pow(d, 18.0);
  color = mix(color, vec3(1.0, 0.96, 0.75), smoothstep(0.9989, 0.9993, d));
  if (ray.y > 0.04) {
    vec2 p = ray.xz / (ray.y + 0.2);
    float cloud = sin(p.x * 1.4 + uTime * 0.003) * sin(p.y * 2.1 + p.x * 0.7);
    float bands = smoothstep(0.46, 0.86, cloud) * (1.0 - smoothstep(0.48, 0.9, ray.y));
    color = mix(color, vec3(0.88, 0.89, 0.80), bands * 0.55);
  }
  gl_FragColor = vec4(color, 1.0);
}`;

function shader(gl, type, source) {
  const value = gl.createShader(type); gl.shaderSource(value, source); gl.compileShader(value);
  if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
    const error = gl.getShaderInfoLog(value); gl.deleteShader(value); throw new Error(`WINDWAKE shader: ${error}`);
  }
  return value;
}
function program(gl, vertex, fragment) {
  const p = gl.createProgram(), v = shader(gl, gl.VERTEX_SHADER, vertex), f = shader(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(p, v); gl.attachShader(p, f); gl.linkProgram(p); gl.deleteShader(v); gl.deleteShader(f);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`WINDWAKE program: ${gl.getProgramInfoLog(p)}`);
  return p;
}

function perspective(out, aspect, near = 0.12, far = 260) {
  out.fill(0); out[0] = SQRT3 / aspect; out[5] = SQRT3;
  out[10] = (far + near) / (near - far); out[11] = -1; out[14] = 2 * far * near / (near - far);
}
function lookAt(out, ex, ey, ez, tx, ty, tz) {
  let zx = ex - tx, zy = ey - ty, zz = ez - tz;
  const zd = Math.hypot(zx, zy, zz) || 1; zx /= zd; zy /= zd; zz /= zd;
  // +X is screen-right at yaw zero, matching the movement contract (+Z forward).
  // This reflected camera basis is intentional; geometry uses two-sided rendering.
  let xx = -zz, xz = zx;
  const xd = Math.hypot(xx, xz) || 1; xx /= xd; xz /= xd;
  const yx = -zy * xz, yy = zx * xz - zz * xx, yz = zy * xx;
  out[0] = xx; out[1] = yx; out[2] = zx; out[3] = 0;
  out[4] = 0; out[5] = yy; out[6] = zy; out[7] = 0;
  out[8] = xz; out[9] = yz; out[10] = zz; out[11] = 0;
  out[12] = -(xx * ex + xz * ez); out[13] = -(yx * ex + yy * ey + yz * ez);
  out[14] = -(zx * ex + zy * ey + zz * ez); out[15] = 1;
}
function multiply(out, a, b) {
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!this.gl) throw new Error('WebGL을 사용할 수 없습니다. 브라우저의 하드웨어 가속을 켜 주세요.');
    const gl = this.gl;
    this.program = program(gl, VERTEX, FRAGMENT); this.skyProgram = program(gl, SKY_VERTEX, SKY_FRAGMENT);
    this.attributes = ['aPosition', 'aNormal', 'aColor', 'aMaterial'].map(n => gl.getAttribLocation(this.program, n));
    this.uniforms = Object.fromEntries(['uViewProjection', 'uEye', 'uFog', 'uTime'].map(n => [n, gl.getUniformLocation(this.program, n)]));
    this.skyUniforms = Object.fromEntries(['uYawPitch', 'uAspect', 'uTime', 'uFog'].map(n => [n, gl.getUniformLocation(this.skyProgram, n)]));
    this.skyPosition = gl.getAttribLocation(this.skyProgram, 'aPosition');
    this.skyBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.dynamicBuffer = gl.createBuffer(); this.transparentBuffer = gl.createBuffer();
    this.dynamic = new Mesh(16000); this.transparent = new Mesh(10000);
    this.view = new Float32Array(16); this.projection = new Float32Array(16); this.viewProjection = new Float32Array(16);
    this.frustum = new Float32Array(24);
    this.eye = new Float32Array(3); this.target = new Float32Array(3);
    this.eyeInitialized = false; this.time = 0; this.lastFrame = -1; this.hitStopRemaining = 0; this.lastImpact = '';
    this.stats = { drawCalls: 0, triangles: 0, staticTriangles: 0, dynamicTriangles: 0, frameMs: 0, width: 0, height: 0, pixelRatio: 1 };
    this.resolutionScale = 1;
    this.chunkSize = 30; this.chunks = new Map(); this.buildWorld(); this.resize();
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.disable(gl.CULL_FACE);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    this.onContextLost = e => { e.preventDefault(); this.contextLost = true; };
    this.onContextRestored = () => { this.contextLost = false; this.needsReload = true; };
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.cssWidth = Math.max(1, rect.width || this.canvas.clientWidth || 1280);
    this.cssHeight = Math.max(1, rect.height || this.canvas.clientHeight || 800);
    // 1.5 keeps the scene crisp while bounding mobile fill-rate and software GL cost.
    const ratio = Math.min(globalThis.devicePixelRatio || 1, 1.5) * this.resolutionScale;
    const width = Math.round(this.cssWidth * ratio), height = Math.round(this.cssHeight * ratio);
    if (this.canvas.width !== width || this.canvas.height !== height) { this.canvas.width = width; this.canvas.height = height; }
    this.gl.viewport(0, 0, width, height);
    perspective(this.projection, this.cssWidth / this.cssHeight);
    Object.assign(this.stats, { width, height, pixelRatio: ratio });
  }

  setResolutionScale(scale) {
    this.resolutionScale = clamp(scale, .72, 1);
    this.resize();
  }

  chunk(x, z) {
    const ix = Math.floor(x / this.chunkSize), iz = Math.floor(z / this.chunkSize), key = `${ix},${iz}`;
    if (!this.chunks.has(key)) this.chunks.set(key, { x: (ix + 0.5) * this.chunkSize, z: (iz + 0.5) * this.chunkSize, mesh: new Mesh() });
    return this.chunks.get(key).mesh;
  }
  upload(mesh) {
    const gl = this.gl, buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data.subarray(0, mesh.length), gl.STATIC_DRAW);
    return { buffer, count: mesh.vertices };
  }
  buildWorld() {
    const size = WORLD.size || 120, step = 2.5;
    for (let x = -size; x < size; x += step) for (let z = -size; z < size; z += step) {
      const x2 = Math.min(size, x + step), z2 = Math.min(size, z + step);
      const a = heightAt(x, z), b = heightAt(x2, z), c = heightAt(x2, z2), d = heightAt(x, z2);
      // Average the world's small color jitter so the ground reads as broad terrain,
      // while preserving the original path and region boundaries in world.mjs.
      const sampleX = x + step / 2, sampleZ = z + step / 2;
      const color = terrainColor(sampleX, sampleZ) || PALETTE.grass;
      const nearby = terrainColor(sampleX + 0.6, sampleZ - 0.3) || color;
      const col = color.map((v, i) => (v * 0.6 + nearby[i] * 0.4) * (0.99 + noise(x, z) * 0.02)), m = this.chunk(x, z);
      if ((Math.floor(x / step) + Math.floor(z / step)) % 2) {
        m.tri(x, a, z, x, d, z2, x2, b, z, col);
        m.tri(x2, b, z, x, d, z2, x2, c, z2, tint(col, 0.995));
      } else {
        m.tri(x, a, z, x, d, z2, x2, c, z2, col);
        m.tri(x, a, z, x2, c, z2, x2, b, z, tint(col, 1.005));
      }
    }
    for (const block of [...OBSTACLES, ...PLATFORMS]) this.staticBlock(block);
    for (const prop of PROPS) this.staticProp(prop);
    for (const landmark of LANDMARKS) this.staticLandmark(landmark);
    for (const rune of RUNES) {
      const m = this.chunk(rune.x, rune.z);
      m.cone(rune.x, rune.y, rune.z, 0.66, 1.45, PALETTE.stone, 6, 0.5);
      m.box(rune.x, rune.y + 0.5, rune.z - 0.47, 0.70, 0.65, 0.08, PALETTE.stoneDark);
    }
    const plate = this.chunk(PLATE.x, PLATE.z);
    for (let i = 0; i < 32; i++) {
      const a = i / 32 * TAU, b = (i + 1) / 32 * TAU;
      const ax = PLATE.x + Math.sin(a) * PLATE.radius, az = PLATE.z + Math.cos(a) * PLATE.radius;
      const bx = PLATE.x + Math.sin(b) * PLATE.radius, bz = PLATE.z + Math.cos(b) * PLATE.radius;
      plate.tri(PLATE.x, PLATE.y + 0.035, PLATE.z, ax, heightAt(ax, az) + 0.035, az, bx, heightAt(bx, bz) + 0.035, bz, PALETTE.stoneDark);
    }
    for (const chunk of this.chunks.values()) {
      const data = chunk.mesh.data;
      let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
      for (let i = 0; i < chunk.mesh.length; i += STRIDE) {
        minX = Math.min(minX, data[i]); maxX = Math.max(maxX, data[i]);
        minY = Math.min(minY, data[i + 1]); maxY = Math.max(maxY, data[i + 1]);
        minZ = Math.min(minZ, data[i + 2]); maxZ = Math.max(maxZ, data[i + 2]);
      }
      chunk.centerX = (minX + maxX) / 2; chunk.centerY = (minY + maxY) / 2; chunk.centerZ = (minZ + maxZ) / 2;
      chunk.radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) / 2;
      Object.assign(chunk, this.upload(chunk.mesh)); this.stats.staticTriangles += chunk.count / 3; delete chunk.mesh;
    }
    const water = new Mesh(1000), waterY = WORLD.waterLevel ?? -3;
    water.quad(-size * 2, waterY, -size * 2, -size * 2, waterY, size * 2,
      size * 2, waterY, size * 2, size * 2, waterY, -size * 2, PALETTE.water, 0.94, 2);
    this.water = this.upload(water);
    const backdrop = new Mesh(1000);
    // A distant serrated horizon is decorative; none of these peaks hide a traversable route.
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU, r = size + 65 + noise(i, 9) * 28;
      const x = Math.sin(a) * r, z = Math.cos(a) * r;
      backdrop.cone(x, -13, z, 25 + noise(i, 3) * 24, 22 + noise(i, 12) * 35, PALETTE.stoneDark, 5, 0, a);
    }
    this.backdrop = this.upload(backdrop);
  }

  staticBlock(block) {
    if (block.kind === 'trunk') return; // Its corresponding procedural tree owns the visible trunk.
    const m = this.chunk(block.x, block.z), kind = block.kind || '';
    const col = kind.includes('wood') || kind.includes('bridge') ? PALETTE.trunk : PALETTE.stone;
    m.origin(block.x, block.y, block.z, block.yaw || 0);
    m.box(0, 0, 0, block.w, block.h, block.d, col);
    if (kind === 'sky') {
      const radius = Math.min(block.w, block.d) / 2;
      m.cone(0, 0, 0, radius, -9, PALETTE.stoneDark, 9, 2.7, 0.2);
      m.cone(-5, -1, -5, 5.8, -7.5, PALETTE.rock, 5, 0.3);
      m.cone(7, -1, 4, 5.2, -6.5, PALETTE.rock, 5, 0.4);
      m.ring(0, block.h + 0.12, 0, 10.3, 0.14, PALETTE.amber, 1, 0, TAU, 0, 48);
      m.ring(0, block.h + 0.13, 0, 6.0, 0.09, PALETTE.stoneDark, 1, 0, TAU, 0, 40);
      for (let i = 0; i < 6; i++) {
        const angle = i / 6 * TAU + Math.PI / 6;
        const x = Math.sin(angle) * (radius - 1.2), z = Math.cos(angle) * (radius - 1.2);
        m.cone(x, block.h, z, 0.45, 2.5 + i % 3, PALETTE.stone, 5, 0.27);
      }
    }
    if (block.w > 2 && block.d > 2) {
      m.box(0, block.h, 0, block.w * 0.92, 0.055, block.d * 0.92, PALETTE.stoneDark);
      m.box(0, block.h + 0.056, 0, block.w * 0.90, 0.045, block.d * 0.90, tint(col, 1.1));
    }
    m.origin(0, 0, 0);
  }

  staticProp(prop) {
    const x = prop.x, z = prop.z, y = prop.y ?? heightAt(x, z), s = prop.scale || 1;
    const m = this.chunk(x, z), type = prop.type || prop.kind || 'rock';
    m.origin(x, y, z, prop.yaw || noise(x, z) * TAU, s);
    if (type.includes('tree') || type.includes('pine')) {
      const pine = type.includes('pine'), h = pine ? 5.8 : 4.5;
      m.cone(0, 0, 0, 0.24, h * 0.8, PALETTE.trunk, 6, 0.11);
      m.beam(0, 1.8, 0, 1.0, 3.0, 0.25, 0.15, 0.14, PALETTE.trunk);
      if (pine) {
        m.cone(0, 1.6, 0, 1.6, 2.9, PALETTE.pine, 7);
        m.cone(0, 3.0, 0, 1.25, 2.4, PALETTE.leaf, 7);
        m.cone(0, 4.3, 0, 0.8, 1.6, PALETTE.leafLight, 7);
      } else {
        m.jewel(0, 3.6, 0, 1.8, 2.4, PALETTE.leaf, 0.3);
        m.jewel(1.0, 3.0, 0.25, 1.15, 1.6, PALETTE.leafLight, 0.8);
        m.jewel(-0.8, 3.3, 0.5, 1.35, 1.8, PALETTE.leafLight, 0.2);
      }
    } else if (type.includes('grass') || type.includes('reed')) {
      for (let i = 0; i < 3; i++) {
        const px = (i - 1) * 0.14, h = type.includes('reed') ? 1.1 : 0.40 + i * 0.07;
        m.tri(px - 0.08, 0, 0, px + 0.08, 0, 0.06, px + 0.18, h, 0.03, PALETTE.leafLight);
        if (type.includes('reed')) m.box(px + 0.12, h - 0.25, 0.03, 0.05, 0.2, 0.05, PALETTE.amber);
      }
    } else if (type.includes('flower')) {
      m.beam(0, 0, 0, 0.04, 0.43, 0, 0.025, 0.025, PALETTE.leaf);
      m.jewel(0.04, 0.43, 0, 0.13, 0.13, PALETTE.paper);
      m.jewel(-0.15, 0.29, 0.05, 0.09, 0.11, PALETTE.amber);
    } else if (type.includes('banner') || type.includes('flag')) {
      m.cone(0, 0, 0, 0.07, 3.4, PALETTE.trunk, 5, 0.045);
      m.quad(0, 3.15, 0, 1.1, 3.05, 0.12, 0.8, 1.85, 0.15, 0, 2.05, 0, PALETTE.cape);
      m.beam(0.12, 2.95, 0.02, 0.8, 2.84, 0.13, 0.03, 0.025, PALETTE.amber);
    } else if (type.includes('column') || type.includes('pillar')) {
      m.box(0, 0, 0, 1.0, 0.3, 1.0, PALETTE.stoneDark);
      m.cone(0, 0.3, 0, 0.4, 3.0, PALETTE.stone, 7, 0.32);
      m.box(0, 3.15, 0, 0.9, 0.25, 0.9, PALETTE.stone);
    } else if (type.includes('ruin') || type.includes('arch')) {
      m.box(-1.3, 0, 0, 0.7, 3.8, 0.8, PALETTE.stone);
      m.box(1.3, 0, 0, 0.7, 3.8, 0.8, PALETTE.stone);
      m.box(0, 3.5, 0, 3.35, 0.6, 0.95, PALETTE.stone);
      m.box(0, 4.1, 0, 1.0, 0.3, 0.9, PALETTE.stoneDark);
    } else if (type.includes('stump') || type.includes('log')) {
      m.cone(0, 0, 0, 0.55, 0.65, PALETTE.trunk, 7, 0.43);
      m.cone(0, 0.65, 0, 0.40, 0.01, PALETTE.sand, 7, 0.40);
    } else {
      m.cone(0, -0.08, 0, 0.8, 0.85, PALETTE.rock, 6, 0.34, 0.2);
      m.cone(0.4, -0.03, 0.5, 0.4, 0.43, PALETTE.stoneDark, 5, 0.12);
    }
    m.origin(0, 0, 0);
  }

  staticLandmark(l) {
    const y = l.y ?? heightAt(l.x, l.z), m = this.chunk(l.x, l.z), kind = l.kind || '';
    m.origin(l.x, y, l.z);
    if (kind === 'camp' || kind === 'checkpoint') {
      m.cone(0, 0, 0, 0.76, 0.12, PALETTE.stoneDark, 8, 0.7);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; m.box(Math.sin(a) * 0.6, 0.07, Math.cos(a) * 0.6, 0.3, 0.23, 0.28, PALETTE.rock, a); }
      m.beam(-0.45, 0.22, -0.24, 0.5, 0.23, 0.23, 0.15, 0.17, PALETTE.trunk);
      m.beam(-0.35, 0.19, 0.35, 0.35, 0.25, -0.3, 0.15, 0.17, PALETTE.trunk);
      m.box(2.0, 0, 0.8, 0.15, 2.6, 0.15, PALETTE.trunk);
      m.quad(2.0, 2.5, 0.8, 3.25, 1.15, 1.6, 3.25, 1.15, -0.7, 2.0, 2.5, -1.0, PALETTE.cape);
    } else if (kind.includes('chest') || kind === 'cache') {
      // The lid and treasure are drawn from state; this small slab remains after opening.
      m.box(0, 0, 0, 1.05, 0.12, 0.78, PALETTE.stoneDark);
    } else if (kind === 'updraft' || kind === 'wind') {
      m.cone(0, 0, 0, 2.4, 0.12, PALETTE.stoneDark, 12, 2.4);
      for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; m.cone(Math.sin(a) * 2.7, 0, Math.cos(a) * 2.7, 0.32, 2.6, PALETTE.stone, 5, 0.18); }
    } else if (kind.includes('rune')) {
      m.cone(0, 0, 0, 0.65, 1.25, PALETTE.stone, 5, 0.45);
    } else if (kind === 'boss' || kind === 'summit') {
      m.ring(0, 0.05, 0, 5.5, 0.14, PALETTE.amber, 1, 0, TAU, 0, 40);
    } else {
      m.cone(0, 0, 0, 1.0, 0.35, PALETTE.stoneDark, 6, 0.82);
      m.cone(0, 0.35, 0, 0.55, 1.1, PALETTE.stone, 6, 0.4);
    }
    m.origin(0, 0, 0);
  }

  updateCamera(state, camera, dt) {
    const p = state.player, yaw = Number.isFinite(camera.yaw) ? camera.yaw : 0;
    const pitch = clamp(Number.isFinite(camera.pitch) ? camera.pitch : 0.35, 0.08, 1.15);
    const distance = clamp(Number.isFinite(camera.distance) ? camera.distance : 8, 3.0, 18);
    const targetX = p.x, targetY = p.y + (p.gliding ? 1.1 : 1.25), targetZ = p.z;
    if (!this.eyeInitialized || Math.hypot(targetX - this.target[0], targetY - this.target[1], targetZ - this.target[2]) > 15 || state.frame < this.lastFrame) {
      this.target.set([targetX, targetY, targetZ]); this.eyeInitialized = true;
    }
    const smoothing = 1 - Math.exp(-Math.min(Math.max(dt || 1 / 60, 0.001), 0.1) * 12);
    this.target[0] = mix(this.target[0], targetX, smoothing);
    this.target[1] = mix(this.target[1], targetY, smoothing * 0.85);
    this.target[2] = mix(this.target[2], targetZ, smoothing);
    const dx = -Math.sin(yaw) * Math.cos(pitch), dy = Math.sin(pitch), dz = -Math.cos(yaw) * Math.cos(pitch);
    let safeDistance = distance;
    for (let r = 0.5; r <= distance; r += 0.25) {
      const x = this.target[0] + dx * r, y = this.target[1] + dy * r, z = this.target[2] + dz * r;
      if (y < heightAt(x, z) + 0.28) { safeDistance = Math.max(0.8, r - 0.3); break; }
      let blocked = false;
      for (const b of OBSTACLES) {
        if (Math.abs(x - b.x) < b.w / 2 + 0.18 && Math.abs(z - b.z) < b.d / 2 + 0.18 && y > b.y - 0.18 && y < b.y + b.h + 0.18) { blocked = true; break; }
      }
      if (!blocked) for (const b of PLATFORMS) {
        if (Math.abs(x - b.x) < b.w / 2 + 0.14 && Math.abs(z - b.z) < b.d / 2 + 0.14 && y > b.y - 0.14 && y < b.y + b.h + 0.14) { blocked = true; break; }
      }
      if (blocked) { safeDistance = Math.max(0.8, r - 0.3); break; }
    }
    const shake = camera.reducedMotion ? 0 : clamp(camera.shake || 0, 0, 1) * 0.12;
    this.eye[0] = this.target[0] + dx * safeDistance + Math.sin(this.time * 71) * shake;
    this.eye[1] = Math.max(this.target[1] + dy * safeDistance + Math.cos(this.time * 83) * shake, heightAt(this.target[0] + dx * safeDistance, this.target[2] + dz * safeDistance) + 0.25);
    this.eye[2] = this.target[2] + dz * safeDistance;
    lookAt(this.view, ...this.eye, ...this.target); multiply(this.viewProjection, this.projection, this.view);
    this.cameraYaw = yaw; this.cameraPitch = pitch; this.lastFrame = state.frame;
  }

  shadow(x, y, z, radius, alpha = 0.19) {
    this.transparent.origin(0, 0, 0);
    this.transparent.ring(x, y + 0.04, z, radius, radius, PALETTE.shadow, alpha, 0, TAU, 1, 14);
  }

  player(state) {
    const p = state.player, m = this.dynamic, time = state.time || 0;
    const speed = Math.hypot(p.vx || 0, p.vz || 0), moving = clamp(speed / 4, 0, 1);
    const gait = Math.sin(time * (speed > 6 ? 16 : 11)) * 0.35 * moving;
    const attacking = (p.attackTimer || 0) > 0 || p.action === 'attack';
    const dodging = (p.dodgeTimer || 0) > 0 || p.action === 'dodge';
    const airborne = !p.grounded, bodyY = dodging ? -0.4 : (airborne ? 0.04 : Math.abs(gait) * 0.04);
    const flash = (p.invulnerable || 0) > 0 && Math.floor(time * 15) % 2 === 0;
    const tunic = flash ? PALETTE.paper : PALETTE.cloth;
    m.origin(p.x, p.y + bodyY, p.z, p.yaw || 0);
    for (let side = -1; side <= 1; side += 2) {
      const x = side * 0.19, swing = airborne ? -0.1 : side * gait;
      m.beam(x, 0.86, 0, x, 0.46, swing * 0.45, 0.20, 0.24, PALETTE.paper);
      m.beam(x, 0.46, swing * 0.45, x, 0.14, swing, 0.18, 0.19, PALETTE.leather);
      m.box(x, 0.03, swing + 0.04, 0.23, 0.19, 0.36, PALETTE.leather);
    }
    m.box(0, 0.82, 0, 0.57, 0.56, 0.35, tunic);
    m.box(0, 0.87, 0, 0.60, 0.09, 0.38, PALETTE.leather);
    m.box(0.03, 0.88, 0.205, 0.14, 0.095, 0.03, PALETTE.amber);
    m.box(0, 1.36, 0.025, 0.18, 0.11, 0.2, PALETTE.skin);
    m.box(0, 1.47, 0.045, 0.35, 0.34, 0.31, PALETTE.skin);
    m.box(0, 1.69, 0.005, 0.40, 0.16, 0.37, PALETTE.ink);
    m.box(0, 1.48, -0.115, 0.4, 0.23, 0.14, PALETTE.ink);
    m.box(-0.10, 1.62, 0.204, 0.052, 0.045, 0.025, PALETTE.ink);
    m.box(0.10, 1.62, 0.204, 0.052, 0.045, 0.025, PALETTE.ink);
    m.box(0, 1.35, 0, 0.62, 0.10, 0.43, PALETTE.capeLight);
    const flutter = Math.sin(time * 6) * 0.11 + moving * 0.28 + (airborne ? 0.25 : 0);
    m.quad(-0.31, 1.41, -0.23, 0.31, 1.41, -0.23, 0.40, 0.48, -0.30 - flutter, -0.40, 0.51, -0.38 - flutter, PALETTE.cape);
    m.tri(-0.4, 0.51, -0.38 - flutter, 0.4, 0.48, -0.30 - flutter, 0, 0.39, -0.40 - flutter, PALETTE.capeLight);
    m.beam(-0.30, 1.3, 0, -0.44, 0.99, 0.10 - gait * 0.5, 0.19, 0.21, tunic);
    m.beam(-0.44, 0.99, 0.10 - gait * 0.5, -0.42, 0.82, 0.18 - gait, 0.14, 0.15, PALETTE.skin);
    let handX = 0.45, handY = 0.95, handZ = 0.18;
    let swordX = 0.91, swordY = 0.38, swordZ = 0.66;
    if (attacking) {
      const phase = ((0.55 - (p.actionTime || p.attackTimer || 0)) * 12 + (p.combo || 0) * 0.8);
      const sweep = Math.sin(phase) * 1.4;
      handX = Math.sin(sweep) * 0.62; handZ = 0.15 + Math.cos(sweep) * 0.54; handY = 1.02 + (p.combo === 3 ? 0.28 : 0);
      swordX = Math.sin(sweep) * 1.65; swordY = handY + 0.1; swordZ = 0.15 + Math.cos(sweep) * 1.65;
    } else if ((p.parryTimer || 0) > 0 || p.action === 'parry') {
      handX = 0.26; handY = 1.12; handZ = 0.6; swordX = -0.25; swordY = 2.0; swordZ = 0.62;
    }
    m.beam(0.3, 1.3, 0, handX, handY, handZ, 0.20, 0.19, tunic);
    m.jewel(handX, handY, handZ, 0.11, 0.18, PALETTE.skin);
    m.beam(handX, handY, handZ, swordX, swordY, swordZ, 0.12, 0.055, PALETTE.steel, 1, 0.4);
    m.beam(handX - 0.16, handY, handZ, handX + 0.16, handY, handZ, 0.06, 0.07, PALETTE.amber);
    if (p.gliding) {
      m.beam(-1.7, 2.17, 0.2, 1.7, 2.17, 0.2, 0.05, 0.05, PALETTE.trunk);
      m.tri(-1.85, 2.14, 0.28, 0, 2.65, -0.15, 0, 2.18, 1.0, PALETTE.paper);
      m.tri(1.85, 2.14, 0.28, 0, 2.18, 1.0, 0, 2.65, -0.15, PALETTE.amber);
      m.tri(-1.85, 2.14, 0.28, -0.6, 2.17, -0.65, 0, 2.65, -0.15, PALETTE.wind);
      m.tri(1.85, 2.14, 0.28, 0, 2.65, -0.15, 0.6, 2.17, -0.65, PALETTE.wind);
      m.beam(-0.42, 1.15, 0.05, -0.8, 2.17, 0.2, 0.025, 0.025, PALETTE.leather);
      m.beam(0.42, 1.15, 0.05, 0.8, 2.17, 0.2, 0.025, 0.025, PALETTE.leather);
    }
    m.origin(0, 0, 0);
    const ground = heightAt(p.x, p.z);
    this.shadow(p.x, ground, p.z, 0.55 + Math.min(Math.max(p.y - ground, 0), 12) * 0.04, 0.20 / (1 + Math.max(p.y - ground, 0) * 0.12));
    if (attacking) {
      const a = this.transparent; a.origin(p.x, p.y + 0.92, p.z, p.yaw || 0);
      const sweep = Math.sin((0.55 - (p.actionTime || 0)) * 14) * 0.9;
      a.ring(0, 0, 0, 1.9, 0.20, PALETTE.paper, 0.62, -0.7 + sweep, 1.5, 1, 16);
      a.ring(0, 0.035, 0, 2.05, 0.045, PALETTE.amber, 0.87, -0.7 + sweep, 1.5, 1, 16);
      a.origin(0, 0, 0);
    }
    if ((p.parryTimer || 0) > 0) {
      this.transparent.origin(p.x, p.y + 0.07, p.z);
      this.transparent.ring(0, 0, 0, 0.95, 0.08, PALETTE.wind, 0.8);
      this.transparent.origin(0, 0, 0);
    }
  }

  enemy(e, time, player) {
    if (e.state === 'dead' || e.hp <= 0) return;
    if (Math.hypot(e.x - player.x, e.z - player.z) > 85) return;
    const m = this.dynamic, boss = e.type === 'boss', charger = e.type === 'charger', ranger = e.type === 'ranger';
    const scale = boss ? 2.5 : charger ? 1.35 : 1.0;
    const gait = e.state === 'chase' || e.state === 'attack' ? Math.sin(time * (charger ? 10 : 8)) * 0.28 : Math.sin(time * 1.7) * 0.015;
    const color = e.hitFlash > 0 ? PALETTE.paper : boss || charger ? PALETTE.armor : ranger ? PALETTE.ranger : PALETTE.cape;
    m.origin(e.x, e.y, e.z, e.yaw || 0, scale);
    for (let side = -1; side <= 1; side += 2) {
      m.beam(side * 0.23, 0.9, 0, side * 0.24, 0.16, side * gait, 0.23, 0.25, PALETTE.armor);
      m.box(side * 0.24, 0.02, side * gait + 0.05, 0.3, 0.23, 0.4, PALETTE.leather);
    }
    m.box(0, 0.8, 0, charger || boss ? 0.79 : 0.58, 0.64, 0.43, color);
    m.box(0, 1.44, 0.015, 0.42, 0.38, 0.38, color);
    m.box(0, 1.57, 0.213, 0.31, 0.085, 0.04, PALETTE.ink);
    m.box(-0.085, 1.59, 0.24, 0.075, 0.04, 0.025, PALETTE.amber, 0, 1, 1);
    m.box(0.085, 1.59, 0.24, 0.075, 0.04, 0.025, PALETTE.amber, 0, 1, 1);
    const reach = e.state === 'attack' ? 0.6 : 0.1;
    m.beam(0.35, 1.31, 0, 0.55, 0.97, reach, 0.23, 0.24, color);
    m.beam(-0.35, 1.31, 0, -0.55, 1.0, 0.15, 0.23, 0.24, color);
    if (boss) {
      const core = e.phase === 2 ? PALETTE.danger : PALETTE.crystal;
      m.box(0, 0.94, 0.25, 0.27, 0.4, 0.065, core, 0, 1, 1);
      m.jewel(0, 2.28 + Math.sin(time * 2) * 0.06, 0, 0.17, 0.42, core, time * 0.6, 1);
      m.box(-0.52, 1.27, 0, 0.43, 0.35, 0.65, PALETTE.stone);
      m.box(0.52, 1.27, 0, 0.43, 0.35, 0.65, PALETTE.stone);
      for (let i = 0; i < 5; i++) { const a = i / 5 * TAU; m.cone(Math.sin(a) * 0.28, 1.83, Math.cos(a) * 0.28, 0.09, 0.38, PALETTE.amber, 4); }
      m.beam(0.55, 0.97, reach, 0.7, 1.6, reach + 0.15, 0.11, 0.1, PALETTE.stone);
      m.box(0.7, 1.58, reach + 0.15, 0.65, 0.46, 0.55, PALETTE.stone);
    } else if (charger) {
      m.box(-0.57, 0.68, 0.42, 0.55, 0.86, 0.16, PALETTE.stoneDark);
      m.box(-0.57, 0.83, 0.51, 0.13, 0.55, 0.035, PALETTE.amber);
      m.cone(-0.19, 1.77, 0, 0.09, 0.34, PALETTE.stone, 4);
      m.cone(0.19, 1.77, 0, 0.09, 0.34, PALETTE.stone, 4);
      m.beam(0.55, 0.97, reach, 0.6, 0.7, 1.15 + reach, 0.16, 0.11, PALETTE.steel);
    } else if (ranger) {
      m.cone(0, 1.73, -0.03, 0.30, 0.40, PALETTE.ranger, 5);
      m.quad(-0.30, 1.36, -0.24, 0.30, 1.36, -0.24, 0.45, 0.33, -0.42, -0.45, 0.33, -0.42, PALETTE.ranger);
      m.beam(-0.55, 0.58, 0.4, -0.71, 1.15, 0.5, 0.065, 0.065, PALETTE.trunk);
      m.beam(-0.71, 1.15, 0.5, -0.55, 1.74, 0.4, 0.065, 0.065, PALETTE.trunk);
      m.beam(-0.55, 0.58, 0.4, -0.55, 1.74, 0.4, 0.017, 0.017, PALETTE.paper);
    } else {
      m.quad(-0.28, 1.4, -0.22, 0.28, 1.4, -0.22, 0.38, 0.6, -0.34, -0.38, 0.6, -0.34, PALETTE.capeLight);
      m.beam(0.55, 0.97, reach, 0.7, 1.2, reach + 0.9, 0.13, 0.065, PALETTE.steel);
    }
    m.origin(0, 0, 0);
    this.shadow(e.x, Math.max(heightAt(e.x, e.z), e.y - 0.08), e.z, 0.65 * scale);
    if (e.state === 'telegraph') {
      const a = this.transparent, y = e.y + 0.075, yaw = e.yaw || 0;
      const pattern = e.pattern || (charger ? 'charge' : ranger ? 'bolt' : 'slam');
      const pulse = 0.62 + Math.sin(time * 14) * 0.16;
      if (pattern === 'bolt') {
        // Thin arrow-shaped lanes communicate the ranged volley, distinct from an area slam.
        for (let i = 0; i < (boss ? 3 : 1); i++) {
          const heading = yaw + (i - (boss ? 1 : 0)) * 0.18;
          a.tri(e.x, y, e.z, e.x + Math.sin(heading - 0.025) * 12, y, e.z + Math.cos(heading - 0.025) * 12,
            e.x + Math.sin(heading + 0.025) * 12, y, e.z + Math.cos(heading + 0.025) * 12, PALETTE.danger, pulse * 0.6, 1);
        }
      } else if (pattern === 'charge') {
        a.origin(e.x, y, e.z, yaw);
        a.quad(-0.7, 0, 0, 0.7, 0, 0, 0.7, 0, 8.25, -0.7, 0, 8.25, PALETTE.danger, 0.17, 1);
        a.beam(-0.7, 0.02, 0, -0.7, 0.02, 8.25, 0.05, 0.04, PALETTE.danger, pulse, 1);
        a.beam(0.7, 0.02, 0, 0.7, 0.02, 8.25, 0.05, 0.04, PALETTE.danger, pulse, 1);
        a.tri(-0.5, 0.03, 6.8, 0.5, 0.03, 6.8, 0, 0.03, 8.0, PALETTE.paper, 0.65, 1);
        a.origin(0, 0, 0);
      } else if (boss && pattern === 'ring') {
        a.ring(e.x, y, e.z, 9, 0.17, PALETTE.amber, pulse, 0, TAU, 1, 48);
        a.ring(e.x, y + 0.05, e.z, 8.7, 0.04, PALETTE.paper, 0.7, 0, TAU, 1, 48);
        // Low concentric arcs advertise the jumpable wave.
        a.ring(e.x, y + 0.3, e.z, 1.8 + (time * 2 % 1) * 4, 0.06, PALETTE.amber, 0.5);
      } else {
        const radius = boss ? 5.1 : 2.9, start = boss ? 0 : yaw - 1.3, span = boss ? TAU : 2.6;
        a.ring(e.x, y, e.z, radius, 0.13, PALETTE.danger, pulse, start, span);
        a.ring(e.x, y + 0.01, e.z, radius, radius, PALETTE.danger, 0.09, start, span);
        if (boss) for (let i = 0; i < 8; i++) {
          const angle = i / 8 * TAU;
          a.beam(e.x + Math.sin(angle) * 3.7, y + 0.02, e.z + Math.cos(angle) * 3.7,
            e.x + Math.sin(angle) * 5.0, y + 0.02, e.z + Math.cos(angle) * 5.0, 0.07, 0.035, PALETTE.danger, pulse, 1);
        }
      }
    }
    if (e.hp < e.maxHp || e.state !== 'idle') {
      const width = boss ? 2.3 : 0.95 * scale, y = e.y + 2.1 * scale;
      m.origin(e.x, y, e.z, this.cameraYaw);
      m.box(0, 0, 0, width, 0.085, 0.025, PALETTE.ink, 0, 1, 1);
      const amount = width * clamp(e.hp / e.maxHp, 0, 1);
      m.box((amount - width) / 2, 0.012, -0.026, amount, 0.06, 0.015, PALETTE.danger, 0, 1, 1);
      m.origin(0, 0, 0);
    }
  }

  dynamicLandmarks(state) {
    const time = state.time || 0, progress = state.progress || {}, m = this.dynamic, a = this.transparent;
    for (const l of LANDMARKS) {
      const y = l.y ?? heightAt(l.x, l.z), kind = l.kind || '';
      if (Math.hypot(l.x - state.player.x, l.z - state.player.z) > (kind === 'shrine' ? 180 : 90)) continue;
      const solved = (progress.sigils || []).includes(l.sigil || l.id) || (l.id === 'forest' && (progress.sigils || []).includes('forest'));
      if (kind === 'camp' || kind === 'checkpoint') {
        m.cone(l.x, y + 0.2, l.z, 0.31, 0.75 + Math.sin(time * 13 + l.x) * 0.13, PALETTE.amber, 5, 0, time, 1, 1);
        m.cone(l.x + 0.10, y + 0.21, l.z - 0.08, 0.18, 0.47 + Math.sin(time * 17) * 0.08, PALETTE.paper, 4, 0, 0, 1, 1);
        for (let i = 0; i < 3; i++) {
          const phase = (time * 0.65 + i / 3) % 1;
          m.jewel(l.x + Math.sin(i * 3 + time) * phase * 0.25, y + 0.6 + phase * 1.2, l.z + Math.cos(i) * 0.15, 0.025, 0.08, PALETTE.amber, 0, 1);
        }
      } else if (kind.includes('chest') || kind === 'cache') {
        const opened = (progress.chests || []).includes(l.id);
        m.origin(l.x, y + 0.12, l.z, l.yaw || 0);
        m.box(0, 0, 0, 0.85, 0.45, 0.6, PALETTE.trunk);
        m.box(0, opened ? 0.65 : 0.45, opened ? -0.23 : 0, 0.90, 0.15, 0.65, PALETTE.leather);
        for (const x of [-0.28, 0.28]) m.box(x, 0, 0, 0.06, 0.6, 0.65, PALETTE.amber);
        if (!opened) m.jewel(0, 1.18 + Math.sin(time * 2) * 0.10, 0, 0.12, 0.26, PALETTE.amber, time, 1);
        m.origin(0, 0, 0);
      } else if (kind === 'updraft' || kind === 'wind') {
        const active = (progress.sigils || []).length >= 3;
        for (let i = 0; i < (active ? 9 : 2); i++) {
          const phase = (time * (active ? 0.17 : 0.07) + i / 9) % 1, h = active ? phase * 25 : phase * 1.4;
          a.ring(l.x, y + h + 0.2, l.z, 1.7 + Math.sin(phase * Math.PI) * 0.6, 0.05, PALETTE.wind, active ? 0.52 * Math.sin(phase * Math.PI) : 0.17, time + i, 4.5, 1, 30);
        }
      } else if (kind !== 'boss' && kind !== 'summit') {
        const color = solved ? PALETTE.wind : PALETTE.amber;
        m.jewel(l.x, y + 1.8 + Math.sin(time * 1.5 + l.x) * 0.13, l.z, 0.25, 0.65, color, time * 0.55, 1);
        a.ring(l.x, y + 0.03, l.z, 1.3, 0.04, color, 0.55);
        if (!solved) {
          // Above the woodland canopy, these signals reveal each nonlinear destination.
          const height = l.id === 'forest' ? 12 : 8;
          m.beam(l.x, y + 2.5, l.z, l.x, y + height, l.z, 0.10, 0.10, color, 1, 1);
          m.jewel(l.x, y + height + 0.3, l.z, 0.45, 1.2, color, time * 0.35, 1);
          a.ring(l.x, y + height - 0.3, l.z, 0.7, 0.04, color, 0.8);
        }
      }
    }
    const charge = clamp((state.puzzle?.plateCharge || 0) / 1.2, 0, 1), plateSolved = (progress.sigils || []).includes('quarry');
    const plateColor = plateSolved ? PALETTE.wind : PALETTE.amber;
    a.ring(PLATE.x, PLATE.y + 0.13, PLATE.z, PLATE.radius, 0.12, plateColor, 0.84);
    if (charge > 0) a.ring(PLATE.x, PLATE.y + 0.15, PLATE.z, PLATE.radius - 0.22, 0.18, PALETTE.wind, 0.9, 0, TAU * charge);
    for (let i = 0; i < RUNES.length; i++) {
      const rune = RUNES[i], lit = (progress.sigils || []).includes('forest') || i < (state.puzzle?.runeStep || 0);
      const color = lit ? PALETTE.wind : PALETTE.amber, glyphZ = -0.526;
      m.origin(rune.x, rune.y, rune.z);
      if (i === 0) {
        m.beam(0, 0.62, glyphZ, 0, 1.01, glyphZ, 0.055, 0.03, color, 1, 1);
        m.tri(0, 0.79, glyphZ, -0.27, 1.04, glyphZ, -0.25, 0.76, glyphZ, color, 1, 1);
        m.tri(0, 0.83, glyphZ, 0.25, 0.88, glyphZ, 0.26, 1.08, glyphZ, color, 1, 1);
      } else if (i === 1) {
        m.box(0, 0.73, glyphZ, 0.19, 0.19, 0.028, color, 0, 1, 1);
        for (let j = 0; j < 8; j++) {
          const angle = j / 8 * TAU;
          m.beam(Math.sin(angle) * 0.18, 0.825 + Math.cos(angle) * 0.18, glyphZ,
            Math.sin(angle) * 0.29, 0.825 + Math.cos(angle) * 0.29, glyphZ, 0.035, 0.026, color, 1, 1);
        }
      } else {
        m.tri(0, 0.75, glyphZ, -0.32, 1.04, glyphZ, -0.22, 0.72, glyphZ, color, 1, 1);
        m.tri(0, 0.75, glyphZ, 0.22, 0.72, glyphZ, 0.32, 1.04, glyphZ, color, 1, 1);
        m.box(0, 0.69, glyphZ, 0.055, 0.24, 0.025, color, 0, 1, 1);
      }
      for (let tally = 0; tally <= i; tally++) m.box((tally - i / 2) * 0.12, 0.33, glyphZ, 0.04, 0.1, 0.025, color, 0, 1, 1);
      m.origin(0, 0, 0);
      a.ring(rune.x, rune.y + 1.47, rune.z, 0.46, 0.045, color, lit ? 0.95 : 0.35);
    }
  }

  effects(state) {
    const a = this.transparent, m = this.dynamic, time = state.time || 0;
    const effects = state.effects || [];
    for (let index = Math.max(0, effects.length - 180); index < effects.length; index++) {
      const e = effects[index], life = Math.max(0.01, e.life || 0.6), age = e.age || 0;
      const t = clamp(age / life, 0, 1), fade = 1 - t, power = e.power || 1;
      const type = e.type || '', x = e.x || 0, y = e.y || 0, z = e.z || 0;
      if (type.includes('pulse') || type.includes('shock') || type.includes('ring') || type.includes('slam')) {
        const radius = (e.power || (type.includes('pulse') ? 7 : 3.5)) * Math.max(0.04, t);
        const color = e.pattern ? e.pattern === 'ring' ? PALETTE.amber : PALETTE.danger : PALETTE.wind;
        a.ring(x, y + 0.11, z, radius, 0.09 + fade * 0.16, color, fade * 0.85);
        a.ring(x, y + 0.18 + t * 0.7, z, radius * 0.88, 0.04, PALETTE.paper, fade * 0.45);
      } else if (type.includes('slash') || type.includes('attack')) {
        a.origin(x, y + 0.95, z, e.yaw || 0);
        a.ring(0, 0, 0, 1.7 + t * 0.7, 0.25 * fade, PALETTE.paper, fade * 0.7, -0.9 + t, 1.8, 1, 20); a.origin(0, 0, 0);
      } else {
        const color = type.includes('heal') || type.includes('parry') ? PALETTE.wind : type.includes('death') ? PALETTE.stone : PALETTE.amber;
        for (let i = 0; i < 6; i++) {
          const angle = i / 6 * TAU + index * 2.3, r = t * (0.8 + noise(i, index) * 0.8);
          const py = y + 0.65 + Math.sin(t * Math.PI) * (0.5 + noise(index, i)) - t * 0.25;
          m.jewel(x + Math.sin(angle) * r, py, z + Math.cos(angle) * r, 0.07 * fade, 0.18 * fade, color, time * 3 + i, 1);
        }
      }
    }
    for (const p of state.projectiles || []) {
      const hostile = p.hostile !== false && p.owner !== 'player', col = hostile ? PALETTE.danger : PALETTE.wind;
      m.jewel(p.x, p.y, p.z, p.radius || 0.14, 0.32, col, time * 5, 1);
      const vx = p.vx || 0, vy = p.vy || 0, vz = p.vz || 0, len = Math.hypot(vx, vy, vz) || 1;
      m.beam(p.x, p.y, p.z, p.x - vx / len * 0.65, p.y - vy / len * 0.65, p.z - vz / len * 0.65, 0.035, 0.035, col, 1, 1);
    }
  }

  buildDynamic(state) {
    const m = this.dynamic, a = this.transparent; m.clear(); a.clear();
    this.player(state);
    for (const e of state.enemies || []) this.enemy(e, state.time || 0, state.player);
    for (const b of state.blocks || []) {
      m.box(b.x, b.y, b.z, b.w || 1.1, b.h || 1.1, b.d || 1.1, PALETTE.stoneDark);
      m.box(b.x, b.y + (b.h || 1.1) * 0.36, b.z - (b.d || 1.1) / 2 - 0.015, 0.35, 0.35, 0.035, PALETTE.wind, 0, 1, 1);
      m.box(b.x, b.y + (b.h || 1.1) + 0.015, b.z, 0.35, 0.035, 0.35, PALETTE.wind, 0, 1, 1);
    }
    for (const item of state.items || []) {
      if (item.collected || item.active === false) continue;
      const y = item.y ?? heightAt(item.x, item.z), bob = Math.sin((state.time || 0) * 3 + item.x) * 0.1;
      if (item.type === 'flask' || item.type === 'heal') {
        m.cone(item.x, y + 0.25 + bob, item.z, 0.15, 0.28, PALETTE.danger, 6, 0.10);
        m.box(item.x, y + 0.53 + bob, item.z, 0.13, 0.07, 0.13, PALETTE.amber);
      } else m.jewel(item.x, y + 0.4 + bob, item.z, 0.16, 0.4, PALETTE.crystal, state.time || 0, 1);
    }
    this.dynamicLandmarks(state); this.effects(state);
  }

  bind(buffer) {
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const sizes = [3, 3, 4, 1], offsets = [0, 3, 6, 10];
    for (let i = 0; i < 4; i++) {
      gl.enableVertexAttribArray(this.attributes[i]); gl.vertexAttribPointer(this.attributes[i], sizes[i], gl.FLOAT, false, STRIDE * 4, offsets[i] * 4);
    }
  }
  draw(buffer, count) {
    if (!count) return;
    this.bind(buffer); this.gl.drawArrays(this.gl.TRIANGLES, 0, count);
    this.stats.drawCalls++; this.stats.triangles += count / 3;
  }
  drawDynamic(mesh, buffer) {
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    // Reuse both CPU capacity and GL allocation; grow only when a new scene needs it.
    const capacityKey = buffer === this.dynamicBuffer ? 'dynamicCapacity' : 'transparentCapacity';
    if ((this[capacityKey] || 0) < mesh.data.byteLength) {
      gl.bufferData(gl.ARRAY_BUFFER, mesh.data.byteLength, gl.DYNAMIC_DRAW); this[capacityKey] = mesh.data.byteLength;
    }
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, mesh.data.subarray(0, mesh.length)); this.draw(buffer, mesh.vertices);
  }

  updateFrustum() {
    const m = this.viewProjection, planes = this.frustum;
    for (let axis = 0; axis < 3; axis++) for (let side = 0; side < 2; side++) {
      const sign = side ? -1 : 1, offset = (axis * 2 + side) * 4;
      let length = 0;
      for (let col = 0; col < 4; col++) {
        const value = m[col * 4 + 3] + sign * m[col * 4 + axis];
        planes[offset + col] = value; if (col < 3) length += value * value;
      }
      length = Math.sqrt(length) || 1;
      for (let col = 0; col < 4; col++) planes[offset + col] /= length;
    }
  }
  chunkVisible(chunk) {
    const p = this.frustum;
    if (Math.hypot(chunk.centerX - this.eye[0], chunk.centerZ - this.eye[2]) - chunk.radius > 145) return false;
    for (let i = 0; i < 24; i += 4) {
      if (p[i] * chunk.centerX + p[i + 1] * chunk.centerY + p[i + 2] * chunk.centerZ + p[i + 3] < -chunk.radius) return false;
    }
    return true;
  }

  render(state, camera = {}, dt = 1 / 60) {
    if (this.contextLost) return;
    if (this.needsReload) throw new Error('WebGL context was restored; reload the page to reconstruct the world.');
    const start = performance.now(), gl = this.gl;
    if (Math.abs(this.canvas.clientWidth - this.cssWidth) > 1 || Math.abs(this.canvas.clientHeight - this.cssHeight) > 1) this.resize();
    this.time += Math.min(dt || 1 / 60, 0.1); this.stats.drawCalls = 0; this.stats.triangles = 0;
    this.updateCamera(state, camera, dt);
    gl.clearColor(...PALETTE.sky, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.depthMask(false);
    gl.useProgram(this.skyProgram); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    for (const attribute of this.attributes) gl.disableVertexAttribArray(attribute);
    gl.enableVertexAttribArray(this.skyPosition); gl.vertexAttribPointer(this.skyPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.skyUniforms.uYawPitch, this.cameraYaw, this.cameraPitch);
    gl.uniform1f(this.skyUniforms.uAspect, this.cssWidth / this.cssHeight); gl.uniform1f(this.skyUniforms.uTime, this.time);
    gl.uniform3fv(this.skyUniforms.uFog, PALETTE.sky); gl.drawArrays(gl.TRIANGLES, 0, 3); this.stats.drawCalls++;
    gl.disableVertexAttribArray(this.skyPosition);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, this.viewProjection);
    gl.uniform3fv(this.uniforms.uEye, this.eye); gl.uniform3fv(this.uniforms.uFog, PALETTE.sky);
    gl.uniform1f(this.uniforms.uTime, state.time || this.time);
    this.draw(this.backdrop.buffer, this.backdrop.count);
    this.updateFrustum();
    for (const chunk of this.chunks.values()) {
      if (!this.chunkVisible(chunk)) continue;
      this.draw(chunk.buffer, chunk.count);
    }
    for (const effect of state.effects || []) {
      if (effect.type !== 'hit' || (effect.age || 0) > 0.045) continue;
      const impact = `${state.frame - Math.round((effect.age || 0) * 60)}:${effect.x}:${effect.z}`;
      if (impact !== this.lastImpact) { this.lastImpact = impact; this.hitStopRemaining = 0.035; }
    }
    this.hitStopRemaining = Math.max(0, this.hitStopRemaining - (dt || 1 / 60));
    if (this.hitStopRemaining <= 0 || !this.dynamic.length) this.buildDynamic(state);
    this.drawDynamic(this.dynamic, this.dynamicBuffer);
    gl.enable(gl.BLEND); this.draw(this.water.buffer, this.water.count);
    gl.depthMask(false); this.drawDynamic(this.transparent, this.transparentBuffer); gl.depthMask(true); gl.disable(gl.BLEND);
    this.stats.dynamicTriangles = (this.dynamic.vertices + this.transparent.vertices) / 3;
    this.stats.frameMs = performance.now() - start;
  }

  project(x, y, z) {
    const m = this.viewProjection;
    const px = m[0] * x + m[4] * y + m[8] * z + m[12];
    const py = m[1] * x + m[5] * y + m[9] * z + m[13];
    const pz = m[2] * x + m[6] * y + m[10] * z + m[14];
    const w = m[3] * x + m[7] * y + m[11] * z + m[15];
    const nx = px / w, ny = py / w;
    return { x: (nx + 1) * this.cssWidth / 2, y: (1 - ny) * this.cssHeight / 2,
      visible: w > 0 && pz >= -w && pz <= w && Math.abs(nx) <= 1.1 && Math.abs(ny) <= 1.1 };
  }

  dispose() {
    const gl = this.gl;
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    for (const chunk of this.chunks.values()) gl.deleteBuffer(chunk.buffer);
    for (const value of [this.skyBuffer, this.dynamicBuffer, this.transparentBuffer, this.water.buffer, this.backdrop.buffer]) gl.deleteBuffer(value);
    gl.deleteProgram(this.program); gl.deleteProgram(this.skyProgram); this.chunks.clear();
  }
}
