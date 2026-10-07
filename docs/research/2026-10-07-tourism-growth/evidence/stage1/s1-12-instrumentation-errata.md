측정 시각(KST): 2026-10-08T04:30:28+09:00 | 도구: Git 2.50.1 (Apple Git-155), Python 3.14.6 | 표본: DDL 1개 | 명령: git show origin/main:wishlist/feature/src/main/resources/wishlistdb/migration/V3__collections.sql

# S1-12 정정 — 묶음 테이블명

[s1-12-instrumentation.md](s1-12-instrumentation.md)의 「search의 다른 경로와 조회 원장 여부」에서 `wishlist_collections`로 적은 묶음 테이블의 실제 DDL 이름은 **`wishlist_collection`**이다. origin/main `a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24`의 V3__collections.sql:7에서 확인했다. 찜 상태 테이블은 `wishlist_items`가 맞다. 공유 이벤트 부재 및 기준선 판정에는 영향이 없다.

이미 생성된 파일을 덮어쓰지 않는 제약에 따라 별도 새 파일로 정정했다. 운영 테이블의 실제 적용 상태는 「미확인」이다.
