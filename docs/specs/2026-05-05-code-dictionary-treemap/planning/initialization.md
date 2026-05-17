<!-- source: code-dictionary -->
<!-- source: portal-fe -->
# Code Dictionary Treemap Visualization

## 출처
- 사용자 요청: 네이버 증권 모바일(https://m.stock.naver.com/)의 "증시 현황" 트리맵 차트 스타일을 code-dictionary에 추가
- 참고 이미지: /Users/gideok-kwon/Desktop/image.png (트리맵 — 면적=비중, 색상=등락률)

## 결정된 사항 (사용자 컨펌 완료)
1. **배치 위치**: 양쪽 frontend
   - code-dictionary 사용자 frontend (`code-dictionary/frontend`) — 학습자 탐색용
   - admin frontend (`admin/frontend`) — 운영자 분포 진단용
   - 동일한 stats endpoint 재사용
2. **면적(weight) 정의**: `indexCount` (concept별 code snippet 수)
   - 현재 ForceGraph3D 버블 크기에 이미 사용 중 (검증된 메트릭)
   - V1은 indexCount만, V2에서 weight 컬럼 추가 검토
3. **색상 정의**: `level` 필드 (BEGINNER/INTERMEDIATE/ADVANCED)
   - 학습 난이도 직관적 표현

## 스코프 (포함)
- Backend: `code-dictionary/app` 의 `GraphService`에 `getCategoryStats()` 추가
  - 응답: 카테고리 → concept 리스트 + indexCount + level
- Frontend (code-dictionary): `TreemapView.tsx` 컴포넌트 (recharts Treemap)
- Frontend (admin): `CodeDictionaryTreemapPage.tsx` 또는 기존 page에 탭 추가
- Gateway: `/api/v1/concepts/**` 라우트 추가 (production 트리맵 호출 가능하게)

## 스코프 (분리 — 별도 스펙으로)
- OpenSearch 자동 동기화 (현재 수동 버튼만 존재)
- Admin K8s ingress proxy 설정 (정적 SPA → /api/* 라우팅)

## 기존 코드 컨텍스트
- 라이브러리: 양쪽 frontend 모두 `recharts@3.8.1` 설치됨 (Treemap 사용 가능)
- DB 스키마: `concept` 테이블 (indexCount는 query time 계산), `category`/`level` enum 존재
- API: `code-dictionary/app/.../ConceptController.kt`, `GraphService.kt`
- CORS: localhost:5173/5174 허용 (admin/code-dictionary 양쪽 dev port)
- Gateway 라우트 부재 확인됨 (`gateway/src/main/resources/application.yml:28-50`에 code-dictionary 없음)

## 비기능 요구
- 성능: stats endpoint은 모든 concept 조회 — 캐싱 검토(Redis 또는 in-memory)
- 디자인: `docs/conventions/frontend-design.md` 준수 (AI slop 방지)
- Latency Budget: P99 < 200ms (Tier 2 — 학습/관리 도구)
