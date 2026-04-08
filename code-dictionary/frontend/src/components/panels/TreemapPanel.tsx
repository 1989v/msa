import { Treemap, ResponsiveContainer, Tooltip } from 'recharts';
import type { GraphNode } from '../../types/graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface TreemapPanelProps {
  nodes: GraphNode[];
  onNodeClick: (conceptId: string) => void;
  onCategoryClick?: (category: string) => void;
}

export default function TreemapPanel({ nodes, onNodeClick, onCategoryClick }: TreemapPanelProps) {
  const grouped = nodes.reduce<Record<string, GraphNode[]>>((acc, node) => {
    (acc[node.category] ??= []).push(node);
    return acc;
  }, {});

  const data = Object.entries(grouped).map(([category, categoryNodes]) => ({
    name: CATEGORY_LABELS[category as Category] || category,
    categoryKey: category,
    color: CATEGORY_COLORS[category as Category] || '#888',
    children: categoryNodes.map((n) => ({
      name: n.name,
      size: Math.max(1, n.indexCount),
      conceptId: n.id,
      color: CATEGORY_COLORS[n.category as Category] || '#888',
    })),
  }));

  const CustomContent = (props: any) => {
    const { x, y, width, height, name, color, conceptId, categoryKey } = props;
    if (width < 20 || height < 20) return null;

    const handleClick = () => {
      if (conceptId) {
        onNodeClick(conceptId);
      } else if (categoryKey && onCategoryClick) {
        onCategoryClick(categoryKey);
      }
    };

    return (
      <g>
        <rect
          x={x}
          y={y}
          width={width}
          height={height}
          fill={color || '#888'}
          fillOpacity={0.7}
          stroke="#0a0a14"
          strokeWidth={2}
          rx={4}
          style={{ cursor: 'pointer' }}
          onClick={handleClick}
        />
        {width > 40 && height > 24 && (
          <text
            x={x + width / 2}
            y={y + height / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#fff"
            fontSize={Math.min(12, width / 8)}
          >
            {name.length > width / 8 ? name.slice(0, Math.floor(width / 8)) + '…' : name}
          </text>
        )}
      </g>
    );
  };

  return (
    <div style={{ padding: 32, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ color: '#e0e0e0', fontSize: 18, marginBottom: 24, textAlign: 'center' }}>
        Concept Treemap
      </h2>
      <ResponsiveContainer width="100%" height="80%">
        <Treemap
          data={data}
          dataKey="size"
          aspectRatio={4 / 3}
          stroke="#0a0a14"
          content={<CustomContent />}
        >
          <Tooltip
            contentStyle={{ background: '#1a1a2e', border: '1px solid #333', color: '#e0e0e0' }}
            formatter={(value: any) => [`${value} indexes`, 'Code']}
          />
        </Treemap>
      </ResponsiveContainer>
    </div>
  );
}
