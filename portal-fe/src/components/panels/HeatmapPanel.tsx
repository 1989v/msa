import type { CategoryLevelMatrix } from '../../types/graph';
import { CATEGORIES, CATEGORY_LABELS, LEVELS, LEVEL_LABELS, CATEGORY_COLORS } from '../../types';
import type { Category } from '../../types';

interface HeatmapPanelProps {
  matrix: CategoryLevelMatrix;
  onCellClick: (category: string, level: string) => void;
}

export default function HeatmapPanel({ matrix, onCellClick }: HeatmapPanelProps) {
  const maxCount = Math.max(
    1,
    ...CATEGORIES.flatMap((cat) =>
      LEVELS.map((lvl) => matrix[cat]?.[lvl] ?? 0)
    )
  );

  return (
    <div style={{ padding: 32, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <h2 style={{ color: '#e0e0e0', fontSize: '1.125rem', marginBottom: 24, textAlign: 'center' }}>
        Category × Level Heatmap
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '140px repeat(3, 1fr)', gap: 4, maxWidth: 600, margin: '0 auto' }}>
        <div />
        {LEVELS.map((lvl) => (
          <div key={lvl} style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.6875rem', padding: 4 }}>
            {LEVEL_LABELS[lvl]}
          </div>
        ))}

        {CATEGORIES.map((cat) => {
          const catKey = cat as Category;
          return (
            <div key={cat} style={{ display: 'contents' }}>
              <div style={{ color: CATEGORY_COLORS[catKey], fontSize: '0.75rem', display: 'flex', alignItems: 'center', paddingRight: 8 }}>
                {CATEGORY_LABELS[catKey]}
              </div>
              {LEVELS.map((lvl) => {
                const count = matrix[cat]?.[lvl] ?? 0;
                const intensity = count / maxCount;
                return (
                  <div
                    key={`${cat}-${lvl}`}
                    onClick={() => onCellClick(cat, lvl)}
                    style={{
                      background: `rgba(108, 99, 255, ${0.1 + intensity * 0.7})`,
                      borderRadius: 6,
                      padding: 8,
                      textAlign: 'center',
                      cursor: 'pointer',
                      color: intensity > 0.5 ? '#fff' : '#aaa',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      transition: 'transform 0.15s',
                      minHeight: 36,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {count}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
