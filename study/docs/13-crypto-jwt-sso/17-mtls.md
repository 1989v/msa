---
parent: 13-crypto-jwt-sso
seq: 17
title: mTLS + SPIFFE / SPIRE
type: deep
created: 2026-04-28
---

# 17. mTLS

## 일반 TLS vs mTLS

- **일반 TLS (Transport Layer Security, 전송 계층 보안)** — 클라이언트만 서버 인증
- **mTLS (mutual TLS, 양방향 TLS)** — 클라이언트도 인증서 제시, 서버가 검증

## 사용 시나리오

1. **서비스 메시 내부 통신** (Istio, Linkerd) — Pod 간 자동 mTLS, identity 기반 인가
2. **B2B API** — 파트너사 클라이언트 인증
3. **금융/규제** — PSD2 OBIE, FAPI 같은 강한 인증
4. **IoT** — 디바이스별 인증서 + lifecycle 관리

## SPIFFE / SPIRE

- **SPIFFE** — workload identity 표준 (SVID = SPIFFE Verifiable Identity Document)
- **SVID** 형식: X.509 또는 JWT
- **SPIRE** — SPIFFE 구현 (서버 + 에이전트)
- 서비스 메시(Istio Citadel, Linkerd)가 내부적으로 SPIFFE 사용

### SPIFFE ID 예
```
spiffe://example.com/ns/default/sa/payment-service
```

## Short-lived Certificates

- 인증서 만료를 시간 단위로 (1시간 등) → revocation 의존도 ↓
- 자동 회전 필수 (cert-manager, SPIRE 자동 발급)

## mTLS 운영 토픽

### 인증서 회전
- cert-manager (K8s) + ACME (Let's Encrypt 등) — 보통 90일 주기
- SPIRE — 시간 단위 short-lived
- 만료 30일 전 자동 갱신, grace period 확보

### 신뢰 모델
- 사내 CA 운영 (Vault PKI / 사내 root)
- 외부 CA (Let's Encrypt, AWS ACM Private CA, GCP CAS)

### Pod identity
- K8s ServiceAccount + workload identity (IRSA, Workload Identity)
- SPIFFE 통합으로 cross-cluster identity

## JWT vs mTLS 비교

| 측면 | JWT | mTLS |
|---|---|---|
| 신원 단위 | 사용자 | Workload (Pod) |
| 탈취 위험 | 토큰 탈취 가능 | 인증서 + 개인키 탈취 어려움 |
| 회전 비용 | 짧은 TTL + Refresh | 자동 cert rotation 필요 |
| 인증 시점 | API 단계 | TCP 연결 단계 |
| 운영 복잡도 | 보통 | 높음 (CA + cert lifecycle) |

**현실** — 외부 사용자 인증은 JWT, 서비스 간 내부 통신은 mTLS (서비스 메시) 조합이 일반적.

## 핵심 포인트

- 일반 TLS는 클라이언트가 서버를 인증할 뿐, 서버는 클라이언트를 모름
- mTLS는 서비스 메시 + B2B API + 금융/IoT 같은 강한 인증 시나리오
- 인증서 lifecycle 자동화가 필수 — cert-manager / SPIRE
- 서비스 메시 도입 시 자동 mTLS는 "공짜로 따라온다" (Istio mTLS strict 모드)

## 다음 학습

- [18-code-refactoring.md](18-code-refactoring.md) — 코드 리팩터링 실습
- 추가 학습: K8s 11번 주제 — 서비스 메시 mTLS 자연스러운 분기
