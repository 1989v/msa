---
parent: 13-crypto-jwt-sso
seq: 02
title: AES 모드 · IV · 패딩 · AEAD
type: deep
created: 2026-04-28
---

# 02. AES 사용자 관점 — 모드 / IV / 패딩 / AEAD

## AES 개요

- 2001년 NIST 표준화, 이전 DES 대체
- **블록 암호** — 16바이트(128b) 블록 단위 처리
- 키 길이: 128 / 192 / 256-bit (라운드 수 10/12/14)

## 블록 암호 vs 스트림 암호

- **블록**: 고정 크기 블록 단위 변환 (AES, DES). 패딩 필요할 수 있음
- **스트림**: 비트/바이트 단위 XOR (ChaCha20, RC4 deprecated). 패딩 불필요
- AES도 CTR/GCM 모드를 쓰면 사실상 스트림 암호처럼 동작

## 운영 모드 (Mode of Operation)

| 모드 | 핵심 | 병렬화 | 무결성 | 평가 |
|---|---|---|---|---|
| **ECB** | 블록 단위 독립 암호화 | 가능 | ❌ | **절대 사용 금지** |
| **CBC** | 이전 ciphertext와 XOR 후 암호화 | 암호화 ❌ / 복호화 ✅ | ❌ | 레거시, padding oracle 위험 |
| **CTR** | 카운터를 암호화한 키스트림과 XOR | ✅✅ | ❌ | 빠르나 무결성 별도 필요 |
| **GCM** | CTR + GMAC 인증 태그 | ✅ | ✅ | **현재 표준** |

**ECB는 왜 쓰면 안 되는가** — 같은 평문 블록 → 같은 암호문 블록. 패턴이 그대로 노출됨 (펭귄 이미지를 ECB로 암호화하면 펭귄 윤곽이 보이는 유명한 예시).

## IV (Initialization Vector)

- **역할**: 같은 키 + 같은 평문이라도 매번 다른 암호문이 나오게 만듦 (랜덤화)
- **비밀이 아니다** — 평문으로 ciphertext 앞에 붙여 보냄
- **고유성/예측불가능성**이 핵심
  - CBC: 예측 불가능해야 함 (BEAST 공격)
  - CTR/GCM: 같은 (키, IV) 쌍 재사용 절대 금지 → **NONCE** 라고도 부름
- **GCM IV 길이**: 12바이트 권장 (96-bit). 더 길면 내부 GHASH 처리, 더 짧으면 충돌 위험

### IV 재사용 시 무엇이 깨지는가
- CTR/GCM에서 같은 IV 재사용 → 두 ciphertext의 XOR = 두 평문의 XOR (키스트림 상쇄)
- GCM에서는 거기에 더해 **인증 키까지 복원 가능** → 위조 공격 가능. 치명적.

## 패딩 (Padding)

- **언제 필요한가**: 블록 모드(CBC, ECB)에서 평문이 블록 크기 배수가 아닐 때
- **PKCS#7**: 부족한 바이트 수만큼 그 값으로 채움 (5바이트 부족 → `05 05 05 05 05`)
- **GCM은 padding 불필요**: 내부적으로 CTR 모드라 평문 길이 그대로 ciphertext 길이

**Padding Oracle Attack** — 서버가 패딩 오류와 다른 오류를 다른 응답으로 알려주면, 공격자가 한 바이트씩 평문 복원 가능. CBC 사용 시 반드시 MAC 후 암호화/암호화 후 MAC 검증으로 막아야 함. → **그래서 GCM**.

## AEAD (Authenticated Encryption with Associated Data)

- **AE**: 암호화 + 무결성 동시 제공
- **AEAD**: 거기에 더해 "암호화하지 않지만 무결성은 검증할 데이터"(AAD) 추가
  - 예: HTTP 헤더처럼 평문이지만 변조되면 안 되는 부분
- **GCM 태그 (인증 태그)**: 16바이트(128b) 권장. 복호화 시 태그 검증 실패하면 복호화 결과 자체를 버려야 함

## 핵심 포인트

- 새 코드는 AES-256-GCM 기본 선택
- IV는 매번 새로 생성 (CSPRNG), 키 + IV 쌍 재사용 금지
- 태그 검증 실패 시 어떤 정보도 누설 금지 (timing-safe 비교)

## 코드 연결 — `AesUtil.kt`

`common/src/main/kotlin/com/kgd/common/security/AesUtil.kt`가 정확히 이 패턴: AES-256-GCM, 12바이트 IV(SecureRandom), 128b 태그, IV를 ciphertext 앞에 붙여 Base64. **교과서적 구현**.

| 라인 | 내용 | 평가 |
|---|---|---|
| 14 | `AES/GCM/NoPadding` | ✅ AEAD, padding 불필요 |
| 15 | `GCM_IV_LENGTH = 12` | ✅ NIST 권장 96b |
| 16 | `GCM_TAG_LENGTH = 128` | ✅ 최대값, 위조 저항 최대화 |
| 17 | `KEY_SIZE = 32` (AES-256) | ✅ 안전 마진 충분 |
| 22-25 | 키 길이 검증 + `copyOf(KEY_SIZE)` | ⚠️ 키를 그대로 32B로 자름 — KDF 없이. PBKDF2/HKDF로 derive하는 편이 더 안전 |
| 29 | `SecureRandom().nextBytes(iv)` | ✅ CSPRNG. ⚠️ companion으로 한 번 생성 후 재사용 권장 |
| 34 | `iv + encrypted` Base64 | ✅ 자연스러운 직렬화 패턴 |

**개선 후보** → [18-code-refactoring.md](18-code-refactoring.md), [19-improvements.md](19-improvements.md)
