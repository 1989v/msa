import { useMemo } from 'react';
import Markdown from '../../components/Markdown';
import type { ResumeProfile } from '../../api/resumeApi';
import { CareerSection, ProjectSection, SkillSection } from './ResumeSections';

const PLACEHOLDER = /\{\{(career|projects|skills)\}\}/g;

type SectionName = 'career' | 'projects' | 'skills';

type Chunk =
  | { kind: 'markdown'; text: string }
  | { kind: 'section'; name: SectionName };

/**
 * 서술과 데이터를 한 문서로 엮는다 (ADR-0064).
 *
 * 마크다운 본문의 `{{career}}` `{{projects}}` `{{skills}}` 자리에 구조화 섹션이 들어간다.
 * 배치와 제목은 마크다운이 정하고 내용만 데이터가 채우므로, 순서를 바꾸려고 코드를 고칠 일이 없다.
 */
function split(source: string): Chunk[] {
  const chunks: Chunk[] = [];
  let cursor = 0;
  for (const match of source.matchAll(PLACEHOLDER)) {
    const at = match.index ?? 0;
    if (at > cursor) chunks.push({ kind: 'markdown', text: source.slice(cursor, at) });
    chunks.push({ kind: 'section', name: match[1] as SectionName });
    cursor = at + match[0].length;
  }
  if (cursor < source.length) chunks.push({ kind: 'markdown', text: source.slice(cursor) });
  return chunks;
}

interface ResumeBodyProps {
  source: string;
  profile: ResumeProfile;
  transformHtml?: (html: string) => string;
}

export default function ResumeBody({ source, profile, transformHtml }: ResumeBodyProps) {
  const chunks = useMemo(() => split(source), [source]);

  return (
    <>
      {chunks.map((chunk, i) =>
        chunk.kind === 'markdown' ? (
          <Markdown key={i} className="resume-body" source={chunk.text} transformHtml={transformHtml} />
        ) : (
          <div key={i} className="resume-body">
            {chunk.name === 'career' && <CareerSection profile={profile} />}
            {chunk.name === 'projects' && <ProjectSection profile={profile} />}
            {chunk.name === 'skills' && <SkillSection profile={profile} />}
          </div>
        ),
      )}
    </>
  );
}
