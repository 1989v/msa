"""Market sources → preflighted, identity-preserving internal upserts (ADR-0109).

Bulk ZIP is disk-backed; province CSVs are streamed into a target-dong SQLite
index. Prepared requests are spooled, and no place writes occur before preflight.
"""
from __future__ import annotations

import csv
import hashlib
import io
import json
import math
import os
import re
import sqlite3
import tempfile
import zipfile
from collections import Counter
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

from . import datagokr, place_client, quota
from .transit_stops import download

STREET_RADIUS_M = 300
BUILDING_RADIUS_M = 150
ROAD_MIN_ONNURI_MERCHANTS = 11
ROAD_MIN_ONNURI_SHARE = .30
MAX_MARKET_FAILURE_RATIO = .05
MAX_CALL_FAILURE_RATIO = .05
DAILY_API_BUDGET = 9_000  # provider 10,000/day; reserve 1,000 for other callers
MAX_PAGES_PER_MARKET = 18  # 482 × 18 = 8,676 < 9,000
API_PAGE_SIZE = 1_000
FILE_MAX_BYTES = 600 * 1024 * 1024
API_PATH = "B553077/api/open/sdsc2"
SANGGA_QUOTA_PROVIDER = "sangga-market"
quota.DAILY_LIMIT[SANGGA_QUOTA_PROVIDER] = DAILY_API_BUDGET


def norm(s):
    s = re.sub(r"\s+", "", s or "")
    for a, b in (("서울특별시", "서울"), ("경기도", "경기"), ("부산광역시", "부산"),
                 ("대구광역시", "대구"), ("인천광역시", "인천"), ("광주광역시", "광주"),
                 ("대전광역시", "대전"), ("울산광역시", "울산"), ("특별자치도", "")):
        s = s.replace(a, b)
    return s


def locality(address):
    m = re.match(r"(.+?(?:시|군|구))", norm(address))
    return m[1] if m else ""


def parcel(address):
    """Whitespace-free source addresses, including 서울중구남창동49; never cross legal dong."""
    m = re.match(r"(.+?(?:동\d+가|로\d+가|동|리|읍|면))(?=\d|$)(\d+(?:-\d+)?)?", norm(address))
    return (m[1], m[2] or "") if m else ("", "")


def raw(row):
    return json.dumps(row, ensure_ascii=False, separators=(",", ":"))


def key(*parts):
    return hashlib.sha256("|".join(norm(p) for p in parts).encode()).hexdigest()


def coords(row):
    try:
        lat, lng = float(row.get("위도", row.get("lat"))), float(row.get("경도", row.get("lon")))
        return (lat, lng) if math.isfinite(lat) and math.isfinite(lng) and 33 <= lat <= 39 and 124 <= lng <= 132 else None
    except (TypeError, ValueError):
        return None


