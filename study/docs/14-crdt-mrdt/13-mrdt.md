---
parent: 14-crdt-mrdt
seq: 13
title: MRDT (Mergeable Replicated Data Type) — Git-style 3-way merge
type: deep
created: 2026-05-01
---

# 13. MRDT — CRDT 의 진화 (Git 의 영혼)

CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입) 의 한계: 모든 자료구조가 *수렴 가능한 형태*로 재설계 필요. List 는 RGA, Set 은 OR-Set... 사용자 정의가 어렵다. **MRDT (Mergeable Replicated Data Type, 병합 가능 복제 데이터 타입)** 는 다른 답을 제시 — *"Git 처럼 3-way merge 를 쓰자"*.

## 동기

```
일반 CRDT:
  사용자 정의 자료구조 X 의 CRDT 버전 만들려면?
    → semilattice 로 재설계
    → merge 함수 직접 작성 + ACI 증명
    → tombstone, GC, dot store 모두 고려
    → 매우 어려움

MRDT 의 답:
  사용자 자료구조를 "Git 처럼 LCA + 3-way merge" 로
    → CRDT 의 수학적 보장은 약화
    → 대신 사용자가 *의미 있는 merge* 를 직접 정의
    → 일반 데이터에 적용 가능
```

## Git 의 3-way merge 복습

```
        A1 ── A2 ── A3   (branch A)
       ╱
   ⊥ (LCA = Lowest Common Ancestor)
       ╲
        B1 ── B2          (branch B)

merge 시:
  - LCA: ⊥ (또는 둘이 만나기 전 마지막 공통 commit)
  - 3-way merge: 사용자 코드 또는 conflict marker
    → text 라면 줄 단위 비교 (LCA 와 두 branch 차이를 합침)
```

3-way merge 의 본질: **LCA 와 두 branch 의 차이를 합치는 것**. 같은 줄 다르게 수정 → conflict (사용자 결정).

## MRDT 의 정식 정의

```
MRDT = (S, ⊥, merge)
  S: 데이터 타입
  ⊥: 초기 값
  merge: S × S × S → S       ← three-way merge 함수
    merge(lca, a, b) = c

조건:
  - merge(lca, a, a) = a       ← (idempotent on same)
  - merge(lca, a, b) = merge(lca, b, a)   ← (commutative)
  - merge(s, s, s) = s
```

CRDT 처럼 ACI 가 아니라 *3-way merge 의 자연스러운 성질* 을 요구.

## Irmin — OCaml 구현

