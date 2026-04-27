---
parent: 13-crypto-jwt-sso
seq: 05
title: 비밀번호 해싱 (PBKDF2 / bcrypt / scrypt / argon2id)
type: deep
created: 2026-04-28
---

# 05. 비밀번호 해싱

## 핵심 원칙

비밀번호 해싱은 일반 해시와 **요구사항이 정반대**다.
- 일반 해시: **빠를수록 좋음**
- 비밀번호 해싱: **느릴수록 좋음** (브루트포스 비용 ↑)

## SHA-256을 그대로 쓰면 안 되는 이유

1. 너무 빠르다 (GPU로 초당 수십억 번 시도 가능)
2. Salt 없으면 rainbow table 공격에 무력
3. 하드웨어 가속(ASIC)에 더 취약해짐

## Salt vs Pepper

- **Salt** — 사용자별 랜덤 값. DB에 비밀번호 해시와 함께 저장. **공개돼도 됨**.
  - 목적: 같은 비밀번호가 같은 해시가 되지 않게 함 (rainbow table 무력화)
  - 권장 길이: 16바이트 이상
- **Pepper** — 애플리케이션 전체가 공유하는 비밀값. **별도 보관 (KMS, HSM)**
  - 목적: DB만 유출됐을 때도 해시 무력화 — DB와 pepper가 같이 털려야 깰 수 있음
  - HMAC(pepper, password) 후 메인 알고리즘 적용하는 식

## KDF (Key Derivation Function) 알고리즘

### 1. PBKDF2 (RFC 2898)
- HMAC-SHA256을 N회 반복 (N: 일반적으로 600,000+ 권장 OWASP 2023)
- **단점**: GPU/ASIC 가속에 취약 (메모리 사용량 적음)
- 평가: FIPS 인증 환경에서만 사용. 그 외엔 deprecated.

### 2. bcrypt (1999)
- Blowfish 기반, **work factor (cost)** 파라미터로 반복 횟수 조절 (2^cost)
- 일반 권장: cost 12 (= 2^12 = 4096회) → 100ms 정도
- 한계: **72바이트 입력 잘림** (Blowfish 키 한계). 긴 패스프레이즈 위험.
- 메모리 사용 적음 → GPU 공격에 절대적으로 강하지는 않음

### 3. scrypt (2009)
- **메모리-하드 함수** — 시간뿐 아니라 메모리도 많이 씀
- 파라미터: N (메모리/시간), r (블록 크기), p (병렬도)
- ASIC 공격을 비싸게 만듦

### 4. argon2 (2015, Password Hashing Competition 우승)
- **현재 OWASP 권장 1순위**
- 변형:
  - **Argon2d** — GPU 공격에 강함, side-channel 취약 → 서버사이드만
  - **Argon2i** — side-channel 강함, GPU 약함 → 클라이언트 측
  - **Argon2id** — 둘의 절충, **기본 선택**
- 파라미터: m (메모리 KB), t (반복), p (병렬도)
- OWASP 권장: m=19456 (19MiB), t=2, p=1

## Work Factor 튜닝 — 100ms 룰

- 사용자가 인지 못 할 만큼은 빠르고, 공격자가 분당 시도 횟수를 충분히 제한할 만큼은 느리게
- 인증 서버 한 대에서 ~100ms 목표
- 하드웨어 발전에 따라 매년 재검토 필요

## 검증 알고리즘 비교

| 알고리즘 | 메모리-하드 | 단순 hash | 권장도 |
|---|---|---|---|
| MD5/SHA-256 직접 | ❌ | ✅ | **금지** |
| PBKDF2 | ❌ | ❌ | FIPS 환경만 |
| bcrypt | 부분 | ❌ | 무난, 레거시 호환 |
| scrypt | ✅ | ❌ | 무난 |
| **argon2id** | ✅ | ❌ | **권장** |

## 코드 연결

현 msa는 `auth` 서비스가 미구현이라 비밀번호 해싱 코드가 없다. 도입 시 argon2id 우선 검토.

JVM 라이브러리:
- argon2: `de.mkammerer:argon2-jvm`
- bcrypt: Spring Security `BCryptPasswordEncoder`

## 다음 학습

- [06-hmac.md](06-hmac.md) — HMAC (pepper 적용 시 사용)
- [15-hsm.md](15-hsm.md) — pepper 보관 시 KMS/HSM 활용
