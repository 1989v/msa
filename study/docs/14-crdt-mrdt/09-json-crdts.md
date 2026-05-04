---
parent: 14-crdt-mrdt
seq: 09
title: JSON CRDT — Automerge · Yjs 의 데이터 모델
type: deep
created: 2026-05-01
---

# 09. JSON CRDT — Automerge · Yjs

협업 도구의 데이터를 표현하는 *전체 document* 단위 CRDT (Conflict-free Replicated Data Type, 충돌 없는 복제 데이터 타입). **Map + List + Register + Counter 의 재귀 합성**.

## 두 시스템

| | Automerge | Yjs |
|---|---|---|
| 언어 | Rust + JS | JS (Y-CRDT 는 Rust) |
| 개념 모델 | op-based, opset 보존 | op-based, RGA + Yata |
| 데이터 | JSON 호환 | shared types (Y.Map / Y.Array / Y.Text) |
| Time travel | ✓ (full history) | ✗ (history 압축) |
| 사용처 | Local-first 앱 | Notion (일부) / Figma 류 |

둘 다 **document = nested CRDT** 라는 점은 같다.

## Automerge 의 데이터 모델

### 모든 변경이 op

```javascript
// Automerge 는 모든 mutation 을 op 로 기록
let doc = Automerge.from({ todos: [] })
doc = Automerge.change(doc, d => {
  d.todos.push({ text: "Buy milk", done: false })
})

// 내부적으로:
//   op1: makeMap(rootId)
//   op2: makeList(todosId, parent=rootId, key="todos")
//   op3: makeMap(item1Id, parent=todosId, after=null)
//   op4: set(item1Id, "text", "Buy milk")
//   op5: set(item1Id, "done", false)
```

### Document = op set 의 함수

```
Document = fold(allOps, ⊥)

Replica A 의 ops: [op1, op2, op3]
Replica B 의 ops: [op1, op2, op4]   (다른 마지막 op)

merge:
  combined = {op1, op2, op3, op4}
  document = fold(combined, ⊥)

→ 어느 순서로 fold 해도 같은 결과 (CRDT 특성)
```

### 인과 관계

```
op 의 메타데이터:
  - opId: (actorId, counter)
  - parentOps: 이 op 가 기반한 이전 op 들의 id
  - 따라서 op DAG (Directed Acyclic Graph) 형성
```

이 DAG 가 곧 Git commit graph 와 동형. **Automerge = CRDT 위의 Git**.

## Yjs 의 데이터 모델

### Shared Types

```javascript
import * as Y from 'yjs'

const doc = new Y.Doc()
const text = doc.getText('content')      // Y.Text (RGA / Yata)
const map = doc.getMap('metadata')       // Y.Map (OR-Map)
const array = doc.getArray('items')      // Y.Array (RGA / Yata)

text.insert(0, "Hello")                  // sequence CRDT
map.set('title', 'My Doc')               // OR-Map + LWW-Register
array.push([{ key: 'value' }])           // sequence + nested map
```

### 내부 표현: Linked List + struct store

```
Y.Doc
  └── struct store: Map<clientId, Item[]>
        Item:
          id: (clientId, clock)
          left: Item | null      ← Yata 의 originLeft
          right: Item | null     ← Yata 의 originRight
          parent: Item | null    ← 부모 (nested 구조)
          content: text / object / type
          deleted: boolean
```

각 변경이 **delta update** — 변경된 struct 만 인코딩해 전송.

### Update Encoding

Yjs 는 효율적 binary encoding 을 가진다.

```
Yjs update = list of struct
  - structVersionLength
  - actorClock state (clientId → clock)
  - structs (compact binary)

크기: 평균 op 당 수십 바이트, RLE 압축으로 더 작음
```

## 두 시스템의 Document 합성

### Automerge

```
Document = Map  (root)
  ├── "todos" → List
  │     ├── 0 → Map
  │     │     ├── "text" → Register("Buy milk")
  │     │     └── "done" → Register(false)
  │     └── 1 → ...
  └── "title" → Register("Shopping List")
```

### Yjs

```
Y.Doc
  ├── Y.Map "metadata"
  │     ├── "title" → "Shopping List"
  │     └── "createdAt" → 1700000000
  ├── Y.Array "todos"
  │     └── Y.Map (each item)
  │           ├── "text" → Y.Text "Buy milk"
  │           └── "done" → false
  └── Y.Text "content"
```

본질적으로 같음. 둘 다 OR-Map + Sequence CRDT + LWW-Register 의 재귀 합성.

## Conflict 시나리오: 같은 key 동시 set

```javascript
// Automerge
const doc1 = Automerge.from({ title: "A" })
const doc2 = Automerge.clone(doc1)

const docA = Automerge.change(doc1, d => { d.title = "Alice's Doc" })
const docB = Automerge.change(doc2, d => { d.title = "Bob's Doc" })

const merged = Automerge.merge(docA, docB)
// merged.title === ?  → "Bob's Doc" (Lamport order tie-break)
// 잃은 값 확인: Automerge.getConflicts(merged, 'title')
// → { 'op-id-A': "Alice's Doc", 'op-id-B': "Bob's Doc" }
```

