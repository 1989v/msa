import type { GraphNode } from '../types/graph';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../types/index';
import './PopularConcepts.css';

interface PopularConceptsProps {
  nodes: GraphNode[];
  onConceptClick: (conceptId: string) => void;
}

export default function PopularConcepts({ nodes, onConceptClick }: PopularConceptsProps) {
  const top12 = [...nodes]
    .sort((a, b) => b.indexCount - a.indexCount)
    .slice(0, 12);

  const handleClick = (node: GraphNode) => {
    const techSection = document.getElementById('tech');
    if (techSection) {
      techSection.scrollIntoView({ behavior: 'smooth' });
    }
    setTimeout(() => onConceptClick(node.id), 300);
  };

  return (
    <section className="popular-section">
      <div className="popular-inner">
        <div className="popular-header">
          <h2 className="popular-title">인기 개념</h2>
          <p className="popular-subtitle">코드에서 가장 많이 발견된 개념</p>
        </div>
        <div className="popular-grid">
          {top12.map((node) => {
            const color = CATEGORY_COLORS[node.category] ?? '#6c63ff';
            const label = CATEGORY_LABELS[node.category] ?? node.category;
            return (
              <button
                key={node.id}
                className="popular-card"
                onClick={() => handleClick(node)}
                style={{ '--card-accent': color } as React.CSSProperties}
              >
                <div className="popular-card-top">
                  <span
                    className="popular-category-badge"
                    style={{ background: `${color}22`, color, borderColor: `${color}44` }}
                  >
                    {label}
                  </span>
                  <span className="popular-index-count">{node.indexCount} refs</span>
                </div>
                <h3 className="popular-card-name">{node.name}</h3>
                {node.description && (
                  <p className="popular-card-desc">{node.description}</p>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
