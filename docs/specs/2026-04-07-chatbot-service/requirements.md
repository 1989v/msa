# Requirements — Chatbot Service

## Overview

MSA Commerce Platform의 코드, 정책, 아키텍처에 대한 질문에 답변하는 대화형 AI 챗봇 서비스.
Claude API(Sonnet)를 활용하며, 채널 추상화를 통해 Slack/웹 UI/향후 채널을 지원한다.

## Stakeholders

- **내부 개발자**: 아키텍처, 컨벤션, ADR, 운영 가이드 질의
- **외부 사용자**: public repo 기준 정책/구조 질의 (권한 필요)

---

## Functional Requirements

### FR-1: 대화형 질의응답

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-1.1 | 사용자 질문에 대해 프로젝트 문서 기반으로 답변 생성 | P0 |
| FR-1.2 | 멀티턴 대화 지원 (이전 맥락 유지) | P0 |
| FR-1.3 | 답변 불가 시 명확히 "모르겠다" 응답 | P0 |
| FR-1.4 | 코드베이스 탐색 기반 답변 (2차 확장) | P2 |

### FR-2: 지식 소스 관리

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-2.1 | 정적 문서 인덱싱 (docs/, ADR, CLAUDE.md) | P0 |
| FR-2.2 | 문서 변경 시 인덱스 갱신 | P1 |
| FR-2.3 | 코드베이스 탐색 데이터소스 (GitHub MCP 등) | P2 |

### FR-3: 채널 연동

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-3.1 | 채널 추상화 포트/어댑터 설계 | P0 |
| FR-3.2 | Slack 채널 어댑터 (멘션, 스레드 대화) | P0 |
| FR-3.3 | 웹 채팅 UI 어댑터 (REST/WebSocket) | P0 |
| FR-3.4 | 추가 채널 확장 가능 구조 | P1 |

### FR-4: 대화 이력

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-4.1 | 대화 세션 생성/관리 | P0 |
| FR-4.2 | 메시지 이력 DB 저장 (MySQL) | P0 |
| FR-4.3 | 세션별 컨텍스트 윈도우 관리 (최근 N개 메시지) | P0 |

### FR-5: 사용자 인증/권한

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-5.1 | 권한 획득한 사용자만 접근 허용 | P0 |
| FR-5.2 | 내부/외부 사용자 구분 | P0 |
| FR-5.3 | 외부 사용자는 public repo 정보만 답변 | P0 |
| FR-5.4 | auth 서비스 연동 (JWT 기반) | P1 |

---

## Non-Functional Requirements

| ID | 요구사항 | 목표 |
|----|---------|------|
| NFR-1 | 응답 시간 | 첫 토큰 3초 이내, 전체 응답 30초 이내 |
| NFR-2 | 동시 요청 처리 | Semaphore 기반 동시성 제어 (기본 5) |
| NFR-3 | 비용 관리 | 요청당 max budget 설정, 월간 비용 모니터링 |
| NFR-4 | 가용성 | Eureka 등록, 헬스체크 엔드포인트 |
| NFR-5 | 보안 | API Key 외부 노출 방지, 입력 sanitization |

---

## Out of Scope (1차)

- 파일 업로드/이미지 분석
- 코드 생성/수정 기능
- 실시간 서비스 상태 모니터링
- 다국어 지원 (한국어 우선)
- 관리자 대시보드

---

## Constraints

- MSA 프로젝트 Clean Architecture 준수 (chatbot:domain, chatbot:app)
- 기존 서비스와 DB 공유 금지
- Claude Sonnet 모델 기본 사용
- Kotlin 2.2.21 + Spring Boot 4.0.4 + Java 25
