"""검색엔진·AI 수집 로봇 요청의 시간 집계 (`--job=crawl-stats`).

portal-fe 파드의 nginx 접근 로그를 쿠버네티스 API 로 읽어, 직전 정시 한 시간의 로봇 요청을
(로봇, 호스트, 경로 유형, 상태 칸, 파드)별 건수로 ClickHouse 에 쓴다. 표 주인은 analytics
(`V008__crawler_requests.sql`)이고 이 이미지는 실행 장소일 뿐이다 — place 도메인 데이터가 아니다.

**IP·UA 원문·전체 경로는 이 모듈 밖으로 나가지 않는다.** 줄을 읽어 칸 이름으로 바꾼 뒤 버리고,
형식 밖 줄은 건수만 센다 — 예외 메시지에도 줄 원문을 넣지 않는다.

시간마다 도는 이유: 컨테이너 로그는 현재 컨테이너 것만 읽히고 portal-fe 는 배포마다 교체된다.
하루 한 번이면 마지막 교체 전 요청을 통째로 잃는다. 일 집계는 질의가 시간 행을 더해 만든다.
"""
from __future__ import annotations

import http.client
import json
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Callable, Iterable, Iterator, NamedTuple

from src.popularity import CLICKHOUSE_URL, CONNECT_RETRIES

REQUESTS_TABLE = "analytics.crawler_requests_hourly"
COVERAGE_TABLE = "analytics.crawler_log_coverage_hourly"

NAMESPACE_FILE = "/var/run/secrets/kubernetes.io/serviceaccount/namespace"
TOKEN_FILE = "/var/run/secrets/kubernetes.io/serviceaccount/token"
CA_FILE = "/var/run/secrets/kubernetes.io/serviceaccount/ca.crt"
POD_SELECTOR = "app.kubernetes.io/name=portal-fe"
CONNECT_TIMEOUT_SEC = 10
READ_TIMEOUT_SEC = 120

#: UA 부분 문자열(대소문자 무시) → 로봇 칸. 위에서부터 첫 일치 — OAI-SearchBot 은 GPTBot 을 함께 싣기도 한다.
BOTS: tuple[tuple[str, str], ...] = (
    ("oai-searchbot", "oai-searchbot"),
    ("gptbot", "gptbot"),
    ("googlebot", "googlebot"),
    ("yeti", "yeti"),
    ("bingbot", "bingbot"),
    ("daum", "daumoa"),
)

# 공식 이미지 `main` 형식(combined + "$http_x_forwarded_for") 뒤에 "$host" 가 붙는다.
# 호스트 칸이 없는 옛 형식 줄은 전환 시간대에만 나온다.
_LINE = re.compile(
    r'^\S+ \S+ \S+ \[(?P<time>[^\]]+)\] "(?P<request>[^"]*)" (?P<status>\d{3}) \S+ "[^"]*" "(?P<ua>[^"]*)"'
    r'(?: "[^"]*")?(?: "(?P<host>[^"]*)")?\s*$'
)
_HOST = re.compile(r"^[a-z0-9.-]+$")

# ─── 경로 유형 — 화면 `landingTypeOf`(portal-fe/src/analytics/inflow.ts)의 사본 + 크롤 전용 다섯 ───
# 두 구현은 tests/fixtures/path_types.json 하나로 함께 검사한다. 한쪽만 고치면 그 검사가 빨개진다.
_ASSET_EXT = re.compile(
    r"\.(?:js|mjs|css|map|png|jpe?g|gif|webp|avif|svg|ico|woff2?|ttf|otf|webmanifest|json|mp3|mp4|wasm)$"
)


def landing_type(path: str) -> str:
    """착지 경로 유형. `/en`·`/place` 접두와 끝 슬래시는 떼고 비교한다. 대소문자는 그대로."""
    if len(path) > 1:
        path = path.rstrip("/") or "/"
    if path == "/en" or path.startswith("/en/"):
        path = path[3:]
    if path == "/place" or path.startswith("/place/"):
        path = path[6:]
    if path == "":
        path = "/"
    if path == "/":
        return "hub"
    if re.fullmatch(r"/attractions/[^/]+", path):
        return "detail"
    if re.fullmatch(r"/regions/[^/]+", path):
        return "region"
    if re.fullmatch(r"/regions/[^/]+/[^/]+", path):
        return "attr_landing"
    if re.fullmatch(r"/guides(?:/[^/]+)?", path):
        return "editorial"
    return "other"


