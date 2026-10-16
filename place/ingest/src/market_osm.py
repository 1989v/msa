"""Overpass geometry drafts; each batch passes its failure gate before place writes."""
from __future__ import annotations

import json
import math
import time
from datetime import datetime, timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from . import place_client
from .market_stores import BUILDING_RADIUS_M, STREET_RADIUS_M, check_failures

OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"
REQUEST_INTERVAL_SECONDS = 2
MARKET_BATCH_SIZE = 50
BATCH_RETRY_WAIT_SECONDS = 60
OSM_REFRESH_DAYS = 28
NEAREST_BOUNDARY_MAX_M = 100
DERIVED_MARGIN_M = 20
BUFFER_ARC_STEP_DEGREES = .5  # Chord error below 0.2mm at the 20m buffer radius.
USER_AGENT = "CommercePlatform-place-ingest/1.0 (market geometry; OSM attribution)"
ALLEY_HIGHWAYS = {"footway", "pedestrian", "service", "living_street", "residential"}
BACKGROUND_HIGHWAYS = {"primary", "secondary", "tertiary", "trunk"}


def fetch_overpass(center, radius, sleep=None):
    sleep = sleep or time.sleep
    around = f"around:{radius},{center[0]},{center[1]}"
    highways = "|".join(sorted(ALLEY_HIGHWAYS | BACKGROUND_HIGHWAYS))
    query = (f'[out:json][timeout:90];(way["amenity"="marketplace"]({around});'
             f'relation["amenity"="marketplace"]({around});'
             f'way["highway"~"^({highways})$"]({around}););out body geom;')
    req = Request(OVERPASS_ENDPOINT, data=urlencode({"data": query}).encode(), method="POST",
                  headers={"User-Agent": USER_AGENT, "Accept": "application/json",
                           "Content-Type": "application/x-www-form-urlencoded"})
    retry_delays = (10, 30)
    for attempt in range(len(retry_delays) + 1):
        try:
            with urlopen(req, timeout=120) as response:
                payload = json.load(response)
            break
        except (HTTPError, URLError, TimeoutError) as exc:
            if isinstance(exc, HTTPError) and exc.code not in {429, 502, 503, 504}:
                raise
            if attempt == len(retry_delays):
                raise
            sleep(retry_delays[attempt])
    if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list) or payload.get("remark"):
        raise ValueError("Incomplete Overpass response")
    return payload


def geometry(row):
    points = [[float(p["lat"]), float(p["lon"])] for p in row.get("geometry", [])]
    if any(not math.isfinite(v) for p in points for v in p):
        raise ValueError("Invalid OSM coordinate")
    return points


def ring(element):
    if element["type"] == "way":
        points = geometry(element)
    else:
        members = element.get("members", [])
        # The contract accepts one flat polygon: never silently fill inner holes
        # or discard islands. Such relations remain intact in raw for editing.
        if any(m.get("role") == "inner" for m in members):
            return None
        pieces = [geometry(m) for m in members if m.get("type") == "way" and m.get("role", "") in ("", "outer")]
        if not pieces or any(len(p) < 2 for p in pieces):
            return None
        points = pieces.pop(0)
        while pieces:
            if points[0] == points[-1]:
                return None
            for i, piece in enumerate(pieces):
                if points[-1] == piece[-1]:
                    piece = piece[::-1]
                if points[-1] == piece[0]:
                    points += piece[1:]
                    pieces.pop(i)
                    break
            else:
                return None
    return points if len(points) >= 4 and points[0] == points[-1] and len(set(map(tuple, points))) >= 3 else None


def cross(a, b, c):
    return (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0])


def on_segment(p, a, b):
    return abs(cross(a, b, p)) < 1e-12 and all(min(a[i], b[i])-1e-12 <= p[i] <= max(a[i], b[i])+1e-12 for i in (0, 1))


def contains(p, polygon):
    inside = False
    for a, b in zip(polygon, polygon[1:]):
        if on_segment(p, a, b):
            return True
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]:
            inside = not inside
    return inside


def projected(p, origin):
    return ((p[1]-origin[1])*111_195*math.cos(math.radians(origin[0])), (p[0]-origin[0])*111_195)


