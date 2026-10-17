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
# 서버는 질의 벡터를 QueryNormalizer(NFKC → 공백 축약 → 소문자 → 끝 부호 제거 → 100자)를 거친 문자열로 얻는다.
# 원문으로 인코딩하면 대소문자가 섞인 질의(DDP · KSPO DOME)의 knn·B 피처가 서버와 달라진다.
import re, unicodedata
def norm(raw):
    s=re.sub(r"\s+"," ",unicodedata.normalize("NFKC",raw)).strip().lower(); s=re.sub(r"[?!.,~\s]+$","",s)
    return s[:100].strip() if len(s)>100 else s
spec=importlib.util.spec_from_file_location("le","/tmp/ltr2/live-eval.py"); le=importlib.util.module_from_spec(spec); spec.loader.exec_module(le)
le.K=20
# C 는 LTR 을 걸기 전의 라이브 순서여야 한다. 국문은 운영에서 LTR 이 첫 장 상위 20 을 다시 줄 세우므로 첫 장을 그대로 받으면
# 학습 행의 c_rank 가 모델 자신의 출력이 된다. LTR 은 첫 장에만 걸리니 1~19위는 size=1 의 다음 장들로 읽고,
# 0위는 첫 장 상위 20 에서 남는 하나다. 하나로 정해지지 않으면 멈춘다. 영문은 LTR 을 걸지 않으니 첫 장이 곧 C 다
# (로마자 질의는 장마다 순서가 흔들려 size=1 복원이 맞지 않는다).
import urllib.parse, urllib.request
def pre_ltr_c(q,l):
    if l!="ko": return le.ids_live(q,l)[0]
    def page(size,p):
        qs=urllib.parse.urlencode({"keyword":q,"lang":l,"size":size,"page":p,"sort":"relevance"})
        req=urllib.request.Request(le.API_URL+"?"+qs,headers={"User-Agent":le.UA,"Accept":"application/json"})
        return [str(x["id"]) for x in json.load(urllib.request.urlopen(req,timeout=30))["data"]["attractions"]]
    head=page(20,0)
    rest=[page(1,p)[0] for p in range(1,len(head))]
    first=set(head)-set(rest)
    if len(first)!=1 or len(set(rest))!=len(rest): raise ValueError(f"C 복원 실패 {q} {l}")
    return [first.pop()]+rest
out=[]
for j in json.load(open("/tmp/ltr2/judg.json")):
    if j["intent"]=="NO_ANSWER": continue
    q,l=j["query"],j["lang"]
    try:
        v=le.encode(norm(q)); C=pre_ltr_c(q,l)
        out.append({"query":q,"lang":l,"A":le.ids_bm25(q,l),"B":le.ids_hybrid(q,l,v),"C":C})
    except Exception as e: print("ERR",q,e)
json.dump(out,open("/tmp/ltr-pool.json","w"),ensure_ascii=False); print("pool",len(out))
PY
kill $P1 $P2 $P3
