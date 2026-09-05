"""판정 보조 — 후보를 사람이 훑기 좋은 표(markdown)와 클릭으로 매기는 페이지(html)로 낸다 (P0-2).

`judgments.yml` 의 후보 550건을 그대로 읽으면 어느 것이 어느 모델에서 왔는지, BM25 와 벡터가 무엇을 다르게 봤는지가 안 보인다.
질의별로 한 화면에 모아 **판정할 것만** 남긴다. grade 는 만들지 않는다.

  python -m embed.review sheet --judgments judgments.yml --out review.md [--queries 궁궐,한옥] [--only-ungraded]
  python -m embed.review html  --judgments judgments.yml --out review.html [--rerank rerank/] [--queries core]
  python -m embed.review apply --judgments judgments.yml --grades grades.json --out judgments.yml
  python -m embed.review stats --judgments judgments.yml
"""
from __future__ import annotations

import argparse
import json
from collections import Counter

import yaml

CORE = ["궁궐", "한옥", "바다가 보이는 곳", "아이와 갈만한 곳", "조용한 사찰", "야경 명소",
        "일출 명소", "실내 놀거리", "palace in seoul", "kids friendly place"]


def load(path: str) -> dict:
    return yaml.safe_load(open(path, encoding="utf-8"))


def rows(query: dict) -> list[dict]:
    """BM25 후보와 벡터 후보를 한 목록으로. 같은 문서가 양쪽에 있으면 출처를 합친다."""
    merged: dict[str, dict] = {}
    for rank, c in enumerate(query.get("candidates", []), start=1):
        merged[str(c["id"])] = {"id": str(c["id"]), "title": c["title"], "category": c.get("category") or "",
                                "address": (c.get("address") or "")[:20], "from": [f"bm25#{rank}"], "grade": c.get("grade")}
    for c in query.get("vector_candidates", []):
        key = str(c["id"])
        src = [f"vec:{m}" for m in c.get("models", [])]
        if key in merged:
            merged[key]["from"] += src
        else:
            merged[key] = {"id": key, "title": c["title"], "category": c.get("category") or "",
                           "address": (c.get("address") or "")[:20], "from": src, "grade": c.get("grade")}
    return list(merged.values())


def sheet(doc: dict, queries: list[str] | None, only_ungraded: bool) -> str:
    out = ["# 판정 시트 — grade 를 3(정확) / 2(관련) / 1(약함) / 0(무관) 으로 적는다",
           "",
           "> 빠르게 하려면 **3 과 0 만** 써도 된다. 판정하지 않은 질의는 평가에서 빠진다(자동 정답 없음).",
           "> `from` 은 그 문서를 어디서 찾았는지다 — `bm25#n` 은 현재 검색의 n위, `vec:모델` 은 그 모델의 벡터 상위 10.",
           ""]
    for q in doc["queries"]:
        if queries and q["query"] not in queries:
            continue
        rs = rows(q)
        if only_ungraded:
            rs = [r for r in rs if r["grade"] is None]
        if not rs:
            continue
        out += [f"## {q['query']}  `{q.get('lang','ko')}`", "", f"의도: {q.get('intent','')}", "",
                "| grade | 제목 | 분류 | 주소 | 찾은 곳 |", "|---|---|---|---|---|"]
        for r in sorted(rs, key=lambda x: (0 if any(f.startswith("bm25") for f in x["from"]) else 1, x["title"])):
            g = "" if r["grade"] is None else str(r["grade"])
            out.append(f"| {g} | {r['title']} | {r['category']} | {r['address']} | {' '.join(r['from'])} |")
        out.append("")
    return "\n".join(out)