def segment_distance(p, a, b):
    a, b = projected(a, p), projected(b, p)
    dx, dy = b[0]-a[0], b[1]-a[1]
    t = max(0, min(1, -(a[0]*dx+a[1]*dy)/(dx*dx+dy*dy))) if dx or dy else 0
    return math.hypot(a[0]+t*dx, a[1]+t*dy)


def select_boundary(elements, center):
    candidates = []
    for e in elements:
        if e.get("type") not in {"way", "relation"} or e.get("tags", {}).get("amenity") != "marketplace":
            continue
        polygon = ring(e)
        if polygon:
            distance = 0 if contains(center, polygon) else min(segment_distance(center, a, b) for a, b in zip(polygon, polygon[1:]))
            candidates.append((distance, f'{e["type"]}/{e["id"]}', polygon))
    if not candidates:
        return None
    distance, osm_id, polygon = min(candidates)
    return {"polygon": polygon, "source": "OSM", "osmId": osm_id} if distance <= NEAREST_BOUNDARY_MAX_M else None


def derived_boundary(points):
    """Convex hull + bounded 20m round buffer in a local metric projection."""
    points = sorted(set(map(tuple, points)))
    if len(points) < 3:
        return None
    origin = points[0]
    xy = sorted(projected(p, origin) for p in points)
    def half(rows):
        result = []
        for p in rows:
            while len(result) >= 2 and cross(result[-2], result[-1], p) <= 0:
                result.pop()
            result.append(p)
        return result
    hull = half(xy)[:-1] + half(xy[::-1])[:-1]
    if len(hull) < 3:
        return None
    normals = []
    for a, b in zip(hull, hull[1:]+hull[:1]):
        dx, dy = b[0]-a[0], b[1]-a[1]
        normals.append(math.atan2(-dx, dy))
    polygon = []
    for i, vertex in enumerate(hull):
        start = normals[i-1]
        turn = (normals[i]-start) % math.tau
        steps = max(1, math.ceil(turn/math.radians(BUFFER_ARC_STEP_DEGREES)))
        # Include both adjacent outward normals. Connecting consecutive arcs
        # then preserves the straight hull edges at their exact 20m offset.
        for step in range(steps+1):
            angle = start+turn*step/steps
            x = vertex[0]+DERIVED_MARGIN_M*math.cos(angle)
            y = vertex[1]+DERIVED_MARGIN_M*math.sin(angle)
            polygon.append([origin[0]+y/111_195, origin[1]+x/(111_195*math.cos(math.radians(origin[0])))])
    return {"polygon": polygon+polygon[:1], "source": "DERIVED", "osmId": None}


def intersects(a, b, c, d):
    if any((on_segment(p, x, y)) for p, x, y in ((a,c,d), (b,c,d), (c,a,b), (d,a,b))):
        return True
    return cross(a,b,c)*cross(a,b,d) < 0 and cross(c,d,a)*cross(c,d,b) < 0


def prepare(payload, center, radius, store_points=()):
    boundary = select_boundary(payload["elements"], center) or derived_boundary(store_points)
    paths = []
    for e in payload["elements"]:
        if e.get("type") != "way" or e.get("tags", {}).get("highway") not in ALLEY_HIGHWAYS:
            continue
        points = geometry(e)
        if len(points) < 2:
            continue
        if boundary:
            polygon = boundary["polygon"]
            keep = any(contains(p, polygon) for p in points) or any(
                intersects(a,b,c,d) for a,b in zip(points, points[1:]) for c,d in zip(polygon, polygon[1:]))
        else:
            keep = any(segment_distance(center, a, b) <= radius for a,b in zip(points, points[1:]))
        if keep:
            paths.append({"osmWayId": e["id"], "name": e.get("tags", {}).get("name"), "geometry": points})
    # One combined provider response serves all three kinds. Keep its complete
    # envelope, tags, members and unselected elements in every raw slot.
    # place reads LocalDateTime: an offset suffix ("+00:00") makes it reject the whole body.
    return {"fetchedAt": datetime.now().replace(microsecond=0).isoformat(),
            "raw": {"boundary": payload, "paths": payload, "roads": payload},
            "boundary": boundary, "paths": paths}


def in_store_points(state):
    points = []
    for row in state.get("stores", []):
        display = row["display"]
        if display.get("membership", {}).get("status") != "IN":
            continue
        coordinate = display.get("coordinate") or {}
        lat, lng = coordinate.get("latitude"), coordinate.get("longitude")
        if lat is not None and lng is not None and all(math.isfinite(float(v)) for v in (lat, lng)):
            points.append([float(lat), float(lng)])
    return points


