---
parent: 14-crdt-mrdt
seq: 14
title: CRDT vs OT (Operational Transform)
type: deep
created: 2026-05-01
---

# 14. CRDT vs OT — 협업 에디터의 두 패러다임

협업 에디터의 분산 동기화는 두 패러다임 중 하나. **OT** 가 1989년부터 자리 잡았고, **CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입)** 가 2010년 이후 떠올랐다.

## OT (Operational Transform) 의 핵심

```
Operation Transform:
  두 op 이 concurrent 일 때, 한 쪽을 다른 쪽 효과 반영해 *변형* 후 적용

  T(opA, opB) = (opA', opB')
    where applying opA' to (opB applied) = applying opB' to (opA applied)
```

수식적으로는 **commutative diagram** 의 형태.

```
        s ─────── opA ─────► sA
        │                    │
       opB                  opB'
        │                    │
        ▼                    ▼
        sB ──── opA' ──────► s_final
```

`s_final` 이 같으려면 OT 는 `(opA', opB')` 를 잘 만들어야 한다.

## OT 예시: 텍스트 insert

```
초기 문서: "Hello"

A: insert(", world", at=5)   → "Hello, world"
B: insert("!", at=5)          → "Hello!"

A 가 B 의 op 받음:
  T(B의 insert("!", 5), A의 insert(", world", 5))
  = B의 insert 가 A 위에 반영되도록 변형
  = insert("!", at=12)   ← A 의 ", world" 가 5번 위치에 7글자 추가됐으니 5 + 7

→ A 의 결과: "Hello, world!"

B 가 A 의 op 받음:
  T(A의 insert(", world", 5), B의 insert("!", 5))
  = A 의 insert 가 B 위에 반영되도록 변형
  = insert(", world", at=5)   ← B 가 5 에 1글자 추가했으니 5 그대로? 또는 5+1?
  
  여기가 OT 의 미묘함 — 정책에 따라 다름:
    - "left wins": A 가 5 에, B 가 5 에 → A 가 먼저 와서 5+1=6 으로 변형?
    - 명확한 priority 규칙 필요
```

## OT 의 변환 매트릭스

각 op 쌍에 대해 transformation 정의 필요.

```
N 종류의 op → N×N 변환 정의 필요
  insert × insert = ?
  insert × delete = ?
  delete × insert = ?
  delete × delete = ?
  format × insert = ?
  ...
```

게다가 *순서* 까지 고려 (TP1, TP2 properties):
```
TP1: T(T(opA, opB), T(opC, T(opB, opA))) ?= T(T(opA, opC), opB)
```

이 조건이 못 만족되는 경우가 *Jupiter*, *Operational Transform Control* 등 다양한 변형 알고리즘.

## OT 의 역사적 사건

```
1989: Ellis & Gibbs 가 OT 제안 (GROVE)
1992: Jupiter (CSCW)
1995: REDUCE algorithm
1998: ICT (Imine et al.)
2002: Coordination Protocol
2005~: Google Docs 등장 — OT 채택
2010~: CRDT 학술 부상
2015~: 협업 에디터들이 점차 CRDT 로 이동
```

## Google Docs 의 OT

Google Docs 는 OT 의 대표 사례. 중앙 서버가 op 정렬 + transformation 수행.

```
구조:
  - 중앙 서버 (single source of truth)
  - 클라이언트 → 서버에 op 전송
  - 서버가 다른 op 과 OT 적용 후 broadcast
  - 클라이언트는 서버 정렬에 따라 local state 조정
```

**중앙 서버가 핵심** — 진정한 P2P/오프라인은 어렵다. 이것이 CRDT 와의 큰 차이.

## CRDT 의 OT 대비 강점

```
1. 결정론
   OT: 변환 정책에 따라 결과 다름, 미묘한 버그
   CRDT: 같은 op set → 같은 결과 (수학적 보장)

2. 분산 친화
   OT: 중앙 서버 필요 (또는 매우 복잡한 P2P)
   CRDT: P2P 자연

3. 오프라인
   OT: 오프라인 후 합치려면 모든 op 변환
   CRDT: state 만 합치면 됨

4. 사용자 정의 op
   OT: 새 op 마다 N×N 변환 정의
   CRDT: 새 자료구조 추가 (재귀 합성)
```

## CRDT 의 OT 대비 약점

