import { useState, useMemo } from 'react';
import type { GraphNode } from '../../types/graph';
import MemoryGame from './MemoryGame';
import FillBlankQuiz from './FillBlankQuiz';
import CodeMagnifier from './CodeMagnifier';
import ConceptCascade from './ConceptCascade';
import './QuizSection.css';

interface QuizSectionProps {
  nodes: GraphNode[];
  onConceptClick?: (conceptId: string) => void;
}

type QuizMode = 'memory' | 'fillblank' | 'magnifier' | 'cascade';

const MODES: { key: QuizMode; label: string; icon: string; desc: string }[] = [
  { key: 'memory', label: 'Memory', icon: '🃏', desc: '개념 짝 맞추기' },
  { key: 'fillblank', label: 'Fill Blank', icon: '✏️', desc: '빈칸 채우기' },
  { key: 'magnifier', label: 'Magnifier', icon: '🔍', desc: '코드 돋보기' },
  { key: 'cascade', label: 'Cascade', icon: '🎯', desc: '개념 분류하기' },
];

export default function QuizSection({ nodes, onConceptClick }: QuizSectionProps) {
  const [mode, setMode] = useState<QuizMode>('memory');

  const filteredNodes = useMemo(
    () => nodes.filter((n) => n.description && n.description.length > 20),
    [nodes],
  );

  if (filteredNodes.length < 6) return null;

  return (
    <section className="quiz-section" id="quiz">
      <div className="quiz-header">
        <h2 className="quiz-title">Concept Quiz</h2>
        <p className="quiz-subtitle">개념을 게임으로 학습하세요</p>
      </div>

      <div className="quiz-mode-tabs">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={`quiz-mode-tab ${mode === m.key ? 'active' : ''}`}
            onClick={() => setMode(m.key)}
          >
            <span className="quiz-mode-icon">{m.icon}</span>
            <span className="quiz-mode-label">{m.label}</span>
            <span className="quiz-mode-desc">{m.desc}</span>
          </button>
        ))}
      </div>

      <div className="quiz-content">
        {mode === 'memory' && <MemoryGame nodes={filteredNodes} />}
        {mode === 'fillblank' && <FillBlankQuiz nodes={filteredNodes} />}
        {mode === 'magnifier' && <CodeMagnifier nodes={filteredNodes} onConceptClick={onConceptClick} />}
        {mode === 'cascade' && <ConceptCascade nodes={filteredNodes} />}
      </div>
    </section>
  );
}