def fetched_recently(state, now):
    """Whether place already holds an OSM fetch younger than OSM_REFRESH_DAYS for this market."""
    fetched = state.get("osmFetchedAt")
    if not fetched:
        return False
    return now - datetime.fromisoformat(fetched) < timedelta(days=OSM_REFRESH_DAYS)


def run(fetch=None, sleep=None, now=None):
    """Read, gate and write fifty markets at a time.

    The public Overpass server can take ~40s a call, so one run may not reach every market
    before the Job deadline. Markets fetched within OSM_REFRESH_DAYS are skipped, which makes
    each run continue where the last one stopped. A market whose Overpass call failed is
    called once more at the end of its batch, before the batch's failure gate.
    """
    fetch, sleep = fetch or fetch_overpass, sleep or time.sleep
    now = now or datetime.now()
    attractions = place_client.fetch_market_attractions()
    summary = {"markets": 0, "failedMarkets": 0, "calls": 0, "failedCalls": 0, "errors": [],
               "batches": 0, "skippedRecent": 0}
    total_calls = ingested = 0

    def call(center, radius):
        nonlocal total_calls
        if total_calls:
            sleep(REQUEST_INTERVAL_SECONDS)
        total_calls += 1
        payload = fetch(center, radius)
        if not isinstance(payload, dict) or not isinstance(payload.get("elements"), list) or payload.get("remark"):
            raise ValueError("Incomplete Overpass response")
        return payload

    for start in range(0, len(attractions), MARKET_BATCH_SIZE):
        prepared, failures, retries = [], {}, []
        markets = calls = skipped = 0
        for attraction in attractions[start:start + MARKET_BATCH_SIZE]:
            content_id = str(attraction["contentId"])
            markets += 1
            try:
                state = place_client.market_state(content_id)
                if state is None:  # Not yet ingested by market-stores.
                    markets -= 1
                    continue
                ingested += 1
                if fetched_recently(state, now):
                    markets -= 1
                    skipped += 1
                    continue
                market = state["market"]
                center = [float(market["latitude"]), float(market["longitude"])]
                if not all(math.isfinite(v) for v in center):
                    raise ValueError("Invalid market center")
                radius = BUILDING_RADIUS_M if market["marketType"] == "BUILDING" else STREET_RADIUS_M
                calls += 1
                try:
                    payload = call(center, radius)
                except Exception as exc:
                    failures[content_id] = (type(exc).__name__, True)
                    retries.append((content_id, market["id"], center, radius, state))
                    continue
                prepared.append((market["id"], prepare(payload, center, radius, in_store_points(state))))
            except Exception as exc:
                failures[content_id] = (type(exc).__name__, False)
        if retries:
            sleep(BATCH_RETRY_WAIT_SECONDS)
        for content_id, market_id, center, radius, state in retries:
            try:
                payload = call(center, radius)
                prepared.append((market_id, prepare(payload, center, radius, in_store_points(state))))
                del failures[content_id]
            except Exception as exc:
                failures[content_id] = (type(exc).__name__, True)
        errors = [f"{content_id}: {name}" for content_id, (name, _) in failures.items()]
        batch = {"markets": len(prepared), "failedMarkets": len(failures), "calls": calls,
                 "failedCalls": sum(1 for _, overpass in failures.values() if overpass),
                 "skippedRecent": skipped, "errors": errors}
        # Printed before the gate so a failing batch still shows which markets failed and why.
        print(f"[market-osm] batch {json.dumps(batch)}", flush=True)
        if markets:  # A batch of markets not yet ingested by market-stores has nothing to gate.
            check_failures(markets, batch["failedMarkets"], calls, batch["failedCalls"])
        for market_id, command in prepared:
            place_client._request("PUT", f"/internal/markets/{market_id}/osm", command)
            place_client._request("POST", f"/internal/markets/{market_id}/rejudge")
        for key in ("markets", "failedMarkets", "calls", "failedCalls", "skippedRecent"):
            summary[key] += batch[key]
        summary["errors"].extend(errors)
        summary["batches"] += 1
    if not ingested:
        check_failures(0, 0, 0, 0)
    print(f"[market-osm] {json.dumps(summary)}", flush=True)
    return summary