LWW + tie-break — 한 값을 고르되 *충돌 history* 보존.

```javascript
// Yjs (Y.Map)
yMap.set('title', 'Alice\'s Doc')   // client A
yMap.set('title', 'Bob\'s Doc')     // client B (concurrent)

// merge 후: 한 값이 이김. clientId 비교로 결정론.
// Yjs 는 conflict history 노출 안 함 (단순함 우선)
```

## Time Travel: Automerge 의 강점

Automerge 는 모든 op 을 보존 → **document 의 어느 시점이든 재현 가능**.

```javascript
const history = Automerge.getHistory(doc)
// [{ change: ..., snapshot: ... }, ...]

const old = Automerge.applyChanges(Automerge.init(),
  history.slice(0, 10).map(h => h.change))
// 처음 10개 변경만 적용한 시점의 document
```

Yjs 는 op log 압축 (snapshot + GC) → 임의 시점 복원 어려움. 대신 효율.

## Local-First 패턴

Local-First Software ([Kleppmann et al. 2019](https://www.inkandswitch.com/local-first/)) — 로컬에서 동작 + 동기화는 부가.

```
원칙:
  1. 즉시 응답 (no spinner)
  2. 어떤 디바이스에서든 작동
  3. 네트워크 없어도 작동
  4. 다른 사람과 협업
  5. 오랫동안 보관
  6. 보안 + 프라이버시
  7. 데이터 소유권

구현 핵심: CRDT (Automerge / Yjs)
```

협업 도구뿐 아니라 노트앱(Obsidian, Logseq), 드로잉(tldraw), 디자인 도구가 이 모델 채택 중.

## Yjs 의 ProseMirror / Quill 통합

```javascript
// ProseMirror + Yjs
import { ySyncPlugin } from 'y-prosemirror'
const yXmlFragment = ydoc.getXmlFragment('prosemirror')

const editor = new EditorView(domNode, {
  state: EditorState.create({
    plugins: [ySyncPlugin(yXmlFragment), ...]
  })
})

// 모든 편집이 Yjs op 로 변환 → WebSocket 으로 전송 → 다른 클라이언트 sync
```

ProseMirror 의 transaction 을 Yjs op 로 변환하는 어댑터가 핵심. Y-WebSocket 또는 Y-WebRTC 가 transport.

## Storage / Sync Layer

```
Yjs:
  - y-websocket: WebSocket 서버 + 메모리/Redis state
  - y-webrtc: P2P (signaling 서버만)
  - y-leveldb: 서버 영구 저장

Automerge:
  - automerge-repo: 통합 sync framework
  - storage 어댑터: IndexedDB (브라우저), filesystem
  - sync 어댑터: WebSocket, MessageChannel, BroadcastChannel
```

## 트레이드오프 박스

| 측면 | Automerge | Yjs |
|---|---|---|
| op log | 전체 보존 | 압축 + GC |
| Time travel | ✓ | 제한적 |
| 메모리 | 큼 (history) | 작음 |
| Update size | 중간 | 매우 작음 (binary encoding) |
| 학습 곡선 | JS object 같은 인터페이스 | shared type 학습 필요 |
| 사용처 | Local-first 일반 | 실시간 협업 (큰 document) |

## msa 적용 검토

현 msa 에 협업 에디터 / local-first 앱 없음. 다만:

```
agent-viewer (관리 도구): 단일 사용자 → 불필요
admin (백오피스): 단일 사용자 + single-master → 불필요
ideabank (아이디어 메모): potential — 사용자가 모바일/웹 동시 편집할 가능성?
```

[17-msa-application.md](17-msa-application.md) 에서 더 자세히 검토.

## 면접 포인트

- **"협업 에디터의 데이터 모델은?"** — Map + List + Register 의 재귀 합성. Automerge / Yjs 모두 본질적으로 OR-Map(top) + RGA/Yata(text) + LWW-Register(field).
- **"Automerge 와 Yjs 의 차이?"** — Automerge 는 op log 보존 → time travel + 큰 메모리. Yjs 는 압축 + binary encoding 로 효율 우선. Yjs 가 production 큰 document 에 더 적합.
- **"Local-first 가 뭐야?"** — 데이터를 로컬에 두고 sync 는 부가. 즉시 응답 + 오프라인 동작 + 협업 + 데이터 소유. CRDT 가 핵심 building block.
- **"왜 ProseMirror/Quill 같은 에디터에 Yjs 를 끼우나?"** — 에디터 자체는 사용자 편집 op 만 알고, 분산 sync 는 Yjs 가 담당. 어댑터로 둘을 연결.

## 다음 학습

- [10-causal-context.md](10-causal-context.md) — op DAG 와 causal context 의 관계
- [12-garbage-collection.md](12-garbage-collection.md) — Yjs 가 어떻게 op log 압축
- [14-crdt-vs-ot.md](14-crdt-vs-ot.md) — Google Docs 의 OT 와 비교
- [16-real-systems.md](16-real-systems.md) — Yjs / Automerge production 사례