def path_type(target: str) -> str:
    path = target.split("?", 1)[0].split("#", 1)[0]
    if not path.startswith("/"):
        return "other"
    if re.fullmatch(r"/sitemap[^/]*\.xml", path):
        return "sitemap"
    if path == "/robots.txt":
        return "robots"
    if path in ("/feed.xml", "/en/feed.xml"):
        return "feed"
    if path == "/llms.txt":
        return "llms"
    if path.startswith("/assets/") or _ASSET_EXT.search(path):
        return "asset"
    return landing_type(path)


def status_class(code: int) -> str:
    if code in (200, 304, 404):
        return str(code)
    if 300 <= code < 400:
        return "3xx"
    if 400 <= code < 500:
        return "4xx"
    if 500 <= code < 600:
        return "5xx"
    return "other"


def host_class(host: str | None) -> str:
    """`1989v.com`·`*.1989v.com` 만 그대로 — 위조 Host 헤더가 칸을 늘리지 않게."""
    if host is None:
        return "unknown"
    host = host.lower()
    if _HOST.match(host) and (host == "1989v.com" or host.endswith(".1989v.com")):
        return host
    return "other"


def bot_of(ua: str) -> str | None:
    lowered = ua.lower()
    return next((bot for needle, bot in BOTS if needle in lowered), None)


class MalformedLine(ValueError):
    """접근 로그 형식이 아닌 줄. 메시지에 줄 원문을 담지 않는다."""

    def __init__(self) -> None:
        super().__init__("접근 로그 형식 밖 줄")


class Hit(NamedTuple):
    at: datetime
    bot: str
    host: str
    path_type: str
    status_class: str


def _parse(raw: str) -> tuple[datetime, Hit | None]:
    m = _LINE.match(raw.rstrip("\r\n"))
    if not m:
        raise MalformedLine()
    try:
        at = datetime.strptime(m["time"], "%d/%b/%Y:%H:%M:%S %z").astimezone(timezone.utc)
    except ValueError:
        raise MalformedLine() from None
    bot = bot_of(m["ua"])
    if bot is None:
        return at, None
    parts = m["request"].split(" ")
    target = parts[1] if len(parts) >= 2 else ""
    return at, Hit(at, bot, host_class(m["host"]), path_type(target), status_class(int(m["status"])))


def parse_line(raw: str) -> Hit | None:
    """줄 하나 → 로봇 요청이면 칸, 아니면 None. 형식 밖 줄은 [MalformedLine]."""
    return _parse(raw)[1]


def hour_epoch(at: datetime) -> int:
    ts = int(at.timestamp())
    return ts - ts % 3600


# ─── 시간 창 집계 ───

@dataclass
class Result:
    hour: datetime
    requests: list[dict] = field(default_factory=list)
    coverage: list[dict] = field(default_factory=list)
    malformed: int = 0


def aggregate(pod_lines: dict[str, Iterable[str]], hour: datetime, started: dict[str, datetime | None],
              collected_at: datetime) -> Result:
    """파드마다 줄을 한 번 훑어 [hour, hour+1h) 에 든 로봇 요청을 센다.

    여러 파드의 같은 칸은 파드별 행으로 남긴다 — 교체 시간대에 옛·새 파드가 한 시간을 나눠 갖는다.
    `partial` 은 그 파드의 첫 줄이나 컨테이너 시작이 시간 시작보다 늦을 때 1 — 그 시간 앞부분을 못 읽었다.
    """
    end = hour + timedelta(hours=1)
    result = Result(hour=hour)
    epoch = hour_epoch(hour)
    for pod, lines in pod_lines.items():
        cells: Counter[tuple[str, str, str, str]] = Counter()
        first_at: datetime | None = None
        in_hour = 0
        for raw in lines:
            try:
                at, hit = _parse(raw)
            except MalformedLine:
                result.malformed += 1
                continue
            if first_at is None:
                first_at = at
            if not (hour <= at < end):
                continue
            in_hour += 1
            if hit is not None:
                cells[(hit.host, hit.bot, hit.path_type, hit.status_class)] += 1
        for (host, bot, ptype, status), n in sorted(cells.items()):
            result.requests.append({"hour": epoch, "pod": pod, "host": host, "bot": bot,
                                    "path_type": ptype, "status_class": status, "requests": n})
        pod_started = started.get(pod)
        partial = first_at is None or first_at > hour or (pod_started is not None and pod_started > hour)
        result.coverage.append({
            "hour": epoch, "pod": pod, "lines": in_hour,
            # 줄이 하나도 없으면 0(1970) — partial 이 1 이라 그 시간은 하한으로 읽힌다
            "first_line_at": int(first_at.timestamp()) if first_at else 0,
            "container_started_at": int(pod_started.timestamp()) if pod_started else 0,
            "partial": 1 if partial else 0,
            "collected_at": int(collected_at.timestamp()),
        })
    return result


