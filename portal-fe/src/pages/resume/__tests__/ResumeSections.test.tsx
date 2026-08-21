import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProjectSection } from '../ResumeSections';
import type { ResumeProfile } from '../../../api/resumeApi';

const fullCode = Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n');

const profile: ResumeProfile = {
  career: { totalMonths: 48, years: 4, months: 0, yearsInField: 5 },
  companies: [],
  categories: [
    { code: 'search', label: '검색', description: null },
  ],
  projects: [
    {
      title: '검색 개편',
      companyName: null,
      categoryCode: 'search',
      startMonth: '2024-01',
      endMonth: null,
      ongoing: true,
      summary: '요약',
      bodyMarkdown: null,
      metrics: [],
      skills: [],
      snippets: [
        {
          id: 1,
          title: '랭킹 파이프라인',
          language: 'kotlin',
          filePath: 'search/app/src/main/kotlin/Ranking.kt',
          lineStart: 1,
          lineEnd: 20,
          gitUrl: 'https://github.com/example/msa',
          code: fullCode,
          totalLines: 20,
          orderNo: 0,
        },
      ],
      detailSlug: null,
      orderNo: 0,
    },
  ],
  skills: [],
};

describe('ProjectSection — 이력서의 코드 스니펫', () => {
  it('게이트 없이 전문을 그린다 — 이력서 접근 자체가 이미 게이트다 (ADR-0064)', () => {
    render(
      <MemoryRouter>
        <ProjectSection profile={profile} />
      </MemoryRouter>,
    );

    expect(screen.getByText(/line 20/)).toBeInTheDocument();
    expect(screen.getByText('랭킹 파이프라인')).toBeInTheDocument();
    // 잠금 띠의 두 액션이 없어야 한다 — 이력서에서 로그인·광고를 요구하면 사고다
    expect(screen.queryByRole('link', { name: '로그인하고 전체 보기' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: '광고 보고 전체 보기' }),
    ).not.toBeInTheDocument();
  });

  it('Git 링크는 새 탭 + noopener 다', () => {
    render(
      <MemoryRouter>
        <ProjectSection profile={profile} />
      </MemoryRouter>,
    );

    const git = screen.getByRole('link', { name: /View on Git/ });
    expect(git).toHaveAttribute('href', 'https://github.com/example/msa');
    expect(git).toHaveAttribute('rel', 'noopener noreferrer');
  });
});
