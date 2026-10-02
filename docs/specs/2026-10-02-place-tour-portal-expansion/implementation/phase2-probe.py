# 노드에서 실행: 키는 환경변수 E(이미 인코딩된 값), 결과는 stdout JSON 한 줄(키·URL 없음)
import json, os, sys, urllib.request, datetime
E = os.environ["E"]; KST = datetime.timezone(datetime.timedelta(hours=9)); now = datetime.datetime.now(KST)
d = now.strftime("%Y%m%d"); ym = (now.replace(day=1) - datetime.timedelta(days=1)).strftime("%Y%m")
B = "https://apis.data.go.kr/B551011"; C = f"serviceKey={E}&MobileOS=ETC&MobileApp=k-tour&_type=json"
calls = [
 ("1 무장애 목록", f"{B}/KorWithService2/areaBasedList2?{C}&numOfRows=3&pageNo=1"),
 ("1 무장애 상세", f"{B}/KorWithService2/detailWithTour2?{C}&contentId=126508"),
 ("2 집중률", f"{B}/TatsCnctrRateService/tatsCnctrRatedList?{C}&numOfRows=3&pageNo=1&areaCd=11&signguCd=11110"),
 ("3 연관관광지", f"{B}/TarRlteTarService1/areaBasedList1?{C}&numOfRows=3&pageNo=1&baseYm={ym}&areaCd=11&signguCd=11110"),
 ("4 두루누비 코스", f"{B}/Durunubi/courseList?{C}&numOfRows=2&pageNo=1"),
 ("4 두루누비 길", f"{B}/Durunubi/routeList?{C}&numOfRows=2&pageNo=1"),
 ("5 고캠핑", f"{B}/GoCamping/basedList?{C}&numOfRows=2&pageNo=1"),
 ("6 관광사진", f"{B}/PhotoGalleryService1/galleryList1?{C}&numOfRows=2&pageNo=1&arrange=A"),
 ("7 웰니스", f"{B}/WellnessTursmService/areaBasedList?{C}&numOfRows=2&pageNo=1&langDivCd=KOR"),
 ("8 방문자 광역", f"{B}/DataLabService/metcoRegnVisitrDDList?{C}&numOfRows=3&pageNo=1&startYmd={(now-datetime.timedelta(days=10)).strftime('%Y%m%d')}&endYmd={(now-datetime.timedelta(days=9)).strftime('%Y%m%d')}"),
 ("8 방문자 기초", f"{B}/DataLabService/locgoRegnVisitrDDList?{C}&numOfRows=3&pageNo=1&startYmd={(now-datetime.timedelta(days=10)).strftime('%Y%m%d')}&endYmd={(now-datetime.timedelta(days=10)).strftime('%Y%m%d')}"),
 ("9 반려동물 목록", f"{B}/KorPetTourService2/areaBasedList2?{C}&numOfRows=2&pageNo=1"),
 ("10 단기예보", f"https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey={E}&dataType=JSON&numOfRows=12&pageNo=1&base_date={d}&base_time=0500&nx=60&ny=127"),
 ("11 중기 육상", f"https://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey={E}&dataType=JSON&numOfRows=1&pageNo=1&regId=11B00000&tmFc={d}0600"),
 ("11 중기 기온", f"https://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?serviceKey={E}&dataType=JSON&numOfRows=1&pageNo=1&regId=11B10101&tmFc={d}0600"),
 ("12 대기오염", f"https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey={E}&returnType=json&numOfRows=2&pageNo=1&sidoName=%EC%84%9C%EC%9A%B8&ver=1.0"),
]
out = {}
for name, url in calls:
    try:
        raw = urllib.request.urlopen(url, timeout=30).read().decode("utf-8", "ignore")
        d0 = json.loads(raw)
        if "OpenAPI_ServiceResponse" in d0:
            out[name] = {"status": d0["OpenAPI_ServiceResponse"]["cmmMsgHeader"].get("errMsg")}; continue
        r = d0.get("response", d0); h = r.get("header", {}); b = r.get("body", {}) or {}
        items = b.get("items") or {}
        items = items.get("item") if isinstance(items, dict) else items
        if isinstance(items, dict): items = [items]
        out[name] = {"status": h.get("resultCode"), "msg": h.get("resultMsg"), "total": b.get("totalCount"),
                     "keys": sorted(items[0].keys()) if items else [], "sample": items[:2] if items else []}
    except Exception as e:
        out[name] = {"status": "ERR", "msg": str(e)[:150]}
print(json.dumps(out, ensure_ascii=False))
