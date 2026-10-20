# Review provenance

아래 기존 리뷰는 최초 공유 작업 트리 구현에 대한 기록이며 최신 배포판의 설계는 spec.md가 우선한다.
최신 remote 호환 배포판은 부모가 별도 정적 검토했으며 기존 API/코퍼스/attraction hybrid 보존에서 blocker가 없다고 보고했다.
격리 테스트·빌드 증거는 operations.md/context/progress.md를 따른다.

# 설계 검토

2026-10-21 독립 컨텍스트 검토: SHIP (설계).

검토 기준: 사용자 승인 범위, ADR-0090 최신 개정, AGENTS.md 및 agent-behavior.
구현 승인 범위를 변경할 설계 blocker는 발견하지 않았다.

구현 검토에서 확인할 사항:

1. 로컬 OpenAPI 계약과 실제 입력 제한/오류 응답 일치.
2. 자동완성은 벡터 호출 없음. 전체 검색은 모델 호환성 및 임베딩 장애 fallback.
3. 이름 일치·선택 안정성·IME·역순 응답과 직접 목적지 연결.
4. 실패한 재색인은 기존 alias 보존. 비공개 콘텐츠 색인 제외.
5. 임베딩 캐시 미적중 P99 500ms는 단위 테스트로 입증할 수 없으므로 실측 또는 검증 공백 기록.

부모 검증: Node `js-yaml`로 contracts/openapi.yaml 파싱 성공:
`OpenAPI YAML parse: PASS (2 endpoints)`.
이는 문법 검사이며 전체 OpenAPI 의미 검사나 서버 동작 검증은 아니다.

## 백엔드 1차 코드 리뷰

판정: REVISE. 부모가 아래 세 발견을 모두 채택해 구현 담당자에게 수정 요청했다.

- P1: 기존 세대 cleanup은 활성/진행 중 인덱스를 제외하지 않아 동시 재색인 시 활성 인덱스를 삭제할 수 있음.
- P2: 게임 수집 `sort=newest`는 지원되지 않아 TRENDING으로 해석됨. 공개 API의 `sort=new`를 사용해야 함.
- P2: 이름 keyword 필드의 대소문자 정규화가 없어 `mar`로 `Marine Command` 접두 검색 불가.

검토자는 테스트 실행·코드 수정을 하지 않았다. 수정 후 독립 재검토 예정.

## 수정 후 독립 코드 리뷰

판정: SHIP (코드 검토). 세 발견의 수정 확인:

- 게임 수집 `sort=new`.
- keyword lowercase normalizer와 Locale.ROOT 질의 정규화 일치.
- 통합 인덱스는 삭제 없이 atomic alias 교체. 기존 cleanup의 활성 인덱스 삭제 경로 제거.

FE 검토: 오래된 응답 무효화, 로딩 중 Enter 보호, IME, URL 복원, 로컬/운영 목적지,
음료 필터 전달, 두 진입 경로, 기존 셸 제외, manifest·MIME 및 nginx whitelist 확인.
새로운 구체적 blocker 없음.

독립 리뷰는 정적 코드 검토이며 테스트·브라우저·운영 엔진 검증을 대신하지 않는다.

## 배치·활성화 설정 추가 검토

추가 리뷰에서 `opensearch.unified.hybrid-enabled`와 소비자의
`search.unified.hybrid-enabled` 불일치를 발견해 수정 요청했다.
부모가 실제 YAML의 `search.unified.hybrid-enabled` 위치로 수정된 것을 확인했다.
설정 회귀 검사 결과는 구현 검증 기록을 따른다.

CronJob은 `suspend: true`, `concurrencyPolicy: Forbid`이며 job 이름·content:8097 원천 주소·
기존 Harrier 모델 스탬프가 일치한다. 운영 자동 활성화는 하지 않았다.
