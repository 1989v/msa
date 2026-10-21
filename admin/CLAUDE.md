<!-- source: admin/frontend/src -->

# Admin (백오피스 — FE 전용)

전용 admin 호스트의 루트(`/`)에서 서빙되는 **프론트엔드 전용** 디렉토리다. 경로 prefix 배포는 `/admin/*`를 사용한다. **백엔드 모듈이 없다** —
어드민 API 는 각 서비스가 `/api/v1/admin/**` 로 직접 제공하고, gateway 가 `ROLE_ADMIN` 으로 막는다.

## 구조

```
admin/frontend/     Vite + React (admin-fe 이미지)
```

## Commands

```bash
cd admin/frontend && npm run dev      # 로컬
cd admin/frontend && npm run build    # dist/ 산출
scripts/image-import.sh --fe          # FE 5종 docker build + 클러스터 로드
```

## Key Rules

- **백엔드를 여기 만들지 않는다.** 어드민 기능은 그 도메인을 소유한 서비스의
  `/api/v1/admin/**` 에 붙인다 (게임은 `game`, 이력서·전시는 `code-dictionary`, …).
  여기 API 를 만들면 서비스 간 DB 공유 금지 원칙이 무너진다

- **디자인 토큰을 직접 쓰지 않는다** — hex 직접 입력 금지, 루트 `DESIGN.md` 의 토큰을 참조한다
  (`docs/standards/design-md.md`). 브랜드 면(`/`·`/portfolio`·`/games` 등)과 달리
  어드민은 `docs/design/k-heritage.html` 의 적용 대상이 아니다 — **운영 도구의 밀도**가 우선이다

- **권한은 화면이 아니라 gateway 와 서비스가 막는다.** FE 에서 메뉴를 숨기는 것은 편의이지
  보안이 아니다. 역할은 `member_roles` 행에만 있다 (ADR-0078 — 어드민 부트스트랩은 제거됨)

- 게임 어드민(`/admin/games`)은 **상태 무관 조회**다 — 공개 API 로 안 보이는
  DRAFT/REVIEW/SUSPENDED 를 여기서 다룬다 (`game/CLAUDE.md`)

## Related

- 어드민 API 목록은 각 서비스 `CLAUDE.md` 의 API 표 (`game` · `code-dictionary` · `blog` · `ranking`)
- 인증/역할: `docs/adr/ADR-0078-identity-minimization.md` (auth 복구 절차는 `auth/CLAUDE.md`)

## 랭킹 데이터 운영 (ADR-0114)

전용 admin 호스트의 `/ranking/*`에 S1~S8을 제공한다. 음료 검색·페이지 간 최대 200키 선택,
원천/교정 비교, 유형 preview, 적재 이력, 필드별 충돌 검토, 복수 브랜드 공식 URL 검증,
감사/작업 단위 보상 되돌리기, 읽기 전용 주유소 진단이다. API 소유자는 ranking이며
`/api/v1/admin/ranking/**`를 content에 전달한다. 쓰기 응답 유실은 제출 전 만든 UUID로
결과 조회 후 동일 키·본문 재시도를 제공한다. 근거·사유·초안을 URL/storage에 저장하지 않는다.
가격·순위·재수집 버튼은 없다. 실제 viewport/확대·지도·운영 데이터 검수는 별도 증거가 필요하다.

랭킹 S3 경로는 `/ranking/cafe/group-corrections`, S4는 `/ranking/ingest-runs/:runId`,
S8은 `/ranking/gas/boards/:boardId`다. 검색/필터는 제출 시 적용하고 변경 시 선택을 비우며,
페이지 이동에서는 선택을 유지한다. 전체 필터 결과 선택은 서버가 반환한 최대200개 명시 키다.
409 최신 기준 재조회는 초안을 보존하고 자동 재제출하지 않는다. 후기403은 캐시된 상세·선택 폼을
모두 제거한다. 숫자·용량·100ml 초안 미리보기와 대상별 일괄/되돌리기 미리보기를 제공한다.