def report(result: Result) -> None:
    hits = sum(r["requests"] for r in result.requests)
    lines = sum(r["lines"] for r in result.coverage)
    partial = sum(r["partial"] for r in result.coverage)
    log(f"[crawl-stats] {result.hour:%Y-%m-%dT%H}Z 파드 {len(result.coverage)}개(부분 {partial}) · "
        f"줄 {lines:,} · 로봇 요청 {hits:,} · 칸 {len(result.requests)} · 형식 밖 {result.malformed}")


def target_hour(arg: str | None, now: datetime) -> datetime:
    """`--hour=YYYY-MM-DDTHH`(UTC). 없으면 직전 정시 한 시간."""
    if arg is None:
        return now.astimezone(timezone.utc).replace(minute=0, second=0, microsecond=0) - timedelta(hours=1)
    try:
        return datetime.strptime(arg, "%Y-%m-%dT%H").replace(tzinfo=timezone.utc)
    except ValueError:
        raise SystemExit(f"--hour 는 YYYY-MM-DDTHH(UTC) 다: {arg}") from None


def since_seconds(hour: datetime, now: datetime) -> int:
    """시간 시작 한 시간 전부터 읽는다 — 첫 줄이 시간 시작보다 앞인지 봐야 partial 을 가른다."""
    return int((now - hour).total_seconds()) + 3600


# ─── 쿠버네티스 API ───

Opener = Callable[[str, dict, float, float], Iterator[bytes]]


def _https_opener(path: str, headers: dict, connect_timeout: float, read_timeout: float) -> Iterator[bytes]:
    """연결과 읽기에 제한 시간을 따로 둔다 — urllib 은 한 값뿐이다. 본문은 줄 단위로 흘려 읽는다."""
    host = os.environ["KUBERNETES_SERVICE_HOST"]
    port = int(os.environ.get("KUBERNETES_SERVICE_PORT", "443"))
    ctx = ssl.create_default_context(cafile=CA_FILE)
    for attempt, wait in enumerate((*CONNECT_RETRIES, None)):
        conn = http.client.HTTPSConnection(host, port, timeout=connect_timeout, context=ctx)
        try:
            conn.connect()
            break
        except OSError as e:
            conn.close()
            if wait is None:
                raise
            # NetworkPolicy 가 새 파드를 허용 목록에 올리기 전 몇 초는 연결이 거부된다 (popularity 와 같은 원인)
            log(f"[crawl-stats] API 연결 실패(시도 {attempt + 1}): {type(e).__name__} — {wait}s 후 재시도")
            time.sleep(wait)
    conn.sock.settimeout(read_timeout)
    conn.request("GET", path, headers=headers)
    res = conn.getresponse()
    if res.status != 200:
        conn.close()
        raise RuntimeError(f"쿠버네티스 API HTTP {res.status}: {path.split('?', 1)[0]}")

    def stream() -> Iterator[bytes]:
        try:
            while chunk := res.readline():
                yield chunk
        finally:
            conn.close()

    return stream()


