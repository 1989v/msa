export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
K="sudo -E kubectl -n commerce"
OS=$($K get pod --no-headers -o custom-columns=N:.metadata.name | grep opensearch | head -1)
SPOD=$($K get pod -l app.kubernetes.io/name=search --field-selector=status.phase=Running --no-headers -o custom-columns=N:.metadata.name | head -1)
$K port-forward pod/$OS 19211:9200 >/tmp/pl1.log 2>&1 & P1=$!
$K port-forward pod/$SPOD 18095:8099 >/tmp/pl2.log 2>&1 & P2=$!
sleep 6
python3 - <<'PY'
import json, urllib.request
OS="http://127.0.0.1:19211"; ENC="http://127.0.0.1:18095"
MODEL="microsoft/harrier-oss-v1-270m@31de22b#d640"
def post(u,b):
    r=urllib.request.Request(u,data=json.dumps(b).encode(),headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(r,timeout=60))
def scores(q, ids, query):
    h=post(OS+"/attractions/_search",{"size":len(ids),"_source":False,"query":{"bool":{"must":[query],"filter":[{"ids":{"values":ids}}]}}})
    return {x["_id"]:x["_score"] for x in h["hits"]["hits"]}
pool=json.load(open("/tmp/ltr-pool.json")); rows=[]
for q in pool:
    t,lang=q["query"],q["lang"]; cand=q["C"][:20]
    if not cand: continue
    f={}
    f["bm_title"]=scores(t,cand,{"multi_match":{"query":t,"fields":["title","title.en","titleLocal"]}})
    f["bm_overview"]=scores(t,cand,{"multi_match":{"query":t,"fields":["overview","overview.en"]}})
    f["bm_address"]=scores(t,cand,{"multi_match":{"query":t,"fields":["address","address.en"]}})
    f["bm_all"]=scores(t,cand,{"multi_match":{"query":t,"fields":["title^3","title.en^3","titleLocal^3","overview","overview.en","address","address.en"]}})
    f["phrase_title"]=scores(t,cand,{"multi_match":{"query":t,"type":"phrase","fields":["title","title.en","titleLocal"]}})
    v=post(ENC+"/encode",{"query":t})["vector"]
    kn=post(OS+"/attractions/_search",{"size":100,"_source":False,"query":{"knn":{"embedding":{"vector":v,"k":100,"filter":{"bool":{"filter":[{"term":{"lang":lang}},{"term":{"embeddingModel":MODEL}}]}}}}}})
    knn={x["_id"]:x["_score"] for x in kn["hits"]["hits"]}
    src=post(OS+"/attractions/_mget?_source_includes=title,category,overview,setting,contentTypeId",{"ids":cand})["docs"]
    meta={d["_id"]:d.get("_source",{}) for d in src}
    for rank,doc in enumerate(cand):
        m=meta.get(doc,{})
        rows.append({"query":t,"lang":lang,"doc":doc,"c_rank":rank,
            "a_rank":q["A"].index(doc) if doc in q["A"] else 20,"b_rank":q["B"].index(doc) if doc in q["B"] else 20,
            **{k:f[k].get(doc,0.0) for k in f},"knn":knn.get(doc,0.0),
            "category":m.get("category") or "","content_type":m.get("contentTypeId") or "","setting":m.get("setting") or "",
            "title_len":len(m.get("title") or ""),"overview_len":len(m.get("overview") or ""),
            "title_has_query":int(t.replace(" ","").lower() in (m.get("title") or "").replace(" ","").lower())})
json.dump(rows,open("/tmp/ltr-rows.json","w"),ensure_ascii=False); print("rows",len(rows))
PY
kill $P1 $P2
