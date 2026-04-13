# 8. AI Engineering

> Agent OS 하네스, 아이디어→PRD→구현 파이프라인, 스킬 시스템, 벤치마크

---

## Agent OS — AI 에이전트 행동 표준

AI 코드 에이전트의 품질과 안전성을 보장하는 하네스 프레임워크.

```
agent-os/
├── config.yml                    # 모드 설정 (quality | efficient)
├── product/
│   ├── mission.md                # 프로젝트 미션 정의
│   └── tech-stack.md             # 기술 스택 명세
└── standards/
    ├── agent-behavior/
    │   ├── core-rules.md         # 탐색 우선, 증거 기반
    │   ├── confirmation.md       # L1/L2/L3 리스크 분류
    │   ├── self-review.md        # 구현 후 자가 리뷰
    │   ├── doc-gardening.md      # 문서 자동 동기화
    │   ├── session.md            # 세션 라이프사이클
    │   └── compaction.md         # 컨텍스트 윈도우 관리
    └── global/
        └── conventions.md        # 코드 & 네이밍 규칙
```

---

## 리스크 분류 체계

| Level | 위험도 | 예시 | 확인 방식 |
|-------|--------|------|----------|
| **L1** | 저위험 (자동 진행) | 파일 읽기, 테스트 실행 | 없음 |
| **L2** | 중위험 (자동 + 검증) | 코드 수정, 빌드 | Ralph Loop (최대 3회 재시도) |
| **L3** | 고위험 (사용자 확인 필수) | DB 변경, 배포, 삭제 | 명시적 승인 |

**Ralph Loop**: L2 작업 실패 시 자동 재시도 (max 3), 3회 초과 시 사용자에게 에스컬레이션.

---

## Idea → PRD → Implementation Pipeline

아이디어를 체계적으로 발전시키는 3단계 파이프라인.

```
tempidea.md (날 것 아이디어)
    ↓ /ideabank-init
ideabank/docs/{id}-{name}.md (1차 PRD)
    ↓ /ideabank-bs (브레인스토밍)
PRD 보완 (status: refined → ready)
    ↓ /ideabank-impl
실제 서비스 구현 (코드 + 테스트 + 배포 매니페스트)
```

**실적**:
- 10개 아이디어 중 2개 구현 완료 (code-dictionary, gifticon)
- 나머지 8개 draft/refined 상태로 관리 중

**코드 위치**: `ideabank/` · `ideabank/docs/`

---

## 스킬 시스템 (Claude Code)

반복 작업을 스킬로 패키징하여 `/command` 형태로 실행.

### 개발 파이프라인 스킬

| 스킬 | 용도 |
|------|------|
| `/hns:start` | 통합 진입점 — 질의/피처 자동 라우팅 |
| `/ideabank-init` | tempidea.md → 1차 PRD 생성 |
| `/ideabank-bs` | PRD 브레인스토밍 (채팅형 보완) |
| `/ideabank-impl` | PRD → 서비스 구현 |
| `/reindex` | 코드베이스 IT 개념 자동 추출 → code-dictionary 색인 |
| `/gcm` | 자동 커밋 메시지 생성 + 푸시 |
| `/run-services` | 전체/선택 서비스 실행 |

### 품질 관리 스킬

| 스킬 | 용도 |
|------|------|
| `/hns:verify` | 표준 → lint → build → test 순차 검증 |
| `/hns:validate` | 문서/코드 하네스 규칙 검증 |
| `/hns:gc` | Dead code, doc drift, 규칙 위반 탐지 |
| `/hns:audit` | 외부 벤치마크 대비 하네스 감사 |
| `/hns:wrapup` | 세션 회고 (what-went-well, blocked, change) |

### 디버깅 스킬

| 스킬 | 용도 |
|------|------|
| `/ai-debugger:curl-gen` | 자연어 → curl 명령 생성 |
| `/ai-debugger:io-setup` | IO 캡처 인터셉터 주입 |
| `/ai-debugger:log-query` | Redis IO 로그 조회 (2-phase) |

---

## HNS 피처 파이프라인

`/hns:start`로 진입하면 요청을 분석하여 자동으로 라우팅.

```
사용자 요청
    ↓ /hns:start
    ├─ 코드베이스 질의 → 탐색/분석/설명으로 즉시 처리
    └─ 피처 개발 요청 → 파이프라인 진입
                          ↓
                    shape (요구사항 정리)
                          ↓
                    write (구현 계획)
                          ↓
                    review (코드 리뷰)
                          ↓
                    tasks (작업 분할)
                          ↓
                    implement (구현)
                          ↓
                    validate (검증)
```

---

## 벤치마크 & 비교 분석

외부 AI 하네스와의 비교를 통해 지속적으로 개선.

| 벤치마크 | 파일 | 핵심 인사이트 |
|---------|------|-------------|
| HNS Review | `docs/benchmarks/2026-04-06-hns-review.md` | 하네스 스캐폴딩 평가 |
| OpenAI Harness | `docs/benchmarks/2026-04-08-openai-harness-engineering.md` | OpenAI 하네스 패턴 비교 |
| gstack (YC) | `docs/benchmarks/2026-04-09-gstack.md` | Garry Tan YC AI Factory 비교 |

**우리가 가진 것 (gstack에 없는)**:
- L1/L2/L3 리스크 분류 + 자동 enforcement
- ADR 기반 아키텍처 거버넌스 (hook으로 위반 탐지)
- 컨텍스트 윈도우 컴팩션 관리
- 서비스별 컨텍스트 파일 (per-service CLAUDE.md)
- 계층적 표준 (agent-os/)

**gstack이 가진 것 (우리에게 필요한)**:
- P1: Persistent Learning System (JSONL + confidence scoring)
- P1: Security Audit Skill (OWASP + STRIDE)
- P2: Specialist sub-review dispatch
- P2: Ship/PR automation

---

## AI 하네스와 코드 품질의 연결

```
Agent OS Standards ──→ 스킬 시스템 ──→ 코드 생성/수정
        │                                    │
        ↓                                    ↓
   ADR 검토 자동화            Kotest/build 자동 검증
   문서 동기화 강제            리뷰 체크포인트
   리스크 분류 적용            커밋 전 self-review
```

---

*Code references: `agent-os/` · `ideabank/` · `docs/benchmarks/` · `.claude/` (skill definitions)*