def stats(doc: dict) -> str:
    qs = doc["queries"]
    bm = sum(len(q.get("candidates", [])) for q in qs)
    vc = sum(len(q.get("vector_candidates", [])) for q in qs)
    graded = sum(1 for q in qs for c in q.get("candidates", []) + q.get("vector_candidates", []) if c.get("grade") is not None)
    per_model = Counter(m for q in qs for c in q.get("vector_candidates", []) for m in c.get("models", []))
    judged_q = sum(1 for q in qs if any(c.get("grade") is not None for c in q.get("candidates", []) + q.get("vector_candidates", [])))
    lines = [f"질의 {len(qs)}개 · 후보 {bm + vc}건 (BM25 {bm} + 벡터 {vc}) · 판정됨 {graded}건 / 판정된 질의 {judged_q}개",
             "모델별 벡터 후보 기여: " + (", ".join(f"{k} {v}" for k, v in per_model.most_common()) or "(없음)")]
    overlap = [len({str(c["id"]) for c in q.get("candidates", [])} &
                   {str(c["id"]) for c in q.get("vector_candidates", [])}) for q in qs]
    lines.append(f"질의당 BM25∩벡터 겹침 평균 {sum(overlap)/max(len(overlap),1):.1f}건 — 겹침이 작을수록 벡터가 새로 찾은 것이 많다")
    return "\n".join(lines)


def payload(doc: dict, queries: list[str] | None, rerank_dir: str | None) -> dict:
    """HTML 이 읽을 데이터. 후보마다 어느 모델이 몇 위로 봤는지(ranks)를 붙여 판정에 참고가 되게 한다."""
    ranks: dict[tuple[str, str], dict[str, int]] = {}
    if rerank_dir:
        import glob as _glob
        for f in sorted(_glob.glob(f"{rerank_dir}/rerank_*.json")):
            r = json.load(open(f, encoding="utf-8"))
            for q, hits in r["per_query"].items():
                for i, h in enumerate(hits, start=1):
                    ranks.setdefault((q, str(h["id"])), {})[r["model"]] = i
    out = []
    for q in doc["queries"]:
        if queries and q["query"] not in queries:
            continue
        items = []
        for r in rows(q):
            items.append({**r, "ranks": ranks.get((q["query"], r["id"]), {})})
        items.sort(key=lambda x: (0 if any(f.startswith("bm25") for f in x["from"]) else 1, x["title"]))
        out.append({"query": q["query"], "lang": q.get("lang", "ko"), "intent": q.get("intent", ""), "items": items})
    return {"queries": out}


def apply_grades(doc: dict, grades: dict[str, dict[str, int]]) -> tuple[dict, int]:
    """{질의: {id: grade}} 를 judgments 에 반영한다. 없는 id 는 무시하고, null 로 지우는 것도 허용."""
    n = 0
    for q in doc["queries"]:
        g = grades.get(q["query"])
        if not g:
            continue
        for c in q.get("candidates", []) + q.get("vector_candidates", []):
            key = str(c["id"])
            if key in g:
                c["grade"] = g[key]
                n += 1
    return doc, n


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("sheet"); s.add_argument("--judgments", required=True); s.add_argument("--out", required=True)
    s.add_argument("--queries", help="쉼표 구분. 'core' 면 핵심 10질의")
    s.add_argument("--only-ungraded", action="store_true")
    h = sub.add_parser("html"); h.add_argument("--judgments", required=True); h.add_argument("--out", required=True)
    h.add_argument("--queries"); h.add_argument("--rerank", help="rerank_*.json 이 있는 디렉토리")
    p_ = sub.add_parser("apply"); p_.add_argument("--judgments", required=True); p_.add_argument("--grades", required=True)
    p_.add_argument("--out", required=True)
    t = sub.add_parser("stats"); t.add_argument("--judgments", required=True)
    a = ap.parse_args()
    doc = load(a.judgments)
    if a.cmd == "stats":
        print(stats(doc)); return
    if a.cmd == "apply":
        grades = json.load(open(a.grades, encoding="utf-8"))
        grades = grades.get("grades", grades)
        doc, n = apply_grades(doc, grades)
        from .pool import HEADER, write_judgments
        meta = {k: v for k, v in doc.items() if k != "queries"}
        write_judgments(a.out, HEADER, meta, doc["queries"])
        print(f"applied {n} grades → {a.out}")
        print(stats(load(a.out)))
        return
    qs = CORE if a.queries == "core" else (a.queries.split(",") if a.queries else None)
    if a.cmd == "html":
        data = payload(doc, qs, a.rerank)
        open(a.out, "w", encoding="utf-8").write(HTML.replace("__DATA__", json.dumps(data, ensure_ascii=False)))
        n = sum(len(q["items"]) for q in data["queries"])
        print(f"wrote {a.out} — 질의 {len(data['queries'])}개 · 후보 {n}건")
        return
    open(a.out, "w", encoding="utf-8").write(sheet(doc, qs, a.only_ungraded))
    print(f"wrote {a.out}")



