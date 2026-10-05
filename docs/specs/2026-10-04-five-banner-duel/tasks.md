# P1 구현 태스크

사용자 승인: 2026-10-05. 구현자: gpt-6.1-sol 한 명, 소유권 `portal-fe/public/games/duel-defense/`. 부모는 명세·설계 결정을 담당한다.

- [x] T1 독립 게임 골격, data/core의 공용 경제·초기 배치·5단계 상태 흐름
- [x] T2 타워·적 전투·조합 판정·AI, 의미 있는 core tests 작성
- [x] T3 기존 승인 sprite 아틀라스 추출/animation, 독립 성문·5×5·작은 유닛 렌더링
- [x] T4 타이틀·도움말·배치·공격 카트·장부·관찰·결과·재시작·소리/일시정지
- [x] T5 로컬 실행 도구·README·브라우저 E2E/asset check, 최종 통합 검증 및 증거
- [x] T6 부모 보고 확인 후 fresh-context 구현 리뷰, 유효 결함 수정·관련 재검증

그룹 중간에 같은 테스트/전체 빌드를 반복하지 않는다. 구현 완료와 검증 완료는 구분한다. 기존 협동 게임·타 작업 변경을 보존한다. 커밋은 이 작업의 파일만 포함하며 훅 우회 금지. 온라인 배포는 수행하지 않는다.

2026-10-05 구현·통합 검증 완료: games 서브모듈 `cbf9b5e3`. 증거는 `verifications/final-verification.md`. T6 부모 독립 리뷰 최종 SHIP 확인. pause/44px/모든 aspect 폭 결함은 수정·관련 브라우저 재검증 완료.

## R2 — 직접 구매·드래그 배치 (2026-10-05 승인)

- [x] R2-T1 공용260 직접 시작, paid general160, 활성 조합/initial phase 제거, 같은 예산 AI
- [x] R2-T2 단순 header/두 전장/수비·공격 카드/출진, 실제 공격력·사거리·HP·속도 표시
- [x] R2-T3 Pointer Events mouse/touch 구매·이동, ghost/range preview, invalid/cancel/phase atomicity
- [x] R2-T4 선택 병사 range/표식/철거, 클릭·키보드·44px modal 도움, pause/help와 persisted sound
- [x] R2-T5 R2 Core12·asset5·Chrome 실제 드래그/일반5단계·six viewport 통합 검증
- [x] R2-T6 부모 fresh-context 리뷰 SHIP, 확인된 sound초기화 수정·focused regression

R2 games `70b818c1`, 증거 `verifications/r2-final-verification.md`. P1 체크/출력은 이력.

## R3 — 클릭 배치·타이머·툴팁

- [x] R3-T1 one-shot click carry·cursor/range·invalid nocharge, drag/move/cancel lifecycle
- [x] R3-T2 첫45/이후30, single top-right 바로시작, 빨간 숫자/paper 대비, help/README 동기화
- [x] R3-T3 실제 base rate/traits hover/focus tooltip 및 touch persistent 상세/군악 지원 note
- [x] R3-T4 Core13·scoped real-browser 입력/45s자동/30s다음 준비·6viewport·native touch/red computedcolor
- [x] R3-T5 fresh-context 리뷰 SHIP, 기록/정상 owned commit

게임 `b26b580f`, 증거 `verifications/r3-final-verification.md`. P1/R2는 이력으로 유지.

## R4 — 20단계·성장·병과·접지 걷기

- [x] R4-T1 20 authored waves/군량/등급,45/30/20/15 준비, 실제 경로 종료·20결과
- [x] R4-T2 숫자 방어력/관통/최대3 창/개별 AoE/최고 support,6역할·7공격
- [x] R4-T3 Lv1~3 강화·병종 연구·공통 stats·현재 준비만 환급·공개 정보 AI 연구
- [x] R4-T4 투명9×4 부품·팔/무릎/발목·PATH 접지·서로 다른 synchronized projectile/support FX
- [x] R4-T5 Core19·asset6·seeded20·실제 UI/touch/6viewport/FX/15초 WebM 통합·focused 재검증
- [x] R4-T6 fresh static SHIP·부모 실제 모션 승인·gameREADME/증거·정확한 owned commit

게임 `e5dddaa8`, 증거 `verifications/r4-final-verification.md`. 초기 standalone PNG 절단/발 미끄러짐을 출하하지 않고 전용 부품·world contact로 수정했다. P1~R3 출력은 역사 보존. Root games pointer/타 작업 파일 변경 없음.

## R5 — 관통 순서

- [x] R5-T1 base 창병22 >화차18 >총통12 >포수10 >궁수0, 강화+4/+8 유지
- [x] R5-T2 변경된 numeric/AoE 기대값·모든 레벨 strict ranking·기존 browser assertion source 연동
- [x] R5-T3 Core20/20·390px 실제5종 tooltip/선택·shared Lv3·0console, fresh static SHIP
- [x] R5-T4 게임README·증거·정상 exact-owned commit, root games pointer 보존

게임 `71edb3d4`, 증거 `verifications/r5-final-verification.md`. 다른 밸런스/원화/전체 경기 재검증은 확대하지 않았다.

## R6 — 15웨이브·연구10% 인하·BETA

- [x] R6-T1 첫15wave/grants 유지, 실제 length로 최종/AI연구/UI/help/result
- [x] R6-T2 두 단계 연구비round(old*.9), 유료/수비 가격과 경제 잠금 유지
- [x] R6-T3 Core21/21·실제 연구81 차감/cartlock·15labels·전체15 도메인·0errors
- [x] R6-T4 gameREADME·검증 기록·normal exact-owned game commit `8b2bc8c0`
- [x] R6-T5 부모 fresh static review SHIP
- [x] R6-T6 부모 BETA 배포·카탈로그·공개 URL 확인

로컬 증거 `verifications/r6-final-verification.md`. 카탈로그/BETA 공개는 부모 소유이며 이 구현자의 배포 완료 주장에 포함하지 않는다.
