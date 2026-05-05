import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { fetchConceptDetail } from '../../api/searchApi';
import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../types/index';
import { prepareWithSegments, measureNaturalWidth } from '@chenglou/pretext';
import type { GraphNode, ConceptDetail } from '../../types/graph';
import type { Category } from '../../types/index';
import './FillBlankQuiz.css';

interface FillBlankQuizProps {
  nodes: GraphNode[];
}

interface BlankSlot {
  index: number;
  answer: string;
  userInput: string;
  hintRevealed: boolean;
}

type CheckResult = 'correct' | 'partial' | 'wrong' | null;

interface QuizState {
  detail: ConceptDetail | null;
  loading: boolean;
  error: string | null;
  blanks: BlankSlot[];
  segments: string[];
  blankIndices: Set<number>;
  results: Map<number, CheckResult>;
  checked: boolean;
  score: number;
  totalAnswered: number;
  streak: number;
  questionNumber: number;
}

const SKIP_WORDS = new Set([
  '통해', '위해', '있는', '하는', '되는', '대한', '등의', '위한', '에서',
  'the', 'and', 'for', 'are', 'was', 'that', 'this', 'with', 'from',
  'have', 'will', 'been', 'which', 'their', 'into', 'also', 'than',
  'them', 'then', 'when', 'what', 'your', 'more', 'some', 'such',
  'only', 'other', 'each', 'does', 'most', 'very', 'used', 'between',
]);

const BLANK_FONT = '14px system-ui';
const INPUT_PADDING = 16;
const MIN_BLANK_COUNT = 2;
const MAX_BLANK_COUNT = 4;
const MIN_WORD_LENGTH = 4;

