# Specification: 전초선 — 분대 성장 RPG

## Goal / latest authority
2026-09-30 최신 사용자 지시: 마린 한 명을 조작하는 액션RPG가 아니라 일꾼·마린·고스트를 고용하고 원작의 시나리오/경제/병력성장/지역공략을 계승. 몬스터·웨이브·주둔지·중간보스·최종보스·던전 모두 구현. RTS 드래그선택/건물생산 UI는 필수 아님. 이전 두 설계는 폐기.

## Research
planning/research.md의 실제 공략6종 근거. 경제/조합 기준은 Climax2, 진행 근거는 원작 MSF 및 Nostalgia/Original RE. 서로 다른 버전을 완전복제했다고 주장하지 않는다. 독립던전은 사용자 필수 요구이며 출처로 공통 원작기능 확인하지 못함을 명시. 사용자에게 엔진선택/진행 위임받음, Three.js2D 확정.

## Gameplay / acceptance
- G1: 한 캐릭터 레벨업 게임이 아닌 실제 다수 아군. 초기 rifle2,worker1, 광물12000. 마린역 소총병6000, 고스트역 정찰저격병5500, 일꾼1000. 최대전투24/일꾼8. 환전·채광·수리 중 일꾼별 업무, 매 step 실제 위치/시간/역할에 따라 처리. 포인트→광물은10:1, 수동환전 버튼 또는 환전일꾼 필요. 채광 일꾼은 광맥 왕복당80. 안전기지에서 원격 고용 가능, 신병은 기지에서 원정대 합류.
- G2: 공업100+15n/방업100+30n 최대255/150. 영웅소총병=일반+9000, 영웅저격병=일반+8500. 화염병A=영웅소총+영웅저격, 정예저격B=영웅저격+10000, 지휘관C=A+B+10000. 조합은 재료 유닛 소비/결과1기, 원자적 비용 검사, 고용·승급·조합·1/10업 버튼 UI. 원격 메딕200으로 살아있는 전투원 완전회복(재사용1초); 기지힐은 지속회복. 원작 메딕의 역할은 단발 유료치료이지 RPG포션이나 동행힐러로 바꾸지 않는다.
- G3: 6144² 필드, 거점(700,5100), 야전 적 주둔지6, 지형벽·통로와 지역진입 트리거. 적 근접/원거리/중장갑/은폐4종, 강적2기 유인사냥, 적 최소100기분포. 기지향 주기웨이브55초, 파괴역습과 최초영역침범 증원은 별도. 시뮬은 원정대가 던전에 있어도 본진/주둔군/일꾼·웨이브 진행. 아군 stance follow/defend. 원정대 이동은 WASD/방향키/탭목표/모바일스틱, 자동대형/공격. 필드/던전 x,y 좌표, 장소 field/dungeon0/dungeon1. 주둔군은 본진지키며 원정대에 합류하지 않음.
- G4: 방어시설 bunker(회복/사거리지원), worker 수리(광물소비) 및 방어포탑 건설1000, 인원 일부 본진배치/원정복귀 UI. 기지HP12000; 모든 병력 사망만으로 패배하지 않음. 기지HP0 패배, 최종보스사망 승리. 원정전멸 시 자동기지시점·새고용가능. 불가능한 상태(자원0/전투0/일꾼0) 복구는 비상일꾼1회 지급, 사용여부저장. 사망병력 자동부활 없음.
- G5: 주둔지1~3 제거→던전0, 주둔지4~6 제거→던전1 해금. 각 독립던전 1800², 통로/3방, 1·2방 몬스터 정리→다음방, 3방 중간보스(예고돌진+소환 또는 산성탄+폭발). 진입/퇴각/재입장, 완료보상1회, 보스2개 처치→최종보스소환(필드 중앙상단). 최종보스3페이즈/소환+범위예고+탄막. 원정 병력/손실/자원은 장소전환에도 유지. 미니맵에주둔지/던전/보스/아군/웨이브.
- G6: seeded DOM독립 sim. 저장버전/seed/진행/아군/기지/자원/공방 포함, 범위·타입·유한값·배열길이 검사, 재개시 원정대기지집결/던전미완성방초기화/보상중복없음. 잘못된 저장/차단스토리지 안내, 새게임가능. 일시정지·페이지이탈정지. 이벤트기반 WebAudio/음소거.외부런타임요청없음.
- G7: 아군 sprite72 worldpx, viewport짧은변760/1000/1280 줌3단. 거점/지형/괴물 원본생성atlas로 2D. CPU 시뮬30Hz/렌더60데스크톱45모바일, DPR1.5모바일, 메뉴20FPS, sprite/effect상한과컬링·공간해시. 한국어 HUD, 모바일44px터치, 390×844/844×390양방향. 실제 브라우저 입력/스크린샷/콘솔확인,16개이상행동테스트.

