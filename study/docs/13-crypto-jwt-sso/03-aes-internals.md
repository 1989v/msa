---
parent: 13-crypto-jwt-sso
seq: 03
title: AES 내부 구조 (SPN / 라운드 함수 / Key Schedule)
type: deep
created: 2026-04-28
---

# 03. AES 내부 구조 (P3 풀팩)

> 면접 답변 깊이는 "GCM이 왜 표준인가" 수준에서 멈추지만, 라운드 함수가 어떻게 돌아가는지 알면 트레이드오프(라운드 수, 키 길이) 답변에 자신감이 붙는다.

## SPN (Substitution-Permutation Network)

- AES는 SPN 구조 (DES는 Feistel 구조)
- **혼돈(Confusion)** — 키와 ciphertext 관계를 복잡하게 (S-box가 담당)
- **확산(Diffusion)** — 평문 한 비트 변경이 ciphertext 전체에 퍼지게 (ShiftRows + MixColumns가 담당)

## State (4×4 byte 행렬)

- 16바이트 블록을 4×4 행렬로 배열 (열 우선)

## 라운드 함수 — 4단계 (마지막 라운드만 MixColumns 생략)

1. **SubBytes** — 각 바이트를 S-box 테이블로 치환 (비선형성, 혼돈)
2. **ShiftRows** — 각 행을 좌측으로 0/1/2/3바이트 순환 시프트 (확산)
3. **MixColumns** — 각 열을 GF(2^8) 위 행렬 곱으로 변환 (열 내 확산)
4. **AddRoundKey** — 라운드 키와 XOR (키 의존성 주입)

```
초기:    AddRoundKey (Round 0 key)
Rounds:  [SubBytes → ShiftRows → MixColumns → AddRoundKey] × (N-1)
마지막:  SubBytes → ShiftRows → AddRoundKey
```

## S-box

- 8-bit 입력 → 8-bit 출력 비선형 치환표 (256 엔트리)
- **GF(2^8) 곱셈 역원 + affine 변환**으로 구성
- 미분/선형 공격에 강하도록 설계됨
- 하드웨어 구현 시 단순 LUT, 소프트웨어에서는 캐시 타이밍 공격 우려 → 최신 CPU의 **AES-NI 명령어**가 정공법

## MixColumns

- 각 열(4바이트)을 GF(2^8) 다항식 `{03}x³ + {01}x² + {01}x + {02}`와 곱
- 한 입력 바이트 변경 → 출력 4바이트 모두 변경 (Branch number 5)
- 마지막 라운드에서 생략하는 이유: 복호화 단순화 (보안엔 영향 없음, 알고리즘 균형 차원)

## Key Schedule (Key Expansion)

- 마스터 키로부터 각 라운드 키 생성
- AES-128: 128b → 11개 라운드 키 (Round 0~10) = 176바이트
- AES-256: 256b → 15개 라운드 키
- 핵심 연산:
  - **RotWord** (워드 순환)
  - **SubWord** (S-box 적용)
  - **Rcon** (라운드 상수 XOR)
- **AES-256의 키 스케줄이 AES-128보다 약하다는 분석 결과** (Biclique 공격에서 AES-128 대비 효과 감소). 그래도 실용적으론 안전.

## 라운드 수

- AES-128: 10, AES-192: 12, AES-256: 14
- 라운드 수가 보안 마진을 결정 — 7라운드까지의 공격은 알려져 있음

## 알려진 공격 (실용성 0에 가까움)

- **Biclique 공격** — AES-128을 2^126.1로 깰 수 있음 (브루트포스 2^128 대비 약 4배 빠름). **현실에서 의미 없음**
- **Related-key 공격** — AES-256 키 스케줄 공격. 공격자가 관련된 두 키로 암호화한 결과를 얻을 수 있다는 비현실적 전제 필요
- **Side-channel 공격** — 캐시 타이밍, 전력 분석. AES-NI / 상수 시간 구현으로 방어

## 핵심 포인트

- **AES 자체는 깨진 적 없다.** 깨진 사례는 전부 사용 방식(ECB, IV 재사용, MAC 누락) 또는 사이드 채널.
- AES-128 vs 256 실용적 차이: 양자 컴퓨터 대비 안전 마진 (Grover 알고리즘 기준 256이 128 대비 안전), 그 외엔 무시 가능
- 모르고 외울 필요는 없다. **"GCM이 왜 표준인가"** 수준이면 면접 충분.

## 다음 학습

- [02-aes-modes.md](02-aes-modes.md) — 사용자 관점 (먼저 학습 권장)
- [04-hash-functions.md](04-hash-functions.md) — 해시 함수
