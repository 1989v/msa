interface CodeSnippetProps {
  code: string;
  filePath?: string | null;
  lineStart?: number | null;
  lineEnd?: number | null;
  gitUrl?: string | null;
}

export default function CodeSnippet({ code, filePath, lineStart, lineEnd, gitUrl }: CodeSnippetProps) {
  const lineRange = lineStart && lineEnd ? `L${lineStart}-L${lineEnd}` : lineStart ? `L${lineStart}` : null;

  return (
    <div className="code-snippet">
      <div className="code-header">
        {filePath && filePath !== 'N/A' && (
          <span className="code-file-path">
            {filePath}
            {lineRange && <span className="code-line-range"> ({lineRange})</span>}
          </span>
        )}
        {gitUrl && (
          <a href={gitUrl} target="_blank" rel="noopener noreferrer" className="git-link-button">
            View on Git
          </a>
        )}
      </div>
      <pre className="code-block">
        <code>{code}</code>
      </pre>
    </div>
  );
}