class Kube:
    def __init__(self, token: str, namespace: str, opener: Opener = _https_opener):
        self.token = token
        self.namespace = namespace
        self.opener = opener

    @classmethod
    def in_cluster(cls) -> "Kube":
        with open(TOKEN_FILE, encoding="utf-8") as f:
            token = f.read().strip()
        with open(NAMESPACE_FILE, encoding="utf-8") as f:
            namespace = f.read().strip()
        return cls(token, namespace)

    def _get(self, path: str) -> Iterator[bytes]:
        return self.opener(path, {"Authorization": f"Bearer {self.token}"}, CONNECT_TIMEOUT_SEC, READ_TIMEOUT_SEC)

    def portal_fe_pods(self) -> dict[str, datetime]:
        """로그를 읽을 수 있는(컨테이너가 떠 있는) portal-fe 파드 → 컨테이너 시작 시각."""
        selector = urllib.parse.quote(POD_SELECTOR, safe="/")
        body = b"".join(self._get(f"/api/v1/namespaces/{self.namespace}/pods?labelSelector={selector}"))
        pods: dict[str, datetime] = {}
        for item in json.loads(body).get("items", []):
            statuses = (item.get("status") or {}).get("containerStatuses") or []
            running = next((s["state"]["running"] for s in statuses if "running" in (s.get("state") or {})), None)
            if running is None:
                continue
            pods[item["metadata"]["name"]] = datetime.fromisoformat(running["startedAt"].replace("Z", "+00:00"))
        return pods

    def log_lines(self, pod: str, since_seconds: int) -> Iterator[str]:
        path = f"/api/v1/namespaces/{self.namespace}/pods/{pod}/log?sinceSeconds={int(since_seconds)}&timestamps=false"
        for chunk in self._get(path):
            yield chunk.decode("utf-8", errors="replace").rstrip("\r\n")


# ─── ClickHouse 쓰기 ───

Poster = Callable[[str], "tuple[int, str]"]


def clickhouse_headers() -> dict[str, str]:
    """ClickHouse 계정 헤더 — 계정 없이 보내면 default 로 들어가 거부된다(HTTP 403, Code 516)."""
    user = os.environ.get("CLICKHOUSE_USER", "")
    if not user:
        return {}
    return {"X-ClickHouse-User": user, "X-ClickHouse-Key": os.environ.get("CLICKHOUSE_PASSWORD", "")}


def _post_clickhouse(body: str) -> tuple[int, str]:
    req = urllib.request.Request(
        f"{CLICKHOUSE_URL}/", data=body.encode("utf-8"), method="POST", headers=clickhouse_headers(),
    )
    for attempt, wait in enumerate((*CONNECT_RETRIES, None)):
        try:
            with urllib.request.urlopen(req, timeout=30) as res:
                return res.status, res.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            return e.code, e.read().decode("utf-8", errors="replace")
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            if wait is None:
                return 0, f"연결 실패: {type(e).__name__}"
            log(f"[crawl-stats] ClickHouse 연결 실패(시도 {attempt + 1}) — {wait}s 후 재시도")
            time.sleep(wait)
    return 0, "연결 실패"


def _insert(post: Poster, table: str, rows: list[dict]) -> bool:
    body = f"INSERT INTO {table} FORMAT JSONEachRow\n" + "\n".join(json.dumps(r, ensure_ascii=False) for r in rows)
    status, text = post(body)
    if status != 200:
        log(f"[crawl-stats] {table} 쓰기 실패 HTTP {status}: {text[:200]}")
        return False
    return True


def log(msg: str) -> None:
    print(f"{datetime.now(timezone.utc).strftime('%H:%M:%S')} {msg}", file=sys.stderr, flush=True)


def run(hour_arg: str | None = None, kube: Kube | None = None, post: Poster = _post_clickhouse,
        now: datetime | None = None) -> int:
    """직전 정시(또는 `--hour`) 한 시간을 집계해 두 표에 쓴다. 실패는 0 이 아닌 코드 — 조용히 0행이 되지 않게."""
    now = now or datetime.now(timezone.utc)
    hour = target_hour(hour_arg, now)
    kube = kube or Kube.in_cluster()
    pods = kube.portal_fe_pods()
    if not pods:
        log(f"[crawl-stats] {POD_SELECTOR} 파드 중 로그를 읽을 수 있는 것이 없다")
        return 1
    since = since_seconds(hour, now)
    result = aggregate({pod: kube.log_lines(pod, since) for pod in pods}, hour, pods, collected_at=now)
    report(result)
    if result.requests and not _insert(post, REQUESTS_TABLE, result.requests):
        return 1
    if not _insert(post, COVERAGE_TABLE, result.coverage):
        return 1
    return 0
