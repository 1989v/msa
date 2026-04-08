import { useRef, useCallback, useImperativeHandle, forwardRef } from 'react';
import ForceGraph3DComponent from 'react-force-graph-3d';
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

const ForceGraph3D = forwardRef<GraphRenderer, ForceGraph3DProps>(
  ({ nodes, links, highlightedNodes, dimmed, onNodeClick, onBackgroundClick, width, height }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fgRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
      focusNode(nodeId: string, withSidePanel = false) {
        if (!fgRef.current) return;
        // force-graph 내부의 시뮬레이션된 노드에서 좌표를 가져와야 함
        const graphNodes = fgRef.current.graphData().nodes;
        const node = graphNodes.find((n: any) => n.id === nodeId);
        if (!node) return;
        const distance = 120;
        const sideOffset = withSidePanel ? -60 : 0;
        fgRef.current.cameraPosition(
          { x: node.x + distance + sideOffset, y: node.y + distance / 2, z: node.z + distance },
          { x: node.x + sideOffset, y: node.y, z: node.z },
          1000
        );
      },
      highlightNodes(_nodeIds: string[]) {
        // Handled via highlightedNodes prop
      },
      dimAllExcept(_nodeIds: string[]) {
        // Handled via dimmed + highlightedNodes props
      },
      resetView() {
        if (fgRef.current) {
          fgRef.current.cameraPosition({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 1000);
        }
      },
    }));

    const nodeColor = useCallback(
      (node: any) => {
        const n = node as GraphNode;
        const color = CATEGORY_COLORS[n.category as Category] || '#888';
        if (dimmed && highlightedNodes.has(n.id)) {
          // 하이라이트 노드: 원래 색상 + 밝게
          return '#ffffff';
        }
        if (dimmed && !highlightedNodes.has(n.id)) {
          // dim 노드: 매우 어둡게
          return `${color}15`;
        }
        return color;
      },
      [dimmed, highlightedNodes]
    );

    const nodeVal = useCallback(
      (node: any) => {
        const n = node as GraphNode;
        // indexCount 기반 크기 차등 + relatedCount 보너스
        return Math.max(3, n.indexCount * 2 + n.relatedCount + 1);
      },
      []
    );

    const nodeLabel = useCallback(
      (node: any) => {
        const n = node as GraphNode;
        return `${n.name}\n${n.category} · ${n.level}`;
      },
      []
    );

    return (
      <ForceGraph3DComponent
        ref={fgRef}
        graphData={{ nodes, links }}
        nodeId="id"
        nodeLabel={nodeLabel}
        nodeColor={nodeColor}
        nodeVal={nodeVal}
        nodeOpacity={0.85}
        linkColor={() => 'rgba(140, 130, 255, 0.6)'}
        linkWidth={1.5}
        linkOpacity={0.6}
        onNodeClick={(node: unknown) => onNodeClick(node as GraphNode)}
        onBackgroundClick={onBackgroundClick}
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        height={height}
        showNavInfo={false}
        controlType="orbit"
        onEngineReady={() => {
          if (fgRef.current) {
            const controls = fgRef.current.controls();
            if (controls) {
              controls.zoomSpeed = 3;
            }
          }
        }}
      />
    );
  }
);

ForceGraph3D.displayName = 'ForceGraph3D';
export default ForceGraph3D;
