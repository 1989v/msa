import json,urllib.request,sys
OS=sys.argv[1]
F=["title^3","title.en^3","titleLocal^3","overview","overview.en","address","address.en"]
def cnt(q,lang,fz):
    mm={"query":q,"fields":F,"minimum_should_match":"2<75%"}
    if fz: mm["fuzziness"]="AUTO"
    body={"query":{"bool":{"must":[{"multi_match":mm}],"filter":[{"term":{"lang":lang}}]}}}
    req=urllib.request.Request(f"{OS}/attractions/_count",data=json.dumps(body).encode(),headers={"Content-Type":"application/json"})
    try: return json.load(urllib.request.urlopen(req,timeout=20))["count"]
    except urllib.error.HTTPError as e: return "ERR "+e.read().decode()[:160]
for q,l in [("botanical garedn","en"),("egypt museum","en"),("mexico beach","en"),("daejeon beach","en"),("qwxzv","en"),("zkvqjx","en"),("eiffel tower","en"),("에펠탑","ko"),("도쿄 수족관","ko"),("멕시코 해수욕장","ko"),("gyeongbokgoong","en")]:
    print(q,l,"exact",cnt(q,l,False),"fuzzy",cnt(q,l,True))
