"""관광지 개요 → 실내·실외 판정 (맥 로컬 llama-server, JSON 스키마 강제).

  llama-server -hf Qwen/Qwen3-8B-GGUF:Q4_K_M --jinja -np 8 -c 32768 -ngl 99 --port 18080
  python3 extract.py docs.jsonl out.jsonl [--limit N] [--sample-seed S] [--workers 8]

대상은 관광 분류(자연·역사·문화·레포츠) 가운데 rules.py 가 정하지 못하는 문서뿐이다.
이미 out 에 있는 id 는 건너뛴다(이어서 돌리기).
"""
import argparse, json, random, sys, time, urllib.request

from rules import by_rule
from concurrent.futures import ThreadPoolExecutor

URL = "http://127.0.0.1:18080/v1/chat/completions"
TOURISM = {"nature", "history", "culture", "leisure"}


SCHEMA = {
    "type": "object",
    "properties": {"setting": {"enum": ["indoor", "outdoor", "mixed", "unknown"]}},
    "required": ["setting"],
}

SYSTEM = """너는 관광지 설명을 읽고 주로 어디서 즐기는 곳인지 판정한다.
- indoor: 주로 건물 안(박물관·전시관·미술관·과학관·실내 체험장·실내 놀이시설·공연장).
- outdoor: 주로 야외(산·바다·계곡·공원·길·섬·유적지). 문화재 건물(성문·정자·재실·서원·사찰)은 밖에서 둘러보는 곳이라 outdoor.
- mixed: 실내 시설과 야외 공간의 비중이 둘 다 큼(야외 정원이 넓은 미술관, 실내·야외 풀장 등).
- unknown: 설명으로 판단할 수 없음.
JSON 만 출력한다."""


def ask(doc):
    user = f"이름: {doc['title']}\n분류: {doc.get('category')}\n설명: {(doc.get('overview') or '')[:1200]}"
    body = {
        "messages": [{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}],
        "temperature": 0,
        "max_tokens": 20,
        "response_format": {"type": "json_schema", "json_schema": {"name": "attr", "schema": SCHEMA}},
        "chat_template_kwargs": {"enable_thinking": False},
    }
    req = urllib.request.Request(URL, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        out = json.load(r)
    attrs = json.loads(out["choices"][0]["message"]["content"])
    return {"id": doc["id"], "contentId": doc.get("contentId"), "title": doc["title"],
            "category": doc.get("category"), "attrs": attrs}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out")
    ap.add_argument("--limit", type=int); ap.add_argument("--sample-seed", type=int)
    ap.add_argument("--workers", type=int, default=4)
    a = ap.parse_args()
    docs = [json.loads(l) for l in open(a.src)]
    docs = [d for d in docs if d.get("category") in TOURISM and (d.get("overview") or "").strip()
            and by_rule(d.get("lclsSystm3")) is None]
    if a.sample_seed is not None:
        random.Random(a.sample_seed).shuffle(docs)
    done = set()
    try:
        done = {json.loads(l)["id"] for l in open(a.out)}
    except FileNotFoundError:
        pass
    todo = [d for d in docs if d["id"] not in done][: a.limit]
    print(f"대상 {len(docs)} · 완료 {len(done)} · 이번 {len(todo)}", flush=True)
    t0, n, fail = time.time(), 0, 0
    with open(a.out, "a") as out, ThreadPoolExecutor(a.workers) as ex:
        for res in ex.map(lambda d: _safe(d), todo):
            if res is None:
                fail += 1; continue
            out.write(json.dumps(res, ensure_ascii=False) + "\n"); out.flush(); n += 1
            if n % 200 == 0:
                el = time.time() - t0
                print(f"  {n}/{len(todo)} · {n/el:.2f}건/초 · 남은 {(len(todo)-n)/(n/el)/3600:.1f}시간 · 실패 {fail}", flush=True)
    print(f"끝: {n}건 · 실패 {fail} · {time.time()-t0:.0f}초", flush=True)


def _safe(d):
    try:
        return ask(d)
    except Exception as e:
        print(f"  실패 {d['id']}: {str(e)[:80]}", file=sys.stderr, flush=True)
        return None


if __name__ == "__main__":
    main()
