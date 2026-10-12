"""v3 판정으로 LTR 을 5겹 학습해 C·LTR 상위 5위가 갈리는 문서 쌍을 뽑는다(사람 블라인드 비교용)."""
import json, random, sys
import numpy as np, lightgbm as lgb
rows=json.load(open(sys.argv[1])); judg={(j["query"],j["lang"]):j["grades"] for j in json.load(open(sys.argv[2]))}
done={(p["q"],p["l"],frozenset((p["left"],p["right"]))) for p in json.load(open(sys.argv[3]))}
CATS=sorted({r["category"] for r in rows}); TYPES=sorted({r["content_type"] for r in rows})
NUM=["c_rank","a_rank","b_rank","bm_title","bm_overview","bm_address","bm_all","phrase_title","knn","title_len","overview_len","title_has_query"]
vec=lambda r:[float(r[k]) for k in NUM]+[float(r["category"]==c) for c in CATS]+[float(r["content_type"]==t) for t in TYPES]+[float(r["setting"]=="indoor"),float(r["lang"]=="en")]
by={}
for r in rows: by.setdefault((r["query"],r["lang"]),[]).append(r)
qs=sorted(by); random.Random(42).shuffle(qs); folds=[qs[i::5] for i in range(5)]
orders={}
for f,test in enumerate(folds):
    tr=[q for q in qs if q not in set(test)]; X=[];y=[];g=[]
    for q in tr:
        rs=sorted(by[q],key=lambda r:r["c_rank"]); X+=[vec(r) for r in rs]; y+=[min(3,judg[q].get(r["doc"],0)) for r in rs]; g.append(len(rs))
    m=lgb.LGBMRanker(objective="lambdarank",n_estimators=200,learning_rate=0.05,num_leaves=15,min_child_samples=10,subsample=0.8,subsample_freq=1,colsample_bytree=0.8,label_gain=[0,1,3,7],verbose=-1,random_state=f)
    m.fit(np.array(X),np.array(y),group=g)
    for q in test:
        rs=sorted(by[q],key=lambda r:r["c_rank"]); s=m.predict(np.array([vec(r) for r in rs]))
        orders[q]=([r["doc"] for r in rs],[rs[i]["doc"] for i in np.argsort(-s,kind="stable")])
rnd=random.Random(1013); first=[]; second=[]
for q,(c,l) in sorted(orders.items()):
    co=[d for d in c[:5] if d not in l[:5]]; lo=[d for d in l[:5] if d not in c[:5]]
    for i,(a,b) in enumerate(zip(co,lo)):
        if (q[0],q[1],frozenset((a,b))) in done: continue
        (first if i==0 else second).append({"q":q[0],"l":q[1],"c":a,"ltr":b,"c_rank":c.index(a),"ltr_rank_in_c":c.index(b)})
        if i>=1: break
pairs=first+second[:max(0,100-len(first))]
rnd.shuffle(pairs)
for n,p in enumerate(pairs):
    p["id"]=f"y{n:03d}"; p["c_side"]=rnd.choice(["left","right"])
json.dump(pairs,open(sys.argv[4],"w"),ensure_ascii=False,indent=1)
print("queries",len(orders),"first",len(first),"second",len(second),"pairs",len(pairs))
