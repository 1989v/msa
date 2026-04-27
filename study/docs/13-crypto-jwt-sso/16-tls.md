---
parent: 13-crypto-jwt-sso
seq: 16
title: TLS 1.2 / 1.3 + 인증서 + SNI / ALPN
type: deep
created: 2026-04-28
---

# 16. TLS 1.2 / 1.3

## TLS 1.2 핸드셰이크

```
Client                                    Server
  │  ClientHello                              │
  │  (ver, random_C, cipher_suites, ext)      │
  │ ─────────────────────────────────────►   │
  │                                           │
  │  ServerHello                              │
  │  (ver, random_S, chosen_suite, ext)       │
  │  Certificate (+ chain)                    │
  │  ServerKeyExchange (DHE/ECDHE: g^b mod p) │
  │  ServerHelloDone                          │
  │ ◄─────────────────────────────────────   │
  │                                           │
  │  ClientKeyExchange (g^a mod p)            │
  │  [pre-master 계산: g^(ab)]                 │
  │  ChangeCipherSpec                         │
  │  Finished (encrypted)                     │
  │ ─────────────────────────────────────►   │
  │                                           │
  │                           ChangeCipherSpec│
  │                                  Finished │
  │ ◄─────────────────────────────────────   │
  │                                           │
  │  Application Data (AES-GCM/ChaCha20)      │
  │ ◄────────────────────────────────────►   │
```

### 핵심 단계
1. **ClientHello / ServerHello** — 버전 협상, cipher suite 선택, random 교환
2. **Certificate 검증** — 체인 + 만료 + revocation
3. **Key Exchange (DHE/ECDHE)** — Forward Secrecy 보장 (master secret이 서버 개인키로부터 도출되지 않음)
4. **Finished** — 핸드셰이크 메시지 전체에 대한 MAC — 다운그레이드/MITM 방지

### Cipher Suite (TLS 1.2)
형식: `TLS_KX_AU_WITH_ENC_MAC`
- `TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384`
  - **ECDHE** — 키 교환 (Forward Secrecy)
  - **RSA** — 서버 인증 (인증서)
  - **AES_256_GCM** — 대칭 암호 + AEAD
  - **SHA384** — PRF / HKDF 베이스

### 비추천 조합
- `_RC4_*` (RC4 깨짐)
- `_3DES_*` (Sweet32, 64b 블록)
- `_RSA_*` (RSA 키 교환, PFS 없음)
- `_CBC_*` (padding oracle 위험, 가능하면 GCM)

---

## TLS 1.3 (RFC 8446)

### 핵심 변경
- **1-RTT** (이전 2-RTT)
  ```
  Client                                Server
    ClientHello + key_share  ───────►
                              ◄─────── ServerHello + key_share
                                       Certificate + Finished (encrypted)
    Finished + Application Data ────►
  ```
- **Forward Secrecy 의무화** — RSA 키 교환, static DH 제거
- **AEAD 의무화** — CBC, RC4 제거. GCM/ChaCha20-Poly1305만
- **인증된 핸드셰이크** — ServerHello 이후 모두 암호화
- **Cipher Suite 단순화** — `TLS_AES_256_GCM_SHA384` 형식 (KX/AU 분리)

### 0-RTT (Early Data)
- 두 번째 이후 연결: ClientHello에 Application Data 동봉
- **Replay 위험** — 공격자가 0-RTT 데이터를 재전송하면 멱등성 없는 요청은 두 번 실행됨
- 대응: GET 같은 idempotent 요청만 허용, 또는 0-RTT 비활성

### Pre-Shared Key (PSK)
- 이전 세션 키를 재사용해 1-RTT에서도 핸드셰이크 단축
- 0-RTT의 기반

### HelloRetryRequest
- 클라이언트가 보낸 key_share가 서버 선호 그룹과 안 맞으면 재시도

---

## 인증서 체인 + Revocation

### 체인
```
Root CA (자체 서명, 트러스트 스토어에 사전 설치)
  └── Intermediate CA (Root가 서명)
       └── End-entity Certificate (Intermediate가 서명, 서비스용)
```

검증 시 Intermediate부터 Root까지 모두 서명 확인 + 만료 + Key Usage 확인.

### Revocation
- **CRL (Certificate Revocation List)** — CA가 발급한 폐기 목록 정기 다운로드. 큰 파일 + 지연.
- **OCSP (Online Certificate Status Protocol)** — 인증서 ID로 실시간 조회. 프라이버시 우려 (CA가 누가 어떤 사이트 보는지 앎).
- **OCSP Stapling** — 서버가 OCSP 응답을 미리 받아 TLS 핸드셰이크에 첨부. 프라이버시 + 성능.
- **Certificate Transparency (CT)** — 발급된 인증서를 공개 로그에 등록. 부정 발급 탐지.

---

## SNI / ALPN

- **SNI (Server Name Indication)** — ClientHello에 도메인명을 평문으로 보내 같은 IP의 여러 인증서 중 선택
  - 평문 노출 → **ECH (Encrypted Client Hello, RFC 9460/draft)**로 가는 중
- **ALPN (Application-Layer Protocol Negotiation)** — TLS 위 프로토콜 협상 (`h2`, `http/1.1`)

---

## 핵심 포인트

- **TLS 1.3은 PFS 강제** — 1.2에서 `_RSA_*` 키 교환은 deprecated
- **0-RTT는 idempotent 요청에만** (GET) 또는 비활성
- AEAD만 — CBC/RC4 모두 제거됨 (1.3)
- 인증서 체인 검증은 모든 단계 (만료, Key Usage, revocation)
- OCSP Stapling이 프라이버시 + 성능 면에서 우월
- ALPN으로 HTTP/2 전환

## 다음 학습

- [17-mtls.md](17-mtls.md) — 양방향 인증