def distance(a, b):
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    x = math.sin((lat2-lat1)/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(math.radians(b[1]-a[1])/2)**2
    return 12_742_000 * math.asin(min(1, math.sqrt(x)))


def road(row):
    text = row.get("도로명") or row.get("rdnm") or row.get("도로명주소") or row.get("rdnmAdr") or ""
    m = re.search(r"([^\s]+(?:로\d*번?[가-힣]*길|로|길))(?:\s|$)", text)
    return m[1] if m else ""


def sangga_row(row):
    """API fields → lookup columns only; caller retains original row unchanged in raw JSON."""
    aliases = {"상가업소번호": "bizesId", "상호명": "bizesNm", "지번주소": "lnoAdr", "도로명주소": "rdnmAdr",
               "도로명": "rdnm", "위도": "lat", "경도": "lon", "법정동명": "ldongNm",
               "상권업종대분류명": "indsLclsNm", "상권업종중분류명": "indsMclsNm", "상권업종소분류명": "indsSclsNm",
               "건물관리번호": "bldMngNo", "건물명": "bldNm", "동정보": "dongNo", "층정보": "flrNo", "호정보": "hoNo"}
    return row["_normalized"] if "_normalized" in row else {k: row.get(k, row.get(v, "")) for k, v in aliases.items()}


def read_csv(path, required, encoding="utf-8-sig"):
    with open(path, encoding=encoding, newline="") as f:
        reader = csv.DictReader(f)
        if not set(required) <= set(reader.fieldnames or []):
            raise ValueError(f"CSV header missing {required}")
        yield from reader


class SanggaIndex:
    def __init__(self, path):
        self.db = sqlite3.connect(path)
        self.db.execute("CREATE TABLE shops (id TEXT PRIMARY KEY, dong TEXT, parcel TEXT, name TEXT, payload TEXT)")
        self.db.execute("CREATE INDEX lookup ON shops(dong,parcel,name)")
        self.db.execute("CREATE INDEX names ON shops(dong,name)")

    def add(self, original):
        row = sangga_row(original)
        dong, number = parcel(row["지번주소"])
        sid = row["상가업소번호"]
        if not dong or not sid:
            raise ValueError("Sangga row missing legal dong/source key")
        self.db.execute("INSERT OR REPLACE INTO shops VALUES(?,?,?,?,?)", (sid,dong,number,norm(row["상호명"]),raw(original)))

    def match(self, onnuri):
        dong, number = parcel(onnuri["주소"])
        if not dong:
            return None
        name = norm(onnuri["점포명"])
        for where, args in (("dong=? AND parcel=? AND name=?", (dong,number,name)),
                            ("dong=? AND parcel=?", (dong,number)), ("dong=? AND name=?", (dong,name))):
            if "parcel" in where and not number:
                continue
            rows = self.db.execute("SELECT payload FROM shops WHERE " + where + " ", args).fetchall()
            if len(rows) == 1:
                return json.loads(rows[0][0])
            if rows and where == "dong=? AND parcel=?":
                originals = [json.loads(r[0]) for r in rows]
                normalized = [sangga_row(r) for r in originals]
                points = [coords(r) for r in normalized]
                if points[0] is not None and all(p == points[0] for p in points):
                    # Spatial evidence is common to the parcel; do not invent a tenant/source ID.
                    shared = {k:v for k,v in normalized[0].items()
                              if k != "상가업소번호" and all(r.get(k) == v for r in normalized)}
                    shared["상가업소번호"] = ""
                    return {"parcelCandidates": originals, "_normalized": shared}
        return None

    def dong_rows(self, dongs):
        for dong in sorted(dongs):
            for (payload,) in self.db.execute("SELECT payload FROM shops WHERE dong=?", (dong,)):
                yield json.loads(payload)

    def close(self):
        self.db.close()


def load_bulk(path, index, target_dongs):
    count = 0
    with zipfile.ZipFile(path) as archive:
        for info in archive.infolist():
            if not info.filename.lower().endswith(".csv"):
                continue
            with archive.open(info) as stream, io.TextIOWrapper(stream, encoding="utf-8-sig", newline="") as text:
                reader = csv.DictReader(text)
                if not {"상가업소번호", "지번주소", "상호명"} <= set(reader.fieldnames or []):
                    raise ValueError("Unexpected bulk CSV header")
                for row in reader:
                    if parcel(row["지번주소"])[0] in target_dongs:
                        index.add(row)
                        count += 1
            index.db.commit()
    if count == 0:
        raise ValueError("No bulk rows for target legal dongs")
    return count


def road_density(candidates, population, center, radius):
    """Unique matched merchants / all same-road shops inside first-pass radius."""
    denominator, numerator = Counter(), {}
    for original in population:
        r = sangga_row(original); c = coords(r)
        if c and center and distance(center, c) <= radius:
            denominator[road(r)] += 1
    for merchant, original in candidates:
        if original:
            r = sangga_row(original); c = coords(r)
            if c and center and distance(center, c) <= radius:
                numerator.setdefault(road(r), set()).add(key(merchant["시장명"],merchant["점포명"],merchant["주소"]))
    return {r: (len(ids), len(ids)/max(denominator[r], len(ids))) for r,ids in numerator.items()}


def membership(point, center, radius, r, densities):
    if point is None or center is None:
        return "UNKNOWN"
    if distance(center, point) > radius:
        return "OUT"
    count, share = densities.get(r, (0,0))
    return "IN" if count >= ROAD_MIN_ONNURI_MERCHANTS and share >= ROAD_MIN_ONNURI_SHARE else "OUT"


class StoreApi:
    def __init__(self, service_key, fetch=None, ledger=None):
        self.key, self.fetch = service_key, fetch
        self.ledger = ledger or quota.QuotaLedger()
        self.calls = self.failures = 0

    def page(self, operation, params):
        if self.calls >= DAILY_API_BUDGET or not self.ledger.try_acquire(SANGGA_QUOTA_PROVIDER):
            raise datagokr.BudgetExhausted("Sangga daily budget exhausted")
        self.calls += 1
        url = f"https://apis.data.go.kr/{API_PATH}/{operation}?serviceKey={self.key}&{urlencode(params)}"
        try:
            status, text = self.fetch(url) if self.fetch else datagokr._http_get(url)
            envelope = json.loads(text) if text.lstrip().startswith("{") else None
            if envelope and "header" in envelope:
                text = json.dumps({"response": envelope})
            return datagokr.parse(status, text, "sangga-market")
        except Exception:
            self.failures += 1
            raise

    def stores(self, market, polygons):
        center = (market["latitude"], market["longitude"])
        if None in center:
            return []
        radius = BUILDING_RADIUS_M if market["marketType"] == "BUILDING" else STREET_RADIUS_M
        # Official swagger: https://www.data.go.kr/data/15012005/openapi.do
        queries = [("storeListInPolygon", {"key": p}) for p in polygons] or [
            ("storeListInRadius", {"cx":center[1], "cy":center[0], "radius":radius})]
        result = {}
        page_calls = 0
        for operation, params in queries:
            page = 1
            while True:
                page_calls += 1
                if page_calls > MAX_PAGES_PER_MARKET:
                    raise datagokr.BudgetExhausted("Market pagination exceeds reserved budget")
                body = self.page(operation, {**params, "pageNo":page, "numOfRows":API_PAGE_SIZE, "type":"json"})
                rows = datagokr.items(body)
                for row in rows:
                    sid = sangga_row(row)["상가업소번호"]
                    if not sid:
                        raise ValueError("API row missing store key")
                    result[sid] = row
                total = int(body.get("totalCount", len(rows)))
                if page * API_PAGE_SIZE >= total:
                    break
                if not rows:
                    raise ValueError("Empty API page before totalCount")
                page += 1
        return list(result.values())


def identify(attractions, standards):
    out = {}
    for a in attractions:
        if a.get("lang") != "ko" or a.get("status") != "ACTIVE" or not place_client.is_tourapi(a):
            continue
        name = a.get("title") or ""
        if "시장" not in name and a.get("cat3") not in {"A04010100","A04010200"} and a.get("lclsSystm2") not in {"SH04","SH06"}:
            continue
        address = a.get("addr1") or a.get("address") or ""
        # Require same normalized locality rather than choosing one of many namesakes.
        region = locality(address)
        matches = [s for s in standards if norm(s["시장명"]) == norm(name) and region and
                   locality(s.get("소재지도로명주소") or s.get("소재지지번주소")) == region]
        s = matches[0] if len(matches) == 1 else None
        market = {"attractionContentId":str(a["contentId"]), "name":name,
                  "marketType":"BUILDING" if s and "건물" in s.get("시장유형", "") else "STREET",
                  "latitude":a.get("latitude"), "longitude":a.get("longitude"), "marketInfoMatched":s is not None}
        if s:
            point = coords(s)
            if point:
                market.update(latitude=point[0], longitude=point[1])
            market.update(sourceKey=key(s["시장명"],s.get("소재지지번주소") or s.get("소재지도로명주소", "")), sourceRaw=raw(s),
                          roadAddress=s.get("소재지도로명주소"), jibunAddress=s.get("소재지지번주소"),
                          sourceMarketType=s.get("시장유형"), storeCountRaw=s.get("점포수"), openingCycle=s.get("개설주기"),
                          facilities=raw({k:v for k,v in s.items() if "보유" in k or "시설" in k}))
        out[market["attractionContentId"]] = market
    if not out:
        raise ValueError("No active Korean market attractions")
    matched_keys = [m["sourceKey"] for m in out.values() if m.get("sourceKey")]
    if len(set(matched_keys)) != len(matched_keys):
        raise ValueError("Duplicate standardized market source key across attraction content IDs")
    return list(out.values())


def prepare(market, merchants, index, api_rows):
    matched = [(o,index.match(o)) for o in merchants]
    dongs = ({parcel(o["주소"])[0] for o in merchants} | {parcel(market.get("jibunAddress"))[0]}) - {""}
    population = list(index.dong_rows(dongs))
    by_id = {sangga_row(r)["상가업소번호"]: r for r in population}
    by_id.update({sangga_row(r)["상가업소번호"]: r for r in api_rows})
    center = (market["latitude"],market["longitude"]) if market.get("latitude") is not None and market.get("longitude") is not None else None
    radius = BUILDING_RADIUS_M if market["marketType"] == "BUILDING" else STREET_RADIUS_M
    densities = road_density(matched, by_id.values(), center, radius)
    stores, zones, used = {}, {}, set()
    def make(original, o=None):
        r = sangga_row(original) if original else {}
        c = coords(r); rname = road(r)
        sid = r.get("상가업소번호") or None; source = "ONNURI" if o else "SANGGA"
        skey = key(o["시장명"],o["점포명"],o["주소"]) if o else sid
        if sid:
            used.add(sid)
        zone_key = None
        if rname:
            zone_key = "road:"+rname
            zones[zone_key] = {"marketId":1,"kind":"ROAD","name":rname,"source":"AUTO","sourceKey":zone_key,"roadName":rname}
        if market["marketType"] == "BUILDING" and r.get("건물명"):
            building_key = "building:"+r["건물명"]+":"+(r.get("동정보") or "")
            zones[building_key] = {"marketId":1,"kind":"BUILDING","name":" ".join(filter(None,[r["건물명"],r.get("동정보")])),"source":"AUTO","sourceKey":building_key,"buildingName":r["건물명"],"dong":r.get("동정보")}
            zone_key = building_key
            if r.get("층정보"):
                zone_key = building_key+":floor:"+r["층정보"]
                zones[zone_key] = {"marketId":1,"kind":"FLOOR","name":r["층정보"],"source":"AUTO","sourceKey":zone_key,"buildingName":r["건물명"],"dong":r.get("동정보"),"floor":r["층정보"],"_parentKey":building_key}
        row = {"marketId":1,"name":o["점포명"] if o else r["상호명"],"source":source,"sourceKey":skey,
               "latitude":c[0] if c else None,"longitude":c[1] if c else None,
               "membership":{"status":membership(c,center,radius,rname,densities)}, "roadName":rname or None,
               "roadAddress":r.get("도로명주소"),"jibunAddress":r.get("지번주소") or (o["주소"] if o else None)}
        for field, column in (("categoryMajor","상권업종대분류명"),("categoryMid","상권업종중분류명"),("categorySub","상권업종소분류명"),("buildingManagementNo","건물관리번호"),("buildingName","건물명"),("dong","동정보"),("floor","층정보"),("ho","호정보")):
            row[field] = r.get(column) or None
        if o:
            row.update(items=o["취급품목"],onnuriKey=skey,onnuriRaw=raw(o))
        if original:
            row.update(sanggaKey=sid,sanggaRaw=raw(original))
        stores[(source,skey)] = {"row":row,"zoneKey":zone_key}
    for o,s in matched:
        # Same Sangga parcel may match multiple Onnuri names; unique Sangga key belongs to one row only.
        make(s if not s or sangga_row(s)["상가업소번호"] not in used else None,o)
    for s in api_rows:
        if sangga_row(s)["상가업소번호"] not in used:
            make(s)
    return {"market":market,"zones":[{"row":{k:v for k,v in z.items() if k != "_parentKey"},"parentKey":z.get("_parentKey")} for z in sorted(zones.values(), key=lambda z:bool(z.get("_parentKey")))],"stores":list(stores.values()),"observedSourceKeys":[skey for _,skey in stores]}


def check_failures(markets, failed_markets, calls, failed_calls):
    if not markets or failed_markets / markets > MAX_MARKET_FAILURE_RATIO:
        raise ValueError(f"Market failure ratio {failed_markets}/{markets} exceeds {MAX_MARKET_FAILURE_RATIO}")
    if calls and failed_calls / calls > MAX_CALL_FAILURE_RATIO:
        raise ValueError(f"API failure ratio {failed_calls}/{calls} exceeds {MAX_CALL_FAILURE_RATIO}")


def run(standard_url, onnuri_url, bulk_url, service_key):
    with tempfile.TemporaryDirectory(prefix="market-stores-") as tmp:
        base = Path(tmp)
        standards = list(read_csv(download(standard_url,FILE_MAX_BYTES,base/'standard.csv'), ["시장명"]))
        merchants = list(read_csv(download(onnuri_url,FILE_MAX_BYTES,base/'onnuri.csv'), ["시장명","점포명","취급품목","주소"]))
        if not standards or not merchants:
            raise ValueError("Empty market source")
        markets = identify(place_client.fetch_market_attractions(), standards)
        grouped = {}
        for o in merchants:
            grouped.setdefault(norm(o["시장명"]), []).append(o)
        target = ({parcel(o["주소"])[0] for m in markets for o in grouped.get(norm(m["name"]), [])}
                  | {parcel(m.get("jibunAddress"))[0] for m in markets}) - {""}
        index = SanggaIndex(base/'sangga.db')
        try:
            load_bulk(download(bulk_url,FILE_MAX_BYTES,base/'bulk.zip'),index,target)
            api = StoreApi(service_key)
            failed, errors, paths = 0, [], []
            for i,m in enumerate(markets):
                try:
                    state = place_client.market_state(m["attractionContentId"])
                    polygons = [z["polygonWkt"] for z in (state or {}).get("zones",[]) if z.get("polygonWkt")]
                    command = prepare(m,grouped.get(norm(m["name"]),[]),index,api.stores(m,polygons))
                    path = base/f'market-{i}.json'; path.write_text(raw(command)); paths.append(path)
                except Exception as e:
                    failed += 1; errors.append(f"{m['attractionContentId']}: {type(e).__name__}")
            check_failures(len(markets),failed,api.calls,api.failures)
            # ALL validation precedes writes. Failed markets remain unchanged; accepted markets upsert in chunks.
            applied = 0
            for path in paths:
                command = json.loads(path.read_text())
                stores = command["stores"]
                for start in range(0,max(1,len(stores)),place_client.BULK_CHUNK):
                    place_client.put_market({**command,"stores":stores[start:start+place_client.BULK_CHUNK]})
                applied += 1
            summary = {"markets":applied,"failedMarkets":failed,"calls":api.calls,"failedCalls":api.failures,"errors":errors}
            print(f"[market-stores] {raw(summary)}",flush=True)
            return summary
        finally:
            index.close()
