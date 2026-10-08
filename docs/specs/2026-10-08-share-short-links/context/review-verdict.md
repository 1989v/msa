# 심판 판정 — 1차 리뷰 (2026-10-08)

판정자: `hns:review-verdict` (새 컨텍스트, 읽기 전용). 리뷰어 6명의 발견 52건을 중복 병합해 26건으로 정리했다.
결과: keep 21 / demote 3 / dismiss 2. BLOCK 은 C1 하나이고, 사람 판단 없이 스펙 수정으로 해소된다.

| id | 출처 | 판정 | 등급 | 반영 |
|---|---|---|---|---|
| C1 | impl-B1, sec-B1, domain-D9, usecase-U4 | keep | BLOCK | SR-6: 이력서 원장은 링크 id·시각만, 365일. ADR-0103 §5 |
| C2 | arch-A2, domain-D8, impl-R2 | keep | REVISE | SR-6: 누적 수는 별도 집계 테이블, 원자적 증가 |
| C3 | arch-A3, domain-D5, sec-R3, test-F6 | keep | REVISE | SR-4: 도메인 판정 함수 호출 |
| C4 | arch-A5, domain-D6, impl-R3 | keep | REVISE | SR-1/4: `/p` 목적지에 언어 |
| C5 | impl-R3, usecase-U1 | keep | REVISE | SR-5: 관광지 shortUrl 은 search 상세 응답 |
| C6 | impl-R1, usecase-U2 | keep | REVISE | SR-5: copyGameLink 제외 |
| C7 | sec-R1, impl-R4, domain-D7, test-F3 | keep | REVISE | SR-3: 백필·제약·충돌·롤백 |
| C8 | arch-A1 | keep | REVISE | SR-6: TM 한정자 + REQUIRES_NEW |
| C9 | arch-A4, impl-R6, test-F4/F5 | keep | REVISE | SR-6/8: 러너·컨텍스트 로드·보존 게이트 |
| C10 | sec-R6, impl-R6 | keep | REVISE | SR-6: /privacy §2 |
| C11 | sec-R2, arch-A6, impl-R6 | keep | REVISE | SR-1: origin 은 설정 상수 하나, common 헬퍼 |
| C12 | impl-R5, test-F9, usecase-U3 | keep | REVISE | SR-2/4: 디코더 경계·경로 엣지 |
| C13 | test-F1, usecase-U6, impl-R5 | keep | REVISE | test-quality: 골든 벡터, 범위 정정 |
| C14 | test-F2 | keep | REVISE | SR-8: `:common:test` 게이트 편입 |
| C15 | test-F8, usecase-U3 | keep | REVISE | SR-6: 크롤러 분류기 하나 + 실제 UA 표 |
| C16 | impl-R5, sec-R5 | keep | REVISE | SR-4: 레이트 리미터 건다 |
| C17 | sec-R4 | keep | REVISE | SR-7: `/r` 로그 규칙 |
| C18 | domain-D4, usecase-U6, test-F6 | keep | REVISE | SR-4: 비밀 게임 문장 정정 |
| C19 | usecase-U5 | keep | REVISE | SR-8: 빈 200 감수 명시 + 노출 순서 |
| C20 | test-F4/F5, usecase-U6 | keep | REVISE | test-quality: SR 추적·행 추가·계층 정정 |
| C21 | test-F7 | keep | MINOR | test-quality: 게이트웨이 판정 기준 |
| C22 | domain-D1 | demote | MINOR | 타입 이름 `ShortCode` 를 명시 |
| C23 | domain-D2 | demote | MINOR | 결과 분류를 「공개 아님」으로 |
| C24 | domain-D3 | dismiss | — | — |
| C25 | test-F10 | dismiss | — | — |
| C26 | impl-R3(status) | demote | MINOR | 변경 없음 |

메모: `privacyRetention.test.ts:18-21` 의 `RETENTION_RUNNERS` 에 기존 `BlogRetentionRunner` 도 빠져 있다. 이번 범위 밖이고, 별도로 보고한다.