## Module contract (implement exactly or notify main)
js/sim.js ES module exports createGame(seed), step(s,dt,input), act(s,type,value) returns {ok,message}, saveGame(s) JSON object, loadGame(obj) returns state/null, price(s,type), UNITS, RECIPES, CAMPS, DUNGEONS, WORLD. No DOM/Three. State: phase playing/dead/won; time,seed,rng,location='field'|'dungeon0'|'dungeon1'; squad={x,y,target:null|{x,y}}; minerals,points,kills,upgrades={attack,armor}; units=[{id,kind,x,y,hp,maxHp,location,assignment:'follow'|'defend'|'mine'|'exchange'|'repair',facing,flash,...}]; enemies=[{id,kind,x,y,hp,maxHp,location,radius,boss?,...}]; camps=[{id,x,y,hp,maxHp,cleared,...}]; base={x:700,y:5100,hp,maxHp,turrets}; dungeons=[{unlocked,completed,room,...}]; finalUnlocked; wave={number,next}; bullets/effects/events bounded; obstacles=[{x,y,w,h,location}]; message; emergencyUsed; explored. Units kinds worker,rifle,sniper,heroRifle,heroSniper,flame,elite,commander. Act types: hire(kind), upgrade(attack|armor), upgrade10(attack|armor), promote(unitId), combine(recipeId), assign({id,job}), heal, exchange, turret, recall, enterDungeon(index), exitDungeon, target({x,y}), emergency. Main input {x,y} normalized axis. Events cleared per step: shot/hit/kill/heal/buy/wave/boss/win/lose/message with positions optional. Maxunits32,enemies220,effects256. Bounds/clamping/finite dt. Prices static UI derives exports. Recipes object entries with label,cost,ingredients,result. CAMPS definitions id0..5 labels/positions. DUNGEONS definitions entry positions. WORLD {width,height}. Battle tuning must allow full progression with economic preparation, no cheat-only completion.
js/view.js imports local Three. exports async createView(canvas,atlasURL) => {render(state,dt),resize(),setZoom(index),destroy(),getMetrics()}. Static terrain rebuilt per location, camera follows s.squad, per-unit sprite pools+healthbars/selectionnone+animatedmovement+gunflashes/damageeffects. Coordinate y-down => -y. Atlas4x4 rowmajor rifle/medic/hero/crawler/spitter/brute/crystal/rock/bunker/barracks/workshop/nest/hive/temple/wreck/crater. Additional assets/support.png 2x2 worker/sniper/heroSniper/flame if exists. No DOMHUD owned in renderer. Main owns HUD/minimap/input/menu/audio/save. setZoom slots shortspan760/1000/1280.

## Scope / limitations
Standalone portal-fe/public/games/marine-command/ only; backend/catalog/deploy none. Own images/sound. Research-source names only docs, user-facing role names original. No original asset extraction, no full exact map/version claim. Physical phone thermal measurement unavailable and reported. User approved scope/decisions through instructions; no repeat approval.

## Review-resolved rules
- 경제적 전멸은 전투원0/일꾼0/광물+floor(points/10)<1000일 때. 비상일꾼은1회무료. 이미사용했으면 명시적 패배/새게임 제공; playing교착금지.
- 고용 신병은 언제나 field 본진에 생성. 던전중인 원정에 자동순간이동하지 않음. 던전진입은 field의 follow전투원만 이동, 본진defend/worker유지. exit/recall은 현재던전follow를 field기지로 이동. 던전에서 defend배치 명령은 기지로 복귀시키고 반환이후만 공격.
- 퇴각/전멸/저장재개 모두 완료된방과1회보상여부보존, 미완료방만 초기화. 완료던전 재보상없음. 현장재입장은미완료방부터.
- 모든 전투/충돌/수리/탄알에location동일성검사. 저장은 allowlist재구성+ID중복/직업/위치/진행불변식검증.

<!-- source: portal-fe/public/games/marine-command/js/sim.js -->
<!-- source: portal-fe/public/games/marine-command/js/main.js -->
