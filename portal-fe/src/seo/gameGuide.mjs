import { marbleEditorial } from './gameEditorial.mjs';
/** Verified game instructions shared by the live introduction and initial HTML.
 * Evidence: docs/specs/2026-10-11-webgame-ranking/implementation.md.
 */
import { gamePath } from './copy.mjs';

const GUIDES = {
  'block-burst': {
    title: 'Block Burst',
    ko: {
      reason: '조각을 배치하고 빈칸을 관리하는 퍼즐을 찾는다면. 8×8 보드에서 가로·세로줄을 채우고, 여러 줄을 함께 지우는 배치를 고민합니다.',
      goal: '8×8 보드에 조각을 놓아 가로줄이나 세로줄을 채우세요. 줄을 지우며 점수를 쌓고, 어떤 조각도 놓을 수 없으면 게임이 끝납니다.',
      controls: '아래의 조각을 마우스나 손가락으로 보드에 끌어다 놓습니다.',
      tip: '큰 조각이 들어갈 빈 공간을 남겨두세요. 여러 줄을 동시에 지우거나 연속으로 줄을 지우면 추가 점수를 얻습니다.',
    },
    en: {
      reason: 'For players who enjoy fitting shapes and managing space. Fill rows and columns on an 8×8 board and plan placements that clear several lines together.',
      goal: 'Place shapes on an 8×8 board to fill rows or columns and earn points. The game ends when none of the available shapes can fit.',
      controls: 'Drag a shape from the tray onto the board with your mouse or finger.',
      tip: 'Leave room for larger shapes. Clearing multiple lines together or clearing lines on consecutive turns earns extra points.',
    },
  },
  'mine-pioneer': {
    title: 'Minefield',
    ko: {
      reason: '숫자를 읽고 안전한 칸을 추리하는 지뢰찾기를 찾는다면. 개척 모드는 목숨 3개로 여러 판을 돌파하며, 계속 진행할지 퇴각할지도 결정합니다.',
      goal: '지뢰가 없는 칸을 모두 열어 판을 돌파하세요. 개척 모드는 목숨 3개로 시작하며, 판을 깰수록 지뢰가 늘어납니다. 판 사이에 퇴각해 점수를 확정할 수 있습니다.',
      controls: '탭이나 좌클릭으로 칸을 열고, 길게 누르거나 우클릭으로 깃발을 표시합니다. 아래의 열기·깃발 버튼으로 모드를 바꿀 수도 있습니다.',
      tip: '먼저 클래식 초급 9×9에서 숫자와 깃발 조작을 익혀보세요. 개척 모드의 3×3 스캔은 첫 칸을 연 뒤 판마다 한 번 쓸 수 있습니다.',
    },
    en: {
      reason: 'For players who like reading numbers and deducing safe tiles. Pioneer mode gives you three lives across increasingly mined fields, with a choice to continue or retreat.',
      goal: 'Open every safe tile to clear a field. Pioneer mode starts with three lives and adds more mines after each clear. Retreat between fields to bank your score.',
      controls: 'Tap or left-click to open a tile; long-press or right-click to flag it. The Open and Flag buttons also switch the input mode.',
      tip: 'Try Classic Easy 9×9 to learn the numbers and flag controls. In Pioneer mode, one 3×3 scan is available per field after you open the first tile.',
    },
  },
  'rift-front': {
    title: 'Rift',
    ko: {
      reason: '영웅을 직접 움직이며 전선을 밀어가는 전략 액션을 찾는다면. 크립과 함께 진격하고, 두 스킬과 본진 회복을 활용해 수호탑을 공략합니다.',
      goal: '크립과 함께 단일 전선을 밀어 적 수호탑 2기를 바깥부터 차례로 무너뜨리고, 적의 균열 첨탑을 파괴하세요.',
      controls: '방향키 또는 WASD로 이동하며 사거리 안의 적을 자동 공격합니다. Q는 균열 폭발, E는 재생 오라입니다. 터치 화면에서는 이동·스킬 버튼을 사용합니다.',
      tip: '크립 없이 수호탑에 뛰어들지 마세요. 크립을 잡아 레벨을 올리고, 체력이 낮아지면 아군 첨탑 근처로 돌아가 회복하세요.',
    },
    en: {
      reason: 'For players who want to control a hero and push a lane. Advance with creeps, use two skills and recover near your spire while attacking the guard towers.',
      goal: 'Push the single lane with your creeps. Break the two enemy guard towers from the outside in, then destroy the enemy Rift Spire.',
      controls: 'Move with arrow keys or WASD; enemies in range are attacked automatically. Q casts Rift Burst and E casts Mending Aura. Touch screens use movement and skill buttons.',
      tip: 'Avoid diving a tower without creeps. Defeat creeps to level up, and return near your own spire to recover when health is low.',
    },
  },
};

export function gamePlayGuide(slug, lang) {
  if (slug === 'marble-race') return marbleEditorial(lang).guide;
  const guide = Object.hasOwn(GUIDES, slug) ? GUIDES[slug] : null;
  if (!guide) return null;
  const en = lang === 'en';
  const copy = guide[en ? 'en' : 'ko'];
  return [
    { label: en ? 'Goal' : '목표', text: copy.goal },
    { label: en ? 'Controls' : '조작법', text: copy.controls },
    { label: en ? 'First-play tip' : '첫 플레이 팁', text: copy.tip },
  ];
}

export function gameSelectionGuide(lang) {
  const en = lang === 'en';
  return {
    heading: en ? 'Choose by how you like to play' : '플레이 방식으로 골라보기',
    picks: Object.entries(GUIDES).map(([slug, guide]) => ({
      slug,
      title: guide.title,
      reason: guide[en ? 'en' : 'ko'].reason,
      href: gamePath(lang, `/games/${slug}`),
    })),
  };
}
