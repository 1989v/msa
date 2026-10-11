"""봇 요청 시간 집계 — nginx 접근 로그 줄 파서 · 시간 창 집계 · 쿠버네티스 로그 읽기 · ClickHouse 쓰기.

기대값은 리터럴로 적는다. 경로 유형 표는 화면(`portal-fe/src/analytics/inflow.ts`)과 같은 픽스처로 묶는다.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import pytest

from src import crawl_stats

FIXTURE = Path(__file__).resolve().parent / "fixtures" / "path_types.json"

GOOGLEBOT_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"
CHROME_UA = ("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
             "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36")
# 운영 실측 줄 (2026-10-10, 공식 이미지 main 형식 = combined + "$http_x_forwarded_for")
OLD_LINE = ('10.42.0.73 - - [10/Oct/2026:19:18:01 +0000] "GET /sitemap-places-4.xml HTTP/1.1" 200 51234 "-" '
            f'"{GOOGLEBOT_UA}" "10.42.0.1"')
NEW_LINE = OLD_LINE + ' "place.1989v.com"'


def line(path="/attractions/12", status=200, ua=GOOGLEBOT_UA, host="place.1989v.com",
         at="10/Oct/2026:19:18:01 +0000") -> str:
    tail = "" if host is None else f' "{host}"'
    return f'10.42.0.73 - - [{at}] "GET {path} HTTP/1.1" {status} 10 "-" "{ua}" "10.42.0.1"{tail}'


def utc(*a) -> datetime:
    return datetime(*a, tzinfo=timezone.utc)


# ─── 파서 ───

def test_production_line_with_host_is_googlebot_sitemap_200():
    hit = crawl_stats.parse_line(NEW_LINE)
    assert (hit.bot, hit.host, hit.path_type, hit.status_class) == ("googlebot", "place.1989v.com", "sitemap", "200")
    assert hit.at == utc(2026, 10, 10, 19, 18, 1)


def test_old_format_line_without_host_counts_as_unknown():
    assert crawl_stats.parse_line(OLD_LINE).host == "unknown"


@pytest.mark.parametrize("host, expected", [
    ("1989v.com", "1989v.com"),
    ("blog.1989v.com", "blog.1989v.com"),
    ("PLACE.1989v.com", "place.1989v.com"),
    ("evil.example", "other"),
    ("1989v.com.evil.io", "other"),
    ("x1989v.com", "other"),
    ("", "other"),
])
def test_host_allowlist(host, expected):
    assert crawl_stats.parse_line(line(host=host)).host == expected


def test_query_is_cut_before_path_type():
    assert crawl_stats.parse_line(line(path="/robots.txt?x=1")).path_type == "robots"
    assert crawl_stats.parse_line(line(path="/attractions/12?utm_source=a")).path_type == "detail"


@pytest.mark.parametrize("ua, expected", [
    ("Mozilla/5.0 (compatible; OAI-SearchBot/1.0; GPTBot/1.2)", "oai-searchbot"),
    ("Mozilla/5.0 AppleWebKit/537.36 (compatible; GPTBot/1.2; +https://openai.com/gptbot)", "gptbot"),
    (GOOGLEBOT_UA, "googlebot"),
    ("Googlebot-Image/1.0", "googlebot"),
    ("Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)", "yeti"),
    ("Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "bingbot"),
    ("Mozilla/5.0 (compatible; Daum/4.1; +http://cs.daum.net/faq/15/4118.html)", "daumoa"),
    ("mozilla/5.0 (compatible; googlebot/2.1)", "googlebot"),
])
def test_bot_classification_first_match(ua, expected):
    assert crawl_stats.parse_line(line(ua=ua)).bot == expected


@pytest.mark.parametrize("ua", [CHROME_UA, "Mozilla/5.0 (compatible; GoogleOther)", "ChatGPT-User/1.0", "-", "kube-probe/1.31"])
def test_non_bot_lines_are_not_counted(ua):
    assert crawl_stats.parse_line(line(ua=ua)) is None


@pytest.mark.parametrize("status, expected", [
    (200, "200"), (304, "304"), (404, "404"), (301, "3xx"), (302, "3xx"),
    (403, "4xx"), (499, "4xx"), (500, "5xx"), (503, "5xx"), (206, "other"), (101, "other"),
])
def test_status_classes(status, expected):
    assert crawl_stats.parse_line(line(status=status)).status_class == expected


def test_path_types_match_shared_fixture():
    rows = json.loads(FIXTURE.read_text(encoding="utf-8"))
    assert len(rows) > 20
    for row in rows:
        got = crawl_stats.parse_line(line(path=row["path"])).path_type
        assert (row["path"], got) == (row["path"], row["crawl"])


def test_garbage_request_target_is_other():
    assert crawl_stats.parse_line(line(path="*")).path_type == "other"


def test_hour_boundary_is_utc_epoch_and_next_day_in_kst():
    hit = crawl_stats.parse_line(NEW_LINE)
    hour = crawl_stats.hour_epoch(hit.at)
    assert hour == 1791658800
    # SR-9 의 toDate(hour, 'Asia/Seoul') 기준으로는 KST 다음 날 04시다
    kst = datetime.fromtimestamp(hour, ZoneInfo("Asia/Seoul"))
    assert (kst.year, kst.month, kst.day, kst.hour) == (2026, 10, 11, 4)


# ─── 원문이 함수 밖으로 나가지 않는다 ───

BROKEN = [
    '10.42.0.73 - - [10/Oct/2026:19:18:01 +0000] "GET /attractions/12 HTTP/1.1 200 10 "-" "Googlebot/2.1" "10.42.0.1"',
    '10.42.0.73 - - [10/Oct/2026:19:18:01 +0000] "GET /attractions/12 HTTP/1.1" 2x0 10 "-" "Googlebot/2.1" "10.42.0.1"',
]


def test_raw_fields_never_leave_parser_or_logs(capsys):
    hit = crawl_stats.parse_line(NEW_LINE)
    flat = repr(tuple(hit))
    assert "10.42.0.73" not in flat and "Googlebot/2.1" not in flat and "sitemap-places-4" not in flat

    for broken in BROKEN:
        with pytest.raises(crawl_stats.MalformedLine) as e:
            crawl_stats.parse_line(broken)
        assert "10.42.0.73" not in str(e.value) and "Googlebot" not in str(e.value)

    hour = utc(2026, 10, 10, 19)
    result = crawl_stats.aggregate({"portal-fe-a": [NEW_LINE, *BROKEN]}, hour, {"portal-fe-a": utc(2026, 10, 9)},
                                   collected_at=utc(2026, 10, 10, 20, 5))
    crawl_stats.report(result)
    out = capsys.readouterr()
    logged = out.out + out.err
    assert result.malformed == 2
    assert "형식 밖 2" in logged
    for leak in ("10.42.0.73", "10.42.0.1", "Googlebot/2.1", "sitemap-places-4", "/attractions/12"):
        assert leak not in logged


# ─── 집계 ───

HOUR = utc(2026, 10, 10, 19)
EARLY = "10/Oct/2026:18:30:00 +0000"
COLLECTED = utc(2026, 10, 10, 20, 5)


def test_two_pods_same_cell_stay_two_rows_and_out_of_window_lines_are_dropped():
    pods = {
        "portal-fe-old": [line(at=EARLY), line(at="10/Oct/2026:19:00:00 +0000"), line(at="10/Oct/2026:19:10:00 +0000")],
        "portal-fe-new": [line(at=EARLY), line(at="10/Oct/2026:19:59:59 +0000"),
                          line(at="10/Oct/2026:20:00:00 +0000"), line(ua=CHROME_UA, at="10/Oct/2026:19:30:00 +0000")],
    }
    started = {"portal-fe-old": utc(2026, 10, 9), "portal-fe-new": utc(2026, 10, 9)}
    result = crawl_stats.aggregate(pods, HOUR, started, collected_at=COLLECTED)
    assert sorted(result.requests, key=lambda r: r["pod"]) == [
        {"hour": 1791658800, "pod": "portal-fe-new", "host": "place.1989v.com", "bot": "googlebot",
         "path_type": "detail", "status_class": "200", "requests": 1},
        {"hour": 1791658800, "pod": "portal-fe-old", "host": "place.1989v.com", "bot": "googlebot",
         "path_type": "detail", "status_class": "200", "requests": 2},
    ]
    lines_by_pod = {r["pod"]: r["lines"] for r in result.coverage}
    # 사람 줄도 읽은 줄 수에는 든다 — 커버리지는 로그 전체가 그 시간을 덮었는지를 말한다
    assert lines_by_pod == {"portal-fe-old": 2, "portal-fe-new": 2}


@pytest.mark.parametrize("first_at, started, partial", [
    ("10/Oct/2026:19:20:00 +0000", utc(2026, 10, 9), 1),          # 첫 줄이 시간 시작보다 늦다 (로그 회전)
    (EARLY, utc(2026, 10, 10, 19, 30), 1),                         # 컨테이너가 시간 중에 떴다 (교체)
    (EARLY, utc(2026, 10, 9), 0),                                  # 둘 다 아니다
])
def test_partial_coverage(first_at, started, partial):
    result = crawl_stats.aggregate({"p": [line(at=first_at), line(at="10/Oct/2026:19:40:00 +0000")]},
                                   HOUR, {"p": started}, collected_at=COLLECTED)
    row = result.coverage[0]
    assert row["partial"] == partial
    assert row["first_line_at"] == int(datetime.strptime(first_at, "%d/%b/%Y:%H:%M:%S %z").timestamp())
    assert row["container_started_at"] == int(started.timestamp())
    assert row["collected_at"] == int(COLLECTED.timestamp())
    assert row["hour"] == 1791658800


def test_hour_argument_picks_the_window():
    assert crawl_stats.target_hour("2026-10-10T19", now=utc(2026, 10, 11, 3, 5)) == HOUR
    # 인자가 없으면 직전 정시 한 시간
    assert crawl_stats.target_hour(None, now=utc(2026, 10, 10, 20, 5)) == HOUR
    with pytest.raises(SystemExit):
        crawl_stats.target_hour("2026-10-10 19", now=COLLECTED)


# ─── 쿠버네티스 API ───

PODS_JSON = json.dumps({"items": [
    {"metadata": {"name": "portal-fe-a"},
     "status": {"containerStatuses": [{"state": {"running": {"startedAt": "2026-10-09T00:00:00Z"}}}]}},
    {"metadata": {"name": "portal-fe-pending"},
     "status": {"containerStatuses": [{"state": {"waiting": {"reason": "ContainerCreating"}}}]}},
]})


class KubeRecorder:
    """보낸 요청을 받아 두는 가짜 API 서버. 로그는 줄 단위 바이트로 돌려준다."""

    def __init__(self, log_lines: list[str]):
        self.log_lines = log_lines
        self.calls: list[tuple[str, dict, float, float]] = []

    def __call__(self, path: str, headers: dict, connect_timeout: float, read_timeout: float):
        self.calls.append((path, headers, connect_timeout, read_timeout))
        if "/log?" in path:
            return iter([(x + "\n").encode() for x in self.log_lines])
        return iter([PODS_JSON.encode()])


def test_kube_calls_use_token_selector_and_timeouts():
    fake = KubeRecorder([NEW_LINE])
    kube = crawl_stats.Kube(token="T0KEN", namespace="commerce", opener=fake)
    pods = kube.portal_fe_pods()
    assert pods == {"portal-fe-a": utc(2026, 10, 9)}
    lines = list(kube.log_lines("portal-fe-a", since_seconds=7500))
    assert lines == [NEW_LINE]

    list_path, list_headers, ct, rt = fake.calls[0]
    assert list_path == "/api/v1/namespaces/commerce/pods?labelSelector=app.kubernetes.io/name%3Dportal-fe"
    assert list_headers["Authorization"] == "Bearer T0KEN"
    assert (ct, rt) == (10, 120)
    log_path, log_headers, ct, rt = fake.calls[1]
    assert log_path == "/api/v1/namespaces/commerce/pods/portal-fe-a/log?sinceSeconds=7500&timestamps=false"
    assert log_headers["Authorization"] == "Bearer T0KEN"
    assert (ct, rt) == (10, 120)
    assert len(fake.calls) == 2   # 기동 중인 파드(pending)는 로그를 읽지 않는다


def test_since_seconds_reaches_one_hour_before_the_window():
    assert crawl_stats.since_seconds(HOUR, now=utc(2026, 10, 10, 20, 5)) == 7500
    assert crawl_stats.since_seconds(HOUR, now=utc(2026, 10, 11, 3, 5)) == 32700


# ─── ClickHouse 쓰기 ───

class PostRecorder:
    def __init__(self, replies: list[tuple[int, str]]):
        self.replies = list(replies)
        self.bodies: list[str] = []

    def __call__(self, body: str) -> tuple[int, str]:
        self.bodies.append(body)
        return self.replies.pop(0)


def test_run_writes_both_tables_as_json_each_row_with_epoch_hours():
    kube = crawl_stats.Kube(token="T", namespace="commerce", opener=KubeRecorder([line(at=EARLY), NEW_LINE]))
    post = PostRecorder([(200, ""), (200, "")])
    code = crawl_stats.run("2026-10-10T19", kube=kube, post=post, now=COLLECTED)
    assert code == 0
    req_head, *req_rows = post.bodies[0].splitlines()
    assert req_head == "INSERT INTO analytics.crawler_requests_hourly FORMAT JSONEachRow"
    assert [json.loads(r) for r in req_rows] == [
        {"hour": 1791658800, "pod": "portal-fe-a", "host": "place.1989v.com", "bot": "googlebot",
         "path_type": "sitemap", "status_class": "200", "requests": 1},
    ]
    cov_head, *cov_rows = post.bodies[1].splitlines()
    assert cov_head == "INSERT INTO analytics.crawler_log_coverage_hourly FORMAT JSONEachRow"
    assert [json.loads(r) for r in cov_rows] == [
        {"hour": 1791658800, "pod": "portal-fe-a", "lines": 1,
         "first_line_at": int(utc(2026, 10, 10, 18, 30).timestamp()),
         "container_started_at": int(utc(2026, 10, 9).timestamp()),
         "partial": 0, "collected_at": int(COLLECTED.timestamp())},
    ]


def test_clickhouse_failure_exits_non_zero():
    kube = crawl_stats.Kube(token="T", namespace="commerce", opener=KubeRecorder([NEW_LINE]))
    # 커버리지 쓰기는 성공하게 둔다 — 요청 표 실패를 삼키면 종료 코드 0 이 나와야 이 검사가 그것을 잡는다
    post = PostRecorder([(500, "Code: 60. DB::Exception"), (200, "")])
    code = crawl_stats.run("2026-10-10T19", kube=kube, post=post, now=COLLECTED)
    assert code != 0


def test_no_portal_fe_pod_exits_non_zero():
    class Empty(KubeRecorder):
        def __call__(self, path, headers, ct, rt):
            return iter([b'{"items": []}'])
    kube = crawl_stats.Kube(token="T", namespace="commerce", opener=Empty([]))
    post = PostRecorder([])
    assert crawl_stats.run("2026-10-10T19", kube=kube, post=post, now=COLLECTED) != 0
    assert post.bodies == []
