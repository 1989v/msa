---
parent: 14-crdt-mrdt
seq: 15
title: Byzantine 환경 · BFT-CRDT 연구 동향
type: deep
created: 2026-05-01
---

# 15. Byzantine 환경의 CRDT — 신뢰의 가정

일반 CRDT 는 **모든 replica 가 정직** 하다고 가정. 악의적 replica 가 false dot 을 보내거나 invariant 위반 op 을 발행하면 시스템이 깨진다.

## 일반 CRDT 의 신뢰 가정

```
G-Counter:
  replica X 가 자기 entry 를 +1 증가

만약 X 가 거짓말:
  - "X.count = 1000" 으로 위조 broadcast
  - 다른 replica 는 max merge 로 받아들임 → 카운터 1000 으로 오염
  - 나중에 X 가 정상 +1 → 1001
  - 정정 불가
```

```
OR-Set:
  remove 시 본 적 있는 dot 만 kill

만약 X 가:
  - 본 적 없는 dot 도 kill 했다며 broadcast
  - 다른 replica 가 element 를 잃음
```

### 위협 모델

```
1. 신뢰된 환경 (trusted)
   - 같은 조직 내 replica
   - 인증된 채널
   - 일반 CRDT 가 적합

2. 부분 신뢰 (semi-trusted)
   - 일부 replica 는 외부 (e.g. 모바일 앱)
   - 인증은 가능하나 완벽한 신뢰 어려움
   - 일부 보호 필요

3. Byzantine
   - 임의의 악의적 행동
   - 위조, denial, 모순적 메시지
   - BFT-CRDT 또는 다른 approach 필요
```

## Byzantine Fault Tolerance 의 일반 도구

분산 합의 (consensus) 영역의 도구:
- **PBFT** (Practical Byzantine Fault Tolerance)
- **Raft / Paxos** (crash 만 가정, BFT 아님)
- **Tendermint, HotStuff** (블록체인 합의)

CRDT 와 BFT 합의는 다른 트레이드오프:
- CRDT: 가용성 + 자동 수렴, but 신뢰 가정
- BFT 합의: Byzantine 안전, but 합의 비용 (지연)

## BFT-CRDT 의 접근

연구 영역. 대표 방향:

### 1. 서명 + 검증 (Signed CRDT)

```
모든 op 에 발행자 서명 첨부.
수신자가 서명 검증 후 적용.
```

- replica 가 *자기 op 만* 발행 가능 (위조 방지)
- 서명 비용 (RSA/Ed25519) — 처리량 떨어짐
- 합의는 안 함 → 모순적 op 동시 발행 가능 (e.g. fork)

### 2. Forking 탐지

```
악의적 replica 가 같은 dot 으로 다른 op 두 개 발행 (equivocation):
  op1: (X, 5) → "Alice"
  op2: (X, 5) → "Bob"

탐지: 다른 replica 가 두 op 비교 → 모순 검출 → X 차단
```

- 사후 탐지 (이미 다른 replica 가 둘 다 받은 후)
- 차단 정책 (multisig, vote)

### 3. Hash Chain (Operation Authenticator)

```
각 op 의 hash 가 다음 op 의 hash 에 포함 (Merkle DAG):
  op1.hash = H(op1)
  op2.hash = H(op2 + op1.hash)
  op3.hash = H(op3 + op2.hash)

위조 시 chain 깨짐 → 탐지 가능.
```

블록체인의 핵심 도구. **Hash-CRDT** 연구로 결합.

### 4. Threshold-based Acceptance

```
op 적용 전에 N 개 replica 의 검증 받음:
  X 가 op 발행 → N-1 개 replica 가 sign
  → 모인 후 broadcast

비용: 합의 라운드 트립
이점: 위조 방지
```

본질적으로 BFT 합의 + CRDT.

## Hyperledger / Blockchain 과 CRDT

블록체인은 BFT 합의 + state machine. CRDT 는 합의 없이 수렴. 두 모델이 일부 겹침.

```
Blockchain:
  - 모든 transaction 의 *순서* 합의
  - 강한 BFT
  - 비용: 합의 (PoW, PoS, BFT)

CRDT:
  - 순서 무관 (commutative)
  - 신뢰 가정
  - 비용: 메타데이터 (vc, tag)

CRDT-on-Blockchain:
  - 순서 합의 + CRDT op 으로 비용 분산
  - 일부 분산 DB (FaunaDB 의 Calvin) 와 비슷한 패턴
```

## 실 시스템

### Matrix protocol

Element 의 backend. event-based, 부분적 CRDT 비슷한 구조.
- 각 event 가 hash chain 으로 연결 (Merkle DAG)
- federation 간 신뢰 부분적

### Secure Scuttlebutt

P2P 소셜 네트워크. append-only feed + signed messages.
- 사용자별 hash chain
- 위조 거의 불가
- CRDT 적 합치기 (feed merge)

### CRDT 기반 블록체인 시도

연구 영역. 한 트랜잭션 처리량 향상 위해 CRDT 적용.

## msa 시사점

현 msa 의 운영 환경:

```
모든 서비스가 같은 K8s 클러스터 내 / 같은 조직
인증된 채널 (mTLS 도입 중, [13-crypto-jwt-sso] 의 17번 참고)
→ 신뢰 가정 OK
→ Byzantine 가정 불필요
```

만약 외부 노드 (e.g. partner 시스템) 와 분산 데이터 공유한다면 BFT-CRDT 또는 서명 기반 CRDT 검토.

## 트레이드오프 박스

| 환경 | CRDT 변형 | 비용 |
|---|---|---|
| 신뢰된 (단일 조직) | 일반 CRDT | 메타데이터 |
| 부분 신뢰 | Signed CRDT | 서명 비용 |
| Byzantine | BFT-CRDT | 합의 비용 |
| 강한 무결성 + 순서 | Blockchain | 채굴/합의 비용 |

## 면접 포인트

- **"일반 CRDT 가 Byzantine safe?"** — 아님. 모든 replica 가 정직하다고 가정. 악의적 replica 가 false dot/op 발행 가능.
- **"BFT-CRDT 의 접근법?"** — 서명 (op 위조 방지), forking 탐지 (equivocation 사후 검출), hash chain (Merkle DAG), threshold acceptance (BFT 합의 결합). 모두 비용 있음.
- **"블록체인이 CRDT 의 대안?"** — 다른 모델. 블록체인은 *순서 합의*, CRDT 는 *순서 무관 수렴*. 처리량 vs 신뢰 트레이드오프.
- **"msa 같은 신뢰된 환경에서?"** — 일반 CRDT 면 충분. 외부 노드 신뢰 어려운 경우만 BFT-CRDT 검토.

## 다음 학습

- [16-real-systems.md](16-real-systems.md) — Riak / Redis / Yjs 등 실 production 사례
- [17-msa-application.md](17-msa-application.md) — msa 코드베이스 적용 검토
