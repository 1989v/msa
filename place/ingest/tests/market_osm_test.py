"""Hand-built geometry and fake transports only; no OSM/place network access."""
import copy
import io
import json
from datetime import datetime
from unittest.mock import Mock, patch
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs

import pytest

from src import market_osm as osm

CENTER = [37.5, 127.0]
POLYGON = [[37.4995,126.9995], [37.4995,127.0005], [37.5005,127.0005], [37.5005,126.9995], [37.4995,126.9995]]


def way(sid, points, **tags):
    return {"type": "way", "id": sid, "tags": tags,
            "geometry": [{"lat": p[0], "lon": p[1]} for p in points]}


def response(*elements):
    return {"version": 0.6, "generator": "offline", "osm3s": {"copyright": "keep me"}, "elements": list(elements)}


def state(mid=1, kind="STREET", points=()):
    return {"market": {"id": mid, "latitude": CENTER[0], "longitude": CENTER[1], "marketType": kind},
            "stores": [{"source": {"unused": "preserved"}, "display": {
                "membership": {"status": "IN"}, "coordinate": {"latitude": p[0], "longitude": p[1]}}} for p in points]}


def test_boundary_selection_containing_before_nearest_and_far_none():
    near = [[p[0]+.0008,p[1]] for p in POLYGON]
    far = [[p[0]+.01,p[1]] for p in POLYGON]
    assert osm.select_boundary([way(1,near,amenity="marketplace"),way(2,POLYGON,amenity="marketplace")],CENTER)["osmId"] == "way/2"
    assert osm.select_boundary([way(1,near,amenity="marketplace")],CENTER)["osmId"] == "way/1"
    assert osm.select_boundary([way(1,far,amenity="marketplace")],CENTER) is None
    assert osm.select_boundary([way(1,POLYGON[:-1],amenity="marketplace")],CENTER) is None


def test_relation_joins_reversed_outer_ways_and_rejects_holes_or_islands():
    relation = {"type": "relation", "id": 12, "tags": {"amenity": "marketplace"}, "members": [
        {**way(1,POLYGON[:3]), "role": "outer"}, {**way(2,POLYGON[2:][::-1]), "role": "outer"}]}
    assert osm.select_boundary([relation], CENTER)["osmId"] == "relation/12"
    assert osm.select_boundary([{**relation,"members": relation["members"]+[{"type":"way","role":"inner"}]}], CENTER) is None
    assert osm.select_boundary([{**relation,"members": relation["members"]+[way(3,POLYGON)]}], CENTER) is None


def test_derived_hull_has_twenty_meter_margin_and_requires_three_noncollinear_points():
    result = osm.derived_boundary(POLYGON[:-1]+POLYGON[:1])
    assert result["source"] == "DERIVED" and result["osmId"] is None
    assert result["polygon"][0] == result["polygon"][-1]
    for p in POLYGON[:-1]:
        assert osm.contains(p,result["polygon"])
        assert min(osm.segment_distance(p,a,b) for a,b in zip(result["polygon"],result["polygon"][1:])) == pytest.approx(20,abs=.001)
    assert osm.derived_boundary(POLYGON[:2]) is None
    assert osm.derived_boundary([CENTER,CENTER,[37.501,127]]) is None
    assert osm.derived_boundary([[37.5,127],[37.501,127],[37.502,127]]) is None


def test_derived_thin_triangle_round_buffer_stays_within_twenty_meters_of_hull():
    # A ~176m-long, 1.1m-high street-market hull has two acute corners.
    # Intersecting offset edges produces kilometer-long miters at those corners.
    stores = [[37.5,127],[37.5,127.002],[37.50001,127.001]]
    boundary = osm.derived_boundary(stores)["polygon"]
    assert boundary[0] == boundary[-1]
    assert all(osm.contains(p,boundary) for p in stores)
    edges = list(zip(stores,stores[1:]+stores[:1]))
    for p in boundary:
        assert min(osm.segment_distance(p,a,b) for a,b in edges) <= 20.001
    for p in stores:
        assert min(osm.segment_distance(p,a,b) for a,b in zip(boundary,boundary[1:])) == pytest.approx(20,abs=.001)


