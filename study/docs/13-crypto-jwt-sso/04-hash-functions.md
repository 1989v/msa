---
parent: 13-crypto-jwt-sso
seq: 04
title: 해시 함수 (SHA-2/3, MD vs Sponge, Length Extension)
type: deep
created: 2026-04-28
---

# 04. 해시 함수

## 핵심 정의

임의 길이 입력을 고정 길이 출력으로 변환하는 일방향 함수.

## 3대 보안 속성

1. **Pre-image resistance (사전 이미지 저항성)** — 해시 값에서 원문을 찾기 어려움
2. **2nd pre-image resistance (제2 사전 이미지 저항성)** — 주어진 입력과 같은 해시를 갖는 다른 입력 찾기 어려움
3. **Collision resistance (충돌 저항성)** — 같은 해시를 갖는 두 입력 쌍 찾기 어려움

**생일 역설(Birthday Paradox)** — n비트 해시의 충돌은 2^(n/2)에서 발견. SHA-256의 충돌 저항성은 128비트 수준.

## SHA 패밀리

| 함수 | 출력 | 구조 | 평가 |
|---|---|---|---|
| MD5 | 128b | MD | **깨짐** (충돌 가능) |
| SHA-1 | 160b | MD | **깨짐** (2017 SHAttered) |
| SHA-256 / 512 | 256/512b | Merkle-Damgård | 현재 표준 |
| SHA-3 (Keccak) | 가변 | Sponge | 백업 표준 |
| BLAKE2 / BLAKE3 | 가변 | HAIFA / Tree | 빠름, libsodium 등에서 사용 |

## Merkle-Damgård vs Sponge

### Merkle-Damgård (MD) — SHA-2가 사용
- 입력을 블록으로 자르고, 각 블록을 압축 함수에 순차적으로 통과
- IV → C(IV, M1) → C(_, M2) → ... → 최종 출력
- **Length extension attack** 취약 (구조적 약점)

### Sponge — SHA-3 사용
- 내부 상태를 흡수(absorb) 단계에서 입력으로 갱신, 짜내기(squeeze) 단계에서 출력 생성
- 가변 길이 출력 자연스럽게 지원 (SHAKE128, SHAKE256)
- Length extension에 면역

## Length Extension Attack

**핵심** — `H(K || M)`을 MAC으로 쓰면, 공격자가 `K`를 몰라도 `H(K || M || padding || M')`을 계산할 수 있다.

**메커니즘** — Merkle-Damgård 해시는 마지막 내부 상태가 곧 출력값. 공격자는 `H(K || M)`을 새로운 IV로 사용해 이어서 압축할 수 있음.

### 방어
- HMAC (Hash-based Message Authentication Code, 해시 기반 메시지 인증 코드) 사용 (`HMAC(K, M) = H((K ⊕ opad) || H((K ⊕ ipad) || M))`) — 외부 해시가 한 번 더 막음
- 또는 SHA-3, BLAKE2 (length extension 면역)
- 또는 SHA-512/256, SHA-512/224 같은 truncated 변형

### 현실 사례
Flickr API (2009년) 서명 검증이 length extension에 취약했음.

## 핵심 포인트

- 일반 데이터 무결성: SHA-256
- MAC 필요: HMAC-SHA256 (단순 `H(K||M)` 금지)
- 비밀번호: 일반 해시는 절대 금지 → [05-password-hashing.md](05-password-hashing.md)
- SHA-3는 SHA-2 대체용으로 표준화됐지만, 실무에서 SHA-2가 깨진 게 아니라 SHA-2가 여전히 주력

## 다음 학습

- [05-password-hashing.md](05-password-hashing.md) — 비밀번호 해싱
- [06-hmac.md](06-hmac.md) — HMAC
