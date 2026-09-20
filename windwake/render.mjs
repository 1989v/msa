import { WORLD, VILLAGE, TOWNS, LANDMARKS, RUNES, PLATE, heightAt, terrainColor, getChunk, querySolids } from './world.mjs';
import { dungeonGeometry, dungeonFloor, dungeonSolids, dungeonCleared } from './dungeons.mjs';

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
  dune:[.79,.69,.46], autumn:[.75,.39,.20], alpine:[.63,.73,.72], lavender:[.58,.49,.72],
  nightSky:[.19,.29,.39], cropLeaf:[.34,.57,.29], cropRipe:[.94,.69,.28], soil:[.40,.31,.22],
});

const TAU = Math.PI * 2;
const STRIDE = 11;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const noise = (x, z) => { const n = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return n - Math.floor(n); };
const tint = (c, n) => [c[0] * n, c[1] * n, c[2] * n];
const SQRT3 = Math.sqrt(3);
export function daylightAt(clock) {
  if (!Number.isFinite(clock)) return 1;
  const t = ((clock % 600) + 600) % 600;
  if (t < 420) return 1;
  if (t < 480) return mix(1, .55, (t - 420) / 60);
  if (t < 540) return .55;
  return mix(.55, 1, (t - 540) / 60);
}
const STRUCTURE_SIZE={cottage:[3.2,3.2,3.8],well:[1.8,1.8,1.2],granary:[3.2,3.2,3],tower:[1.8,1.8,4.6],fence:[3.6,.6,1.6]};

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
uniform float uDaylight;
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
  if (vMaterial < 0.5 || vMaterial > 1.5) color *= uDaylight;
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
uniform float uDaylight;
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
  color = mix(color * vec3(0.43, 0.56, 0.78), color, (uDaylight - 0.55) / 0.45);
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

