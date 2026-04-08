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
      focusNode(nodeId: string) {
        const node = nodes.find((n) => n.id === nodeId);
        if (node && fgRef.current) {
          const distance = 120;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const n = node as any;
          fgRef.current.cameraPosition(
            { x: n.x + distance, y: n.y + distance / 2, z: n.z + distance },
            { x: n.x, y: n.y, z: n.z },
            1000
          );
        }
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
        if (dimmed && !highlightedNodes.has(n.id)) {
          return `${color}1a`;
        }
        return color;
      },
      [dimmed, highlightedNodes]
    );

    const nodeVal = useCallback(
      (node: any) => Math.max(2, (node as GraphNode).relatedCount * 2),
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
        nodeOpacity={dimmed ? 0.1 : 0.75}
        linkColor={() => 'rgba(108, 99, 255, 0.2)'}
        linkWidth={0.5}
        onNodeClick={(node: unknown) => onNodeClick(node as GraphNode)}
        onBackgroundClick={onBackgroundClick}
        backgroundColor="rgba(0,0,0,0)"
        width={width}
        height={height}
        showNavInfo={false}
      />
    );
  }
);

ForceGraph3D.displayName = 'ForceGraph3D';
export default ForceGraph3D;
