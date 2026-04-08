import { useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS, CATEGORY_COLORS, type Category } from '../types/index';
import './CategoryChips.css';

interface CategoryChipsProps {
  onCategoryFilter: (category: Category | null) => void;
}

export default function CategoryChips({ onCategoryFilter }: CategoryChipsProps) {
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);

  const handleSelect = (category: Category | null) => {
    setActiveCategory(category);
    onCategoryFilter(category);
  };

  return (
    <div className="category-chips-bar">
      <div className="category-chips-inner">
        <button
          className={`category-chip ${activeCategory === null ? 'active' : ''}`}
          onClick={() => handleSelect(null)}
          style={activeCategory === null ? { borderColor: '#6c63ff', color: '#6c63ff', background: 'rgba(108,99,255,0.15)' } : {}}
        >
          전체
        </button>
        {CATEGORIES.map((cat) => {
          const color = CATEGORY_COLORS[cat];
          const isActive = activeCategory === cat;
          return (
            <button
              key={cat}
              className={`category-chip ${isActive ? 'active' : ''}`}
              onClick={() => handleSelect(cat)}
              style={
                isActive
                  ? { borderColor: color, color: color, background: `${color}22` }
                  : { borderColor: `${color}44`, color: '#aaa' }
              }
            >
              <span
                className="category-chip-dot"
                style={{ background: color }}
              />
              {CATEGORY_LABELS[cat]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
