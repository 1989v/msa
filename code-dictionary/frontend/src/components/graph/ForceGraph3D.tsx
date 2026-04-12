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

/** Create a flat, clean bubble texture — no glow, no glassmorphism */
function makeBubbleTexture(text: string, radius: number, color: string, subText?: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);

  const [r, g, b] = hexToRgb(color);

  // Solid fill with slight depth — lighter center, darker edge (no glow)
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
  const grad = ctx.createRadialGradient(size * 0.42, size * 0.38, size * 0.05, size / 2, size / 2, size / 2);
  grad.addColorStop(0, `rgba(${Math.min(255, r + 40)},${Math.min(255, g + 40)},${Math.min(255, b + 40)},0.92)`);
  grad.addColorStop(0.6, `rgba(${r},${g},${b},0.85)`);
  grad.addColorStop(1, `rgba(${Math.max(0, r - 25)},${Math.max(0, g - 25)},${Math.max(0, b - 25)},0.78)`);
  ctx.fillStyle = grad;
  ctx.fill();

  // Thin border — same hue, not a contrasting accent
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 3, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(${Math.min(255, r + 60)},${Math.min(255, g + 60)},${Math.min(255, b + 60)},0.35)`;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Label text inside bubble
  if (radius >= 5) {
    const fontSize = Math.min(40, Math.max(16, radius * 3.8));
    ctx.font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let label = text;
    const maxW = size * 0.78;
    if (ctx.measureText(label).width > maxW) {
      while (label.length > 2 && ctx.measureText(label + '…').width > maxW) {
        label = label.slice(0, -1);
      }
      label += '…';
    }

    const yOff = subText ? -fontSize * 0.18 : 0;
    ctx.fillText(label, size / 2, size / 2 + yOff);

    // Refs count — muted, no accent color
    if (subText && radius >= 8) {
      const sub = Math.max(12, fontSize * 0.5);
      ctx.font = `400 ${sub}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(subText, size / 2, size / 2 + fontSize * 0.6 + yOff);
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
          fgRef.current.cameraPosition({ x: 0, y: 0, z: 720 }, { x: 0, y: 0, z: 0 }, 1000);
        }
      },
    }));

    /* ---- Custom 3D bubble sprite (no glow, no glassmorphism) ---- */
    const nodeThreeObject = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        const n = node as GraphNode;
        const color = CATEGORY_COLORS[n.category as Category] || '#888';
        const radius = bubbleRadius(n);
        const cacheKey = `${n.id}`;

        if (spriteCache.current.has(cacheKey)) {
          return spriteCache.current.get(cacheKey)!.clone();
        }

        const subText = n.indexCount > 0 ? `${n.indexCount} refs` : undefined;
        const texture = makeBubbleTexture(n.name, radius, color, subText);
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
        const sprite = new THREE.Sprite(mat);
        const spriteSize = radius * 2.5;
        sprite.scale.set(spriteSize, spriteSize, 1);

        spriteCache.current.set(cacheKey, sprite);
        return sprite.clone();
      },
      [],
    );

    /* ---- Node color (for highlight/dim state) ---- */
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

    /* ---- Link color — neutral, no purple ---- */
    const linkColor = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (link: any) => {
        if (!dimmed) return 'rgba(160, 165, 180, 0.18)';
        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        if (highlightedNodes.has(src) && highlightedNodes.has(tgt)) {
          return 'rgba(210, 215, 230, 0.65)';
        }
        return 'rgba(120, 125, 140, 0.05)';
      },
      [dimmed, highlightedNodes],
    );

    const linkWidth = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (link: any) => {
        if (!dimmed) return 1.8;
        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        if (highlightedNodes.has(src) && highlightedNodes.has(tgt)) return 3.5;
        return 0.4;
      },
      [dimmed, highlightedNodes],
    );

    /* ---- Particles on highlighted links only ---- */
    const linkParticles = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (link: any) => {
        if (!dimmed) return 0;
        const src = typeof link.source === 'string' ? link.source : link.source?.id;
        const tgt = typeof link.target === 'string' ? link.target : link.target?.id;
        return (highlightedNodes.has(src) && highlightedNodes.has(tgt)) ? 2 : 0;
      },
      [dimmed, highlightedNodes],
    );

    /* ---- Tooltip — clean, no colored borders or glow ---- */
    const nodeLabel = useCallback(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (node: any) => {
        const n = node as GraphNode;
        const color = CATEGORY_COLORS[n.category as Category] || '#888';
        return `<div style="background:#1e2030;padding:0.75rem 1rem;border-radius:0.5rem;border:1px solid #2a2d3e;max-width:15rem;font-family:system-ui,sans-serif">
          <div style="font-weight:600;font-size:1rem;color:#e2e4ea;margin-bottom:0.25rem">${n.name}</div>
          <div style="font-size:0.875rem;color:${color};margin-bottom:0.25rem">${n.category.replace(/_/g, ' ')} · ${n.level}</div>
          ${n.description ? `<div style="font-size:0.875rem;color:#8b8fa4;line-height:1.5;margin-bottom:0.25rem">${n.description.slice(0, 80)}${n.description.length > 80 ? '…' : ''}</div>` : ''}
          <div style="font-size:0.75rem;color:#5c6070">${n.indexCount} code refs · ${n.relatedCount} related</div>
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
        linkCurvature={0.12}
        linkCurveRotation={0.5}
        linkDirectionalParticles={linkParticles}
        linkDirectionalParticleSpeed={0.004}
        linkDirectionalParticleWidth={2.5}
        linkDirectionalParticleColor={() => 'rgba(200, 205, 220, 0.7)'}
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
          fgRef.current.cameraPosition({ x: 0, y: 0, z: 720 }, { x: 0, y: 0, z: 0 }, 0);

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
/*  Custom d3 clustering force — groups by category                    */
/* ------------------------------------------------------------------ */
function clusterForce(graphNodes: GraphNode[]) {
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