def test_polygon_filter_keeps_crossing_unnamed_paths_and_complete_raw():
    crossing = [[37.5,126.99],[37.5,127.01]]
    payload = response(way(1,POLYGON,amenity="marketplace"),way(2,crossing,highway="footway"),
                       way(3,[[37.51,127],[37.52,127]],highway="service"),
                       way(4,crossing,highway="primary",name="큰길"))
    original = copy.deepcopy(payload)
    command = osm.prepare(payload,CENTER,300)
    assert command["paths"] == [{"osmWayId":2,"name":None,"geometry":crossing}]
    assert command["raw"] == {"boundary":original,"paths":original,"roads":original}
    assert payload == original


def test_no_boundary_radius_filter_uses_segment_distance_and_derived_fallback():
    payload = response(way(2,[[37.5,126.99],[37.5,127.01]],highway="residential"),
                       way(3,[[37.51,127],[37.52,127]],highway="service"))
    command = osm.prepare(payload,CENTER,150)
    assert command["boundary"] is None and len(command["paths"]) == 1
    assert osm.prepare(payload,CENTER,150,POLYGON[:-1])["boundary"]["source"] == "DERIVED"


def test_fetch_one_post_headers_query_and_no_source_field_loss():
    payload = response(way(1,POLYGON,amenity="marketplace",unknown="preserve"))
    with patch.object(osm,"urlopen",return_value=io.BytesIO(json.dumps(payload).encode())) as transport:
        assert osm.fetch_overpass(CENTER,300) == payload
    transport.assert_called_once()
    req = transport.call_args.args[0]
    assert req.full_url == osm.OVERPASS_ENDPOINT and req.method == "POST"
    assert req.get_header("User-agent") == osm.USER_AGENT and req.get_header("Accept") == "application/json"
    query = parse_qs(req.data.decode())["data"][0]
    assert 'relation["amenity"="marketplace"]' in query and 'way["amenity"="marketplace"]' in query
    assert "around:300,37.5,127.0" in query and "out body geom" in query
    for highway in osm.ALLEY_HIGHWAYS | osm.BACKGROUND_HIGHWAYS:
        assert highway in query


@pytest.mark.parametrize("payload", [{}, {"elements": [], "remark": "timeout"}])
def test_incomplete_overpass_is_failure(payload):
    with patch.object(osm,"urlopen",return_value=io.BytesIO(json.dumps(payload).encode())) as transport:
        with pytest.raises(ValueError):
            osm.fetch_overpass(CENTER,300)
    transport.assert_called_once()


def test_overpass_502_succeeds_on_retry():
    payload = response()
    sleep = Mock()
    with patch.object(osm,"urlopen",side_effect=[HTTPError(osm.OVERPASS_ENDPOINT,502,"unavailable",{},None),
                                                io.BytesIO(json.dumps(payload).encode())]) as transport:
        assert osm.fetch_overpass(CENTER,300,sleep=sleep) == payload
    assert transport.call_count == 2
    sleep.assert_called_once_with(10)


@pytest.mark.parametrize("error", [HTTPError(osm.OVERPASS_ENDPOINT,code,"unavailable",{},None) for code in (429,502,503,504)] + [
                                   URLError("offline"), TimeoutError("timeout")])
def test_overpass_stops_after_two_retries(error):
    sleep = Mock()
    with patch.object(osm,"urlopen",side_effect=error) as transport:
        with pytest.raises(type(error)):
            osm.fetch_overpass(CENTER,300,sleep=sleep)
    assert transport.call_count == 3
    assert sleep.call_args_list == [((10,),),((30,),)]


def test_overpass_400_does_not_retry():
    sleep = Mock()
    with patch.object(osm,"urlopen",side_effect=HTTPError(osm.OVERPASS_ENDPOINT,400,"bad query",{},None)) as transport:
        with pytest.raises(HTTPError):
            osm.fetch_overpass(CENTER,300,sleep=sleep)
    transport.assert_called_once()
    sleep.assert_not_called()


