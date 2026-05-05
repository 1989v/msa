import type { SearchHit } from '../api/searchApi';
import CodeSnippet from './CodeSnippet';

interface SearchResultsProps {
  hits: SearchHit[];
  totalHits: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  BASICS: '#6b7280',
  DATA_STRUCTURE: '#2563eb',
  ALGORITHM: '#7c3aed',
  DESIGN_PATTERN: '#db2777',
  CONCURRENCY: '#ea580c',
  DISTRIBUTED_SYSTEM: '#0891b2',
  ARCHITECTURE: '#4f46e5',
  INFRASTRUCTURE: '#059669',
  DATA: '#ca8a04',
  SECURITY: '#dc2626',
  NETWORK: '#0d9488',
  TESTING: '#65a30d',
  LANGUAGE_FEATURE: '#9333ea',
};

const LEVEL_COLORS: Record<string, string> = {
  BEGINNER: '#22c55e',
  INTERMEDIATE: '#f59e0b',
  ADVANCED: '#ef4444',
};

export default function SearchResults({ hits, totalHits }: SearchResultsProps) {
  if (hits.length === 0) {
    return <div className="no-results">No results found.</div>;
  }

  return (
    <div className="search-results">
      <div className="results-count">{totalHits} result{totalHits !== 1 ? 's' : ''} found</div>
      {hits.map((hit, index) => (
        <div key={`${hit.conceptId}-${index}`} className="result-card">
          <div className="result-header">
            <h3 className="result-name">{hit.conceptName}</h3>
            <div className="result-badges">
              <span
                className="badge category-badge"
                style={{ backgroundColor: CATEGORY_COLORS[hit.category] || '#6b7280' }}
              >
                {hit.category.replace(/_/g, ' ')}
              </span>
              <span
                className="badge level-badge"
                style={{ backgroundColor: LEVEL_COLORS[hit.level] || '#6b7280' }}
              >
                {hit.level}
              </span>
              <span className="score">Score: {hit.score.toFixed(2)}</span>
            </div>
          </div>

          {hit.description && <p className="result-description">{hit.description}</p>}

          {hit.filePath && hit.filePath !== 'N/A' && (
            <div className="result-file-info">
              <span className="file-path">{hit.filePath}</span>
              {hit.lineStart && (
                <span className="line-range">
                  :{hit.lineStart}
                  {hit.lineEnd ? `-${hit.lineEnd}` : ''}
                </span>
              )}
              {hit.gitUrl && (
                <a href={hit.gitUrl} target="_blank" rel="noopener noreferrer" className="git-link">
                  Open in Git
                </a>
              )}
            </div>
          )}

          {hit.codeSnippet && (
            <CodeSnippet
              code={hit.codeSnippet}
              filePath={hit.filePath}
              lineStart={hit.lineStart}
              lineEnd={hit.lineEnd}
              gitUrl={hit.gitUrl}
            />
          )}
        </div>
      ))}
    </div>
  );
}