```
1. 메타데이터
   OT: op 자체만 (작음)
   CRDT: tombstone, dot, vc (큼)

2. 의도 보존
   OT: 변환 정책으로 사용자 의도 더 정확히
   CRDT: 알고리즘이 결정 (사용자 의도 부분 손실 가능)

3. 점진적 도입
   OT: 기존 op 모델 위에 점진 도입 가능
   CRDT: 자료구조 자체가 바뀜
```

## 의도 보존 (Intention Preservation)

OT 의 강점. 예: 텍스트의 *위치* 가 사용자에게 의미 있을 때.

```
사용자 A: "ABC" 를 "AXBC" 로 (X 를 1 위치에 insert)
사용자 B: "ABC" 를 "ABCY" 로 (Y 를 끝에 insert)

OT 의 결과: "AXBCY"  ← 두 사용자의 *의도* 가 그대로
CRDT (RGA): "AXBCY"  ← 보통 같은 결과

하지만 더 미묘한 예:
사용자 A: "ABC" 의 'B' 를 'b' 로 변경 (대소문자)
사용자 B: "ABC" 의 'B' 를 삭제

OT: 정책에 따라 — A wins, B wins, conflict
CRDT (RGA): 'B' 는 tombstone (삭제) + 새 char 'b' (A 가 추가? 또는 변경?)
  → 변경의 의미 표현 안 됨, "AbC" or "AC" 정책에 따라
```

이런 미묘한 경우 OT 가 더 자연스러울 수 있다. 하지만 대부분의 협업 도구는 단순화 + 결정론을 선호 → CRDT.

## 산업의 이동

```
2005-2015: OT 시대 (Google Docs, Etherpad, ShareJS)
2015-2020: CRDT 학술 → production 진입 (Yjs, Automerge, ShareDB → ShareJSv2)
2020+: Figma, Notion, Linear 등 신생 도구 = CRDT
```

Figma 의 [블로그](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/): OT 검토 후 CRDT 채택. 이유 "결정론, 오프라인, 단순함".

## OT vs CRDT 결정 흐름도

```
질문                                          → 권장
────────                                        ─────
중앙 서버 항상 있음?                           → OT or CRDT
오프라인 / P2P 필요?                          → CRDT
새 op 자주 추가?                              → CRDT
기존 OT 시스템 점진적 마이그레이션?           → OT 유지
사용자 의도 정확히 보존이 critical?           → OT 검토
구현 복잡도 최소화?                           → CRDT (라이브러리 풍부)
```

## 트레이드오프 박스

| 측면 | OT | CRDT |
|---|---|---|
| 결정론 | 변환 정책 의존 | 수학적 보장 |
| 분산 친화 | 중앙 서버 친화 | P2P 친화 |
| 오프라인 | 어려움 | 자연 |
| 메타데이터 | 작음 | 큼 |
| 새 op 추가 | N×N 변환 정의 | 자료구조 합성 |
| 의도 보존 | 강함 | 정책 따라 |
| 사용 예 | Google Docs | Figma, Notion (일부), Yjs/Automerge 사용 도구 |

## msa 시사점

현 msa 에 협업 에디터 없음 → OT/CRDT 둘 다 직접 필요 없음. 만약 도입한다면 CRDT (Yjs) 가 default 선택.

## 면접 포인트

- **"OT 와 CRDT 의 핵심 차이?"** — OT 는 op 의 변환으로 commutativity 달성, 보통 중앙 서버 필요. CRDT 는 자료구조 자체를 재설계해 자동 수렴, P2P 친화.
- **"Figma 가 CRDT 를 선택한 이유?"** — 결정론 + 오프라인 친화 + 구현 단순. OT 의 N×N 변환 정의가 부담.
- **"Google Docs 는 OT 인데 잘 동작하지 않나?"** — 중앙 서버 모델로 well-tuned. 단 P2P / 오프라인 / 자유 자료구조 확장은 어려움. 신생 도구가 CRDT 로 가는 이유.
- **"OT 가 CRDT 보다 우월한 시나리오?"** — 사용자 의도 미묘한 보존 필요 + 중앙 서버 보장 + 메타데이터 최소화 critical 일 때. 그러나 production 추세는 CRDT.

## 다음 학습

- [15-byzantine-bft.md](15-byzantine-bft.md) — 악의적 replica 가정 시
- [16-real-systems.md](16-real-systems.md) — Yjs / Automerge / Figma 의 production 모델