def test_empty_attraction_list_preserves_failure_gate():
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[]), \
         patch.object(osm.place_client,"_request") as writes:
        with pytest.raises(ValueError,match="Market failure ratio 0/0"):
            osm.run(fetch=Mock(),sleep=Mock())
    writes.assert_not_called()


def test_batch_of_only_uningested_markets_does_not_stop_the_run():
    count = osm.MARKET_BATCH_SIZE
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":str(i)} for i in range(count+1)]), \
         patch.object(osm.place_client,"market_state",side_effect=lambda cid:state() if int(cid) == count else None), \
         patch.object(osm.place_client,"_request") as writes:
        summary = osm.run(fetch=Mock(return_value=response()),sleep=Mock())
    assert summary["markets"] == 1 and summary["batches"] == 1  # uningested markets are never batched
    assert writes.call_count == 2


def test_fetched_at_is_a_local_date_time_without_offset():
    fetched = osm.prepare(response(), CENTER, 300)["fetchedAt"]
    assert datetime.fromisoformat(fetched).tzinfo is None and "+" not in fetched


def test_plan_orders_never_fetched_largest_first_then_oldest_and_skips_recent():
    now = datetime(2026, 10, 16)
    states = {"fresh": {**state(1), "osmFetchedAt": "2026-10-10T00:00:00"},
              "stale": {**state(2), "osmFetchedAt": "2026-09-01T00:00:00"},
              "small": state(3, points=POLYGON[:2]), "large": state(4, points=POLYGON[:4]),
              "oldest": {**state(5), "osmFetchedAt": "2026-08-01T00:00:00"}, "uningested": None}
    reads = Mock(side_effect=lambda cid: states[cid] if cid in states else (_ for _ in ()).throw(OSError("offline")))
    attractions = [{"contentId": cid} for cid in ("fresh", "stale", "small", "broken", "large", "oldest", "uningested")]
    with patch.object(osm.place_client,"market_state",reads):
        queue, planned = osm.plan(attractions, now)
    assert queue == ["large", "small", "oldest", "stale", "broken"]
    assert planned == {"ingested": 5, "due": 5, "neverFetched": 2, "skippedRecent": 1, "unreadable": 1}
    assert reads.call_count == len(attractions)


def test_recently_fetched_markets_are_skipped_so_each_run_continues():
    now = datetime(2026, 10, 16)
    fresh = {**state(1), "osmFetchedAt": "2026-10-10T00:00:00"}
    stale = {**state(2), "osmFetchedAt": "2026-09-01T00:00:00"}
    fetch = Mock(return_value=response())
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":"1"},{"contentId":"2"},{"contentId":"3"}]), \
         patch.object(osm.place_client,"market_state",side_effect=lambda cid: {"1": fresh, "2": stale, "3": state(3)}[cid]), \
         patch.object(osm.place_client,"_request") as writes:
        summary = osm.run(fetch=fetch,sleep=Mock(),now=now)
    assert fetch.call_count == 2 and writes.call_count == 4
    assert summary["markets"] == 2 and summary["skippedRecent"] == 1
    # Never fetched (3) is written before the stale one (2).
    assert [call.args[1] for call in writes.call_args_list] == [
        "/internal/markets/3/osm", "/internal/markets/3/rejudge", "/internal/markets/2/osm", "/internal/markets/2/rejudge"]
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":"1"}]), \
         patch.object(osm.place_client,"market_state",return_value=fresh), \
         patch.object(osm.place_client,"_request") as writes:
        assert osm.run(fetch=fetch,sleep=Mock(),now=now)["skippedRecent"] == 1
    writes.assert_not_called()


