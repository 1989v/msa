import { useState } from 'react';
import { CATEGORIES, CATEGORY_LABELS, LEVELS, LEVEL_LABELS } from '../types';

interface SearchBarProps {
  onSearch: (query: string, category?: string, level?: string) => void;
  loading: boolean;
}

export default function SearchBar({ onSearch, loading }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [level, setLevel] = useState('');

  const handleSearch = () => {
    if (!query.trim()) return;
    onSearch(query.trim(), category || undefined, level || undefined);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="search-bar">
      <div className="search-input-row">
        <input
          type="text"
          placeholder="Search concepts... (e.g. HashMap, DFS, Singleton)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="search-input"
        />
        <button onClick={handleSearch} disabled={loading || !query.trim()} className="search-button">
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>
      <div className="search-filters">
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <select value={level} onChange={(e) => setLevel(e.target.value)} className="filter-select">
          <option value="">All Levels</option>
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              {LEVEL_LABELS[l]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
