# Progress — 2026-10-01
- 현재 작업위치: /Users/gideok-kwon/IdeaProjects/msa. 새로운 docs/specs/2026-10-01-marine-origin 및 docs/plans handoff만 작성.
- 사용자 범위: planning/화면시안/캐릭터/몬스터 디자인,구현 중지. 다음 세션에서 모델을 바꾸어 구현 예정.
- 기존 marine-command runtime와 games서브모듈 포인터는 수정하지 않음.
- 미술 기준00 2026-10-01 사용자 승인. 신규4장01/02/03/04 생성 및 workspace복사.
- 재생성비용: design/images/01~03 총약3분,기준00은 이전생성. 프롬프트 design/prompts에보존.
- 공개블로그본문/2스크린샷 확인,영상접근실패/전체맵미확인. 지도는 재구성설계안.
- 플랫폼실제코드 확인: relay4096char/40msg/s,save64KiB/playable catalog. 신규plan에 명시.
- 독립6차원 리뷰15건을 심판이 모두유지, 재건경제/스폰/공사/던전/온라인계약 보완. 6차원 재리뷰 모두 SHIP, 미해결 지적0. 문서 링크/PNG 검증 완료. 다음 세션 T0부터 구현하며 이번 세션에서는 진행하지 않음. 실행코드/런타임검증 없음.
- 되풀이금지: 초기목수/거액자원/유료1기승급/큰캐릭터/안개속적/가짜온라인.
- 현재 구현제약: 원본전체맵근거가 없음(T0확인). 이전Chrome접근미승인은 다음세션에서현재권한상태확인,우회금지.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->

## Implementation resumed
- 이전 진행 과정에서 구현을 시작했으나, 계획 전용 제한이 종료되었다는 해석은 최신 대화의 명시적인 기획·디자인 범위 제한과 맞지 않아 철회한다.
- 지도 재구성 범위는 사용자에게 비동기 확인 중. 지도와 무관한 T1 경제부터 진행.
- 기존 프로토타입 baseline npm test 실행, 새 규칙 검증으로 혼동하지 않음.

## 최신 결정 반영
- 사용자 답변: 원본 지도 확인 후 맵 구현. 추가 지시: 지도 사이즈·규모는 더 커도 됨.
- world.md 임의 배치 보류. 블로그 SCM 확보/정상 CHK 추출, 96×96 타일과 SE 리메이크 정체 확인. 영상 동일판 여부·램프 의미·트리거 연결은 미확인.
- 근거는 planning/original-map-findings.md. 원본 파일이나 원본 그래픽은 게임 에셋에 추가하지 않음.
- 현재 범위는 기획·디자인. 구현 에이전트 중지. 이미 작성된 origin 모듈·아트 초안은 삭제하지 않고 보존하며, 플레이 가능한 통합 결과로 보고하지 않음.
- 후속 구현자는 games 커밋 8cc4bbca와 미커밋 origin 변경을 먼저 점검. transport 리뷰의 delta 의존 순서 손실 및 ACK 후 checkpoint ID 재전송 지적은 아직 미수정.

## 2026-10-02 — 명시적 구현 재개, 한 그룹
- 사용자: 구현 진행, 총 태스크 수 안내, 그중 하나 수행. 전체 9그룹(T0~T8), 이번 T3.
- 작업 위치: 동일 msa/games 서브모듈. 기존 원본 지도 조사 제약은 유지하며 fixture 지형으로 기능 구현.
- 사용자 추가 지시: 코드확인·전체 테스트는 처음/마지막에만, 태스크마다 반복 금지. 초기 경제+지형 baseline 31 pass / 0 fail 확인 후 추가 광범위 탐색·리뷰 중지.
- T3 구현 담당: 기존 spec_review_b 에이전트, sim.js + workers-towers.test.mjs. 루트는 상태 문서·국소 최종 확인·커밋 담당.
- 게임 화면은 기존 프로토타입이며 이번 T3가 바로 새 플레이 화면을 제공하는 것은 아니다. 진행률과 링크에서 혼동 금지.