const CAMERA_NEAR = .12;
function perspective(out, aspect, near = CAMERA_NEAR, far = 260) {
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

// Sweep the camera's near-plane envelope rather than just its eye point. A
// continuous slab test also catches thin doors and walls within half a metre.
function cameraObstruction(start, delta, solids, padding) {
  let limit = 1;
  for (const b of solids) {
    const low = [b.x-b.w/2-padding,b.y-padding,b.z-b.d/2-padding];
    const high = [b.x+b.w/2+padding,b.y+b.h+padding,b.z+b.d/2+padding];
    let enter = 0, leave = limit;
    for (let axis = 0; axis < 3 && enter <= leave; axis++) {
      if (Math.abs(delta[axis]) < 1e-8) {
        if (start[axis] < low[axis] || start[axis] > high[axis]) { enter = 2; break; }
      } else {
        let a = (low[axis]-start[axis])/delta[axis], z = (high[axis]-start[axis])/delta[axis];
        if (a > z) [a,z] = [z,a];
        enter = Math.max(enter,a); leave = Math.min(leave,z);
      }
    }
    if (enter <= leave) limit = Math.min(limit,Math.max(0,enter-.001));
  }
  return limit;
}

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.gl = canvas.getContext('webgl', { alpha: false, antialias: false, depth: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
    if (!this.gl) throw new Error('WebGL을 사용할 수 없습니다. 브라우저의 하드웨어 가속을 켜 주세요.');
    const gl = this.gl;
    this.program = program(gl, VERTEX, FRAGMENT); this.skyProgram = program(gl, SKY_VERTEX, SKY_FRAGMENT);
    this.attributes = ['aPosition', 'aNormal', 'aColor', 'aMaterial'].map(n => gl.getAttribLocation(this.program, n));
    this.uniforms = Object.fromEntries(['uViewProjection', 'uEye', 'uFog', 'uTime', 'uDaylight'].map(n => [n, gl.getUniformLocation(this.program, n)]));
    this.skyUniforms = Object.fromEntries(['uYawPitch', 'uAspect', 'uTime', 'uFog', 'uDaylight'].map(n => [n, gl.getUniformLocation(this.skyProgram, n)]));
    this.skyPosition = gl.getAttribLocation(this.skyProgram, 'aPosition');
    this.skyBuffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    this.dynamicBuffer = gl.createBuffer(); this.transparentBuffer = gl.createBuffer();
    this.dynamic = new Mesh(16000); this.transparent = new Mesh(10000);
    this.view = new Float32Array(16); this.projection = new Float32Array(16); this.viewProjection = new Float32Array(16);
    this.frustum = new Float32Array(24);
    this.eye = new Float32Array(3); this.target = new Float32Array(3);
    this.eyeInitialized = false; this.time = 0; this.lastFrame = -1; this.hitStopRemaining = 0; this.lastImpact = '';
    this.stats = { drawCalls: 0, triangles: 0, staticTriangles: 0, dynamicTriangles: 0, frameMs: 0, width: 0, height: 0, pixelRatio: 1, residentChunks:0, maxResidentChunks:64, residentBytes:0, chunkBuilds:0, chunkEvictions:0, disposedChunks:0, activeScene:'world', dungeonBuffers:0, dungeonBytes:0, sceneTransitions:0, visibleNPCs:0 };
    this.resolutionScale = 1; this.activeScene='world'; this.dungeonBatch=null; this.sceneState=null;
    this.chunkSize = WORLD.chunkSize; this.chunks = new Map(); this.buildWorld(); this.streamWorld(WORLD.spawn.x, WORLD.spawn.z, 9, 1); this.resize();
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

  chunk() { return this.buildingMesh; }
  upload(mesh) {
    const gl = this.gl, buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, mesh.data.subarray(0, mesh.length), gl.STATIC_DRAW);
    return { buffer, count: mesh.vertices, bytes: mesh.length * 4 };
  }
  buildWorld() {
    const size = WORLD.size, water = new Mesh(16), waterY = WORLD.waterLevel;
    water.quad(-size, waterY, -size, -size, waterY, size, size, waterY, size, size, waterY, -size, PALETTE.water, .94, 2);
    this.water = this.upload(water);
    const backdrop = new Mesh(1000);
    for (let i = 0; i < 40; i++) {
      const a = i / 40 * TAU, r = size + 65 + noise(i, 9) * 28;
      backdrop.cone(Math.sin(a) * r, -13, Math.cos(a) * r, 25 + noise(i, 3) * 24, 22 + noise(i, 12) * 35, PALETTE.stoneDark, 5, 0, a);
    }
    this.backdrop = this.upload(backdrop);
  }
  buildChunk(cx, cz) {
    const chunk = getChunk(cx, cz), mesh = new Mesh(4000), step = 3, minX = cx * this.chunkSize, minZ = cz * this.chunkSize;
    this.buildingMesh = mesh;
    for (let x = minX; x < minX + this.chunkSize; x += step) for (let z = minZ; z < minZ + this.chunkSize; z += step) {
      const x2 = x + step, z2 = z + step, a = heightAt(x,z), b = heightAt(x2,z), c = heightAt(x2,z2), d = heightAt(x,z2);
      const col = terrainColor(x + step / 2, z + step / 2);
      mesh.tri(x,a,z,x,d,z2,x2,c,z2,col); mesh.tri(x,a,z,x2,c,z2,x2,b,z,tint(col,1.005));
    }
    for (const box of chunk.solids) this.staticBlock(box);
    for (const prop of chunk.props) this.staticProp(prop);
    const owns = p => Math.floor(p.x / this.chunkSize) === cx && Math.floor(p.z / this.chunkSize) === cz;
    for (const town of TOWNS) for (const building of town.buildings) if (owns(building)) this.settlementBuilding(mesh,building);
    for (const landmark of LANDMARKS) if (owns(landmark)) this.staticLandmark(landmark);
    for (const rune of RUNES) if (owns(rune)) {
      mesh.cone(rune.x,rune.y,rune.z,.66,1.45,PALETTE.stone,6,.5);
      mesh.box(rune.x,rune.y+.5,rune.z-.47,.70,.65,.08,PALETTE.stoneDark);
    }
    if (owns(PLATE)) for (let i=0;i<32;i++) {
      const a=i/32*TAU,b=(i+1)/32*TAU,ax=PLATE.x+Math.sin(a)*PLATE.radius,az=PLATE.z+Math.cos(a)*PLATE.radius,bx=PLATE.x+Math.sin(b)*PLATE.radius,bz=PLATE.z+Math.cos(b)*PLATE.radius;
      mesh.tri(PLATE.x,PLATE.y+.035,PLATE.z,ax,heightAt(ax,az)+.035,az,bx,heightAt(bx,bz)+.035,bz,PALETTE.stoneDark);
    }
    const data=mesh.data;let lowX=Infinity,lowY=Infinity,lowZ=Infinity,highX=-Infinity,highY=-Infinity,highZ=-Infinity;
    for(let i=0;i<mesh.length;i+=STRIDE){lowX=Math.min(lowX,data[i]);highX=Math.max(highX,data[i]);lowY=Math.min(lowY,data[i+1]);highY=Math.max(highY,data[i+1]);lowZ=Math.min(lowZ,data[i+2]);highZ=Math.max(highZ,data[i+2]);}
    const result={id:chunk.id,cx,cz,centerX:(lowX+highX)/2,centerY:(lowY+highY)/2,centerZ:(lowZ+highZ)/2,radius:Math.hypot(highX-lowX,highY-lowY,highZ-lowZ)/2,...this.upload(mesh)};
    this.buildingMesh=null;this.stats.chunkBuilds++;
    return result;
  }
  streamWorld(x,z,budget=2,radius=3) {
    const cx=Math.floor(clamp(x,-WORLD.size,WORLD.size-.01)/this.chunkSize),cz=Math.floor(clamp(z,-WORLD.size,WORLD.size-.01)/this.chunkSize);
    const desired=[];
    for(let dx=-radius;dx<=radius;dx++)for(let dz=-radius;dz<=radius;dz++)if(cx+dx>=-16&&cx+dx<16&&cz+dz>=-16&&cz+dz<16)desired.push({cx:cx+dx,cz:cz+dz,id:`${cx+dx},${cz+dz}`,distance:dx*dx+dz*dz});
    const keep=new Set(desired.map(c=>c.id));
    for(const [id,chunk]of this.chunks)if(!keep.has(id)){this.gl.deleteBuffer(chunk.buffer);this.chunks.delete(id);this.stats.chunkEvictions++;this.stats.disposedChunks++;}
    desired.sort((a,b)=>a.distance-b.distance||a.cx-b.cx||a.cz-b.cz);
    let built=0;
    for(const c of desired){if(this.chunks.has(c.id))continue;if(built>=budget||this.chunks.size>=64)break;this.chunks.set(c.id,this.buildChunk(c.cx,c.cz));built++;}
    this.stats.residentChunks=this.chunks.size;this.stats.residentBytes=0;this.stats.staticTriangles=0;
    for(const chunk of this.chunks.values()){this.stats.residentBytes+=chunk.bytes;this.stats.staticTriangles+=chunk.count/3;}
    this.stats.chunkBuildsThisFrame=built;
  }

  floorAt(x,z) { return this.sceneState?.expedition?.active?dungeonFloor(this.sceneState,x,z):heightAt(x,z); }
  syncScene(state) {
    this.sceneState=state;
    const id=state.expedition?.active?.id||'world';
    if(id===this.activeScene)return;
    for(const chunk of this.chunks.values()){this.gl.deleteBuffer(chunk.buffer);this.stats.disposedChunks++;this.stats.chunkEvictions++;}
    this.chunks.clear();
    if(this.dungeonBatch){this.gl.deleteBuffer(this.dungeonBatch.buffer);this.dungeonBatch=null;}
    if(this.water){this.gl.deleteBuffer(this.water.buffer);this.water=null;}
    if(this.backdrop){this.gl.deleteBuffer(this.backdrop.buffer);this.backdrop=null;}
    this.activeScene=id;this.stats.activeScene=id;this.stats.sceneTransitions++;
    this.eyeInitialized=false;this.hitStopRemaining=0;this.lastImpact='';this.dynamic.clear();this.transparent.clear();
    this.stats.residentChunks=0;this.stats.residentBytes=0;this.stats.staticTriangles=0;this.stats.dungeonBuffers=0;this.stats.dungeonBytes=0;this.stats.visibleNPCs=0;this.stats.chunkBuildsThisFrame=0;
    if(id==='world')this.buildWorld();
    else {
      const geometry=dungeonGeometry(state);if(!geometry)return;
      const mesh=new Mesh(6000);this.buildingMesh=mesh;
      const theme=geometry.id.endsWith('sunfields')?PALETTE.dune:geometry.id.endsWith('canyon')?PALETTE.rock:geometry.id.endsWith('mistwood')?tint(PALETTE.pine,1.65):PALETTE.alpine;
      for(const floor of geometry.floors){
        mesh.box(floor.x,floor.y,floor.z,floor.w,floor.h,floor.d,PALETTE.stoneDark);
        // Surface tiles follow the exact collision cuboid; never create a hidden floor.
        const y=floor.y+floor.h+.008;
        for(let x=floor.x-floor.w/2+2;x<floor.x+floor.w/2;x+=4)mesh.beam(x,y,floor.z-floor.d/2,x,y,floor.z+floor.d/2,.025,.016,PALETTE.stone);
        for(let z=floor.z-floor.d/2+2;z<floor.z+floor.d/2;z+=4)mesh.beam(floor.x-floor.w/2,y,z,floor.x+floor.w/2,y,z,.025,.016,PALETTE.stone);
      }
      for(const wall of geometry.walls){
        const col=wall.kind==='ceiling'?PALETTE.stoneDark:theme;
        mesh.box(wall.x,wall.y,wall.z,wall.w,wall.h,wall.d,col);
        if(wall.kind!=='ceiling')mesh.box(wall.x,wall.y+wall.h-.16,wall.z,wall.w+.04,.16,wall.d+.04,PALETTE.stoneDark);
      }
      for(const prop of geometry.props||[]){
        if([prop.w,prop.h,prop.d,prop.y].every(Number.isFinite))mesh.box(prop.x,prop.y,prop.z,prop.w,prop.h,prop.d,theme);
        else this.staticProp(prop);
      }
      this.dungeonBatch=this.upload(mesh);this.buildingMesh=null;
      this.stats.dungeonBuffers=1;this.stats.dungeonBytes=this.dungeonBatch.bytes;this.stats.residentBytes=this.dungeonBatch.bytes;this.stats.staticTriangles=this.dungeonBatch.count/3;
    }
  }
  dungeon(state) {
    const g=dungeonGeometry(state);if(!g)return;
    const m=this.dynamic,a=this.transparent,time=state.time||0,progress=state.expedition.progress?.[g.id]||{},solved=progress.solved||[],opened=progress.opened||[];
    this.stats.visibleNPCs=0;this.stats.closedDungeonDoors=0;
    for(const door of g.doors){
      if(door.open){a.ring(door.x,door.y+.03,door.z,1,.04,PALETTE.wind,.35);continue;}
      this.stats.closedDungeonDoors++;
      // The visible gate occupies exactly the cuboid returned by dungeonSolids.
      m.box(door.x,door.y,door.z,door.w,door.h,door.d,PALETTE.trunk);
      const wide=door.w>=door.d;
      if(wide)for(let x=-door.w/2+.4;x<door.w/2;x+=.8)m.box(door.x+x,door.y,door.z,.06,door.h,door.d+.025,PALETTE.steel);
      else for(let z=-door.d/2+.4;z<door.d/2;z+=.8)m.box(door.x,door.y,door.z+z,door.w+.025,door.h,.06,PALETTE.steel);
      m.jewel(door.x,door.y+door.h*.55,door.z,.20,.45,PALETTE.amber,0,1);
    }
    for(const l of g.landmarks){
      if(l.afterClear&&!progress.claimed)continue;
      const y=l.y??this.floorAt(l.x,l.z),lit=l.active??(solved.includes(l.puzzleId)||solved.includes(l.id)),col=lit?PALETTE.wind:PALETTE.amber;
      m.origin(l.x,y,l.z,l.yaw||0);
      if(l.kind==='exit'){
        for(const side of [-1,1])m.box(side*1.7,0,0,.45,3.6,.65,PALETTE.stone);m.box(0,3.1,0,3.8,.55,.7,PALETTE.stone);
        m.jewel(1.7,2.45,0,.16,.4,PALETTE.wind,time*.3,1);a.ring(l.x,y+.06,l.z,1.4,.09,PALETTE.wind,.8);
      }else if(l.kind==='chest'){
        const taken=opened.includes(l.id);m.box(0,.05,0,.95,.55,.65,PALETTE.trunk);m.box(0,taken?.82:.60,taken?-.3:0,1,.14,.7,PALETTE.amber);if(!taken)m.jewel(0,1.2,0,.12,.30,PALETTE.amber,time*.3,1);
      }else if(l.kind==='plate'){
        m.cone(0,0,0,l.radius||1.4,.1,PALETTE.stone,12,l.radius||1.4);m.ring(0,.11,0,l.radius||1.4,.09,col,.8);
      }else if(l.kind==='lever'){
        m.box(0,0,0,.6,.7,.6,PALETTE.stoneDark);m.beam(0,.55,0,lit?.45:-.45,1.4,0,.12,.12,PALETTE.trunk);m.jewel(lit?.45:-.45,1.4,0,.14,.24,col,0,1);
      }else if(l.kind==='rune'){
        m.box(0,0,0,.9,1.45,.6,PALETTE.stoneDark);m.jewel(0,1.9,0,.22,.55,col,time*.3,1);
        const count=(l.index??0)+1;for(let i=0;i<Math.min(count,5);i++)m.box((i-(count-1)/2)*.12,.6,.315,.04,.4,.035,col,0,1,1);
      }else if(l.kind==='clue'){
        m.box(0,0,0,1.6,1.4,.3,PALETTE.stone);for(let i=0;i<3;i++)m.box(0,.35+i*.25,.17,1.1-i*.17,.06,.02,PALETTE.amber,0,1,1);
      }else if(l.kind==='reset'){
        m.cone(0,0,0,.45,.85,PALETTE.stone,6,.3);m.ring(0,1.1,0,.45,.07,PALETTE.wind,.8,time,5);
      }
      m.origin(0,0,0);
    }
    // Torches are readable room anchors, with no simulation RNG or collider additions.
    for(const room of g.rooms){const x=room.x-room.w/2+1,z=room.z-room.d/2+1,y=this.floorAt(x,z);
      if(y<0)continue;m.beam(x,y,z,x,y+2,z,.13,.13,PALETTE.trunk);m.cone(x,y+2,z,.2,.50+Math.sin(time*9+x)*.05,PALETTE.amber,5,0,0,1,1);
    }
  }

  settlementBuilding(m,b) {
    const style=b.style,service=b.type==='service',wall=['lodge','forge','observatory'].includes(style)?PALETTE.stone:style==='herbalist'||style==='fishery'?PALETTE.trunk:PALETTE.paper;
    const roof=style==='caravan'?PALETTE.dune:style==='observatory'?PALETTE.lavender:style==='lodge'?PALETTE.alpine:style==='herbalist'?PALETTE.leaf:PALETTE.cape;
    m.origin(b.x,b.y,b.z,b.yaw||0);
    if(service&&style==='observatory'){
      m.cone(0,0,0,3,4,wall,8,3);m.cone(0,4,0,3,2,PALETTE.alpine,10,.3);m.beam(0,5.8,0,0,8,0,.12,.12,PALETTE.amber);m.ring(0,6.1,0,.85,.08,PALETTE.amber,.9);
    }else{
      const base=style==='fishery'?1:0,wallHeight=style==='caravan'?2.5:3;
      if(base)for(const x of [-2.5,2.5])for(const z of [-2.5,2.5])m.box(x,0,z,.25,1.1,.25,PALETTE.trunk);
      m.box(0,base,0,6,wallHeight,6,wall);
      if(style==='caravan'){
        m.box(0,base+wallHeight,0,6.3,.25,6.3,roof);
        m.quad(-3.3,2.75,3,3.3,2.75,3,3.3,2.25,4.4,-3.3,2.25,4.4,PALETTE.cloth);
        for(const side of [-1,1])m.box(side*3,0,4.2,.12,2.3,.12,PALETTE.trunk);
        m.cone(0,2.75,0,2,1.2,PALETTE.dune,8,.4);
      }else if(style==='herbalist'){
        m.cone(0,base+wallHeight,0,4,2,roof,7,.7);for(const side of [-1,1])m.box(side*2.85,0,3.06,.20,3.2,.14,PALETTE.trunk);
      }else{
        const ridge=base+wallHeight+(style==='lodge'?2:1.6),edge=base+wallHeight;
        m.quad(-3.3,edge,-3.3,0,ridge,-3.3,0,ridge,3.3,-3.3,edge,3.3,roof);
        m.quad(0,ridge,-3.3,3.3,edge,-3.3,3.3,edge,3.3,0,ridge,3.3,tint(roof,1.1));
        m.tri(-3.3,edge,3.3,3.3,edge,3.3,0,ridge,3.3,roof);m.tri(-3.3,edge,-3.3,0,ridge,-3.3,3.3,edge,-3.3,roof);
      }
      m.box(0,base,3.02,1.1,2.0,.05,PALETTE.trunk);
      for(const x of [-1.9,1.9]){m.box(x,base+1.2,3.04,.85,.85,.07,PALETTE.cloth);m.box(x,base+1.61,3.09,.9,.06,.04,PALETTE.amber);}
      if(style==='lodge'||style==='forge')m.box(1.8,3,-1.7,.85,service?5:2.5,.85,PALETTE.stoneDark);
      if(service&&style==='mill'){m.cone(0,3.6,0,1.65,3,PALETTE.paper,8,1.15);m.cone(0,6.6,0,1.7,1.2,PALETTE.cape,8);}
      if(service&&style==='fishery'){m.box(-2,3.5,-1.4,.6,3,.6,PALETTE.stone);m.jewel(-2,6.7,-1.4,.4,.6,PALETTE.amber,0,1);}
      if(service&&style==='forge'){m.box(0,.2,3.07,1.7,1.5,.13,PALETTE.stoneDark);m.cone(0,.3,3.25,.45,.85,PALETTE.amber,5,0,0,1,1);}
      if(style==='orchard')for(const x of [-2,2]){m.box(x,.05,3.4,1,.45,.6,PALETTE.trunk);for(let i=0;i<3;i++)m.jewel(x+(i-1)*.24,.6,3.4,.15,.2,PALETTE.danger);}
    }
    m.origin(0,0,0);
  }

  staticBlock(block) {
    if (block.kind === 'trunk' || block.kind === 'town-building' || block.id?.startsWith('solid-prop-')) return; // Its corresponding procedural tree owns the visible trunk.
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
    const x = prop.x, z = prop.z, y = prop.y ?? this.floorAt(x, z), s = prop.scale || 1;
    const m = this.chunk(x, z), type = prop.type || prop.kind || 'rock';
    m.origin(x, y, z, prop.yaw || noise(x, z) * TAU, s);
    if (type.includes('tree') || type.includes('pine')) {
      const pine = type.includes('pine'), h = pine ? 5.8 : 4.5;
      const foliage=type.includes('autumn')?PALETTE.autumn:prop.biomeId==='alpine'?PALETTE.alpine:PALETTE.leaf;
      const light=type.includes('autumn')?PALETTE.amber:PALETTE.leafLight;
      m.cone(0, 0, 0, 0.24, h * 0.8, PALETTE.trunk, 6, 0.11);
      m.beam(0, 1.8, 0, 1.0, 3.0, 0.25, 0.15, 0.14, PALETTE.trunk);
      if (pine) {
        m.cone(0, 1.6, 0, 1.6, 2.9, PALETTE.pine, 7);
        m.cone(0, 3.0, 0, 1.25, 2.4, foliage, 7);
        m.cone(0, 4.3, 0, 0.8, 1.6, PALETTE.leafLight, 7);
      } else {
        m.jewel(0, 3.6, 0, 1.8, 2.4, foliage, 0.3);
        m.jewel(1.0, 3.0, 0.25, 1.15, 1.6, light, 0.8);
        m.jewel(-0.8, 3.3, 0.5, 1.35, 1.8, light, 0.2);
      }
    } else if (type.includes('grass') || type.includes('reed')) {
      for (let i = 0; i < 3; i++) {
        const px = (i - 1) * 0.14, h = type.includes('reed') ? 1.1 : 0.40 + i * 0.07;
        m.tri(px - 0.08, 0, 0, px + 0.08, 0, 0.06, px + 0.18, h, 0.03, PALETTE.leafLight);
        if (type.includes('reed')) m.box(px + 0.12, h - 0.25, 0.03, 0.05, 0.2, 0.05, PALETTE.amber);
      }
    } else if (type.includes('flower')) {
      m.beam(0, 0, 0, 0.04, 0.43, 0, 0.025, 0.025, PALETTE.leaf);
      m.jewel(0.04, 0.43, 0, 0.13, 0.13, prop.biomeId==='lavender'?PALETTE.lavender:PALETTE.paper);
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
    if(kind==='town'){
      m.box(-3,0,-2,.16,2.3,.16,PALETTE.trunk);m.box(-3,1.5,-2,2.2,.8,.16,PALETTE.trunk);m.box(-3,1.83,-2.1,1.5,.08,.03,PALETTE.paper);
    }else if(kind==='dungeon'){
      m.origin(l.x,y,l.z,l.yaw||0);
      for(const side of [-1,1]){m.box(side*2.4,0,0,.9,4.5,1.2,PALETTE.stoneDark);m.cone(side*2.4,4.5,0,.7,.6,PALETTE.stone,5);}
      m.box(0,4,0,5.5,.85,1.3,PALETTE.stone);m.box(0,0,-.12,3.9,3.95,.20,PALETTE.ink);m.ring(0,.08,1,2.7,.14,PALETTE.amber,.8);
    }else if (kind === 'waypoint') {
      m.cone(0,0,0,2.5,.12,PALETTE.stoneDark,12,2.5);
      m.ring(0,.14,0,2.1,.12,PALETTE.amber,.9);
      for(const side of [-1,1]) {m.cone(side*1.45,.1,0,.30,4.1,PALETTE.stone,5,.18);m.box(side*1.45,4.15,0,.7,.25,.7,PALETTE.amber);}
      m.beam(-1.45,3.3,0,1.45,3.3,0,.18,.18,PALETTE.stone);
      if(l.id==='home'){
        m.box(3,.1,1.8,.16,1.8,.16,PALETTE.trunk);m.box(3,1.35,1.8,1.8,.65,.16,PALETTE.trunk);
        m.box(3,1.6,1.70,.9,.06,.035,PALETTE.paper,0,1,1);
      }
    } else if(kind==='resource') {
      if(l.material==='wood'){m.cone(0,0,0,.85,.9,PALETTE.trunk,7,.62);m.cone(0,.91,0,.60,.02,PALETTE.dune,7,.60);m.beam(-1,.2,.5,1.2,.2,.6,.45,.45,PALETTE.trunk);}
      else if(l.material==='stone'){m.cone(0,0,0,1.1,1.25,PALETTE.rock,6,.3);m.cone(.8,0,.5,.6,.6,PALETTE.stone,5,.1);}
      else{m.jewel(0,.7,0,1.0,1.2,PALETTE.leaf);for(let i=0;i<5;i++)m.jewel(Math.sin(i*2)*.7,1+Math.cos(i)*.2,Math.cos(i*2)*.7,.12,.2,PALETTE.danger);}
    } else if(kind==='trial') {
      m.ring(0,.06,0,2.5,.25,PALETTE.stone,.9);
      for(let i=0;i<3;i++){const angle=i/3*TAU;m.cone(Math.sin(angle)*3.1,0,Math.cos(angle)*3.1,.45,3.5+i*.7,PALETTE.stone,5,.25);}
      m.box(0,0,0,1.1,.8,.8,PALETTE.stoneDark);m.box(0,.8,0,.9,.10,.65,PALETTE.wind);
    } else if (kind === 'camp' || kind === 'checkpoint') {
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
      m.ring(0, .05, 0, l.biomeId?13:5.5, .14, PALETTE.amber, 1, 0, TAU, 0, 40);
      if(l.biomeId)for(let i=0;i<6;i++){const a=i/6*TAU;m.cone(Math.sin(a)*15,0,Math.cos(a)*15,.55,4+i%3,PALETTE.stone,6,.3);}
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
    const indoors=Boolean(state.expedition?.active);
    const solids=[...(indoors?dungeonSolids(state,targetX,targetZ,distance+2):querySolids(targetX,targetZ,distance+2)),...(state.blocks||[])];
    for(const structure of indoors?[]:state.village?.structures||[]){
      const size=STRUCTURE_SIZE[structure.type];if(!size||structure.hp<=0)continue;
      const rotated=Math.abs(Math.sin(structure.facing||0))>.5;
      solids.push({x:structure.x,y:structure.y,z:structure.z,w:size[rotated?1:0],d:size[rotated?0:1],h:size[2]});
    }
    const padding = Math.hypot(CAMERA_NEAR,CAMERA_NEAR/this.projection[0],CAMERA_NEAR/this.projection[5])+.025;
    const anchor = [targetX,targetY,targetZ], lag = anchor.map((v,i)=>this.target[i]-v);
    if (cameraObstruction(anchor,lag,solids,padding)<1 || this.target[1]<this.floorAt(this.target[0],this.target[2])+padding) this.target.set(anchor);
    const shake = camera.reducedMotion ? 0 : clamp(camera.shake || 0, 0, 1) * 0.12;
    const delta = [dx*distance+Math.sin(this.time*71)*shake,dy*distance+Math.cos(this.time*83)*shake,dz*distance];
    let fraction = cameraObstruction(this.target,delta,solids,padding);
    // Terrain is continuous authored/procedural height, so retain a bounded
    // height sweep. No minimum zoom may override an obstruction or final shake.
    const steps = Math.ceil(Math.hypot(...delta)/.2);
    for (let i=1;i<=steps;i++) {
      const t=Math.min(fraction,i/steps),x=this.target[0]+delta[0]*t,y=this.target[1]+delta[1]*t,z=this.target[2]+delta[2]*t;
      if (y<this.floorAt(x,z)+padding) { fraction=Math.max(0,(i-1)/steps); break; }
      if (t===fraction) break;
    }
    for (let axis=0;axis<3;axis++) this.eye[axis]=this.target[axis]+delta[axis]*fraction;
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
    const ground = this.floorAt(p.x, p.z);
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
    const scale = boss ? 2.5 : charger || e.type==='sentinel' ? 1.35 : 1.0;
    const gait = e.state === 'chase' || e.state === 'attack' ? Math.sin(time * (charger ? 10 : 8)) * 0.28 : Math.sin(time * 1.7) * 0.015;
    const color = e.hitFlash > 0 ? PALETTE.paper : boss || charger ? PALETTE.armor : ranger ? PALETTE.ranger : PALETTE.cape;
    m.origin(e.x, e.y, e.z, e.yaw || 0, scale);
    if (['slime','wolf','boar','wisp','burrower'].includes(e.type)) {
      const type=e.type,bob=Math.sin(time*4)*.06;
      if(type==='slime'){
        m.cone(0,.12,0,.77,1.05+bob,PALETTE.wind,9,.22);m.cone(0,.12,0,.78,-.1,PALETTE.crystal,9,.7);
        for(const side of [-1,1])m.box(side*.20,.66,.54,.12,.16,.04,PALETTE.ink);
      } else if(type==='wisp') {
        m.jewel(0,.7+bob,0,.4,1.1,PALETTE.crystal,time);
        for(const side of [-1,1]){m.tri(side*.2,.8,0,side*1.15,1.2+Math.sin(time*8)*.2,-.1,side*.6,.4,.2,PALETTE.wind,.85,1);}
        m.ring(0,.75,0,.7,.04,PALETTE.paper,.8,time,4.5);
      } else if(type==='burrower'){
        m.cone(0,e.burrowed?-.5:.05,0,.85,.85,PALETTE.dune,7,.25);
        for(const side of [-1,1]){m.beam(side*.5,.2,.2,side*.95,.05,.7,.2,.2,PALETTE.steel);m.jewel(side*.18,.4,.62,.08,.14,PALETTE.danger);}
        for(let i=0;i<3;i++)m.cone(0,.65,-.3+i*.3,.15,.5,PALETTE.rock,4);
      } else {
        const boar=type==='boar',coat=boar?PALETTE.trunk:PALETTE.alpine;
        m.box(0,.45,0,boar?1.0:.7,.65,1.45,coat);m.box(0,.7,.75,boar?.7:.5,.48,.55,coat);
        for(const side of [-1,1])for(const fore of [-1,1])m.beam(side*.30,.48,fore*.5,side*.30,.03,fore*.5+Math.sin(time*9+fore+side)*.15,.16,.18,PALETTE.leather);
        for(const side of [-1,1]){m.cone(side*.2,1.13,.66,.14,.32,coat,4);m.jewel(side*.16,.94,1.04,.07,.10,PALETTE.amber);if(boar)m.cone(side*.3,.65,1.03,.12,.38,PALETTE.paper,4);}
        m.beam(0,.84,-.6,0,1.0,-1.2,.14,.17,coat);
      }
    } else {
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
    }
    if(e.type==='shaman'){
      m.cone(0,.15,0,.58,1.35,PALETTE.lavender,7,.29);m.beam(-.7,.05,.2,-.7,2.4,.2,.09,.09,PALETTE.trunk);m.jewel(-.7,2.55,.2,.24,.55,PALETTE.wind,time,1);
    }else if(e.type==='bomber'){
      m.jewel(0,1,-.6,.55,1.0,PALETTE.danger);m.beam(0,1.4,-.5,.25,2,-.55,.05,.05,PALETTE.trunk);m.jewel(.25,2,-.55,.1,.15,PALETTE.amber,time,1);
    }else if(e.type==='sentinel'){
      m.box(-.48,.4,.4,.8,1.3,.22,PALETTE.stone);m.box(-.48,.9,.53,.6,.12,.035,PALETTE.amber);m.beam(.55,1,.15,.6,.8,1.8,.18,.12,PALETTE.steel);
    }else if(e.type==='frostling'){
      m.cone(0,1.72,0,.35,.60,PALETTE.alpine,5);for(const side of [-1,1])m.jewel(side*.4,1.4,.1,.24,.65,PALETTE.crystal);
    }
    if(boss&&e.family==='tempest')for(const side of [-1,1])m.tri(side*.4,1.5,-.1,side*1.7,2.25,-.25,side*1.1,.7,-.5,PALETTE.lavender);
    if(boss&&e.family==='thorn')for(const side of [-1,1]){m.beam(side*.4,1.6,0,side*.95,2.5,0,.12,.12,PALETTE.trunk);m.cone(side*.9,2.3,0,.15,.6,PALETTE.leaf,4);}
    if(boss&&e.family==='tide'){m.ring(0,1.8,0,.65,.08,PALETTE.crystal,.9);m.beam(.7,.1,.2,.7,2.6,.2,.10,.10,PALETTE.steel);m.jewel(.7,2.65,.2,.25,.5,PALETTE.wind,time,1);}
    m.origin(0, 0, 0);
    this.shadow(e.x, Math.max(this.floorAt(e.x, e.z), e.y - 0.08), e.z, 0.65 * scale);
    if (e.state === 'telegraph') {
      const targeted=['eruption','slow'].includes(e.pattern);
      const tx=targeted&&Number.isFinite(e.targetX)?e.targetX:e.x,tz=targeted&&Number.isFinite(e.targetZ)?e.targetZ:e.z;
      const a = this.transparent, y = (targeted&&Number.isFinite(e.targetY)?e.targetY:e.y) + .075, yaw = e.yaw || 0;
      const pattern = e.pattern || (charger ? 'charge' : ranger ? 'bolt' : 'slam');
      const pulse = 0.62 + Math.sin(time * 14) * 0.16;
      if (pattern === 'bolt') {
        // Thin arrow-shaped lanes communicate the ranged volley, distinct from an area slam.
        for (let i = 0; i < (boss ? 3 : 1); i++) {
          const heading = yaw + (i - (boss ? 1 : 0)) * 0.18;
          a.tri(tx, y, tz, tx + Math.sin(heading - 0.025) * 12, y, tz + Math.cos(heading - 0.025) * 12,
            tx + Math.sin(heading + 0.025) * 12, y, tz + Math.cos(heading + 0.025) * 12, PALETTE.danger, pulse * 0.6, 1);
        }
      } else if (pattern === 'charge' || pattern === 'leap') {
        a.origin(tx, y, tz, yaw);
        a.quad(-0.7, 0, 0, 0.7, 0, 0, 0.7, 0, 8.25, -0.7, 0, 8.25, PALETTE.danger, 0.17, 1);
        a.beam(-0.7, 0.02, 0, -0.7, 0.02, 8.25, 0.05, 0.04, PALETTE.danger, pulse, 1);
        a.beam(0.7, 0.02, 0, 0.7, 0.02, 8.25, 0.05, 0.04, PALETTE.danger, pulse, 1);
        a.tri(-0.5, 0.03, 6.8, 0.5, 0.03, 6.8, 0, 0.03, 8.0, PALETTE.paper, 0.65, 1);
        a.origin(0, 0, 0);
      } else if (['summon','slow','eruption','burst'].includes(pattern)) {
        const radius=e.telegraphRadius|| (boss?5.5:3.5),col=pattern==='slow'?PALETTE.alpine:pattern==='summon'?PALETTE.lavender:PALETTE.danger;
        a.ring(tx,y,tz,radius,.16,col,pulse);a.ring(tx,y+.02,tz,radius,radius,col,.10);
        for(let i=0;i<6;i++){const heading=i/6*TAU+time*.2,px=tx+Math.sin(heading)*radius*.72,pz=tz+Math.cos(heading)*radius*.72;
          if(pattern==='eruption'||pattern==='burst')a.cone(px,y,pz,.28,.45+Math.sin(time*12)*.2,col,4,0,0,.65,1);
          else a.beam(tx,y+.04,tz,px,y+.04,pz,.05,.04,col,pulse,1);
        }
      } else if (pattern === 'ring') {
        a.ring(tx, y, tz, e.telegraphRadius||9, 0.17, PALETTE.amber, pulse, 0, TAU, 1, 48);
        a.ring(tx, y + 0.05, tz, (e.telegraphRadius||9)-.3, 0.04, PALETTE.paper, 0.7, 0, TAU, 1, 48);
        // Low concentric arcs advertise the jumpable wave.
        a.ring(tx, y + 0.3, tz, 1.8 + (time * 2 % 1) * 4, 0.06, PALETTE.amber, 0.5);
      } else {
        const radius = e.telegraphRadius || (boss ? 5.1 : 2.9), start = boss && pattern!=='sweep' ? 0 : yaw - 1.3, span = boss && pattern!=='sweep' ? TAU : 2.6;
        a.ring(tx, y, tz, radius, 0.13, PALETTE.danger, pulse, start, span);
        a.ring(tx, y + 0.01, tz, radius, radius, PALETTE.danger, 0.09, start, span);
        if (boss) for (let i = 0; i < 8; i++) {
          const angle = i / 8 * TAU;
          a.beam(tx + Math.sin(angle) * 3.7, y + 0.02, tz + Math.cos(angle) * 3.7,
            tx + Math.sin(angle) * 5.0, y + 0.02, tz + Math.cos(angle) * 5.0, 0.07, 0.035, PALETTE.danger, pulse, 1);
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
      if(kind==='town'){
        // The sign, inhabitants and service buildings provide the town signal.
      }else if(kind==='dungeon'){
        const done=dungeonCleared(state,l.id);
        const col=done?PALETTE.wind:PALETTE.lavender;
        a.ring(l.x,y+.12,l.z,2.15,.09,col,.8,time*.3,5.2);m.jewel(l.x,y+4.55,l.z,.4,.8,col,time*.3,1);
      }else if(kind==='waypoint'){
        const active=(state.adventure?.waypoints||['home']).includes(l.id),col=active?PALETTE.wind:PALETTE.amber;
        m.jewel(l.x,y+2.4+Math.sin(time*1.7)*.1,l.z,.4,1.0,col,time*.35,1);
        a.ring(l.x,y+.18,l.z,2.05,.07,col,.8);
        m.beam(l.x,y+4.4,l.z,l.x,y+12,l.z,.09,.09,col,1,1);m.jewel(l.x,y+12.2,l.z,.4,.8,col,time*.2,1);
      }else if(kind==='resource'){
        const gathered=state.village?.gathered||{};
        const ready=!Object.hasOwn(gathered,l.id)||(state.village?.elapsed||0)-gathered[l.id]>=(l.cooldown||90);
        if(ready)m.jewel(l.x,y+2,l.z,.14,.32,PALETTE.amber,time*.5,1);
      }else if(kind==='trial'){
        const done=(state.adventure?.completedTasks||[]).includes(l.id),col=done?PALETTE.wind:PALETTE.amber;
        a.ring(l.x,y+.9,l.z,1.1,.06,col,.8,time,4.8);m.jewel(l.x,y+1.7,l.z,.23,.6,col,time*.3,1);
      }else if (kind === 'camp' || kind === 'checkpoint') {
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

  settlements(state) {
    const m=this.dynamic,p=state.player,time=state.time||0;let count=0;
    for(const t of TOWNS){
      if(Math.hypot(t.x-p.x,t.z-p.z)>110)continue;
      const service=t.buildings.find(b=>b.type==='service');
      if(t.style==='mill'){
        m.origin(service.x,service.y,service.z,service.yaw);const angle=time*.55;
        for(let i=0;i<4;i++){const a=angle+i/4*TAU;m.beam(Math.sin(a)*.3,6.3+Math.cos(a)*.3,1.8,Math.sin(a)*2.5,6.3+Math.cos(a)*2.5,1.8,.25,.12,PALETTE.trunk);m.beam(Math.sin(a)*1.5,6.3+Math.cos(a)*1.5,1.85,Math.sin(a)*2.4,6.3+Math.cos(a)*2.4,1.85,.55,.06,PALETTE.paper);}
        m.origin(0,0,0);
      }
      for(const npc of t.npcs){
        if(count>=12)break;if(Math.hypot(npc.x-p.x,npc.z-p.z)>85)continue;count++;
        const col=npc.role==='guide'?PALETTE.wind:npc.role==='merchant'?PALETTE.amber:PALETTE.lavender,y=npc.y;
        const yaw=Math.hypot(npc.x-p.x,npc.z-p.z)<8?Math.atan2(p.x-npc.x,p.z-npc.z):npc.yaw;
        m.origin(npc.x,y,npc.z,yaw);
        for(const side of [-1,1])m.box(side*.16,0,0,.18,.72,.24,PALETTE.leather);
        m.box(0,.68,0,.58,.68,.38,col);m.box(0,1.38,0,.34,.36,.32,PALETTE.skin);m.box(0,1.70,0,.42,.12,.39,PALETTE.ink);
        m.beam(-.32,1.2,0,-.40,.78,.12,.14,.14,PALETTE.skin);m.beam(.32,1.2,0,.40,.80,.12,.14,.14,PALETTE.skin);
        if(npc.role==='merchant')m.box(.48,.80,.1,.32,.42,.3,PALETTE.trunk);
        if(npc.role==='guide')m.box(-.4,.78,.2,.35,.12,.25,PALETTE.paper);
        if(npc.role==='keeper')m.cone(0,1.8,0,.28,.18,PALETTE.lavender,6);
        m.jewel(0,2.25+Math.sin(time*2)*.06,0,.14,.32,col,time*.3,1);m.origin(0,0,0);
        this.shadow(npc.x,y,npc.z,.48,.15);
      }
    }
    this.stats.visibleNPCs=count;
  }

  village(state) {
    const village=state.village,p=state.player,m=this.dynamic,a=this.transparent,time=state.time||0;
    if(village&&Math.hypot(p.x-VILLAGE.x,p.z-VILLAGE.z)<125){
      for(const b of (village.structures||[]).slice(0,32)){
        if(Math.hypot(b.x-p.x,b.z-p.z)>95)continue;
        m.origin(b.x,b.y??heightAt(b.x,b.z),b.z,b.facing||0);
        const type=b.type,ruined=b.hp<=0;
        if(ruined){m.box(0,0,0,2.7,.18,2.7,PALETTE.stoneDark);for(let i=0;i<3;i++)m.cone(Math.sin(i*2)*.9,.15,Math.cos(i*2)*.8,.45,.45,PALETTE.rock,5,.2);}
        else if(type==='plot'){
          m.box(0,0,0,3,.12,3,PALETTE.soil);
          for(const side of [-1,1]){m.box(side*1.45,.02,0,.1,.18,3,PALETTE.trunk);m.box(0,.02,side*1.45,3,.18,.1,PALETTE.trunk);}
        }else if(type==='cottage'||type==='granary'){
          const granary=type==='granary',base=granary?.6:0,h=granary?1.8:2.3;
          if(granary)for(const x of [-1.1,1.1])for(const z of [-1.1,1.1])m.box(x,0,z,.2,.7,.2,PALETTE.trunk);
          m.box(0,base,0,3.1,h,3.1,granary?PALETTE.trunk:PALETTE.paper);
          for(const x of [-1.5,1.5])m.box(x,base,1.56,.12,h,.09,PALETTE.trunk);
          m.box(0,base,1.57,.65,1.55,.035,PALETTE.trunk);
          for(const x of [-.96,.96]){m.box(x,base+.9,1.58,.55,.64,.045,PALETTE.cloth);m.box(x,base+1.17,1.61,.59,.05,.05,PALETTE.amber);}
          const roof=granary?PALETTE.dune:PALETTE.cape;
          m.quad(-1.8,base+h,-1.8,0,base+h+1.2,-1.8,0,base+h+1.2,1.8,-1.8,base+h,1.8,roof);
          m.quad(0,base+h+1.2,-1.8,1.8,base+h,-1.8,1.8,base+h,1.8,0,base+h+1.2,1.8,PALETTE.capeLight);
          m.tri(-1.8,base+h,1.8,1.8,base+h,1.8,0,base+h+1.2,1.8,roof);
          m.tri(-1.8,base+h,-1.8,0,base+h+1.2,-1.8,1.8,base+h,-1.8,roof);
          if(!granary)m.box(.9,base+h+.6,-.8,.4,.7,.4,PALETTE.stone);
        }else if(type==='well'){
          m.cone(0,0,0,.9,.85,PALETTE.stone,10,.9);m.cone(0,.86,0,.63,.01,PALETTE.water,10,.63);
          for(const side of [-1,1])m.box(side*.8,0,0,.12,1.7,.12,PALETTE.trunk);
          m.beam(-.9,1.5,0,.9,1.5,0,.15,.15,PALETTE.trunk);m.beam(0,1.5,0,0,.55,0,.025,.025,PALETTE.paper);
        }else if(type==='tower'){
          for(const x of [-.65,.65])for(const z of [-.65,.65])m.box(x,0,z,.20,3.3,.20,PALETTE.trunk);
          for(const side of [-1,1])m.beam(side*.65,.2,-.65,side*.65,2.8,.65,.1,.1,PALETTE.trunk);
          m.box(0,3.0,0,2.0,.22,2.0,PALETTE.stone);
          for(const side of [-1,1]){m.box(side*.91,3.2,0,.18,.55,2,PALETTE.trunk);m.box(0,3.2,side*.91,2,.55,.18,PALETTE.trunk);}
          m.cone(0,3.24,0,.38,.75,PALETTE.cloth,6,.25);m.jewel(0,4.08,0,.2,.45,PALETTE.amber,time*.4,1);
          m.beam(-.65,3.6,.2,.65,3.6,.2,.12,.12,PALETTE.steel);
        }else if(type==='fence'){
          for(const x of [-1.6,0,1.6])m.box(x,0,0,.16,1.6,.18,PALETTE.trunk);
          for(const y of [.55,1.18])m.box(0,y,0,3.6,.16,.16,PALETTE.dune);
        }else if(type==='flowers'){
          for(let i=0;i<7;i++){const x=Math.sin(i*2)*.7,z=Math.cos(i*2)*.7;m.beam(x,0,z,x,.3+i%3*.1,z,.03,.03,PALETTE.cropLeaf);m.jewel(x,.4+i%3*.1,z,.17,.18,i%2?PALETTE.lavender:PALETTE.paper);}
        }else if(type==='lantern'){
          m.box(0,0,0,.14,2.1,.14,PALETTE.trunk);m.beam(0,2,0,.45,2,0,.1,.1,PALETTE.trunk);m.box(.4,1.62,0,.32,.4,.32,PALETTE.amber,0,1,1);m.cone(.4,2.03,0,.26,.18,PALETTE.stoneDark,4);
        }
        m.origin(0,0,0);
        if(!ruined&&b.hp<b.maxHp){a.ring(b.x,(b.y??0)+.2,b.z,1.9,.08,PALETTE.danger,.7,0,TAU*clamp(b.hp/b.maxHp,0,1));}
      }
      for(const plot of (village.plots||[]).slice(0,16)){
        if(!plot.crop||Math.hypot(plot.x-p.x,plot.z-p.z)>85)continue;
        const stage={seed:.12,sprout:.30,growing:.65,ripe:1}[plot.stage]||.12,ripe=plot.stage==='ripe';
        m.origin(plot.x,(plot.y??heightAt(plot.x,plot.z))+.14,plot.z);
        if(plot.watered)m.box(0,0,0,2.65,.02,2.65,tint(PALETTE.soil,.78));
        for(let i=0;i<9;i++){
          const x=(i%3-1)*.8,z=(Math.floor(i/3)-1)*.8,h=.15+stage*.60;
          if(plot.crop==='wheat'){
            for(const d of [-.11,.11]){m.beam(x+d,0,z,x+d,h,z,.035,.035,PALETTE.cropLeaf);m.cone(x+d,h*.65,z,.07,h*.5,ripe?PALETTE.cropRipe:PALETTE.cropLeaf,5,.02);}
          }else if(plot.crop==='pumpkin'){
            m.tri(x-.28*stage,.1,z,x,.22*stage,z+.23,x+.28*stage,.1,z,PALETTE.cropLeaf);
            if(stage>.4){m.jewel(x,h*.26,z,.30*stage,.52*stage,ripe?PALETTE.cropRipe:PALETTE.cropLeaf);m.beam(x,h*.45,z,x+.04,h*.68,z,.06,.06,PALETTE.trunk);}
          }else if(plot.crop==='moonflower'){
            m.beam(x,0,z,x,h,z,.04,.04,PALETTE.cropLeaf);m.jewel(x,h,z,.17*stage,.25*stage,ripe?PALETTE.paper:PALETTE.lavender,time*.1,ripe?1:0);
          }else{
            if(ripe)m.jewel(x,.12,z,.17,.28,PALETTE.paper);
            m.tri(x-.2*stage,.1,z,x,h,z,x+.2*stage,.1,z,PALETTE.cropLeaf);
            m.tri(x,.1,z-.18*stage,x,h*.8,z,x,.1,z+.18*stage,PALETTE.leafLight);
          }
        }
        m.origin(0,0,0);
        if(ripe)a.ring(plot.x,(plot.y??0)+.2,plot.z,1.5,.04,PALETTE.cropRipe,.65);
      }
      if((village.beaconHp??180)<(village.maxBeaconHp??180))a.ring(VILLAGE.x,heightAt(VILLAGE.x,VILLAGE.z)+.22,VILLAGE.z,3.5,.18,PALETTE.danger,.85,0,TAU*clamp(village.beaconHp/(village.maxBeaconHp||180),0,1));
      if(daylightAt(village.clock)>.75)for(let i=0;i<3;i++){
        const x=VILLAGE.x+Math.sin(time*.2+i*2)*18,z=VILLAGE.z+Math.cos(time*.2+i*2)*18,y=heightAt(x,z)+5+i*.5,wing=Math.sin(time*9+i)*.18;
        m.tri(x,y,z,x-.5,y+wing,z-.12,x,y+.05,z+.15,PALETTE.paper);m.tri(x,y,z,x+.5,y+wing,z-.12,x,y+.05,z+.15,PALETTE.paper);
      }
    }
    const preview=state.buildPreview;
    if(preview&&Number.isFinite(preview.x)&&Number.isFinite(preview.z)){
      const y=heightAt(preview.x,preview.z)+.12,col=preview.valid===false?PALETTE.danger:PALETTE.wind;
      a.origin(preview.x,y,preview.z,preview.facing||0);a.box(0,0,0,3.7,.08,3.7,col,0,.30,1);a.ring(0,.1,0,2.2,.06,col,.8);a.origin(0,0,0);
    }
  }

  effects(state) {
    const a = this.transparent, m = this.dynamic, time = state.time || 0;
    const effects = state.effects || [];
    for (let index = Math.max(0, effects.length - 180); index < effects.length; index++) {
      const e = effects[index], life = Math.max(0.01, e.life || 0.6), age = e.age || 0;
      const t = clamp(age / life, 0, 1), fade = 1 - t, power = e.power || 1;
      const type = e.type || '', x = e.x || 0, y = e.y || 0, z = e.z || 0;
      if(type.includes('bloom')||type.includes('healing')){
        a.ring(x,y+.08,z,1+t*4,.12,PALETTE.wind,fade*.8);
        for(let i=0;i<8;i++){const angle=i/8*TAU+time*.3;m.jewel(x+Math.sin(angle)*t*3,y+.3+Math.sin(t*Math.PI),z+Math.cos(angle)*t*3,.14*fade,.3*fade,PALETTE.paper,angle,1);}
      }else if(type.includes('winddash')){
        a.origin(x,y+.6,z,e.yaw||0);for(let i=0;i<3;i++)a.ring(0,-.4+i*.25,-t*2-i*.6,.6+t,.07,PALETTE.wind,fade*.6,0,TAU);a.origin(0,0,0);
      }else if(type.includes('quake')){
        a.ring(x,y+.10,z,t*(e.power||6),.24,PALETTE.amber,fade*.8);
        for(let i=0;i<8;i++){const angle=i/8*TAU;m.cone(x+Math.sin(angle)*t*4,y,z+Math.cos(angle)*t*4,.2*fade,Math.sin(t*Math.PI)*.7,PALETTE.rock,4);}
      }else if(type.includes('tower')&&Number.isFinite(e.targetX)){
        m.beam(x,y+3.7,z,e.targetX,e.targetY??y+1,e.targetZ,.06,.06,PALETTE.amber,fade,1);
      }else if (type.includes('pulse') || type.includes('shock') || type.includes('ring') || type.includes('slam')) {
        const radius = (e.power || (type.includes('pulse') ? 7 : 3.5)) * Math.max(0.04, t);
        const color = e.pattern ? e.pattern === 'ring' ? PALETTE.amber : e.pattern === 'slow' ? PALETTE.alpine : PALETTE.danger : PALETTE.wind;
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
      const hostile = p.hostile !== false && p.owner !== 'player', col = p.type==='sunbolt'?PALETTE.amber:p.kind==='frost'||p.type==='frost'?PALETTE.alpine:hostile?PALETTE.danger:PALETTE.wind;
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
      const y = item.y ?? this.floorAt(item.x, item.z), bob = Math.sin((state.time || 0) * 3 + item.x) * 0.1;
      if (item.type === 'flask' || item.type === 'heal') {
        m.cone(item.x, y + 0.25 + bob, item.z, 0.15, 0.28, PALETTE.danger, 6, 0.10);
        m.box(item.x, y + 0.53 + bob, item.z, 0.13, 0.07, 0.13, PALETTE.amber);
      } else m.jewel(item.x, y + 0.4 + bob, item.z, 0.16, 0.4, PALETTE.crystal, state.time || 0, 1);
    }
    if(state.expedition?.active)this.dungeon(state);else{this.dynamicLandmarks(state);this.settlements(state);this.village(state);}this.effects(state);
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
    this.syncScene(state);
    const indoors=Boolean(state.expedition?.active);
    if(!indoors)this.streamWorld(state.player.x,state.player.z);else this.stats.chunkBuildsThisFrame=0;
    this.updateCamera(state, camera, dt);
    const daylight=indoors?.92:daylightAt(state.village?.clock), fog=indoors?PALETTE.ink:PALETTE.sky.map((v,i)=>mix(PALETTE.nightSky[i],v,(daylight-.55)/.45));
    gl.clearColor(...fog, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.BLEND);
    if(!indoors){
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(this.skyProgram); gl.bindBuffer(gl.ARRAY_BUFFER, this.skyBuffer);
    for (const attribute of this.attributes) gl.disableVertexAttribArray(attribute);
    gl.enableVertexAttribArray(this.skyPosition); gl.vertexAttribPointer(this.skyPosition, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(this.skyUniforms.uYawPitch, this.cameraYaw, this.cameraPitch);
    gl.uniform1f(this.skyUniforms.uAspect, this.cssWidth / this.cssHeight); gl.uniform1f(this.skyUniforms.uTime, this.time);
    gl.uniform1f(this.skyUniforms.uDaylight, daylight); gl.uniform3fv(this.skyUniforms.uFog, fog); gl.drawArrays(gl.TRIANGLES, 0, 3); this.stats.drawCalls++;
    gl.disableVertexAttribArray(this.skyPosition);
    }
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.uViewProjection, false, this.viewProjection);
    gl.uniform3fv(this.uniforms.uEye, this.eye); gl.uniform3fv(this.uniforms.uFog, fog); gl.uniform1f(this.uniforms.uDaylight, daylight);
    gl.uniform1f(this.uniforms.uTime, state.time || this.time);
    if(indoors){if(this.dungeonBatch)this.draw(this.dungeonBatch.buffer,this.dungeonBatch.count);}else this.draw(this.backdrop.buffer, this.backdrop.count);
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
    gl.enable(gl.BLEND); if(!indoors)this.draw(this.water.buffer, this.water.count);
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
    for (const chunk of this.chunks.values()) { gl.deleteBuffer(chunk.buffer); this.stats.disposedChunks++; }
    for (const value of [this.skyBuffer, this.dynamicBuffer, this.transparentBuffer, this.water?.buffer, this.backdrop?.buffer, this.dungeonBatch?.buffer].filter(Boolean)) gl.deleteBuffer(value);
    gl.deleteProgram(this.program); gl.deleteProgram(this.skyProgram); this.chunks.clear();
    this.stats.residentChunks=0;this.stats.residentBytes=0;this.stats.staticTriangles=0;this.stats.dungeonBuffers=0;this.stats.dungeonBytes=0;
  }
}
