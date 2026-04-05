import { useState } from 'react';
import SearchBar from '../components/SearchBar';
import SearchResults from '../components/SearchResults';
import { searchConcepts, type SearchHit } from '../api/searchApi';

export default function SearchPage() {
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [totalHits, setTotalHits] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(0);
  const [lastQuery, setLastQuery] = useState('');
  const [lastCategory, setLastCategory] = useState<string | undefined>();
  const [lastLevel, setLastLevel] = useState<string | undefined>();

  const PAGE_SIZE = 20;

  const doSearch = async (query: string, category?: string, level?: string, pageNum = 0) => {
    setLoading(true);
    setError(null);
    try {
      const result = await searchConcepts(query, category, level, pageNum, PAGE_SIZE);
      setHits(result.hits);
      setTotalHits(result.totalHits);
      setPage(pageNum);
      setLastQuery(query);
      setLastCategory(category);
      setLastLevel(level);
      setSearched(true);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Search failed';
      setError(message);
      setHits([]);
      setTotalHits(0);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (query: string, category?: string, level?: string) => {
    doSearch(query, category, level, 0);
  };

  const totalPages = Math.ceil(totalHits / PAGE_SIZE);

  return (
    <div className="search-page">
      <header className="page-header">
        <h1>Code Dictionary</h1>
        <p className="subtitle">Search programming concepts with real code examples</p>
      </header>

      <SearchBar onSearch={handleSearch} loading={loading} />

      {error && <div className="error-message">{error}</div>}

      {searched && !loading && <SearchResults hits={hits} totalHits={totalHits} />}

      {searched && totalPages > 1 && (
        <div className="pagination">
          <button
            disabled={page === 0 || loading}
            onClick={() => doSearch(lastQuery, lastCategory, lastLevel, page - 1)}
          >
            Previous
          </button>
          <span className="page-info">
            Page {page + 1} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages - 1 || loading}
            onClick={() => doSearch(lastQuery, lastCategory, lastLevel, page + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
