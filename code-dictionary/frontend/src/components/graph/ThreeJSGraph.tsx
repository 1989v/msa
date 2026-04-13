import { useRef, useMemo, forwardRef, useImperativeHandle } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import * as THREE from 'three';
// @ts-expect-error d3-force-3d has no type definitions
import { forceSimulation, forceManyBody, forceLink, forceCenter } from 'd3-force-3d';
import type { GraphNode, GraphLink, GraphRenderer } from '../../types/graph';
import { CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface ThreeJSGraphProps {
  nodes: GraphNode[];
  links: GraphLink[];
  highlightedNodes: Set<string>;
  dimmed: boolean;
  onNodeClick: (node: GraphNode) => void;
  onBackgroundClick: () => void;
  width: number;
  height: number;
}

interface SimNode extends GraphNode {
  x: number;
  y: number;
  z: number;
}

function useForceLayout(nodes: GraphNode[], links: GraphLink[]): SimNode[] {
  return useMemo(() => {
    const simNodes: SimNode[] = nodes.map((n) => ({ ...n, x: 0, y: 0, z: 0 }));
    const simLinks = links.map((l) => ({ ...l }));

    const sim = forceSimulation(simNodes, 3)
      .force('charge', forceManyBody().strength(-80))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .force('link', forceLink(simLinks).id((d: any) => d.id).distance(40))
      .force('center', forceCenter())
      .stop();

    for (let i = 0; i < 120; i++) sim.tick();
    return simNodes;
  }, [nodes, links]);
}

function NodeMesh({
  node,
  highlighted,
  dimmed,
  onClick,
}: {
  node: SimNode;
  highlighted: boolean;
  dimmed: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const color = CATEGORY_COLORS[node.category as Category] || '#94a3b8';
  const radius = Math.max(1.5, node.relatedCount * 0.8);
  const opacity = dimmed && !highlighted ? 0.1 : Math.min(1, 0.4 + (node.indexCount / 10) * 0.6);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.lerp(new THREE.Vector3(node.x, node.y, node.z), 0.1);
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[node.x, node.y, node.z]} onClick={onClick}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={opacity}
          emissive={color}
          emissiveIntensity={highlighted ? 0.5 : 0.1}
        />
      </mesh>
      <Text
        position={[node.x, node.y + radius + 1.5, node.z]}
        fontSize={1.2}
        color="#cbd5e1"
        anchorX="center"
        anchorY="bottom"
      >
        {node.name}
      </Text>
    </group>
  );
}

function LinkLine({
  source,
  target,
  dimmed,
}: {
  source: SimNode;
  target: SimNode;
  dimmed: boolean;
}) {
  const points = useMemo(
    () => [
      new THREE.Vector3(source.x, source.y, source.z),
      new THREE.Vector3(target.x, target.y, target.z),
    ],
    [source, target]
  );
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  return (
    // @ts-expect-error R3F line element conflicts with SVG line type
    <line geometry={geometry}>
      <lineBasicMaterial color="#6c63ff" transparent opacity={dimmed ? 0.03 : 0.15} />
    </line>
  );
}

function CameraController({
  targetRef,
}: {
  targetRef: React.RefObject<THREE.Vector3 | null>;
}) {
  const { camera } = useThree();

  useFrame(() => {
    if (targetRef.current) {
      const target = targetRef.current;
      camera.position.lerp(
        new THREE.Vector3(target.x + 80, target.y + 40, target.z + 80),
        0.02
      );
      camera.lookAt(target);
    }
  });

  return <OrbitControls enableDamping dampingFactor={0.1} />;
}

const ThreeJSGraph = forwardRef<GraphRenderer, ThreeJSGraphProps>(
  (
    { nodes, links, highlightedNodes, dimmed, onNodeClick, onBackgroundClick, width, height },
    ref
  ) => {
    const simNodes = useForceLayout(nodes, links);
    const cameraTarget = useRef<THREE.Vector3 | null>(null);

    const nodeMap = useMemo(() => {
      const map = new Map<string, SimNode>();
      simNodes.forEach((n) => map.set(n.id, n));
      return map;
    }, [simNodes]);

    useImperativeHandle(ref, () => ({
      focusNode(nodeId: string) {
        const node = nodeMap.get(nodeId);
        if (node) {
          cameraTarget.current = new THREE.Vector3(node.x, node.y, node.z);
        }
      },
      highlightNodes(_nodeIds: string[]) {
        // Handled via highlightedNodes prop
      },
      dimAllExcept(_nodeIds: string[]) {
        // Handled via dimmed + highlightedNodes props
      },
      resetView() {
        cameraTarget.current = new THREE.Vector3(0, 0, 0);
      },
    }));

    return (
      <Canvas
        style={{ width, height, background: 'transparent' }}
        camera={{ position: [0, 0, 200], fov: 60 }}
        onPointerMissed={onBackgroundClick}
      >
        <ambientLight intensity={0.6} />
        <pointLight position={[100, 100, 100]} intensity={0.8} />
        <CameraController targetRef={cameraTarget} />

        {links.map((link, i) => {
          const source = nodeMap.get(
            typeof link.source === 'string' ? link.source : (link.source as unknown as { id: string }).id
          );
          const target = nodeMap.get(
            typeof link.target === 'string' ? link.target : (link.target as unknown as { id: string }).id
          );
          if (!source || !target) return null;
          return <LinkLine key={i} source={source} target={target} dimmed={dimmed} />;
        })}

        {simNodes.map((node) => (
          <NodeMesh
            key={node.id}
            node={node}
            highlighted={highlightedNodes.has(node.id)}
            dimmed={dimmed}
            onClick={() => onNodeClick(node)}
          />
        ))}
      </Canvas>
    );
  }
);

ThreeJSGraph.displayName = 'ThreeJSGraph';
export default ThreeJSGraph;
