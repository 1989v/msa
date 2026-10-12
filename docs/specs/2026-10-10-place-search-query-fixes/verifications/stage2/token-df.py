import json,urllib.request,sys
OS=sys.argv[1]
F=["title^3","title.en^3","titleLocal^3","overview","overview.en","address","address.en"]
def cnt(q,lang,fz=False):
    mm={"query":q,"fields":F}
    if fz: mm["fuzziness"]="AUTO"
    body={"query":{"bool":{"must":[{"multi_match":mm}],"filter":[{"term":{"lang":lang}}]}}}
    req=urllib.request.Request(f"{OS}/attractions/_count",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req,timeout=20))["count"]
for t in "botanical garedn egypt museum mexico beach daejeon eiffel tower gyeongbokgoong qwxzv zkvqjx".split():
    print(t, cnt(t,"en"), "fuzzy", cnt(t,"en",True))
