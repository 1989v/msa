# Domain review — REVISE

검토일: 2026-10-01. 범위: 계획/시안만. 런타임 코드는 수정하지 않았다.
검토 입력: spec, gameplay/world/platform, requirements/research, tasks/test-quality, design/DESIGN, context-map, game/CLAUDE. 기존 sim의 createGame/act/saveGame/loadGame 경계 존재를 확인했으며 기존 수치를 새 규칙의 근거로 쓰지 않았다.

## D1 · P1 · 재건 가능한 상태를 패배로 판정 / 협동 판정 단위 누락

- 근거: `spec.md` SR-1/SR-6; `planning/gameplay.md:13`, `planning/gameplay.md:42`, `planning/gameplay.md:43`; `planning/platform.md:20`.
- 목수 가격은100G인데 전투원0/목수0/금화180 미만이면 패배한다. 100~179G는 목수 고용→채집→활잡이 재고용이 가능하므로 문서의 '더는 재고용할 수 없음'과 모순이다. 독립 지갑인 협동에서 이 판정을 한 좌석에 적용하면 다른 좌석이 싸우는 중 원정 전체가 종료될 수도 있다.
- 수정 제안: solo는 수입원/전투원 없음 + 최소 재건 비용100G 미만으로 정의한다. coop은 좌석별 `재건 가능/무력화`와 캠페인 패배를 구분하고, 팀 전체가 재건 불가능할 때만 경제 패배로 처리한다. 캠프 분배금으로 무력화 좌석이 재진입할 수 있는지도 명시한다. 경계값99/100/179/180 및 한 좌석 전멸·다른 좌석 생존 사례를 테스트 계획에 넣는다.

## D2 · P2 · 보상 수령자 집합이 완전히 결정되지 않음

- 근거: `spec.md` SR-1/SR-6; `planning/gameplay.md:70`, `planning/gameplay.md:71`, `planning/gameplay.md:72`.
- '가까운 기여자'에는 거리/같은 지역 조건이 없고 다음 문장은 최근10초 피해만 정의한다. 사격 후 던전으로 이동한 소유자도 참여자인지 구현에 따라 달라진다. 캠프 보상은 '등록 두 좌석'인데 solo도 포함하는 문장으로 읽힌다.
- 수정 제안: 거리 제한을 제거하고 최근10초 피해 소유자만 적용하거나 정확한 반경·지역·판정 시점을 고정한다. 캠프는 등록 좌석 수1/2로 분배하고 coop 난이도 배수는 총 보상에 한 번 적용한 뒤 분할한다고 명시한다. 이탈/fork 후 빈 좌석 몫의 지갑 귀속도 보존한다.

## D3 · P2 · solo fork의 제어권과 경제 소유권을 분리해야 함

- 근거: `spec.md` SR-2/SR-3/SR-6; `planning/platform.md:20`, `planning/platform.md:48`, `planning/platform.md:49`; `planning/gameplay.md:54`.
- 이탈 후 상대 부대의 '단독 제어권 이전'만 규정되어 있다. owner까지 통합하면 48전투원/16목수가 개인 상한을 초과하고 서로 다른 강화와 지갑을 병합하게 된다. owner를 유지하면 원래 소유자 명령 제한과 합성/수리 검증을 어떻게 통과하는지 빠져 있다.
- 수정 제안: 원래 ownerSeat/지갑/강화/정원을 유지하고 `controller → 허용 ownerSeats`를 별도 저장한다. fork HUD에서 대상 좌석을 선택하며 고용/강화/탑 수리는 해당 좌석 지갑만 사용하고 서로 다른 owner의3기 합성은 계속 금지한다고 확정한다. 합병이 의도라면 별도 이전 규칙을 작성한다.

## D4 · P2 · 피처 도메인 용어 기준 연결 필요

- 근거: `docs/context-map.md:20`의 BC 매핑에는 game이 없고 `game/glossary.md`도 없다. `spec.md` SR-2/SR-3/SR-6에서 원정대·명령 그룹·소유자·좌석·캠페인·주둔 슬롯을 함께 사용한다.
- 게임플랫폼의 계정/프로필과 캠페인 seat가 다르다는 방향은 적절하다. 다만 후속 모델이 owner/controller/seat를 같은 값으로 합치지 않도록 피처 범위 glossary에 정의와 식별자/수명/관계를 기록하고 spec에서 연결한다. 전체 MSA 사전 재작성은 필요하지 않다.

## 유지할 판단

- 활잡이1→사냥→목수 고용→자동 노동 수입, 일반3 합성, 주둔자만 사격하는 탑, 영구 사망 및 소유자별 공방업은 사용자 요청을 반영한다.
- `planning/gameplay.md:2`의 수치는 제안, `planning/world.md:2`의 지도는 재구성 초안이다. 원작 확인 사실로 승격하지 않는다. 독립 던전의 출처 미확인 고지도 적절하다.
- 위 수정은 기획 내부 일관성 보완이며 이번 세션 구현·배포를 요구하지 않는다.

## Round 2 — SHIP (계획 인계 기준)

2026-10-01 수정본을 다시 읽고 D1~D4의 해결을 확인했다. 최초 지적은 위에 이력으로 보존하며 현재 판정은 SHIP이다.

| 지적 | 해결 근거 |
|---|---|
| D1 | `planning/gameplay.md:43`에서 최소 재건100G 경계를 적용하고, `planning/gameplay.md:44`에서 등록 소유자 전원이 무력화될 때만 협동 경제 패배로 한정했다. `planning/test-quality.md:43`에99/100/179/180 및 한 좌석 전멸 회귀 사례가 있다. |
| D2 | `planning/gameplay.md:74`에서 거리·지역 조건을 제거하고 최근10초 피해 기여만 적용한다. `planning/gameplay.md:75`에서 solo1/coop2 등록 소유자 수 및 후속 문장의 배수1회·fork 지갑 보존이 정해졌다. |
| D3 | `planning/platform.md:63`에서 owner/지갑/강화/정원을 보존한 채 controller.allowedOwners만 확장한다. `planning/platform.md:64`에서 대상 소유자 선택·해당 지갑 결제·교차 소유 합성 금지를 명시했다. |
| D4 | `planning/glossary.md:1`에 캠페인/소유자/릴레이 좌석/제어자/프로필/원정대/주둔 슬롯/체크포인트/epoch/fork의 관계를 정의하고 `spec.md:6`에서 연결했다. |

새로운 도메인 차단 사항은 발견하지 않았다. 수치·맵은 설계 제안이고 원본 전체 지도 근거는 T0 미결이라는 상태를 유지한다. 이 판정은 런타임 구현·균형 검증·아트 승인 완료를 뜻하지 않는다.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
