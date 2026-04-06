# CLAUDE.md — Commerce Platform (MSA)

**On conflict**: CLAUDE.md wins over plugin/skill defaults.

---

## Commands

```bash
./gradlew build                                            # 전체 빌드
./gradlew :{service}:app:build                             # 단일 서비스 빌드
./gradlew :{service}:domain:test                           # 도메인 테스트 (Spring context 없음)
docker compose -f docker/docker-compose.infra.yml up -d    # 로컬 인프라
```

---

## Architecture (Clean Architecture + MSA)

- 의존성 방향: 항상 안쪽 (Domain ← Application ← Infrastructure/Presentation)
- Domain 레이어: 프레임워크 의존 금지
- 서비스 간 DB 공유 금지, cross-reference 금지 (API 호출만)
- 구조 변경 시 ADR 필수 → `docs/adr/`
- 상세 → `docs/architecture/00.clean-architecture.md`

---

## Key Conventions (상세는 docs/ 참조)

- **모듈 구조 & 패키지** → `docs/architecture/module-structure.md`
- **테스트**: Kotest BehaviorSpec + MockK → `docs/standards/test-rules.md`
- **Kafka 토픽** → `docs/architecture/kafka-convention.md`
- **API 응답 포맷**: `ApiResponse<T>` → `docs/architecture/api-response.md`
- **Common 기능 로드**: `@EnableCommonFeatures` → `docs/architecture/common-features.md`
- **백업/복구**: XtraBackup + Binlog PITR → `docker/backup/README.md`

---

## Agent Behavior

- 리스크 분류 & 검증 루프 → `agent-os/standards/agent-behavior/confirmation.md`
- 구현 후 리뷰 → `agent-os/standards/agent-behavior/self-review.md`
- 문서 동기화 → `agent-os/standards/agent-behavior/doc-gardening.md`
- 탐색 우선, 증거 기반 → `agent-os/standards/agent-behavior/core-rules.md`
- 컴팩션 복구 → `agent-os/standards/agent-behavior/compaction.md`
- ADR 검토 후 구현, 충돌 시 중단 후 확인 요청

---

## Skill Routing Priority

신규 기능 개발 또는 작업 요청 시 (예: "새 기능 만들어줘", "기능 추가", "서비스 구현"):

1. **`/hns:feat` 파이프라인 우선** — shape → write → review → tasks → implement → validate
   - 병렬 분할 가능하면 Claude Teams + hns 조합
   - 패턴 A: hns 플래닝 → 독립 태스크를 Teams 병렬 디스패치
   - 패턴 B: 독립 작업 단위가 명확하면 Teams 분할 → 각 에이전트가 hns 수행
2. **hns 단독** — 병렬 불가능한 단일 기능
3. **superpowers 보조** — hns 부적합 시(아이디어 탐색, 비개발 논의)

> 이 규칙은 superpowers Skill Priority보다 우선합니다.

**생산물 위치 규칙**: superpowers 스킬의 기본 출력 경로(`docs/superpowers/specs/`)를 사용하지 않는다. 모든 생산물은 프로젝트 docs/ 구조에 맞게 배치:
- PRD / Spec → `docs/specs/`
- Plan → `docs/plans/`
- ADR → `docs/adr/`

---

## Navigation

| 영역 | 경로 |
|------|------|
| Architecture docs | `docs/architecture/` |
| ADRs | `docs/adr/` |
| Feature specs | `docs/specs/` |
| Standards | `agent-os/standards/` |
| Product context | `agent-os/product/` |

---

## Local Dev

- 서비스별 독립 실행 (Eureka + 해당 DB만 필요)
- 환경변수: `docker/.env` (gitignore, `.env.example` 제공)
- Profile: `SPRING_PROFILES_ACTIVE=docker`

## Backup & Disaster Recovery

- 백업 스크립트: `docker/backup/scripts/` (Shell + Cron 기반)
- 스토리지 플러그인: `docker/backup/storage-providers/` (S3/GCS/Local 교체 가능)
- 보관 정책: 풀백업 7일, binlog 2일
- 자동 페일오버: `docker/backup/ha/` (Orchestrator + ProxySQL, 비활성 상태)
- 상세 가이드: `docker/backup/README.md`