[Irmin](https://irmin.org/) 은 MirageOS 의 일부로 MRDT 구현. Git 호환 storage backend 를 제공.

```ocaml
module type CONTENT = sig
  type t
  val merge : old:t -> t -> t -> t  (* 3-way merge *)
end

module Counter : CONTENT = struct
  type t = int
  let merge ~old a b = a + b - old
end

(* 사용 *)
let v0 = 5      (* LCA *)
let vA = 7      (* branch A: +2 *)
let vB = 8      (* branch B: +3 *)
let vMerged = Counter.merge ~old:v0 vA vB
(* = 7 + 8 - 5 = 10  → 두 변경분의 합 *)
```

Counter 의 3-way merge: `(a - old) + (b - old) + old` = "두 branch 의 *변경분* 을 LCA 에 모두 적용".

## Set 의 3-way merge

```ocaml
module Set : CONTENT = struct
  type t = StringSet.t
  let merge ~old a b =
    let added_a = diff a old   in
    let added_b = diff b old   in
    let removed_a = diff old a in
    let removed_b = diff old b in
    union (union (diff old (union removed_a removed_b))
                 added_a)
          added_b
end
```

직관: "양쪽이 추가한 건 모두 추가, 둘 중 하나라도 삭제했으면 삭제, 둘 다 안 건드린 건 LCA 그대로."

```
LCA: {a, b, c}
A:   {a, b, d}    → +d
B:   {a, c, e}    → +e, -b

merge(LCA, A, B) = {a, c, d, e}
  - a: 둘 다 안 건드림 → LCA 그대로
  - b: B 가 삭제 → 삭제
  - c: B 가 유지, A 가 삭제 → ?
    실제 정책: A 의 -c 는 변경, B 의 c 유지는 미변경 → A 의 변경 적용? 또는 그대로?
    이 부분이 *사용자 정의 merge 의 자유도*
```

## CRDT vs MRDT 차이

```
CRDT:
  Document = fold(allOps, ⊥)
  순서 무관, history 모름 OK
  ✓ 자동 수렴 보장
  ✗ 자료구조 재설계 필요

MRDT:
  Document = (LCA, currentBranches)
  history (LCA) 필요
  ✓ 사용자 정의 자유로움
  ✗ LCA 를 어떻게 추적? 3-way merge 결과의 일관성?
```

MRDT 는 본질적으로 **versioned 데이터** — Git 처럼 commit graph 보존.

## LCA 추적

```
각 commit:
  parent: 1 또는 2 (merge commit)
  data: 그 시점 state

LCA 계산:
  두 commit 의 ancestor set 의 가장 최근 공통점
  Git 의 git merge-base 와 같음
```

분산 환경에서 LCA 합의는 본질적으로 *그래프 동기화* — Git push/pull 과 같다.

## 3-way merge 의 결정론?

CRDT 는 같은 op 집합 → 같은 결과. MRDT 는?

```
조건:
  merge 가 *commutative* (a, b 순서 무관)
  merge(lca, a, a) = a (둘이 같으면 그대로)
  
이 조건만으로 SEC 가 보장되는가?

증명 가능 (Kaki et al. 2019 "Mergeable Replicated Data Types"):
  적절한 commit graph 와 commutative merge 에서 SEC 보장.
```

따라서 MRDT 도 SEC 가능. 단 *사용자가 merge 를 잘 정의했을 때*.

## Quark, Peritext — MRDT 응용

### Quark (LCA-based set)
- Set 의 MRDT
- LCA 추적해 add/remove 의 의도 더 정확히

### Peritext (rich text MRDT)
- text 위에 *마크업* (bold, italic) 동시 편집
- CRDT 만으론 마크업의 의미 보존 어려움
- MRDT 의 사용자 정의 merge 로 해결

## CRDT 와 MRDT 의 Synthesis

연구 추세: 두 패러다임의 장점 취하기.

```
Versioned CRDT:
  - CRDT 의 자동 수렴
  - + Git 같은 branching/merging
  - 예: jsonjoy, Loro

CRDT-on-MRDT:
  - MRDT 위에 CRDT 자료구조 올림
  - merge 가 CRDT 의 join
```

## 트레이드오프 박스

| 측면 | CRDT | MRDT |
|---|---|---|
| 자동 수렴 | ✓ (수학적 보장) | 사용자 책임 |
| 자료구조 자유도 | 제한적 | 자유 |
| History | 보통 압축 | LCA 보존 (Git-like) |
| 사용자 정의 merge | 어려움 | 자연 |
| GC | tombstone 골치 | LCA 그래프 GC |
| 사용처 | 협업 도구, 분산 DB | local-first, versioned data |

## msa 적용 검토

현 msa 에 versioned 데이터 직접 필요한 곳은 없다. 다만:

```
ideabank: 사용자가 PRD 초안 → bs 통해 다듬음 → 최종
  → 일종의 versioned 데이터, MRDT 후보
  → 단, 단일 사용자 단일 디바이스라면 git 으로 충분

docs/standards: 문서 변경 history
  → git 이 그대로 답

charting: chart spec 의 변경 이력
  → 단순 audit log 면 충분
```

대부분의 영역에서 *Git 자체* 가 답이며, MRDT 는 "데이터베이스 안에 Git 모델" 이 필요할 때.

## 면접 포인트

- **"MRDT 와 CRDT 의 차이?"** — CRDT 는 모든 op 의 fold. MRDT 는 LCA 기반 3-way merge. CRDT 는 자동 수렴 보장 강함, MRDT 는 사용자 정의 merge 자유도가 강함.
- **"Git merge 가 MRDT 의 origin?"** — 사실상 그렇다. Git 은 file 단위 LCA + 3-way merge. MRDT 는 그 모델을 데이터베이스 데이터에 적용.
- **"MRDT 의 SEC 보장?"** — 조건 만족 시 (commutative merge + 적절한 graph) 보장. 사용자 정의 merge 가 잘못되면 깨짐.
- **"언제 CRDT 대신 MRDT?"** — 자료구조가 사용자 정의이고 CRDT 화가 어려울 때. local-first + git-like history 가 자연스러울 때.

## 다음 학습

- [14-crdt-vs-ot.md](14-crdt-vs-ot.md) — 또 다른 비교 대상 OT
- [16-real-systems.md](16-real-systems.md) — Irmin / jsonjoy / Loro
