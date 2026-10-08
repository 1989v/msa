/** 편집 페이지 생성 JSON 의 본문 조각 — html 은 render-content 검사를 통과한 레포 원본, cardId 는 관광지 카드 자리 */
export type GuidePart = { html: string } | { cardId: string };

/** `scripts/render-content.mjs` 가 `src/content/guides/{slug}.md` 에서 만든 JSON */
export interface Guide {
  slug: string;
  title: string;
  description: string;
  status: 'draft' | 'published';
  reviewedBy: string | null;
  reviewedAt: string | null;
  attractionIds: string[];
  source: string;
  parts: GuidePart[];
}

// 빌드 때 render-content 가 만든다(커밋하지 않는다). 0장이면 빈 객체다.
const modules = import.meta.glob<Guide>('./generated/guides/*.json', { eager: true, import: 'default' });

/** slug → 편집 페이지. draft 도 들어 있다(주소로는 열리고 목록에는 published 만) */
export const GUIDES: Readonly<Record<string, Guide>> = Object.fromEntries(
  Object.values(modules).map((g) => [g.slug, g]),
);
