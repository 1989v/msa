# Portfolio — Seed DML 가이드

idea #17 ([PRD](../../ideabank/docs/17-portfolio-showcase.md)) MVP 흐름: 카드는 사용자가 DML 로 직접 적재한다.
어드민 CRUD 화면은 Phase 2 — MVP 에선 본 가이드 대로 INSERT 문을 실행한다.

## 흐름 (Claude-as-Importer)

1. `~/IdeaProjects/ai` 의 `plugins/portfolio` 스킬로 `docs/portfolio/` 에 markdown 산출
2. markdown 을 Claude 대화창에 붙여넣고 **"포트폴리오 카드 DML 로 변환해줘"** 라고 요청
3. Claude 가:
   - 회사 도메인 워딩을 일반 컨벤션 용어로 치환 (사용자 확인)
   - 시크릿/토큰/이메일 패턴 제거
   - `INSERT INTO portfolio_card ...` DML 생성
4. 사용자가 MySQL 에 직접 실행
5. `/portfolio` 에서 즉시 확인

## 테이블 스키마

```sql
-- Flyway migration: V5__portfolio_card.sql
portfolio_card (
    id BIGINT PK AUTO_INCREMENT,
    title VARCHAR(200) NOT NULL,
    summary VARCHAR(500),
    body MEDIUMTEXT NOT NULL,
    period_start DATE,
    period_end DATE,          -- NULL = 진행 중
    role VARCHAR(100),
    impact INT NOT NULL DEFAULT 5,    -- 1~10
    visibility VARCHAR(16) NOT NULL DEFAULT 'PUBLIC',   -- PUBLIC | PRIVATE
    tags JSON,                -- ["Kotlin", "Spring", "Kafka"]
    keywords JSON,            -- ["분산락", "saga-pattern"]
    created_at DATETIME,
    updated_at DATETIME
)
```

## 적재 전 필수 — 클라이언트 charset

MySQL 서버는 `utf8mb4` 지만 client 기본값이 `latin1` 인 환경이 많아, 그대로 한국어 INSERT 시 mojibake 발생.
반드시 `--default-character-set=utf8mb4` 옵션 또는 세션 첫 줄에 `SET NAMES utf8mb4;` 추가.

```bash
# k3d MySQL pod 으로 적재할 때
kubectl exec -i -n commerce mysql-0 -- mysql \
  --default-character-set=utf8mb4 \
  -ucode_dictionary_user -pcode_dictionary_password code_dictionary_db <<'SQL'
SET NAMES utf8mb4;
INSERT INTO portfolio_card (...) VALUES (...);
SQL
```

## INSERT 예시

```sql
INSERT INTO portfolio_card
    (title, summary, body, period_start, period_end, role, impact, visibility, tags, keywords)
VALUES (
    'Kafka 기반 주문-결제 Saga 도입',
    '결제 이탈 1.4% → 0.2% 로 감축. Outbox + DLQ 안전 망 구성.',
    '## 배경
주문-결제 동기 호출이 결제 게이트웨이 응답 지연에 그대로 노출되어 이탈률이 1.4% 까지 올라옴.

## 접근
- Saga(orchestration) 전환 — 주문 상태기계를 별도 정의
- Transactional Outbox + Kafka 이벤트로 결제 트리거
- 멱등 consumer + DLQ 로 재처리 안전망

## 결과
- 결제 이탈률 1.4% → 0.2%
- 응답 P95 1.8s → 320ms
- 운영 6개월간 결제 중복 발생 0건',
    '2025-09-01',
    '2026-02-28',
    'Backend Lead',
    9,
    'PUBLIC',
    JSON_ARRAY('Kotlin', 'Spring', 'Kafka', 'MySQL'),
    JSON_ARRAY('saga-pattern', 'transactional-outbox', 'idempotent-consumer', 'dlq')
);
```

## 컬럼별 입력 가이드

| 컬럼 | 가이드 |
|------|--------|
| `title` | 카드 제목 — 한 줄에 요약 가능한 액션 또는 결과 (예: "X 도입", "Y 성능 N% 개선") |
| `summary` | 카드 리스트에서 보일 한 줄 요약 (500자 이내). 핵심 임팩트를 숫자로 |
| `body` | 본문. 배경/접근/결과 3섹션 권장. markdown 그대로 저장됨 (FE 는 `white-space: pre-wrap`) |
| `period_start` / `period_end` | `YYYY-MM-DD`. `period_end = NULL` 이면 "진행 중" 표시 |
| `role` | 본인의 역할 (`Backend Lead`, `Tech Owner` 등) |
| `impact` | 1~10. 디폴트는 5. 카드끼리 비교 가능한 상대 점수 |
| `visibility` | `PUBLIC` (외부 노출) 또는 `PRIVATE` (현재 MVP 에선 노출 안 됨, Phase 2 어드민 보호용) |
| `tags` | 기술 스택 — FE 필터 chip 에 사용됨. `JSON_ARRAY(...)` 로 입력 |
| `keywords` | 검색 보조 키워드 — 추후 검색 인덱싱 시 사용 (현재는 저장만) |

## 마스킹 체크리스트 (수동)

DML 실행 전 사용자가 직접 확인:

- [ ] 사내 시스템명·서비스명·도메인 워딩이 일반 용어로 바뀌었는가
- [ ] 사내 동료/팀명 미노출
- [ ] 시크릿/토큰/내부 URL/이메일 미포함
- [ ] 회사를 특정하게 만드는 고유 지표 (예: "X일까지 N건") 일반화

Phase 2 에서 `secret-glossary.yml` 기반 자동 마스킹 도입 예정 (private submodule).

## 운영

- 카드 수정: `UPDATE portfolio_card SET ... WHERE id = N` — 어드민 CRUD 는 Phase 2
- 카드 숨김: `UPDATE portfolio_card SET visibility = 'PRIVATE' WHERE id = N`
- 카드 삭제: `DELETE FROM portfolio_card WHERE id = N`

## 확인

```bash
# DML 실행 후 API 확인
curl http://localhost:8089/api/v1/portfolio/cards

# FE
open http://localhost/portfolio
```