def test_failed_overpass_call_is_retried_once_at_batch_end_before_the_gate(capsys):
    fetch = Mock(side_effect=[OSError("busy")] + [response()]*20)
    sleep = Mock()
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":str(i)} for i in range(20)]), \
         patch.object(osm.place_client,"market_state",side_effect=lambda cid:state(int(cid))), \
         patch.object(osm.place_client,"_request") as writes:
        summary = osm.run(fetch=fetch,sleep=sleep)
    assert summary["failedMarkets"] == 0 and summary["markets"] == 20 and writes.call_count == 40
    assert ((osm.BATCH_RETRY_WAIT_SECONDS,),) in sleep.call_args_list
    fetch = Mock(side_effect=[OSError("busy")] + [response()]*18 + [OSError("still busy")])  # market 0 fails twice
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":str(i)} for i in range(19)]), \
         patch.object(osm.place_client,"market_state",side_effect=lambda cid:state(int(cid))), \
         patch.object(osm.place_client,"_request"):
        with pytest.raises(ValueError,match="failure ratio"):
            osm.run(fetch=fetch,sleep=Mock())
    assert '"errors": ["0: OSError"]' in capsys.readouterr().out


def test_existing_store_projection_only_uses_in_display_coordinates():
    sample = state(points=POLYGON[:-1])
    sample["stores"] += [{"display":{"membership":{"status":"OUT"},"coordinate":{"latitude":0,"longitude":0}}},
                          {"display":{"membership":{"status":"IN"},"coordinate":None}}]
    assert osm.in_store_points(sample) == POLYGON[:-1]


def test_orchestration_stages_batch_reads_then_put_and_bodyless_rejudge():
    events = []
    def read(cid):
        events.append(("read",cid))
        # Market 2 holds more shops, so the plan puts it first.
        return state(int(cid),"BUILDING" if cid == "2" else "STREET",POLYGON[:-1] if cid == "2" else POLYGON[:3])
    def fetch(center,radius):
        events.append(("fetch",radius))
        return response()
    def write(*args):
        events.append(args)
    sleep = Mock()
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":"1"},{"contentId":"2"}]), \
         patch.object(osm.place_client,"market_state",side_effect=read), patch.object(osm.place_client,"_request",side_effect=write):
        summary = osm.run(fetch=fetch,sleep=sleep)
    assert events[:6] == [("read","1"),("read","2"),("read","2"),("fetch",150),("read","1"),("fetch",300)]
    assert summary["markets"] == 2 and summary["calls"] == 2
    sleep.assert_called_once_with(osm.REQUEST_INTERVAL_SECONDS)
    for i,mid in enumerate((2,1)):
        put, post = events[6+i*2:8+i*2]
        assert put[:2] == ("PUT",f"/internal/markets/{mid}/osm")
        assert set(put[2]) == {"fetchedAt","raw","boundary","paths"}
        assert put[2]["boundary"]["source"] == "DERIVED"
        assert post == ("POST",f"/internal/markets/{mid}/rejudge")


def test_failed_second_batch_keeps_first_writes_and_never_reads_third():
    count = osm.MARKET_BATCH_SIZE
    events = []
    def read(cid):
        events.append(("read",int(cid)))
        return state(int(cid))
    def write(*args):
        events.append(args[:2])
    fetch = Mock(side_effect=[response()]*count + [OSError("offline")]*count*2)  # second batch fails twice
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":str(i)} for i in range(count*3)]), \
         patch.object(osm.place_client,"market_state",side_effect=read) as reads, \
         patch.object(osm.place_client,"_request",side_effect=write) as writes:
        with pytest.raises(ValueError,match="failure ratio"):
            osm.run(fetch=fetch,sleep=Mock())
    assert writes.call_count == count*2
    assert reads.call_count == count*3 + count*2  # one planning read per market, then one per batched market
    assert fetch.call_count == count*3
    assert events[count*4:count*6] == [event for mid in range(count) for event in
        [("PUT",f"/internal/markets/{mid}/osm"),("POST",f"/internal/markets/{mid}/rejudge")]]
    assert events[count*6] == ("read",count) and events[-1] == ("read",count*2-1)