### T3 완료
- `js/origin/sim.js`: 목수 왕복 채집/운반/노드당3명, 건설220G/20초/취소환급/일시정지/수리, 최대4명 실제 주둔/개별 사격/퇴각/파괴 피해 구현.
- `act(s,command,worldContext=null)`, `step(s,dt,inputsByOwner={},worldContext=null)`로 기존 호출부 호환 유지. worldContext는 terrain/resourceNodes, 경로 캐시는 저장 상태 밖에 보관.
- T3에 필요한 기존 `js/origin/world.js`, `tests/world.test.mjs`도 함께 추적한다. 원본 캠페인 지도는 생성하지 않음.
- 구현 담당 최종 확인: `node --test --test-reporter=dot tests/economy.test.mjs tests/workers-towers.test.mjs`, exit0 / 29 pass / 0 fail (경제16, 목수·탑13). 사용자 요청에 따라 루트는 동일 테스트 재실행 생략.
- 루트 직접 확인: `node --check marine-command/js/origin/sim.js`, `git diff --check`, 각각 exit0. 전체 회귀·브라우저 검증은 수행하지 않음.
- 다음: 원본 맵의 미확인 연결/고도/진출 구조 조사 완료 후 T2 실제 맵 배치. T4 캠페인과 T5 화면 통합이 되어야 새 버전 플레이 링크를 안내할 수 있음.
- 별도 미완료 origin 스프라이트/통신 초안은 이번 커밋에 포함하지 않음. 기존 staged games 서브모듈 포인터 및 타 작업 변경 유지.

## 2026-10-02 최신: 전체 구현/최종 통합
- 이전 ‘한 그룹’ 제한은 최신 사용자 전체 구현 요청으로 대체됨. T0~T7 코드가 새 index/origin UI에 연결되었다.
- 원본 topology/램프/북부 통로 확인, 실제 캠페인 5거점+2던전+최종보스. 세부 근거 world.md/original-map-findings.md.
- 새 로컬 링크 http://127.0.0.1:8138/marine-command/ (games 루트 정적 서버). 8137의 이전 실행 방식은 공용 lib 경로가 맞지 않아 사용하지 않는다.
- 통합검증에서 실제 원본 섬의 사거리, 비정렬 방어탑 입구, 구 UI 테스트 등을 수정했다. 최종 검증 증거와 남은 환경 검증은 status.md를 정본으로 한다.
- hns:implement-tasks 소스와 설치본에 최초 분석 1회/마지막 통합 검증/임계치 중단 원칙 반영.
- Chrome 접근 미승인으로 실제 UI/GPU 확인 불가. 별도 브라우저 자동화로 우회하지 않음. 실제 gateway/relay/cloud 운영 검증도 미수행.

### 최종 통합 결과
정상 명령 완주 통과(seed1989/3001.43초/본진4000), 관련 재검증 통과. code-complete 상태이며 실제 브라우저/서버 환경 검증 대기는 status.md에 명시했다. 기존 staged games 서브모듈 포인터는 그대로 보존한다.

## 플레이 피드백 1차
본진 절벽/출구·부드러운 시야·초기 습격·적 소굴·이동/발사 모션·고용소/훈련장/단계 안내 반영. 최초 분석 재사용, 전체수정 후 통합1회 및 실패 관련재검증. 최종보스 정상완주2754.43초. 자세한 결과는 status.md의 최신절 참조.

## 중단 — 최신 피드백 2차 / 주간 잔여63%
사용자 기존 중단 조건(<70%)에 따라 telemetry used_percent37 확인 즉시 구현 중단. 이번 변경은 미커밋·미검증이며 완료가 아니다.
- 작성된 변경: sim 목수cost500, main 500G안내, campaign 초기180초간25초주기8→10→12…최대20 정찰시체/이후60초주기정규증원, world LOS elevationOnly옵션, view 지형상시표시/반경안개제거/적은높은지형LOS가림.
- 변경 파일: games/marine-command/js/origin/{sim,main,campaign,world,view}.js. 기존 서버가 파일을 제공하므로 새로고침 시 미검증 수정이 보일 수 있음.
- 아직 안 한 것: 가격100G를 가정한 economy/campaign/UI 테스트와진행봇을500G기준으로갱신,500G동일가격의장궁/목수버튼선택테스트구별, 웨이브 생존/첫목수시간/원정수비밸런스 검증, view에서이제불필요한거리시야계산·fogcanvas정리, 고도시야/건물정보가림 검토, 문법/통합검증,커밋.
- 마지막 안정 커밋 games1a1c7cc8. 이번 새수정은 안정완료판으로 안내하지 않음. 잔여량회복 또는 사용자중단조건변경 후 재개.

