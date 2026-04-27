---
parent: 13-crypto-jwt-sso
seq: 15
title: HSM + Secrets vs Keys + K8s Secret 연동
type: deep
created: 2026-04-28
---

# 15. HSM + 키/시크릿 보관

## HSM (Hardware Security Module)

**핵심** — 키가 디바이스 밖으로 절대 나오지 않는 전용 하드웨어. 암복호화 연산이 디바이스 내에서 이뤄진다.

### 특징
- Tamper-resistant (개봉 시 키 자동 파기)
- 난수 생성 — 진성 RNG (열잡음, 양자 노이즈 등 물리 소스)
- 인증된 시스템: FIPS 140-2/3 Levels

## FIPS 140-2/3 Levels

| Level | 요구사항 (간략) | 예 |
|---|---|---|
| 1 | 소프트웨어 모듈 OK, 기본 암호 알고리즘만 | OpenSSL FIPS 모듈 |
| 2 | 변조 흔적, role-based 인증 | Azure Key Vault Premium |
| 3 | 변조 시 키 파기, identity-based 인증 | AWS CloudHSM, GCP Cloud HSM |
| 4 | 환경 공격 방어 (전압/온도) | 일부 HSM 어플라이언스 |

## AWS CloudHSM vs KMS

| 측면 | KMS | CloudHSM |
|---|---|---|
| 테넌시 | 멀티 테넌트 | **단일 테넌트** |
| FIPS | 140-2 L2/L3 | **140-2 L3** |
| 키 export | ❌ | 클러스터 간 가능 |
| API | AWS API | **PKCS#11**, JCE, OpenSSL engine |
| 비용 | 키당 $1/월 | HSM 인스턴스 시간당 |
| 사용 시점 | 일반 | 컴플라이언스 강제 (PCI HSM, EU sovereign) |

**KMS도 내부적으론 HSM 위에 도는데**, 키 정책이 AWS API 모델이라 PKCS#11 직접 접근이 필요하면 CloudHSM.

KMS Custom Key Store로 KMS 인터페이스에 CloudHSM을 백엔드로 붙이는 절충안도 있다.

## PKCS#11

- HSM/스마트카드 표준 API (C 언어)
- 토큰 / 슬롯 / 세션 / 객체 모델
- 자바: SunPKCS11 provider, Bouncy Castle

---

## Secrets vs Keys 구분

- **Secrets** — DB 비밀번호, API key, 토큰 같은 임의 비밀값. 보통 평문 read 필요.
- **Keys** — 암복호화/서명 키. **평문 read 안 함**, 디바이스 내 연산.

### 서비스 매핑

| 용도 | AWS | GCP | Azure |
|---|---|---|---|
| Keys | KMS | Cloud KMS | Key Vault Keys |
| Secrets | Secrets Manager / Parameter Store | Secret Manager | Key Vault Secrets |
| Certificates | ACM | Certificate Manager | Key Vault Certificates |

---

## K8s Secret + 외부 KMS 연동

### 기본 K8s Secret 한계
- etcd에 base64 인코딩만 (encryption at rest는 별도 설정)
- RBAC만으로 통제

### 보강 패턴
1. **EncryptionConfiguration** — etcd at-rest 암호화 (KMS 또는 aescbc)
2. **Sealed Secrets** (Bitnami) — Git에 암호화된 Secret 커밋 가능, 클러스터에서만 복호화
3. **External Secrets Operator (ESO)** — AWS Secrets Manager / Vault / Azure에서 Secret을 동기화
4. **AWS Secrets Manager / SSM CSI Driver** — Pod 시작 시 마운트
5. **Vault Agent Injector** — sidecar로 Vault 비밀 주입
6. **SPIFFE/SPIRE + workload identity** — Pod identity로 KMS/Secret store 인증

### 현 msa 적용 가능 포인트
- K8s Secret → External Secrets Operator + AWS Secrets Manager
- JWT secret, AES key를 클러스터에서 빼내고, 회전 정책 자동화

## 핵심 포인트

- KMS로 일반 시나리오는 충분
- HSM이 필요한 경우: PCI HSM, EU sovereign cloud, 자체 PKI 운영, FIPS 140-2 Level 3+ 강제
- K8s Secret은 그 자체로는 안전하지 않음 → External Secrets Operator 같은 외부 store 동기화 패턴 필수
- Secrets vs Keys 구분 — Secrets는 read 가능, Keys는 디바이스 내 연산만

## 다음 학습

- [16-tls.md](16-tls.md) — TLS로 운영 Layer 5 진입
- [19-improvements.md](19-improvements.md) — msa 적용 제안
