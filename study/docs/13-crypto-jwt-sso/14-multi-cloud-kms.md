---
parent: 13-crypto-jwt-sso
seq: 14
title: 멀티 클라우드 KMS (GCP / Azure / Vault)
type: deep
created: 2026-04-28
---

# 14. 멀티 클라우드 KMS

## GCP Cloud KMS

| 측면 | AWS KMS | GCP KMS |
|---|---|---|
| 키 단위 | KMS Key | KeyRing → CryptoKey → CryptoKeyVersion |
| 자동 rotation | 1년 (AWS managed) | 사용자 정의 주기 |
| HSM 백업 | CloudHSM 별도 | **Cloud HSM** (단일 권역, FIPS 140-2 L3) |
| External Key | Custom Key Store (CloudHSM) | **EKM (External Key Manager)** — 외부 KMS와 연동 |
| 가격 모델 | 키당 + API 호출 | 키 버전당 + 작업당 |

**EKM** — GCP가 외부 KMS(예: 자체 데이터센터 HSM)에 키를 두고 GCP 데이터를 암호화 가능. Sovereign cloud / 강한 컴플라이언스 시나리오.

## Azure Key Vault

- **Standard** — software-protected, 일반용
- **Premium** — HSM-backed (FIPS 140-2 L2)
- **Managed HSM** — single-tenant FIPS 140-2 L3 (전용 HSM 서비스)
- 두 종류 객체:
  - **Keys** — 암호화/서명 키
  - **Secrets** — 일반 비밀값 (DB password 등)
  - **Certificates** — TLS 인증서 통합 관리

### Azure 특이점
- **Managed Identity** + Key Vault 결합으로 코드에 자격 증명 0개 (가장 매끄러운 패턴)
- **Soft delete + Purge protection** — 실수로 키 삭제해도 30~90일 복구 기간

## HashiCorp Vault — Transit 시크릿 엔진

- **클라우드 종속성 없음** — 온프레미스 + 멀티 클라우드 + 하이브리드
- **Transit 엔진** — KMS와 유사 (encrypt/decrypt API, 키는 Vault 밖으로 안 나옴)
- **Dynamic secrets** — DB password, AWS IAM 자격을 짧은 TTL로 동적 발급
- **PKI 엔진** — 사내 CA처럼 인증서 발급
- **Auto-unseal** — KMS/HSM으로 Vault 자체 마스터 키 보호

## 비교 요약

| 측면 | AWS KMS | GCP KMS | Azure Key Vault | Vault |
|---|---|---|---|---|
| 종속성 | AWS만 | GCP만 | Azure만 | 무관 |
| HSM | CloudHSM | Cloud HSM | Managed HSM | + HSM 백업 가능 |
| Dynamic secrets | Secrets Manager 별도 | Secret Manager 별도 | Key Vault 통합 | **강점** |
| PKI | ACM Private CA 별도 | CAS 별도 | Key Vault 통합 | **강점** |

## 선택 기준

- **단일 클라우드 + 단순 키 관리**: 해당 클라우드 KMS
- **멀티 클라우드 / 하이브리드**: HashiCorp Vault
- **Dynamic secrets / PKI 통합**: Vault 또는 Azure Key Vault
- **데이터 주권 / 외부 KMS 의무**: GCP EKM 또는 Vault

## 핵심 포인트

- 모든 클라우드 KMS의 핵심은 동일: **Envelope Encryption + IAM 통합**
- 차이는 주로 키 관리 객체 모델, HSM 옵션, 가격, dynamic secrets 통합 여부
- 클라우드 종속을 피하려면 **Vault Transit 추상화**가 표준 패턴

## 다음 학습

- [15-hsm.md](15-hsm.md) — HSM 자체와 K8s 연동
- [13-aws-kms.md](13-aws-kms.md) — AWS 깊이 (이미 학습)