## 재개 후 피드백2차 완료
사용자50%기준으로진행재개. 가격500G/초반대량습격/고도전용시야 구현 및관련검증완료. 최초146중144통과,실패관련27재검증통과. 정상완주2776.93초,첫목수299초. 위중단항목중이전반경fog계산정리·가격tests·진행검증을해결했다. status.md최신절참조.

## 최신: 피드백3차완료
안개복원+영구장식셀만면제. 길20곳적분산/근접초기사냥/본진접근웨이브8초첫발/20초간격12→44,후반45초48→100. 기존저장보충배치호환. 시뮬정상완주및시야/실제render명령/저장상한테스트통과. 상세status.md최신절.

## 최신: 피드백4차
본진을 맵 좌하단 가장자리 근처로 이전하고 북쪽 공략 고지·경사로·고정 원거리 적탑2개를 연결했다. 웨이브 출발지는 실제 이동경로1824px 밖으로 이동. 목수500G/활잡이700G/장궁수1400G, 초기 활잡이 강화 우선 안내 및 지역별 몬스터/보상 단계화. 새 맵 버전 southwest-2는 구맵 저장을 보존하며 새 원정 필요. 대각 LOS가 목표 뒤 지형까지 검사하던 오류도 수정했다. 검증 증거와 한계는 status.md 최신절 참조.

## 최신: 첫 고지 한정 수정 완료, 사용자 플레이 확인 대기
2026-10-03 games bb4aa10e, gpt-6.1-sol 단일 구현. 고지 높이 투영/짧은 경사로/적 시설 외형/본진 근접 생성/정확한 패배 원인 표시. 세부 검증과 한계는 status.md 피드백5차 참조. 새 원정 필수(southwest-3). 광범위 확대 및 전체 캠페인 재조정은 사용자 확인 전 진행하지 않는다.

## 최신: 수비대 증원과 저장 개선 완료
2026-10-03 games0292929d. 주둔지수비대10배/원거리·비행형/예고후가시/160px입구, binary-v3무손실압축48.8%감소. 국소45검증통과. southwest-4새원정필수. 최대fixture여유588B,실제대군브라우저성능미검증. status.md피드백7차참조.

## 최신: 가시 이미지와 추가 증원 완료
2026-10-03 수비대525/20초보충과출현표시,초반wave24~88/15초·후반64~134/35초,동시wave240·ambient65분리. 가시투명PNG실제렌더. 국소29검증통과,910개체최대저장28,086B. southwest-4기존저장이어하기가능. 상세status.md피드백8차.

## 최신: 웨이브5배/타깃 AI 완료
게임b748ee0b,backend19b001d5. 접근가능아군우선/본진진군공유flow,초반120~440·후반320~670(협동최대938),관련검증통과. 최대1670상태45,060B/두슬롯90,698B. Marine만서버128KiB코드변경이나배포안함:원격저장64KiB제약남음. southwest4저장유지/protocol5협동양측새로고침. 상세status.md피드백9차.

## 최신: 초반 단계화·치료사
games19828054. 첫3wave지상전용,4차부터박쥐소수. 기지옆무적중립치료사반경180/초당5%,병력아님. 관련15통과,지도/저장호환유지. 세부status.md피드백10차.

## 최신: 베타 배포 완료
공개플레이 https://game.1989v.com/games/marine-command/index.html . 카탈로그BETA/저장한도서버수정/게임화면모두배포. 두서비스Ready,공개31리소스검증및11PNG해시일치. 기존localstaged포인터변경없이격리remote-main릴리스. 증거verifications/beta-deployment.md.

