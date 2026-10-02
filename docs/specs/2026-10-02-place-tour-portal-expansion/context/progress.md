# Progress — 관광 정보 포털 확장

## 현재
- 작업 위치: scratchpad/wt3 (공유 트리 금지). 커밋은 kgd/1989v@naver.com, 푸시는 gh auth 1989v → push → kwongd.
- 완료: TG1 사전 확인(2026-10-02). TG2 완료(V23·왕복 경로·숙박 딥링크 제외, 57 tests). TG3 완료(--job=tour-portal-sync, 24 tests). 다음: TG4 CronJob(KST 03:10 · deadline 540 · backoffLimit 0) · 대장 · 배포 ① · Q2 보정(fix_legacy_en_type 미리보기 → --apply).

## TG1 결과 요약
- 행사 조회 창 −365일 유지(국·영 합 12쪽). eventStartDate 는 「종료일 ≥ 값」 필터.
- 숙박·코스 목록 필드는 areaBasedList2 와 같은 25키. 행사만 4키 추가.
- 숙박 목록에 다른 유형 섞임(Q6) → 32·80 만. 코스 1,016/1,068 법정동 없음(Q7) → 원천 유지.
- 날짜 이상값 0건(Q4). 옛 영문 숙박 2건은 detailCommon2 일회성 보정(Q2).

## 함정
- 2026-10-02 관광지 재색인 두 개가 겹쳐 attractions 별칭이 5분 사라짐 → IndexAliasManager 정리 수정(b2ced8fb). 수동 재색인 전 다른 잡이 도는지 확인.
- search/* 변경은 search-batch 이미지를 자동 빌드하지 않는다 → images.yml 수동 dispatch(push run 끝난 뒤).
- oci-mysql --write 확인 입력은 `yes`.
- 2026-10-02 03:05 UTC: ops-baseline.sh 첫 실행이 MySQL 을 재시작시킴(liveness 5초 × 3). 파생 테이블에 TEXT 를 담는 모양 금지 — id 범위 직접 집계 + 덩어리 사이 1초.
