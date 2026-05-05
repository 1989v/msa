import { useState, useRef } from 'react';
import { useSuggest } from '../hooks/useSuggest';
import AutocompleteDropdown from './AutocompleteDropdown';
import type { SuggestItem } from '../types/graph';

interface SearchBarProps {
  onSearch: (query: string) => void;
  onSelectConcept: (conceptId: string) => void;
}

export default function SearchBar({ onSearch, onSelectConcept }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const { suggestions, clear } = useSuggest(query);

  const handleSelect = (item: SuggestItem) => {
    setQuery(item.name);
    setShowDropdown(false);
    clear();
    onSelectConcept(item.conceptId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < suggestions.length) {
        handleSelect(suggestions[activeIndex]);
      } else if (query.trim()) {
        setShowDropdown(false);
        clear();
        onSearch(query.trim());
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      clear();
    }
  };

  const handleChange = (value: string) => {
    setQuery(value);
    setActiveIndex(-1);
    setShowDropdown(value.trim().length > 0);
  };

  return (
    <div className="search-bar-wrapper" style={{ position: 'relative' }}>
      <div className="search-bar-floating">
        <span className="search-icon">🔍</span>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search concepts..."
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim() && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          className="search-input-floating"
        />
        <kbd className="search-shortcut">⌘K</kbd>
      </div>
      {showDropdown && (
        <AutocompleteDropdown
          items={suggestions}
          activeIndex={activeIndex}
          onSelect={handleSelect}
        />
      )}
    </div>
  );
}