## 최신: 우측 전초기지 베타 패치 완료
첫wave가본진오른쪽새전초기지에서출발,타워+지역수비중간보스추가. 강화전후초반정상명령비교검증. gamesrelease9e1f8c2/portal1b28009/manifestd14ba1f,CI37081837959SUCCESS. SW4save유지/protocol6협동재접속. 첫wave이미지났으면새원정으로초반확인. 상세status.md최신절과verifications/outpost-beta-evidence.json.

## 최신: 간격 있는 웨이브 행렬·우측 출발 유지·치료 강화 베타 완료
3열 순차 방출/비전투 최소 32px, 현재 차수 전량 출발 후 다음 차수 타이머. 우측 전초 타워와 파수꾼 모두 처치 전까지 우측에서만 웨이브 출발. 치료 초당 최대 HP 7%. 관련 13건 최종 통과(실패 영향만 재검증), SW4 저장 유지/protocol7. games ec4eb40d → release b0a719dc, portal5bcaec8/manifest68610ae, CI37085638787 SUCCESS 및 공개 파일 확인. 실제 브라우저 픽셀/FPS 미검증. 상세 status.md 최신절과 verifications/procession-beta-evidence.json.

## 최신: 궁수 키우기 이름·불규칙한 난입 베타 완료
게임/카탈로그 이름을 궁수 키우기로 통일, URL/저장 키 유지. 고정 대열 대신 2~4마리 무리별 불규칙 출발과 지형 안전한 좌우 진군·회피. 실제40초73명 출발/최소32.0001px, 관련7건 통과. local907b0b7e/release035b9f1, content46e127a/portal73563df/manifest9ad2a0e, 양쪽CI SUCCESS 및 공개 파일 확인. protocol8/incursion-8, 기존 저장 유지·협동 새로고침. 실제 시각적 체감은 미검증. status.md 최신절과 verifications/incursion-beta-evidence.json 참조.

## 최신: 중간보스 추격·귀환회복/웨이브 목표 안정화 베타 완료
우측파수꾼 인식320/추격한계360/속도126, 귀환상태20%HP초회복·복귀완료전재추격금지. 기본zombie123(궁수110), 경로예산부족과차단구분·타깃유지1.5초. 관련8건최종통과, locald87e9329/release6ee93b72/portalf90912f/manifest5b6ff9c, CI37127276568SUCCESS와공개파일확인. protocol9/pursuit-9, SW4저장유지. planning/unit-progression-preview.md에현재고용/합성/강화및미구현영웅스킬초안작성, 스킬구현은사용자확인후. 상세status.md최신절.

## 최신: 영웅 Q/E 스킬 베타 완료
2026-10-04 승인명세대로다중사격최대6명/14초·구르기최대120/9tick/10초 구현. HUD/키·내영웅1명·주둔금지·저장/협동연결, 고유10건최종PASS. 최대checkpoint46879B/display12042B4청크(표시조각3072, 기존envelope내). localbace2f97/releasee6a59897/portal95a9459/manifest481b383e, CI37141368540SUCCESS 및공개파일확인. protocol10/hero-skills-10, 새원정불필요·협동재접속. 스킬문서4절은이제구현명세. 실제브라우저픽셀/체감미검증.

## 최신: 첫 웨이브 2/3 베타 반영
첫solo120→80/coop168→112, 둘째160/224이후불변·기존queue보존. 관련2건PASS. local0c59d822/release46f0c04f/portalf194543/manifest58b0156a, CI37166049509SUCCESS 및공개파일확인. protocol11/opening-wave-11, 새원정또는첫wave미생성save부터적용. 상세status.md최신절.

## 최신: 몬스터 도감·적 선택 정보 베타 완료
보이는적클릭→실제HP/공격/방어·내아군피해/타수/최소피해방업비용. 기본·정찰·파수꾼17정적도감. 첫정찰공2는초기궁수방1(25G)로피해1, 일반공4는방3(누적150G); 동시공격생존보장아님. 관련8PASS, protocol12/JS·CSSmonster-info-12. local5c98f189/releaseaca0481a/portald49b40e/manifest6136460a, CI37169612524SUCCESS/공개파일확인. planning/monster-info.md 참조. 새원정불필요, 실제브라우저픽셀미검증.
