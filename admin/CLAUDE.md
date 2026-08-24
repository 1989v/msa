<!-- source: admin/frontend/src -->

# Admin (백오피스 — FE 전용)

`/admin/*` 로 서빙되는 **프론트엔드 전용** 디렉토리다. **백엔드 모듈이 없다** —
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
