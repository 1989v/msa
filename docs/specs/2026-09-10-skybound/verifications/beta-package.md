# 첫 베타 배포 패키지 준비

직접 실행: `node release/build-beta.mjs` → 5 payload files; metadata added.

파일 5개 합계 **2,923,994 bytes** (메타데이터 제외). 모든 파일의 실제 크기/SHA-256과 메타데이터 일치, HTML의 상대 JS/CSS/GLB/고지 파일 존재, 개발 베타/저장 없음 안내를 확인했다. 소스맵은 생성하지 않는다.

브라우저/실제 공개/성능 검증을 의미하지 않는다. 다음에 패키지 자체로 통합 플레이를 수행한다. 빌드 산출물은 `release/dist/`, 재생성 명령은 `release/README.md`에 저장했다.