HTML = r"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>통합 검색 판정</title>
<style>
:root{--bg:#fbfaf8;--fg:#1c1a17;--mut:#6b665e;--line:#e2ddd4;--card:#fff;--acc:#2f6b4f;--bm:#3b5bdb;--vec:#8b5a2b;
--g3:#2f6b4f;--g2:#5a8f6e;--g1:#b08a3e;--g0:#a33c3c;}
@media(prefers-color-scheme:dark){:root:not([data-t=light]){--bg:#16150f;--fg:#ece7dd;--mut:#9a9287;--line:#332f27;--card:#1e1c16;--acc:#7fbf9a;--bm:#8fa8ff;--vec:#d9a066;}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Pretendard",sans-serif}
header{position:sticky;top:0;z-index:9;background:var(--bg);border-bottom:1px solid var(--line);padding:12px 20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
h1{font-size:16px;margin:0;font-weight:650}
.bar{flex:1;min-width:180px;height:7px;background:var(--line);border-radius:4px;overflow:hidden}
.bar>i{display:block;height:100%;background:var(--acc);width:0;transition:width .25s}
button{font:inherit;border:1px solid var(--line);background:var(--card);color:var(--fg);border-radius:7px;padding:5px 11px;cursor:pointer}
button:hover{border-color:var(--acc)}
main{max-width:1080px;margin:0 auto;padding:20px}
section{background:var(--card);border:1px solid var(--line);border-radius:12px;margin-bottom:18px;overflow:hidden}
.qh{padding:14px 18px;border-bottom:1px solid var(--line)}
.qh h2{margin:0 0 3px;font-size:17px}.qh p{margin:0;color:var(--mut);font-size:13px}
.qh .cnt{float:right;color:var(--mut);font-size:12px;font-variant-numeric:tabular-nums}
table{width:100%;border-collapse:collapse}
td{padding:7px 10px;border-top:1px solid var(--line);vertical-align:middle}
tr.done{opacity:.5}
.t{font-weight:550}.m{color:var(--mut);font-size:12.5px}
.src{font-size:11px;color:var(--mut);white-space:nowrap}
.src b{font-weight:600;color:var(--bm)}.src i{font-style:normal;color:var(--vec)}
.gs{display:flex;gap:4px;justify-content:flex-end}
.gs button{padding:3px 9px;min-width:32px;font-size:13px;font-variant-numeric:tabular-nums}
.gs button[data-on]{color:#fff;border-color:transparent}
.gs button[data-g="3"][data-on]{background:var(--g3)}.gs button[data-g="2"][data-on]{background:var(--g2)}
.gs button[data-g="1"][data-on]{background:var(--g1)}.gs button[data-g="0"][data-on]{background:var(--g0)}
dialog{border:1px solid var(--line);border-radius:12px;background:var(--card);color:var(--fg);max-width:640px;width:92%}
textarea{width:100%;height:260px;font:12px/1.4 ui-monospace,Menlo,monospace;background:var(--bg);color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:9px}
.hint{color:var(--mut);font-size:12.5px;margin:10px 0 0}
</style></head><body>
<header>
  <h1>통합 검색 판정</h1>
  <div class="bar"><i id="pi"></i></div>
  <span id="ps" class="m"></span>
  <button id="hide">미판정만</button>
  <button id="exp">내보내기</button>
</header>
<main id="app"></main>
<dialog id="dlg">
  <h3 style="margin:14px 18px 6px">판정 내보내기</h3>
  <div style="padding:0 18px 18px">
    <p class="hint" style="margin-top:0">아래를 <code>grades.json</code> 으로 저장하거나, 「파일로 저장」을 누르세요.</p>
    <textarea id="out" readonly></textarea>
    <p style="display:flex;gap:8px;margin-top:10px">
      <button id="dl">파일로 저장</button><button id="cp">복사</button><button id="cl">닫기</button>
    </p>
  </div>
</dialog>
<script>
const DATA = __DATA__;
const KEY = "kgd-judge-v1";
let G = JSON.parse(localStorage.getItem(KEY) || "{}");
let hideDone = false;
const app = document.getElementById("app");

function total(){ return DATA.queries.reduce((a,q)=>a+q.items.length,0); }
function graded(){ return Object.values(G).reduce((a,m)=>a+Object.keys(m).length,0); }
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(G)); }catch(e){} paint(); }
function paint(){
  const t=total(), g=graded();
  document.getElementById("pi").style.width = (t? g/t*100:0)+"%";
  document.getElementById("ps").textContent = `${g} / ${t}`;
}
function srcHtml(from, ranks){
  const parts = from.map(f => f.startsWith("bm25") ? `<b>${f}</b>` : `<i>${f.replace("vec:","")}</i>`);
  const rk = Object.entries(ranks||{}).map(([m,r])=>`${m.replace("qwen3-","q")}#${r}`).join(" ");
  return parts.join(" ") + (rk? ` <span style="opacity:.7">· ${rk}</span>`:"");
}
function render(){
  app.innerHTML = "";
  for (const q of DATA.queries){
    const gq = G[q.query] || {};
    const items = hideDone ? q.items.filter(i => !(i.id in gq)) : q.items;
    if (!items.length) continue;
    const sec = document.createElement("section");
    const done = q.items.filter(i => i.id in gq).length;
    sec.innerHTML = `<div class="qh"><span class="cnt">${done}/${q.items.length}</span>
      <h2>${q.query} <span class="m">${q.lang}</span></h2><p>${q.intent||""}</p></div>`;
    const tb = document.createElement("table");
    for (const it of items){
      const tr = document.createElement("tr");
      if (it.id in gq) tr.className = "done";
      tr.innerHTML = `<td><span class="t">${it.title}</span> <span class="m">${it.category||""}</span><br>
          <span class="m">${it.address||""}</span></td>
        <td class="src">${srcHtml(it.from, it.ranks)}</td>
        <td style="width:190px"><div class="gs">${[3,2,1,0].map(n=>
          `<button data-g="${n}" ${gq[it.id]===n?'data-on':''}>${n}</button>`).join("")}</div></td>`;
      tr.querySelectorAll("button").forEach(b => b.onclick = () => {
        const n = +b.dataset.g;
        G[q.query] = G[q.query] || {};
        if (G[q.query][it.id] === n) delete G[q.query][it.id]; else G[q.query][it.id] = n;
        if (!Object.keys(G[q.query]).length) delete G[q.query];
        save(); render();
      });
      tb.appendChild(tr);
    }
    sec.appendChild(tb); app.appendChild(sec);
  }
  if (!app.children.length) app.innerHTML = '<p class="m">판정할 것이 없습니다.</p>';
}
document.getElementById("hide").onclick = e => { hideDone = !hideDone; e.target.textContent = hideDone? "전체 보기":"미판정만"; render(); };
document.getElementById("exp").onclick = () => {
  document.getElementById("out").value = JSON.stringify({grades:G}, null, 1);
  document.getElementById("dlg").showModal();
};
document.getElementById("cl").onclick = () => document.getElementById("dlg").close();
document.getElementById("cp").onclick = async e => {
  try{ await navigator.clipboard.writeText(document.getElementById("out").value); e.target.textContent="복사됨"; }
  catch(err){ document.getElementById("out").select(); }
};
document.getElementById("dl").onclick = () => {
  const b = new Blob([document.getElementById("out").value], {type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = "grades.json"; a.click();
};
render(); paint();
</script></body></html>
"""


if __name__ == "__main__":
    main()
