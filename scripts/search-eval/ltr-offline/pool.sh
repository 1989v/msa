export KUBECONFIG=/etc/rancher/k3s/k3s.yaml
# v3 판정 세트의 비-NO_ANSWER 질의마다 A·B·C top-20 을 /tmp/ltr-pool.json 으로 — features.sh 의 입력. live-eval.py·판정 파일을 /tmp/ltr2/ 에 둔다.
K="sudo -E kubectl -n commerce"
OS=$($K get pod --no-headers -o custom-columns=N:.metadata.name | grep opensearch | head -1)
SPOD=$($K get pod -l app.kubernetes.io/name=search --field-selector=status.phase=Running --no-headers -o custom-columns=N:.metadata.name | head -1)
$K port-forward pod/$OS 19211:9200 >/tmp/pl1.log 2>&1 & P1=$!
$K port-forward pod/$SPOD 18095:8099 >/tmp/pl2.log 2>&1 & P2=$!
$K port-forward pod/$SPOD 18084:8083 >/tmp/pl3.log 2>&1 & P3=$!
sleep 6
EVAL_OPENSEARCH_URL=http://127.0.0.1:19211 EVAL_ENCODER_URL=http://127.0.0.1:18095 EVAL_API_URL=http://127.0.0.1:18084/api/search/attractions python3 - <<'PY'
import importlib.util, json
spec=importlib.util.spec_from_file_location("le","/tmp/ltr2/live-eval.py"); le=importlib.util.module_from_spec(spec); spec.loader.exec_module(le)
le.K=20
out=[]
for j in json.load(open("/tmp/ltr2/judg.json")):
    if j["intent"]=="NO_ANSWER": continue
    q,l=j["query"],j["lang"]
    try:
        v=le.encode(q); C,_,_=le.ids_live(q,l)
        out.append({"query":q,"lang":l,"A":le.ids_bm25(q,l),"B":le.ids_hybrid(q,l,v),"C":C})
    except Exception as e: print("ERR",q,e)
json.dump(out,open("/tmp/ltr-pool.json","w"),ensure_ascii=False); print("pool",len(out))
PY
kill $P1 $P2 $P3
