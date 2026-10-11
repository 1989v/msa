import type { MouseEvent } from 'react';
import type { AttractionDetail, PlaceLang } from '../../api/placeApi';
import { track } from '../../analytics/tracker';
import FavoriteButton from '../../components/favorite/FavoriteButton';
import SharePanel from '../../components/share/SharePanel';
import { googleMapsDirectionsUrl } from './googleMaps';

const UI = {
  ko: { group: '이 관광지 바로 하기', directions: '길찾기', save: '찜', call: '전화', jump: '이 페이지 안에서 이동' },
  en: { group: 'Quick actions', directions: 'Directions', save: 'Save', call: 'Call', jump: 'Jump to section' },
} as const;

/** 계측 위치 — 행동 줄(payload 없음)과 갈라 읽는 값. `events.ts` 의 `DIRECTIONS`·`SHARE`·`PHONE` 주석과 한 몸 */
const SOURCE = 'action_bar';

/**
 * 상세 하단 행동 바(좁은 화면) — 행동 줄이 머리띠 밑으로 지나간 뒤에만 보인다(`hidden` 은 부모가 정한다).
 * 숨을 때는 `hidden` 속성이라 접근성 트리·탭 순서에서도 빠진다. 찜·공유는 공용 컴포넌트를 그대로 쓴다 —
 * 판 위 색은 바 범위 CSS 가 덮는다(PlacePage.css `.place-action-bar`).
 */
export default function AttractionActionBar({
  attraction,
  lang,
  shareUrl,
  phoneHref,
  viewId,
  screenRef,
  hidden,
}: {
  attraction: AttractionDetail;
  lang: PlaceLang;
  /** 공유 주소 — 단축 주소가 없을 때의 canonical */
  shareUrl: string;
  /** 전화 링크(`tel:`) — 번호 모양이 아니면 null, 그때는 칸이 없다 */
  phoneHref: string | null;
  viewId: string;
  screenRef: string;
  hidden: boolean;
}) {
  const L = UI[lang];
  const click = (sectionId: 'DIRECTIONS' | 'SHARE' | 'PHONE', payload: Record<string, unknown>) =>
    track('CLICK', { entityType: 'ATTRACTION', entityId: attraction.id, screenType: 'ATTRACTION_DETAIL', screenRef, sectionId, payload }, viewId);
  // Web Share 가 있으면 그것 하나, 없으면 복사 하나 — 복사 쪽이 「복사됨」을 보여 준다
  const channels = typeof navigator.share === 'function' ? (['share'] as const) : (['copy'] as const);
  return (
    <div className="place-action-bar kh-slab" role="group" aria-label={L.group} hidden={hidden}>
      <a
        className="place-action-bar__cell"
        href={googleMapsDirectionsUrl(attraction)}
        target="_blank"
        rel="noreferrer"
        onClick={() => click('DIRECTIONS', { kind: 'google_maps_directions', source: SOURCE })}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
          <path d="M12 2.5 21.5 12 12 21.5 2.5 12Z M9 14.5V12a1 1 0 0 1 1-1h5 M13 9l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span>{L.directions}</span>
      </a>
      <div className="place-action-bar__cell place-action-bar__favorite">
        <FavoriteButton
          type="ATTRACTION"
          targetKey={attraction.id}
          lang={lang}
          tracking={{ screenType: 'ATTRACTION_DETAIL', screenRef, viewId }}
        />
        {/* 보이는 글자만 — 이름은 별 버튼의 접근성 문구(「… 찜」)가 말한다 */}
        <span className="place-action-bar__label" aria-hidden="true">{L.save}</span>
      </div>
      <div className="place-action-bar__cell place-action-bar__share">
        <SharePanel
          shortUrl={attraction.shortUrl}
          url={shareUrl}
          title={attraction.title}
          lang={lang}
          channels={channels}
          onShare={(channel) => click('SHARE', { kind: 'attraction', channel, source: SOURCE })}
        />
      </div>
      {phoneHref && (
        <a className="place-action-bar__cell" href={phoneHref} onClick={() => click('PHONE', { source: SOURCE })}>
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M6.5 3.5h3l1.5 4-2 1.5a11 11 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5.5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <span>{L.call}</span>
        </a>
      )}
    </div>
  );
}

export type JumpTarget = 'summary' | 'access' | 'info' | 'nearby';

const JUMP_LABEL: Record<PlaceLang, Record<JumpTarget, string>> = {
  ko: { summary: '요약', access: '가는 법', info: '방문 정보', nearby: '주변' },
  en: { summary: 'Summary', access: 'Getting there', info: 'At a glance', nearby: 'Nearby' },
};

export const jumpSectionId = (target: JumpTarget) => `place-sec-${target}`;

/**
 * 절 이동 줄(좁은 화면) — 있는 절만, 둘 미만이면 그리지 않는다. 실주소(`#place-sec-…`)를 갖되 기본 동작은 막고
 * 그 절로 스크롤한 뒤 포커스를 옮긴다(스크린리더가 절 이름부터 읽는다). 해시는 주소에 남기지 않는다 —
 * `history.replaceState` 는 라우터 상태를 덮으므로 쓰지 않는다. 대상이 DOM 에 없으면(주변 목록이 비어 절이 없음)
 * 아무것도 하지 않는다.
 */
export function AttractionJumpNav({
  targets,
  lang,
  attractionId,
  viewId,
}: {
  targets: JumpTarget[];
  lang: PlaceLang;
  attractionId: string;
  viewId: string;
}) {
  if (targets.length < 2) return null;
  const go = (e: MouseEvent<HTMLAnchorElement>, target: JumpTarget) => {
    e.preventDefault();
    const el = document.getElementById(jumpSectionId(target));
    if (!el) return;
    track(
      'CLICK',
      {
        entityType: 'ATTRACTION',
        entityId: attractionId,
        screenType: 'ATTRACTION_DETAIL',
        screenRef: attractionId,
        sectionId: 'SECTION_JUMP',
        payload: { target },
      },
      viewId,
    );
    el.scrollIntoView({ block: 'start' });
    el.focus({ preventScroll: true });
  };
  return (
    <nav className="place-jump" aria-label={UI[lang].jump}>
      {targets.map((t) => (
        <a key={t} href={`#${jumpSectionId(t)}`} onClick={(e) => go(e, t)}>
          {JUMP_LABEL[lang][t]}
        </a>
      ))}
    </nav>
  );
}
