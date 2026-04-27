---
parent: 13-crypto-jwt-sso
seq: 06
title: HMAC
type: deep
created: 2026-04-28
---

# 06. HMAC

## 핵심 정의

해시 함수 + 비밀키로 만드는 메시지 인증 코드 (Message Authentication Code).
- "이 메시지는 키 가진 사람만 만들 수 있고, 변조되지 않았다"를 증명

## 왜 단순 `H(K || M)`이 아닌가

1. Length extension 공격 취약 ([04-hash-functions.md](04-hash-functions.md) 참조)
2. HMAC은 이중 해시 구조로 그 취약점 차단:
   ```
   HMAC(K, M) = H( (K ⊕ opad) || H( (K ⊕ ipad) || M ) )
   opad = 0x5C 반복, ipad = 0x36 반복
   ```

## 사용 시나리오

- API 요청 서명 (AWS Signature V4도 HMAC-SHA256 기반)
- JWT HS256/HS384/HS512 알고리즘
- TLS PRF / Cipher Suite의 MAC 부분 (TLS 1.2 GCM 이전)
- 토큰/세션 변조 검출
- 웹훅(webhook) 서명 검증

## 키 관리

- **키 길이** — 해시 출력 길이 이상 권장 (HMAC-SHA256: 32바이트+)
- 짧은 키는 자동으로 해시 한 번 적용해서 길이 맞춤 (RFC 2104)
- 너무 긴 키도 마찬가지로 해시 적용

## 코드 연결 — `JwtUtil.kt`

`JwtUtil.kt`의 `Keys.hmacShaKeyFor(secret.bytes)`가 정확히 HMAC-SHA256 키.

```kotlin
private val key: SecretKey by lazy {
    Keys.hmacShaKeyFor(props.secret.toByteArray(Charsets.UTF_8))
}
```

비밀키가 32바이트 미만이면 JJWT가 `WeakKeyException`을 던진다. 안전한 패턴.

## 핵심 포인트

- HMAC은 "암호화"가 아니다 — **무결성과 인증만** 제공 (메시지 자체는 평문)
- 비밀번호 해싱과 혼동 금지 — HMAC은 빠른 함수, 비밀번호엔 argon2id 사용
- 단방향 인증 — 양쪽 모두 같은 키 보유 필요 (마이크로서비스 내부 적합)
- 비대칭 시나리오엔 디지털 서명 (RSA-PSS, ECDSA, Ed25519)

## 다음 학습

- [07-asymmetric-signing.md](07-asymmetric-signing.md) — 비대칭 서명
- [08-jwt-structure.md](08-jwt-structure.md) — JWT HS256
