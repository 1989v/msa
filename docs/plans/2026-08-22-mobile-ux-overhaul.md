# 모바일 UI/UX 전면 정비 — 실행 계획 (2026-08-22)

> **상태: 전 태스크(T1~T10) 구현 완료.** 검증: portal-fe tsc/vitest 134건/프로덕션 빌드(프리렌더
> ko 41,583·en 14,049건, 상세 3,807장) + 변경 JVM 13모듈 gradle test 전부 통과.
> 배포 후 수동 확인 항목: ① attractions 리인덱스(새벽 배치 또는 수동 트리거)로 신규 랭킹 활성
> ② FE 시각 검증(fe-visual-verification 표준 4조합) ③ 브랜딩 이름 확정은 사용자 결정 대기.

> 요청: 각 서비스 모바일 페이지의 깨진 UI/UX 수정 + 개선 전 항목 **누락 없이** 적용.
> 방식: 도메인별 태스크로 분해 → 파일 소유권이 겹치지 않게 웨이브로 병렬 서브세션 실행 →
> 전체 검증(pnpm build/test + gradle test) 후 한 번에 푸시.

## 웨이브 구성 (파일 소유권 기준 — 겹치면 다른 웨이브)

### Wave 1 (병렬)

| 태스크 | 항목 | 소유 파일 |
|---|---|---|
| T1 place FE 전면 개편 | place 1,2,3,4,5,7,8,10,11(FE),12(FE) | `portal-fe/src/pages/place/**`, `src/seo/**`, `scripts/prerender-seo.mjs` |
| T2 place 백엔드 | place 6,9,11(BE) | `place/**`(ingest 포함), `search/**` attractions 랭킹 |
| T3 게임 FE+BE | 게임 1,2,3,4 | `portal-fe/src/pages/games/**`, `src/api/gameApi.ts`, `game/**` |
| T4 메인페이지 | 메인 1,2,4 + 기타 1 | `src/pages/HomePage.tsx`, `src/components/home/**`, `src/styles/k-heritage.css`(타일 보더), `src/api/displayApi.ts`, `code-dictionary/**`(display), **V16 마이그레이션** |
| T5 블로그 구조 | 블로그 1 | `portal-fe/src/pages/blog/**`, `src/api/blogApi.ts`, `blog/**` |
| T6 테크 페이지 개편 | 기타 5 | `src/pages/SearchPage.tsx`, `src/components/graph|panels/**` |
| T7 프리미엄 코드 | 기타 4 | `src/pages/PortfolioPage*`, `src/pages/resume/**`, resume/portfolio BE, **V17 마이그레이션** |
| T8 브랜딩 | 기타 3 | `docs/product/branding-ideation.md` — 완료 (코드 미반영, 이름 확정은 사용자) |

### Wave 2 (순차 — 전 페이지를 가로지르므로 단독 실행)

| 태스크 | 항목 | 소유 파일 |
|---|---|---|
| T9 찜하기 | 게임 5 | wishlist BE 다형 타깃 + FE FavoriteButton + 게임/place/블로그 카드 + 내 찜 뷰 |
| T10 GNB/FNB 통일 | 게임 6 + 메인 3 + 기타 2 | `GNB.*`, `Footer.*`, `shell/**`, 각 페이지 셸 삽입부 |

## 마이그레이션 번호 예약 (code-dictionary/app db/migration)

- V16: 오픈소스 전시(display_open_source) — T4
- V17: 코드 스니펫(resume_project_code_snippet) — T7
- V18: 블로그 공간 구분이 스키마를 요구할 때만 — T5
- 기타 서비스(blog/game/wishlist 자체 스키마)는 각 서비스 마이그레이션 체계를 따른다.
- **적용된 마이그레이션 수정 금지** — 새 버전만 추가 (flyway-migration-immutable).

## 검증 게이트 (푸시 전 필수)

1. `portal-fe`: `pnpm build` (tsc -b + vite build + prerender) + `pnpm test`
2. 변경 JVM 서비스: `./gradlew :code-dictionary:app:test :code-dictionary:domain:test` + 변경된 blog/game/place/wishlist feature/domain test
3. CI 테스트 게이트 실패 시 해당 커밋의 모든 이미지 미생성 — 로컬에서 전부 통과시킨 뒤 푸시

## 항목 → 태스크 매핑 (누락 방지 체크리스트)

- place 1 칩→드롭다운(모바일) → T1
- place 2 카드 접힘 해제 + 인피니티/페이징 → T1
- place 3 상세 모달 포커스/배치(모바일 바텀시트) → T1
- place 4 유튜브 캐로셀 가로스크롤 격리 → T1
- place 5 모바일 앱형 전면 개편 → T1
- place 6 영문 데이터 품질/정렬 + 괄호 한글명 분리 → T2 (표시 분리는 T1)
- place 7 마커 클러스터링 → T1
- place 8 마커 클릭 이동 부자연 → T1
- place 9 유튜브 수집 관광/여행 카테고리 우선 → T2
- place 10 유튜브 미수집 시 섹션 미노출 → T1
- place 11 외부링크 관광지명 단독 사용 → T1(FE) + T2(수집 쿼리 검증)
- place 12 SEO/AEO 상위 노출 → T1 (+ T2 데이터 보강)
- 메인 1 system_core 모바일 영역 낭비 → T4
- 메인 2 회사 이력 구분 강화 → T4
- 메인 3 GNB 오버플로/햄버거 → T10
- 메인 4 다크모드 카드 테두리 → T4
- 게임 1 서브 카테고리 칩 정리 → T3
- 게임 2 라이트 테마 칩 대비 → T3
- 게임 3 캐로셀 dedupe → T3
- 게임 4 별점 5개(반개 단위) → T3
- 게임 5 찜하기 → T9
- 게임 6 GNB/FNB 정비 + 서비스 탐색 오버레이 → T10
- 블로그 1 공간 구분 진입점 → T5
- 기타 1 오픈소스 큐레이션 → T4
- 기타 2 푸터 문구 → T10
- 기타 3 브랜딩 아이디에이션 → T8 (완료)
- 기타 4 프리미엄 코드 스니펫 → T7
- 기타 5 테크 페이지 개편 → T6
