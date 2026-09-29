# 스펙 리뷰 요약

| 차원 | 1차 | 2차 | 2차 뒤 처리 |
|---|---|---|---|
| architecture | BLOCK (B1 + 8) | REVISE (해소 5 · 부분 4 · 신규 4) | 시군구 5자리 축 · `/internal/render` · 네트워크 정책 두 파일(표식 없음) · CronJob ClickHouse 설정 · V007 IF NOT EXISTS·불변식 · 문서 목록 반영 |
| domain | REVISE 12 | REVISE (해결 8 · 부분 3 · 그대로 1 · 신규 3) | `uniqState`/`uniqMerge` 14일 고유 · M ≤ N · `petPolicy` 대응 표 · UNKNOWN 버킷 없음 · 파서 버전 필드명 · 코드 없는 문서 처리 · 사전 등재 |
| implementation | REVISE 10 | REVISE (해소 9 · 부분 1 · 신규 5) | 계수는 키워드 레그만 · ClickHouse 접속 설정·건수 로그 · 14일 재집계 · 시간 초과 층(0.5/3/1초) · 병렬 집계 요청 · nginx 요청 시 이름 해석·location 분리 |
| security | REVISE 5 | REVISE (해소 5 · 부분 1 · 신규 3) | `/internal/render` 고정 + rt 404/클러스터 200 짝 검사 · `anonymous` 제외·조작 한계 명시·ADR 문장 축소 · 숫자 id location · Cookie/Authorization 미전달 |
| test-strategy | REVISE 11 | REVISE (해소 3 · 부분 8 · 신규 9) | 픽스처 CI 재생성 · T16 판정 수치 · 블라인드 라벨·최소 20건 · 기준 스냅샷은 이전 커밋 · T20~T23 추가 |
| usecase | REVISE 7 | REVISE (해소 3 · 부분 4 · 신규 3) | 새 섹션 식별자·순서·중복 제거 · 영문 문구 · 칩 숨김 대신 흐림 · 반려동물 두 칩 · 「정보가 있는 곳만 거릅니다」 · 모바일 CDP |

수정 2회 상한(파이프라인 규칙)에 도달해 3차 리뷰 없이 위 반영으로 확정한다. 2차에 BLOCK 은 없었다.
