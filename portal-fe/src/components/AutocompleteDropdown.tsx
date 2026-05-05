import type { SuggestItem } from '../types/graph';
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../types';
import './AutocompleteDropdown.css';

interface AutocompleteDropdownProps {
  items: SuggestItem[];
  activeIndex: number;
  onSelect: (item: SuggestItem) => void;
}

export default function AutocompleteDropdown({ items, activeIndex, onSelect }: AutocompleteDropdownProps) {
  if (items.length === 0) return null;

  return (
    <div className="autocomplete-dropdown">
      {items.map((item, index) => (
        <div
          key={item.conceptId}
          className={`autocomplete-item ${index === activeIndex ? 'active' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          <div className="autocomplete-item-header">
            <span className="autocomplete-item-name">{item.name}</span>
            <span
              className="autocomplete-item-badge"
              style={{ background: CATEGORY_COLORS[item.category] }}
            >
              {CATEGORY_LABELS[item.category]}
            </span>
          </div>
          <span className="autocomplete-item-desc">{item.description}</span>
        </div>
      ))}
    </div>
  );
}
