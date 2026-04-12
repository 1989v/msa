import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchConceptDetail } from '../../api/searchApi';
import type { ConceptDetail, CodeSnippetInfo } from '../../types/graph';
import type { GraphNode } from '../../types/graph';
import type { Category } from '../../types';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../types';
import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext';
import './CodeMagnifier.css';

interface CodeMagnifierProps {
  nodes: GraphNode[];
  onConceptClick?: (conceptId: string) => void;
}

interface KeywordMatch {
  start: number;
  end: number;
  node: GraphNode;
}

interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  node: GraphNode | null;
}

const BASE_FONT_SIZE = 13;
const MAGNIFIED_FONT_SIZE = 24;
const LENS_RADIUS = 100;
const LENS_DIAMETER = LENS_RADIUS * 2;
const LINE_HEIGHT = 1.6;
const FONT_FAMILY = "'Fira Code', monospace";
const MAGNIFIED_FONT = `${MAGNIFIED_FONT_SIZE}px ${FONT_FAMILY}`;

function findKeywordsInLine(lineText: string, nodes: GraphNode[]): KeywordMatch[] {
  const matches: KeywordMatch[] = [];
  const isBoundary = (c: string) => /[\s.,;:(){}\[\]<>!@#$%^&*+=|\\/"'`~\-]/.test(c);
  for (const node of nodes) {
    const name = node.name;
    if (name.length < 2) continue;
    let searchFrom = 0;
    const lowerLine = lineText.toLowerCase();
    const lowerName = name.toLowerCase();
    while (searchFrom < lowerLine.length) {
      const idx = lowerLine.indexOf(lowerName, searchFrom);
      if (idx === -1) break;
      const before = idx > 0 ? lowerLine[idx - 1] : ' ';
      const after = idx + lowerName.length < lowerLine.length ? lowerLine[idx + lowerName.length] : ' ';
      if (isBoundary(before) && isBoundary(after)) {
        matches.push({ start: idx, end: idx + name.length, node });
      }
      searchFrom = idx + 1;
    }
  }
  matches.sort((a, b) => a.start - b.start);
  const filtered: KeywordMatch[] = [];
  let lastEnd = -1;
  for (const m of matches) {
    if (m.start >= lastEnd) {
      filtered.push(m);
      lastEnd = m.end;
    }
  }
  return filtered;
}

function renderLineWithKeywords(
  lineText: string,
  keywords: KeywordMatch[],
  onHoverKeyword: (node: GraphNode, rect: DOMRect) => void,
  onLeaveKeyword: () => void,
  onClickKeyword?: (conceptId: string) => void,
): React.ReactNode[] {
  if (keywords.length === 0) {
    return [lineText];
  }
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  keywords.forEach((kw, i) => {
    if (kw.start > cursor) {
      parts.push(lineText.slice(cursor, kw.start));
    }
    const color = CATEGORY_COLORS[kw.node.category] ?? '#6c63ff';
    parts.push(
      <span
        key={`kw-${i}`}
        className="cm-keyword"
        style={{
          borderBottomColor: color,
          color: color,
        }}
        onMouseEnter={(e) => {
          const rect = (e.target as HTMLElement).getBoundingClientRect();
          onHoverKeyword(kw.node, rect);
        }}
        onMouseLeave={onLeaveKeyword}
        onClick={(e) => {
          e.stopPropagation();
          onClickKeyword?.(kw.node.id);
        }}
      >
        {lineText.slice(kw.start, kw.end)}
      </span>
    );
    cursor = kw.end;
  });
  if (cursor < lineText.length) {
    parts.push(lineText.slice(cursor));
  }
  return parts;
}

export default function CodeMagnifier({ nodes, onConceptClick }: CodeMagnifierProps) {
  const [concept, setConcept] = useState<ConceptDetail | null>(null);
  const [snippet, setSnippet] = useState<CodeSnippetInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [noSnippets, setNoSnippets] = useState(false);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ visible: false, x: 0, y: 0, node: null });

  const codeContainerRef = useRef<HTMLDivElement>(null);
  const animFrameRef = useRef<number>(0);
  const pendingMouseRef = useRef<{ x: number; y: number } | null>(null);
  const triedIdsRef = useRef<Set<string>>(new Set());

  const pickRandomConcept = useCallback(async () => {
    if (nodes.length === 0) {
      setLoading(false);
      setNoSnippets(true);
      return;
    }

    const tried = triedIdsRef.current;
    const available = nodes.filter((n) => !tried.has(n.id));
    if (available.length === 0) {
      tried.clear();
      setLoading(false);
      setNoSnippets(true);
      return;
    }

    const randomNode = available[Math.floor(Math.random() * available.length)];
    tried.add(randomNode.id);

    try {
      setLoading(true);
      setNoSnippets(false);
      const detail = await fetchConceptDetail(randomNode.id);
      const validSnippet = detail.codeSnippets.find((s) => s.codeSnippet && s.codeSnippet.trim().length > 0);
      if (validSnippet) {
        setConcept(detail);
        setSnippet(validSnippet);
        setLoading(false);
        setMousePos(null);
      } else {
        await pickRandomConcept();
      }
    } catch {
      await pickRandomConcept();
    }
  }, [nodes]);

  useEffect(() => {
    triedIdsRef.current.clear();
    pickRandomConcept();
  }, [pickRandomConcept]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const container = codeContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    pendingMouseRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    if (animFrameRef.current === 0) {
      animFrameRef.current = requestAnimationFrame(() => {
        setMousePos(pendingMouseRef.current);
        animFrameRef.current = 0;
      });
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (animFrameRef.current !== 0) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    }
    pendingMouseRef.current = null;
    setMousePos(null);
  }, []);

  useEffect(() => {
    return () => {
      if (animFrameRef.current !== 0) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, []);

  const handleHoverKeyword = useCallback((node: GraphNode, rect: DOMRect) => {
    setTooltip({
      visible: true,
      x: rect.left + rect.width / 2,
      y: rect.top - 8,
      node,
    });
  }, []);

  const handleLeaveKeyword = useCallback(() => {
    setTooltip({ visible: false, x: 0, y: 0, node: null });
  }, []);

  const handleNextSnippet = useCallback(() => {
    pickRandomConcept();
  }, [pickRandomConcept]);

  if (loading) {
    return (
      <div className="cm-container">
        <div className="cm-loading">Loading code snippet...</div>
      </div>
    );
  }

  if (noSnippets || !concept || !snippet || !snippet.codeSnippet) {
    return (
      <div className="cm-container">
        <div className="cm-empty">
          <p>No code snippets available.</p>
          <button className="cm-next-btn" onClick={handleNextSnippet}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const codeText = snippet.codeSnippet;
  const lines = codeText.split('\n');
  const lineStartNum = snippet.lineStart || 1;
  const categoryColor = CATEGORY_COLORS[concept.category as Category] ?? '#6c63ff';
  const categoryLabel = CATEGORY_LABELS[concept.category as Category] ?? concept.category;

  const magnifiedLineHeight = MAGNIFIED_FONT_SIZE * LINE_HEIGHT;

  let magnifiedLines: string[] = [];
  if (mousePos) {
    try {
      const prepared = prepareWithSegments(codeText, MAGNIFIED_FONT, { whiteSpace: 'pre-wrap' });
      const result = layoutWithLines(prepared, LENS_DIAMETER - 20, magnifiedLineHeight);
      magnifiedLines = result.lines.map((line) => line.text);
    } catch {
      magnifiedLines = lines;
    }
  }

  const baseTotalLineHeight = BASE_FONT_SIZE * LINE_HEIGHT;
  const magnifiedTotalLineHeight = magnifiedLineHeight;
  const scale = MAGNIFIED_FONT_SIZE / BASE_FONT_SIZE;

  return (
    <div className="cm-container">
      <div className="cm-header">
        <div className="cm-concept-info">
          <h3 className="cm-concept-name">{concept.name}</h3>
          <span className="cm-category-badge" style={{ background: `${categoryColor}22`, color: categoryColor, borderColor: `${categoryColor}44` }}>
            {categoryLabel}
          </span>
        </div>
        <div className="cm-file-path">
          {snippet.gitUrl ? (
            <a href={snippet.gitUrl} target="_blank" rel="noopener noreferrer">{snippet.filePath}</a>
          ) : (
            snippet.filePath
          )}
          <span className="cm-line-range">:{snippet.lineStart}-{snippet.lineEnd}</span>
        </div>
        <button className="cm-next-btn" onClick={handleNextSnippet}>
          Next Snippet
        </button>
      </div>

      <div
        className="cm-code-block"
        ref={codeContainerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div className="cm-code-content">
          {lines.map((line, i) => {
            const lineNum = lineStartNum + i;
            const keywords = findKeywordsInLine(line, nodes);
            return (
              <div key={i} className="cm-code-line">
                <span className="cm-line-number">{lineNum}</span>
                <span className="cm-line-text">
                  {renderLineWithKeywords(line, keywords, handleHoverKeyword, handleLeaveKeyword, onConceptClick)}
                </span>
              </div>
            );
          })}
        </div>

        {mousePos && (
          <div
            className="cm-magnifier"
            style={{
              left: mousePos.x - LENS_RADIUS,
              top: mousePos.y - LENS_RADIUS,
              width: LENS_DIAMETER,
              height: LENS_DIAMETER,
            }}
          >
            <div
              className="cm-magnifier-content"
              style={{
                font: MAGNIFIED_FONT,
                lineHeight: LINE_HEIGHT,
                left: -(mousePos.x * scale) + LENS_RADIUS,
                top: -(mousePos.y * scale) + LENS_RADIUS,
                width: magnifiedLines.length > 0
                  ? undefined
                  : (codeContainerRef.current?.scrollWidth ?? 800) * scale,
              }}
            >
              {magnifiedLines.length > 0 ? (
                <div className="cm-magnified-pretext">
                  {magnifiedLines.map((line, i) => (
                    <div key={i} className="cm-magnified-line" style={{ height: magnifiedTotalLineHeight }}>
                      {line}
                    </div>
                  ))}
                </div>
              ) : (
                lines.map((line, i) => (
                  <div key={i} className="cm-magnified-line" style={{ height: baseTotalLineHeight * scale }}>
                    <span className="cm-magnified-linenum">{lineStartNum + i}</span>
                    <span>{line}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {tooltip.visible && tooltip.node && (
        <div
          className="cm-tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="cm-tooltip-name">{tooltip.node.name}</div>
          <div
            className="cm-tooltip-category"
            style={{ color: CATEGORY_COLORS[tooltip.node.category] ?? '#6c63ff' }}
          >
            {CATEGORY_LABELS[tooltip.node.category] ?? tooltip.node.category}
          </div>
          {tooltip.node.description && (
            <div className="cm-tooltip-desc">{tooltip.node.description}</div>
          )}
        </div>
      )}
    </div>
  );
}
