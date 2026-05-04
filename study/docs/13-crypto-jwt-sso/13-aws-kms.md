---
parent: 13-crypto-jwt-sso
seq: 13
title: AWS KMS + Envelope Encryption
type: deep
created: 2026-04-28
---

# 13. AWS KMS + Envelope Encryption

## 키 보관 문제 (전체 KMS 학습의 출발점)

**원칙** — 키는 가능한 한 사용 위치와 분리하고, 필요한 순간만 메모리에 올라오게.

### 금지 패턴
- 환경변수에 키 평문 저장 (env dump, ps 출력에 노출)
- Git 리포지토리에 키 커밋
- 로그에 키 출력
- DB에 평문 저장

### 완화 패턴
- K8s (Kubernetes) Secret + RBAC (Role-Based Access Control, 역할 기반 접근 제어) + EncryptionConfiguration (etcd 암호화)
- HashiCorp Vault, AWS Secrets Manager
- KMS / HSM (키가 아예 디바이스 밖으로 안 나옴)

---

## CMK / KMS Key

- **Customer Managed Key (CMK)** = KMS Key (현 명칭)
- 종류:
  - **Symmetric** (AES-256 GCM) — 가장 흔함
  - **Asymmetric RSA** — 서명/암호화
  - **Asymmetric ECC** — 서명만 (NIST 곡선 + ECC_SECG_P256K1)
  - **HMAC** — HMAC-SHA 256/384/512
- **AWS managed** vs **Customer managed** vs **AWS owned**
  - AWS owned: 서비스 내부용, 사용자 가시성 없음
  - AWS managed: 서비스가 자동 관리 (`aws/s3` 등), rotation 자동
  - Customer managed: **사용자가 직접 정책 + rotation 제어**

## 핵심 API

- `Encrypt(plaintext, KeyId)` → ciphertext (4KB 제한)
- `Decrypt(ciphertext)` → plaintext
- `GenerateDataKey(KeyId, KeySpec)` → **plaintext DEK + ciphertext DEK** 동시 반환
- `Sign(KeyId, message, alg)` / `Verify(...)` — 비대칭 서명
- `GenerateRandom(numBytes)` — HSM-grade 난수

## Envelope Encryption (핵심 패턴)

**문제** — KMS 직접 암호화는 4KB 제한 + 호출당 비용 + 네트워크 왕복.

**해결** — 큰 데이터를 위한 **데이터 키(DEK)**를 KMS로 감싸기.

```
[암호화]
1. GenerateDataKey(KMS_Key_ID, AES_256) 
   → plaintext_DEK, encrypted_DEK
2. ciphertext = AES-256-GCM(plaintext_DEK, plaintext)
3. plaintext_DEK 메모리에서 즉시 파기
4. 저장: { encrypted_DEK, iv, ciphertext, tag }

[복호화]
1. Decrypt(encrypted_DEK) → plaintext_DEK
2. plaintext = AES-256-GCM-decrypt(plaintext_DEK, ciphertext)
3. plaintext_DEK 즉시 파기
```

### 왜 이게 좋은가
- KMS는 한 번만 호출 (DEK 1개당)
- 대량 데이터는 로컬 AES (수 GB/s)
- 마스터 키(KEK)는 절대 KMS 밖으로 안 나옴
- DEK는 데이터별/요청별/세션별로 고유 → blast radius 제한

**Caching 전략** — DEK를 메모리에 짧게 캐싱(예: 5분, 10MB) — `aws-encryption-sdk` 기본.

## Key Rotation

- **AWS managed automatic rotation** — Symmetric CMK 1년 주기, KMS가 새 backing key 추가
  - 기존 데이터는 이전 backing key로 복호화 가능 (KMS가 키 ID로 라우팅)
  - 사용자 코드 변경 불필요
- **Manual rotation**
  - 새 CMK 생성 → alias 갱신 (`alias/payment-key` → 새 KMS Key)
  - 기존 데이터는 옛 CMK로 복호화 (옛 키 유지)
  - **재암호화 필요시** `ReEncrypt(ciphertext, NewKeyId)` API
- **Asymmetric** 자동 rotation 미지원 → manual

## IAM + Key Policy 이중 권한 모델

- **IAM Policy** — 누가(주체) 무엇을 할 수 있는가 (Principal 측)
- **Key Policy** — 이 키에 대해 누가 무엇을 할 수 있는가 (Resource 측)
- **양쪽 모두 허용해야 작동** (ANDed) — 단, Key Policy가 IAM 위임을 명시(`"Principal": {"AWS": "*"}` + IAM 활성화)하지 않으면 IAM만으로는 안 됨
- 결과: **CMK는 명시적으로 허용된 주체만 사용 가능** (Lock-out 방지 신중)

## Grants

- 임시/위임형 권한 — IAM/Key Policy보다 동적
- 예: Lambda 함수가 1시간 동안 특정 키로 Decrypt만 할 수 있도록
- 해지(`RetireGrant`) 시점까지 유효

## Multi-Region Keys

- 여러 리전에서 같은 키 ID로 암복호화 (DR 시나리오)
- Primary + Replica 모델
- 한 리전의 키로 암호화된 ciphertext를 다른 리전 replica로 복호화 가능 (단순 복사와 다름)

## 비용 모델 (대략)

- KMS Key 보유: $1/월
- API 호출: $0.03 / 10,000 호출 → 그래서 **Envelope Encryption + DEK 캐싱**

## 코드 예시

[18-code-refactoring.md](18-code-refactoring.md)의 `KmsEnvelopeAesUtil` 클래스.

## 핵심 포인트

- **Envelope Encryption은 KMS 사용의 사실상 유일한 패턴** (직접 암호화는 4KB+비용)
- IAM + Key Policy는 lock-out 방지를 위한 의도된 이중 모델
- 자동 rotation은 단순 (코드 변경 0), Multi-Region은 DR
- Grants는 dynamic, IAM/Key Policy는 static

## 다음 학습

- [14-multi-cloud-kms.md](14-multi-cloud-kms.md) — GCP/Azure/Vault 비교
- [15-hsm.md](15-hsm.md) — HSM과 KMS 차이
- [18-code-refactoring.md](18-code-refactoring.md) — `KmsEnvelopeAesUtil` 코드