def test_summary_aggregates_batches_and_paces_across_boundary(capsys):
    count = osm.MARKET_BATCH_SIZE
    sleep = Mock()
    fetch = Mock(side_effect=[OSError("offline")] + [response()]*(count-1) + [OSError("offline")] + [response()]*count)
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":str(i)} for i in range(count*2)]), \
         patch.object(osm.place_client,"market_state",side_effect=lambda cid:state(int(cid))), \
         patch.object(osm.place_client,"_request") as writes:
        summary = osm.run(fetch=fetch,sleep=sleep)
    assert summary == {"markets":count*2-1,"failedMarkets":1,"calls":count*2,
                       "failedCalls":1,"errors":["0: OSError"],"batches":2,"skippedRecent":0}
    assert writes.call_count == (count*2-1)*2
    interval = ((osm.REQUEST_INTERVAL_SECONDS,),)
    assert sleep.call_args_list == ([interval]*(count-1) + [((osm.BATCH_RETRY_WAIT_SECONDS,),)] +
                                    [interval]*(count+1))
    lines = capsys.readouterr().out.splitlines()
    assert len(lines) == 4
    assert json.loads(lines[0].removeprefix("[market-osm] plan ")) == {
        "ingested":count*2,"due":count*2,"neverFetched":count*2,"skippedRecent":0,"unreadable":0}
    assert [json.loads(line.removeprefix("[market-osm] batch ")) for line in lines[1:3]] == [
        {"markets":count-1,"failedMarkets":1,"calls":count,"failedCalls":1,"errors":["0: OSError"]},
        {"markets":count,"failedMarkets":0,"calls":count,"failedCalls":0,"errors":[]}]


@pytest.mark.parametrize("count,failed,allowed", [(20,1,True),(19,1,False),(20,2,False)])
def test_failure_threshold_zero_writes_before_gate(count,failed,allowed):
    results = [OSError("offline")]*failed + [response()]*(count-failed)
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":str(i)} for i in range(count)]), \
         patch.object(osm.place_client,"market_state",return_value=state()), patch.object(osm.place_client,"_request") as writes:
        fetch = Mock(side_effect=results)
        if allowed:
            assert osm.run(fetch=fetch,sleep=Mock())["failedCalls"] == failed
            assert writes.call_count == (count-failed)*2
        else:
            with pytest.raises(ValueError,match="failure ratio"):
                osm.run(fetch=fetch,sleep=Mock())
            writes.assert_not_called()


def test_internal_read_failure_also_prevents_writes():
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":"1"},{"contentId":"2"}]), \
         patch.object(osm.place_client,"market_state",side_effect=lambda cid: state() if cid == "1" else (_ for _ in ()).throw(OSError("offline"))), \
         patch.object(osm.place_client,"_request") as writes:
        with pytest.raises(ValueError,match="Market failure ratio"):
            osm.run(fetch=Mock(return_value=response()),sleep=Mock())
        writes.assert_not_called()


def test_uningested_attractions_do_not_dilute_market_failure_ratio():
    states = [None]*30 + [state(), OSError("offline")]
    def read(cid):
        if isinstance(states[int(cid)], Exception):
            raise states[int(cid)]
        return states[int(cid)]
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":str(i)} for i in range(len(states))]), \
         patch.object(osm.place_client,"market_state",side_effect=read), patch.object(osm.place_client,"_request") as writes:
        with pytest.raises(ValueError,match="Market failure ratio 1/2"):
            osm.run(fetch=Mock(return_value=response()),sleep=Mock())
        writes.assert_not_called()


def test_overpass_remark_does_not_publish_partial_geometry():
    with patch.object(osm.place_client,"fetch_market_attractions",return_value=[{"contentId":"1"}]), \
         patch.object(osm.place_client,"market_state",return_value=state()), patch.object(osm.place_client,"_request") as writes:
        with pytest.raises(ValueError,match="failure ratio"):
            osm.run(fetch=Mock(return_value={"elements":[],"remark":"runtime error: timeout"}),sleep=Mock())
        writes.assert_not_called()