function pickBlanks(words: string[]): Set<number> {
  const candidates: number[] = [];
  for (let i = 0; i < words.length; i++) {
    const cleaned = words[i].replace(/[.,;:!?()"']/g, '');
    if (
      cleaned.length >= MIN_WORD_LENGTH &&
      !SKIP_WORDS.has(cleaned) &&
      !SKIP_WORDS.has(cleaned.toLowerCase())
    ) {
      candidates.push(i);
    }
  }

  const count = Math.min(
    MAX_BLANK_COUNT,
    Math.max(MIN_BLANK_COUNT, Math.floor(candidates.length * 0.3))
  );
  const picked = new Set<number>();
  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    picked.add(shuffled[i]);
  }
  return picked;
}

function measureWidth(text: string): number {
  const prepared = prepareWithSegments(text, BLANK_FONT);
  return measureNaturalWidth(prepared) + INPUT_PADDING;
}

function checkAnswer(userInput: string, answer: string): CheckResult {
  const u = userInput.trim();
  const a = answer.replace(/[.,;:!?()"']/g, '').trim();
  if (u === a) return 'correct';
  if (u.length > 0 && (a.includes(u) || u.includes(a))) return 'partial';
  return 'wrong';
}

function pickRandomNode(nodes: GraphNode[], exclude?: string): GraphNode {
  const pool = exclude ? nodes.filter((n) => n.id !== exclude) : nodes;
  const candidates = pool.length > 0 ? pool : nodes;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

export default function FillBlankQuiz({ nodes }: FillBlankQuizProps) {
  const [state, setState] = useState<QuizState>({
    detail: null,
    loading: false,
    error: null,
    blanks: [],
    segments: [],
    blankIndices: new Set(),
    results: new Map(),
    checked: false,
    score: 0,
    totalAnswered: 0,
    streak: 0,
    questionNumber: 0,
  });

  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());

  const loadQuestion = useCallback(async (excludeId?: string) => {
    if (nodes.length === 0) return;

    const node = pickRandomNode(nodes, excludeId);

    setState((prev) => ({
      ...prev,
      loading: true,
      error: null,
      detail: null,
      blanks: [],
      segments: [],
      blankIndices: new Set(),
      results: new Map(),
      checked: false,
      questionNumber: prev.questionNumber + 1,
    }));

    try {
      const detail = await fetchConceptDetail(node.id);
      const words = detail.description.split(/(\s+)/);
      const wordOnlyIndices: number[] = [];
      for (let i = 0; i < words.length; i++) {
        if (words[i].trim().length > 0) {
          wordOnlyIndices.push(i);
        }
      }

      const wordOnlyPicked = pickBlanks(wordOnlyIndices.map((i) => words[i]));
      const blankIndices = new Set<number>();
      let blankIdx = 0;
      for (const wi of wordOnlyIndices) {
        if (wordOnlyPicked.has(blankIdx)) {
          blankIndices.add(wi);
        }
        blankIdx++;
      }

      const blanks: BlankSlot[] = [];
      for (const idx of blankIndices) {
        blanks.push({
          index: idx,
          answer: words[idx],
          userInput: '',
          hintRevealed: false,
        });
      }
      blanks.sort((a, b) => a.index - b.index);

      setState((prev) => ({
        ...prev,
        detail,
        loading: false,
        segments: words,
        blankIndices,
        blanks,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Failed to load concept detail. Try next question.',
      }));
    }
  }, [nodes]);

  useEffect(() => {
    loadQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.loading && state.blanks.length > 0 && !state.checked) {
      const firstBlank = state.blanks[0];
      const el = inputRefs.current.get(firstBlank.index);
      if (el) {
        el.focus();
      }
    }
  }, [state.loading, state.blanks, state.checked]);

  const handleInputChange = useCallback((blankIndex: number, value: string) => {
    setState((prev) => ({
      ...prev,
      blanks: prev.blanks.map((b) =>
        b.index === blankIndex ? { ...b, userInput: value } : b
      ),
    }));
  }, []);

  const handleCheck = useCallback(() => {
    setState((prev) => {
      const results = new Map<number, CheckResult>();
      let correctCount = 0;
      for (const blank of prev.blanks) {
        const result = checkAnswer(blank.userInput, blank.answer);
        results.set(blank.index, result);
        if (result === 'correct') correctCount++;
      }
      const allCorrect = correctCount === prev.blanks.length;
      return {
        ...prev,
        results,
        checked: true,
        score: prev.score + correctCount,
        totalAnswered: prev.totalAnswered + prev.blanks.length,
        streak: allCorrect ? prev.streak + 1 : 0,
      };
    });
  }, []);

  const handleNext = useCallback(() => {
    inputRefs.current.clear();
    loadQuestion(state.detail?.conceptId);
  }, [loadQuestion, state.detail?.conceptId]);

  const handleHint = useCallback(() => {
    setState((prev) => ({
      ...prev,
      blanks: prev.blanks.map((b) => ({
        ...b,
        hintRevealed: true,
        userInput: b.userInput || b.answer.charAt(0),
      })),
    }));
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, blankIndex: number) => {
    if (e.key === 'Enter' && !state.checked) {
      const currentIdx = state.blanks.findIndex((b) => b.index === blankIndex);
      if (currentIdx < state.blanks.length - 1) {
        const nextBlank = state.blanks[currentIdx + 1];
        const el = inputRefs.current.get(nextBlank.index);
        if (el) el.focus();
      } else {
        handleCheck();
      }
    }
  }, [state.checked, state.blanks, handleCheck]);

  const blankWidths = useMemo(() => {
    const widths = new Map<number, number>();
    for (const blank of state.blanks) {
      widths.set(blank.index, measureWidth(blank.answer));
    }
    return widths;
  }, [state.blanks]);

  const categoryColor = state.detail
    ? CATEGORY_COLORS[state.detail.category as Category] ?? '#6c63ff'
    : '#6c63ff';
  const categoryLabel = state.detail
    ? CATEGORY_LABELS[state.detail.category as Category] ?? state.detail.category
    : '';

  const accuracy = state.totalAnswered > 0
    ? Math.round((state.score / state.totalAnswered) * 100)
    : 0;

  if (nodes.length === 0) {
    return (
      <div className="fbq-container">
        <div className="fbq-empty">No concepts available for quiz.</div>
      </div>
    );
  }

  return (
    <div className="fbq-container">
      <div className="fbq-score-bar">
        <div className="fbq-score-item">
          <span className="fbq-score-label">Score</span>
          <span className="fbq-score-value">
            {state.score}/{state.totalAnswered}
            {state.totalAnswered > 0 && (
              <span className="fbq-score-pct"> ({accuracy}%)</span>
            )}
          </span>
        </div>
        <div className="fbq-score-divider" />
        <div className="fbq-score-item">
          <span className="fbq-score-label">Streak</span>
          <span className="fbq-score-value fbq-streak">
            {state.streak > 0 ? `${state.streak}x` : '0'}
          </span>
        </div>
        <div className="fbq-score-divider" />
        <div className="fbq-score-item">
          <span className="fbq-score-label">Question</span>
          <span className="fbq-score-value">#{state.questionNumber}</span>
        </div>
      </div>

      <div className="fbq-card">
        {state.loading && (
          <div className="fbq-loading">
            <div className="fbq-spinner" />
            <span>Loading concept...</span>
          </div>
        )}

        {state.error && (
          <div className="fbq-error">
            <span>{state.error}</span>
            <button className="fbq-btn fbq-btn-next" onClick={handleNext}>
              Try Next
            </button>
          </div>
        )}

        {state.detail && !state.loading && (
          <>
            <div className="fbq-concept-header">
              <h3 className="fbq-concept-name">{state.detail.name}</h3>
              <span
                className="fbq-category-badge"
                style={{
                  background: `${categoryColor}22`,
                  color: categoryColor,
                  borderColor: `${categoryColor}44`,
                }}
              >
                {categoryLabel}
              </span>
            </div>

            <p className="fbq-instruction">
              Fill in the missing words in the description below.
            </p>

            <div className="fbq-description">
              {state.segments.map((segment, i) => {
                if (!state.blankIndices.has(i)) {
                  return <span key={i}>{segment}</span>;
                }

                const blank = state.blanks.find((b) => b.index === i);
                if (!blank) return <span key={i}>{segment}</span>;

                const result = state.results.get(i);
                const width = blankWidths.get(i) ?? 80;

                return (
                  <span key={i} className="fbq-blank-wrapper">
                    <input
                      ref={(el) => {
                        if (el) inputRefs.current.set(i, el);
                      }}
                      className={`fbq-blank-input ${result ? `fbq-${result}` : ''}`}
                      type="text"
                      value={blank.userInput}
                      onChange={(e) => handleInputChange(i, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, i)}
                      disabled={state.checked}
                      style={{ width: `${width}px` }}
                      placeholder={blank.hintRevealed ? blank.answer.charAt(0) + '...' : ''}
                      spellCheck={false}
                      autoComplete="off"
                    />
                    {result === 'wrong' && (
                      <span className="fbq-correct-answer">{blank.answer}</span>
                    )}
                  </span>
                );
              })}
            </div>

            <div className="fbq-actions">
              {!state.checked ? (
                <>
                  <button className="fbq-btn fbq-btn-hint" onClick={handleHint}>
                    Hint
                  </button>
                  <button className="fbq-btn fbq-btn-check" onClick={handleCheck}>
                    Check
                  </button>
                </>
              ) : (
                <button className="fbq-btn fbq-btn-next" onClick={handleNext}>
                  Next
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
