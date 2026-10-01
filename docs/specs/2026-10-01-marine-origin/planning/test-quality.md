# Verification plan — 미실행
현재는 계획/아트만. 아래는 다음 구현 세션의 gate다. 종전40개 테스트는 새 요구 검증이 아니다.

## 시뮬레이션 (핵심 행동)
1. 시작 archer1/worker0/gold0, 처치10회=100G, 고용 전 노동 수입0.
2. 채집 이동/작업/반납 단계와 사망/경로없음/건설 전환: 반납1회 지급.
3. 금화 부족/상한/중복 command 모두 추가 유닛·자원 변경0.
4. 일반3→hero1, 소유/주둔/지역/HP비율·공방업·원자적 실패.
5. 목수 없으면 건설불가; 공사 정지/재개/취소환급/완공 once.
6. 빈 탑 공격0;4명까지만 주둔;입출입 이중개체0;파괴 강제퇴각.
7. 램프 없는 고도 이동불가, 경로폐쇄 건설불가, 높은 지형/숲 LOS 차단.
8. 미탐색/기억/현재시야 및 coop 합집합. 숨은 적 minmap/효과 없음.
9. 리젠/웨이브/역습 독립, spawn cap에서 보스/클리어 영구 소실없음.
10. 정상 명령만으로 6캠프/2던전/최종보스까지 플레이. seed 여러개, gold나HP 직접 주입 금지.
11. 경제 소프트락/본진HP0 패배. 죽음·보상 중복 없음.
12. serialize/load 이후 다음600step 상태 동등성; 리젠/치유/보상/짐 중복없음.

## 온라인/저장
- relay mock으로 sender 위조/타인 unit/NaN/무한값/out-of-bounds/1000회중복 명령 차단.
- 실제2브라우저 원정대 분리, 동시에 고용·합성·같은 적 처치·탑입장·던전분리.
- 4096char/40msg 상한: 최대260적/64아군/12탑에서 전송 봉투≤3800, 전체 rolling rate≤30.
- chunk 순서/누락/중복/hash오류/과도 count/최대buffer/3초만료. 부분 snapshot 적용0.
- 호스트 이탈·tab close·게스트 drop·양방향 단절·새 room resume, old epoch 거부.
- 단독 fork와 coop 원본을 합치거나 조용히 덮어쓰지 않음.
- server save2슬롯 전체UTF8≤60KiB, schema오염/version불일치/저장거부/낙관적락 충돌.
- 실제 로컬 server와 계정/게스트코드 이어하기, 다른기기 최신기록 보존. HTTP200만으로 판단하지 않음.

## 시각/플레이
- desktop1920×1080,1280×720, phone844×390/390×844 캡처에서 불투명 캐릭터 bound를 CSS px로 측정.
- 명세 비율과 게임카메라가 일치; 애니메이션 발 anchor 안정,8방향 회전·보행·사격.
- 선택44px영역/작은그림 공존,확대UI가 필드/조이스틱 가림없음.
- 원본 참조와 신규 맵의 진출동선/램프/높낮이/가시영역 비교판 기록.
- 실제 사람 테스트: 첫목수40~90초 목표,첫탑4~7분 목표,전체35~50분 목표.
- 렌더60fps desktop/30fps phone 목표,10분 실기기발열/입력지연 확인.
- 스크린샷만으로 재미/움직임을 통과시키지 않음. 자동공략시간은 인간 플레이시간 근거 아님.

실제 browser 접근이 거부되면 권한 우회하지 않고 미검증으로 기록. 다음 모델은 과거 거부와 현재 도구 상태를 구분한다.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->

## 리뷰로 추가한 구체 fixture/oracle
- 경제 경계99/100/179/180G,전투·목수0:99만재건불가. coop한소유자전멸은다른소유자생존시진행.
- checkpoint K검증 후 표시delta K+1/K+2중누락·중복·역행: 실행복구는정확히K,표시만재동기화.
  K에서복원한sim에동일입력600step을재실행한결과와중단없이K에서진행한시뮬레이션을비교.
- K이후성공했으나미저장/ack미수신고용과거부거래:fork는금화/유닛양쪽K로복구,oldepoch재전송실행0.
- 체크포인트조립중표시delta수신,다른peer의가짜host snapshot/NaN seq/정수범위/기대seq gap검증.
- 복구좌석뒤바꿈(새relay0이campaignOwner1제어),업그레이드·정원·지갑보존·합성소유자분리.
- 준비중버전불일치/earlyGO/초기checkpoint hash오류에sim tick0소비0. socketstart와gamestart분리.
- stalled peer에서queue≤96KiB/96msg,checkpoint2개/ack64개상한,5초거래잠금/10초복구UI.
- 두save슬롯에최대적260·아군64·탑12·전체탐색·최대jobs/스폰큐·한글metadata;PlatformAdapter.collect중첩escaping후
  60KiB이하,60KiB초과클라이언트거부,64KiB초과서버거부를각각검증. live-state최대와serializercap이충돌하면표현개선후재측정.
- solo/coop/guestRecovery/old frontline-expedition-v1을각기다른bytes로seed.
  fork취소·새원정·resume·cloudbootstrap마다의도한키외원본bytes동일,guestRecovery업로드없음.
- getItem성공/setItem실패,server낙관적lock충돌시로컬성공과cloud미동기화를구분표시.
- 던전두owner입장→한명퇴각→다른한명보스처치→퇴각자재입장,방/보스리셋과중복보상0.
- 공사도착전취소165G,목수2번째추가가속0,같은tick취소/완공한번,건설중피해를완공으로공짜복구하지않음.
