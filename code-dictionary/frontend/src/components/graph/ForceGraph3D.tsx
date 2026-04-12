import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import ForceGraph3DComponent from 'react-force-graph-3d';
import * as THREE from 'three';
import type { GraphNode, GraphLink, GraphRenderer } from '../../types/graph';
import { CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface ForceGraph3DProps {
  nodes: GraphNode[];
  links: GraphLink[];
  highlightedNodes: Set<string>;
  dimmed: boolean;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
  width: number;
  height: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function bubbleRadius(n: GraphNode): number {
  return Math.max(5, 3 + n.indexCount * 1.5 + n.relatedCount * 0.8);
}

/** Create a canvas texture with text label for a bubble */
function makeLabelTexture(text: string, radius: number, color: string, subText?: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Transparent background
  ctx.clearRect(0, 0, size, size);

  // Circular clip for glow
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.clip();

  // Radial gradient fill (bubble-like)
  const [r, g, b] = hexToRgb(color);
  const grad = ctx.createRadialGradient(size * 0.4, size * 0.35, size * 0.05, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${Math.min(255, r + 80)},${Math.min(255, g + 80)},${Math.min(255, b + 80)},0.95)`);
  grad.addColorStop(0.5, `rgba(${r},${g},${b},0.85)`);
  grad.addColorStop(0.85, `rgba(${Math.max(0, r - 40)},${Math.max(0, g - 40)},${Math.max(0, b - 40)},0.75)`);
  grad.addColorStop(1, `rgba(${Math.max(0, r - 60)},${Math.max(0, g - 60)},${Math.max(0, b - 60)},0.5)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Subtle border ring
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${r},${g},${b},0.6)`;
  ctx.lineWidth = 3;
  ctx.stroke();

  // Main label
  if (radius >= 5) {
    let fontSize = Math.min(42, Math.max(16, radius * 4));
    ctx.font = `700 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Truncate if needed
    let label = text;
    let measured = ctx.measureText(label);
    const maxW = size * 0.8;
    if (measured.width > maxW) {
      while (label.length > 2 && ctx.measureText(label + '…').width > maxW) {
        label = label.slice(0, -1);
      }
      label += '…';
    }

    const yOffset = subText ? -fontSize * 0.2 : 0;
    ctx.fillText(label, size / 2, size / 2 + yOffset);

    // Sub text (refs count)
    if (subText && radius >= 8) {
      const subSize = Math.max(12, fontSize * 0.55);
      ctx.font = `400 ${subSize}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(subText, size / 2, size / 2 + fontSize * 0.65 + yOffset);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */
const ForceGraph3D = forwardRef<GraphRenderer, ForceGraph3DProps>(
  ({ nodes, links, highlightedNodes, dimmed, onNodeClick, onBackgroundClick, width, height }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fgRef = useRef<any>(null);
    const spriteCache = useRef(new Map<string, THREE.Object3D>());

    useImperativeHandle(ref, () => ({
      focusNode(nodeId: string, withSidePanel = false) {
        if (!fgRef.current) return;
        const graphNodes = fgRef.current.graphData().nodes;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const node = graphNodes.find((n: any) => n.id === nodeId);
        if (!node) return;
        const distance = 160;
        const sideOffset = withSidePanel ? -80 : 0;
        fgRef.current.cameraPosition(
          { x: node.x + distance + sideOffset, y: node.y + distance / 3, z: node.z + distance },
          { x: node.x + sideOffset, y: node.y, z: node.z },
          1000,
        );
      },
      highlightNodes() {},
      dimAllExcept() {},
      resetView() {
        if (fgRef.current) {
          fgRef.current.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 1000);
        }
      },
    }));

    /* ---- Custom node rendering: Bubblemaps-style 3D sprite ---- */
    const nodeThreeObject = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        const n = node as GraphNode;
        const color = CATEGORY_COLORS[n.category as Category] || '#888';
        const radius = bubbleRadius(n);
        const cacheKey = `${n.id}_${n.name}_${color}_${radius}`;

        if (spriteCache.current.has(cacheKey)) {
          return spriteCache.current.get(cacheKey)!.clone();
        }

        const group = new THREE.Group();

        // Bubble sprite (textured plane facing camera)
        const subText = n.indexCount > 0 ? `${n.indexCount} refs` : undefined;
        const texture = makeLabelTexture(n.name, radius, color, subText);
        const spriteMat = new THREE.SpriteMaterial({
          map: texture,
          transparent: true,
          depthWrite: false,
        });
        const sprite = new THREE.Sprite(spriteMat);
        const spriteSize = radius * 2.5;
        sprite.scale.set(spriteSize, spriteSize, 1);
        group.add(sprite);

        // Outer glow ring
        const [r, g, b] = hexToRgb(color);
        const glowTexture = makeGlowTexture(r, g, b);
        const glowMat = new THREE.SpriteMaterial({
          map: glowTexture,
          transparent: true,
          depthWrite: false,
          opacity: 0.3,
        });
        const glow = new THREE.Sprite(glowMat);
        glow.scale.set(spriteSize * 1.8, spriteSize * 1.8, 1);
        group.add(glow);

        spriteCache.current.set(cacheKey, group);
        return group.clone();
      },
      [],
    );

    /* ---- Node visual updates (highlight/dim) ---- */
    const nodeColor = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        const n = node as GraphNode;
        const color = CATEGORY_COLORS[n.category as Category] || '#888';
        if (dimmed && highlightedNodes.has(n.id)) return '#ffffff';
        if (dimmed && !highlightedNodes.has(n.id)) return `${color}15`;
        return color;
      },
      [dimmed, highlightedNodes],
    );

    /* ---- Node size ---- */
    const nodeVal = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        const n = node as GraphNode;
        return Math.max(8, n.indexCount * 4 + n.relatedCount * 2 + 4);
      },
      [],
    );

    /* ---- Link styling ---- */
    const linkColor = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (link: any) => {
        if (!dimmed) return 'rgba(140, 130, 255, 0.25)';
        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        if (highlightedNodes.has(src) && highlightedNodes.has(tgt)) {
          return 'rgba(200, 190, 255, 0.8)';
        }
        return 'rgba(100, 90, 180, 0.05)';
      },
      [dimmed, highlightedNodes],
    );

    const linkWidth = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (link: any) => {
        if (!dimmed) return 2;
        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        if (highlightedNodes.has(src) && highlightedNodes.has(tgt)) return 4;
        return 0.5;
      },
      [dimmed, highlightedNodes],
    );

    /* ---- Particle flow on highlighted links ---- */
    const linkParticles = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (link: any) => {
        if (!dimmed) return 0;
        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        return (highlightedNodes.has(src) && highlightedNodes.has(tgt)) ? 3 : 0;
      },
      [dimmed, highlightedNodes],
    );

    const nodeLabel = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        const n = node as GraphNode;
        const color = CATEGORY_COLORS[n.category as Category] || '#888';
        return `<div style="background:rgba(10,10,24,0.92);padding:10px 14px;border-radius:8px;border:1px solid ${color}40;max-width:240px">
          <div style="font-weight:700;font-size:14px;color:#fff;margin-bottom:4px">${n.name}</div>
          <div style="font-size:11px;color:${color};margin-bottom:4px">${n.category.replace(/_/g, ' ')} · ${n.level}</div>
          ${n.description ? `<div style="font-size:10px;color:rgba(255,255,255,0.5);line-height:1.4">${n.description.slice(0, 80)}${n.description.length > 80 ? '…' : ''}</div>` : ''}
          <div style="font-size:10px;color:rgba(255,255,255,0.35);margin-top:4px">${n.indexCount} code refs · ${n.relatedCount} related</div>
        </div>`;
      },
      [],
    );

    return (
      <ForceGraph3DComponent
        ref={fgRef}
        graphData={{ nodes, links }}
        nodeId="id"
        nodeLabel={nodeLabel}
        nodeColor={nodeColor}
        nodeVal={nodeVal}
        nodeOpacity={0.9}
        nodeRelSize={6}
        nodeResolution={32}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkOpacity={0.8}
        linkCurvature={0.15}
        linkCurveRotation={0.5}
        linkDirectionalParticles={linkParticles}
        linkDirectionalParticleSpeed={0.005}
        linkDirectionalParticleWidth={3}
        linkDirectionalParticleColor={() => 'rgba(180, 170, 255, 0.8)'}
        onNodeClick={(node: unknown) => onNodeClick(node as GraphNode)}
        onBackgroundClick={onBackgroundClick}
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        height={height}
        showNavInfo={false}
        controlType="orbit"
        d3VelocityDecay={0.35}
        warmupTicks={80}
        cooldownTime={3000}
        onEngineReady={() => {
          if (!fgRef.current) return;
          const controls = fgRef.current.controls();
          if (controls) {
            controls.zoomSpeed = 2.5;
            controls.rotateSpeed = 0.8;
            controls.enableDamping = true;
            controls.dampingFactor = 0.12;
          }
          // Start camera further back for bigger bubbles
          fgRef.current.cameraPosition({ x: 0, y: 0, z: 720 }, { x: 0, y: 0, z: 0 }, 0);

          // Custom clustering force
          const fg = fgRef.current;
          fg.d3Force('cluster', clusterForce(nodes));
          fg.d3Force('charge')?.strength(-450);
          fg.d3Force('link')?.distance(200);
        }}
      />
    );
  },
);

ForceGraph3D.displayName = 'ForceGraph3D';
export default ForceGraph3D;

/* ------------------------------------------------------------------ */
/*  Glow texture                                                       */
/* ------------------------------------------------------------------ */
function makeGlowTexture(r: number, g: number, b: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${r},${g},${b},0.4)`);
  grad.addColorStop(0.4, `rgba(${r},${g},${b},0.15)`);
  grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

/* ------------------------------------------------------------------ */
/*  Custom d3 clustering force                                         */
/* ------------------------------------------------------------------ */
function clusterForce(graphNodes: GraphNode[]) {
  // Compute category centers
  const categories = [...new Set(graphNodes.map((n) => n.category))];
  const catAngle = new Map<string, number>();
  categories.forEach((cat, i) => {
    catAngle.set(cat, (i / categories.length) * Math.PI * 2);
  });
  const clusterR = 260;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let simNodes: any[] = [];

  const force = (alpha: number) => {
    for (const node of simNodes) {
      const angle = catAngle.get(node.category) ?? 0;
      const tx = Math.cos(angle) * clusterR;
      const ty = Math.sin(angle) * clusterR;
      node.vx += (tx - (node.x || 0)) * 0.003 * alpha;
      node.vy += (ty - (node.y || 0)) * 0.003 * alpha;
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  force.initialize = (nodes: any[]) => {
    simNodes = nodes;
  };

  return force;
}
