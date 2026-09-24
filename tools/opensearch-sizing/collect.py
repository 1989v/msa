#!/usr/bin/env python3
"""OpenSearch 클러스터 사이징 프롬프트의 「입력 데이터」 블록을 만든다.

_cat · _nodes/stats 를 떠서 노드별 델타(샤드 쿼리 수/초, 1건당 시간, rejected 증가)를 계산하고,
인덱스 · alias · 노드 · AZ 이름을 가린 마크다운을 낸다. 가린 이름이 출력에 남으면 실패한다.

  python3 collect.py --url https://host:9200 --user admin:pass --interval 60 -o input.md
  python3 collect.py --url https://domain.es.amazonaws.com --sigv4 ap-northeast-2   # botocore 필요

표준 라이브러리만 쓴다(--sigv4 제외). 원래 이름 ↔ 가린 이름 대응표는 --map 파일에만 남는다.
"""
from __future__ import annotations

import argparse
import base64
import json
import re
import ssl
import sys
import time
import urllib.error
import urllib.request

# 날짜 · 타임스탬프 suffix. 이 부분은 가리지 않는다 — 어느 인덱스가 같은 계열의 사본인지가 분석 입력이다.
SUFFIX = re.compile(r"^(?P<base>.+?)(?P<suffix>[-_][0-9][0-9.\-_]{5,})$")
ZONE_ATTRS = ("zone", "aws_availability_zone", "availability_zone")
SETTING_KEYS = re.compile(
    r"^(cluster\.routing\.allocation\.awareness\.|cluster\.routing\.use_adaptive_replica_selection"
    r"|search\.backpressure\.mode|thread_pool\.search\.)"
)


class Client:
    def __init__(self, url: str, user: str | None, insecure: bool, sigv4: str | None):
        self.url = url.rstrip("/")
        self.ctx = ssl._create_unverified_context() if insecure else None
        self.headers = {"Accept": "application/json"}
        if user:
            self.headers["Authorization"] = "Basic " + base64.b64encode(user.encode()).decode()
        self.sigv4 = sigv4
        self.creds = None
        if sigv4:
            try:
                import botocore.session
            except ImportError:
                sys.exit("--sigv4 은 botocore 가 필요하다: pip install botocore")
            # 환경변수 · ~/.aws · 인스턴스 역할 순으로 찾는 botocore 기본 체인
            self.creds = botocore.session.get_session().get_credentials()
            if self.creds is None:
                sys.exit("--sigv4: AWS 자격증명을 찾지 못했다 (AWS_ACCESS_KEY_ID · AWS_PROFILE · 인스턴스 역할)")

    def get(self, path: str):
        url = f"{self.url}/{path.lstrip('/')}"
        headers = dict(self.headers)
        if self.sigv4:
            from botocore.auth import SigV4Auth
            from botocore.awsrequest import AWSRequest

            req = AWSRequest(method="GET", url=url, headers=headers)
            SigV4Auth(self.creds.get_frozen_credentials(), "es", self.sigv4).add_auth(req)
            headers = dict(req.headers)
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, context=self.ctx, timeout=30) as r:
            return json.load(r)

    def try_get(self, path: str):
        try:
            return self.get(path), None
        except urllib.error.HTTPError as e:
            return None, f"HTTP {e.code}"
        except (urllib.error.URLError, TimeoutError) as e:
            return None, str(e)


class Masker:
    """이름을 종류별 일련 토큰으로 바꾼다. 같은 원래 이름은 늘 같은 토큰이 된다."""

    def __init__(self):
        self.maps: dict[str, dict[str, str]] = {"index": {}, "node": {}, "zone": {}}
        self.raw: set[str] = set()

    def _token(self, kind: str, name: str, fmt) -> str:
        m = self.maps[kind]
        if name not in m:
            m[name] = fmt(len(m))
            self.raw.add(name)
        return m[name]

    def base(self, name: str) -> str:
        return self._token("index", name, lambda n: f"idx-{_letters(n)}")

    def index(self, name: str) -> str:
        if name.startswith("."):
            return name  # 엔진 · 플러그인 시스템 인덱스. 조직 정보가 아니다
        m = SUFFIX.match(name)
        if m:
            self.raw.add(name)
            return self.base(m["base"]) + m["suffix"]
        return self.base(name)

    def node(self, name: str) -> str:
        return self._token("node", name, lambda n: f"node-{n + 1}")

    def zone(self, name: str) -> str:
        return self._token("zone", name, lambda n: f"az-{n + 1}")


def _letters(n: int) -> str:
    s = ""
    n += 1
    while n:
        n, r = divmod(n - 1, 26)
        s = chr(97 + r) + s
    return s


def gb(b) -> str:
    return f"{int(b or 0) / 1024**3:.2f}"


def table(head: list[str], rows: list[list]) -> str:
    out = ["| " + " | ".join(head) + " |", "|" + "---|" * len(head)]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def node_zone(info: dict) -> str | None:
    attrs = info.get("attributes") or {}
    for k in ZONE_ATTRS:
        if attrs.get(k):
            return attrs[k]
    return None


def collect(c: Client, interval: int, samples: int):
    root = c.get("/")
    nodes_info = c.get("_nodes/os,jvm,process")["nodes"]
    indices = c.get("_cat/indices?format=json&bytes=b&expand_wildcards=all")
    shards = c.get("_cat/shards?format=json&bytes=b")
    aliases = c.get("_cat/aliases?format=json")
    settings, settings_err = c.try_get("_cluster/settings?include_defaults=true&flat_settings=true")
    # 경로의 두 번째 조각(index metric)은 indices 하나만 요청할 때만 받는다 — 여럿이면 filter_path 로 좁힌다
    metric = ("_nodes/stats/indices,thread_pool,jvm,os,process,fs?filter_path="
              "nodes.*.name,nodes.*.indices.search,nodes.*.thread_pool.search,nodes.*.jvm.mem.heap_used_percent,"
              "nodes.*.jvm.gc,nodes.*.os.cpu,nodes.*.os.mem.total_in_bytes,nodes.*.process.cpu,nodes.*.fs.total")
    snaps = [(time.time(), c.get(metric)["nodes"])]
    for _ in range(samples - 1):
        time.sleep(interval)
        snaps.append((time.time(), c.get(metric)["nodes"]))
    return root, nodes_info, indices, shards, aliases, settings, settings_err, snaps


def render(data, masker: Masker, interval: int) -> tuple[str, list[str]]:
    root, nodes_info, indices, shards, aliases, settings, settings_err, snaps = data
    leak_sources = [root.get("cluster_name", ""), root.get("cluster_uuid", "")]
    for info in nodes_info.values():
        leak_sources += [info.get("host", ""), info.get("ip", ""), info.get("transport_address", "")]
    id_to_name = {nid: info["name"] for nid, info in nodes_info.items()}
    for name in sorted(id_to_name.values()):
        masker.node(name)

    # ── 클러스터
    ver = root.get("version", {})
    rows = []
    for nid, info in sorted(nodes_info.items(), key=lambda kv: masker.node(kv[1]["name"])):
        z = node_zone(info)
        # RAM 은 노드 info 에 없고 stats 에만 있다
        mem = (snaps[-1][1].get(nid) or {}).get("os", {}).get("mem", {}).get("total_in_bytes") or 0
        heap = (info.get("jvm") or {}).get("mem", {}).get("heap_max_in_bytes") or 0
        roles = ",".join(sorted(info.get("roles", [])))
        vcpu = (info.get("os") or {}).get("allocated_processors") or (info.get("os") or {}).get("available_processors")
        fs = (snaps[-1][1].get(nid) or {}).get("fs", {}).get("total", {})
        used = int(fs.get("total_in_bytes", 0)) - int(fs.get("available_in_bytes", 0))
        rows.append([masker.node(info["name"]), masker.zone(z) if z else "(없음)", roles, vcpu,
                     gb(mem), gb(heap), f"{gb(used)} / {gb(fs.get('total_in_bytes'))}"])
    s_cluster = (
        f"- 엔진: {ver.get('distribution', 'elasticsearch')} {ver.get('number', '?')} · 노드 {len(nodes_info)}대\n\n"
        + table(["노드", "AZ", "역할", "vCPU", "RAM GB", "heap GB", "디스크 사용/전체 GB"], rows)
    )
    if settings_err:
        s_cluster += f"\n\n- 클러스터 설정: 수집 실패({settings_err})"
    elif settings:
        picked = {}
        for layer in ("persistent", "transient", "defaults"):
            for k, v in (settings.get(layer) or {}).items():
                if SETTING_KEYS.match(k) and k not in picked:
                    picked[k] = (v, layer)
        if picked:
            s_cluster += "\n\n- 관련 설정\n" + "\n".join(
                f"  - `{k}` = `{v}` ({layer})" for k, (v, layer) in sorted(picked.items()))

    # ── 인덱스 · alias
    alias_to = {}
    for a in aliases:
        alias_to.setdefault(a["alias"], []).append(a["index"])
    served = {i for ix in alias_to.values() for i in ix}
    user_idx = sorted((i for i in indices if not i["index"].startswith(".")), key=lambda i: i["index"])
    sys_idx = [i for i in indices if i["index"].startswith(".")]
    for i in user_idx:
        masker.index(i["index"])
    for a in alias_to:
        # alias 가 인덱스 계열명과 같으면 같은 토큰을 받는다 — 어느 alias 가 어느 계열을 가리키는지 드러난다
        masker.base(a)

    base_of = {i["index"]: (SUFFIX.match(i["index"]) or {"base": i["index"]})["base"] for i in user_idx}
    # 계열별 서빙 인덱스 이름. 같은 계열의 suffix 는 같은 형식이라 문자열 비교가 곧 시간 비교다
    served_by_base: dict[str, str] = {}
    for i in served:
        if i in base_of:
            served_by_base[base_of[i]] = max(served_by_base.get(base_of[i], ""), i)

    def role_of(name: str) -> str:
        if name in served:
            return "서빙(alias)"
        cur = served_by_base.get(base_of[name])
        if cur is None:
            return "alias 없음"
        return "새 세대(리인덱스 중 또는 전환 전)" if name > cur else "이전 세대"

    shard_sizes: dict[str, list[int]] = {}
    for s in shards:
        if s.get("prirep") == "p" and s.get("store"):
            shard_sizes.setdefault(s["index"], []).append(int(s["store"]))
    rows = []
    for i in user_idx:
        name = i["index"]
        role = role_of(name)
        sz = shard_sizes.get(name) or [0]
        rows.append([masker.index(name), i["pri"], i["rep"], i["docs.count"], i["docs.deleted"],
                     gb(i["pri.store.size"]), gb(i["store.size"]), f"{gb(min(sz))}~{gb(max(sz))}", role])
    s_index = table(["인덱스", "pri", "rep", "docs", "deleted", "pri GB", "전체 GB", "primary 샤드 GB", "구분(스크립트 추정)"], rows)
    if sys_idx:
        s_index += (f"\n\n- 시스템 인덱스(`.` 시작) {len(sys_idx)}개 · 합계 "
                    f"{gb(sum(int(i['store.size'] or 0) for i in sys_idx))} GB — 이름은 엔진 · 플러그인 것이라 가리지 않는다")
    s_alias = table(["alias", "가리키는 인덱스"],
                    [[masker.base(a), ", ".join(masker.index(x) for x in ix)] for a, ix in sorted(alias_to.items())])

    # ── 샤드 배치: 노드 × 인덱스의 primary/replica 수
    place: dict[tuple[str, str], list[int]] = {}
    unassigned = 0
    for s in shards:
        if s["index"].startswith("."):
            continue
        if not s.get("node"):
            unassigned += 1
            continue
        k = (s["index"], s["node"].split(" ")[0])
        place.setdefault(k, [0, 0])[0 if s["prirep"] == "p" else 1] += 1
    node_names = sorted(id_to_name.values(), key=masker.node)
    rows = [[masker.index(i["index"])] + [
        "{}p/{}r".format(*place.get((i["index"], n), [0, 0])) for n in node_names] for i in user_idx]
    s_shards = table(["인덱스"] + [masker.node(n) for n in node_names], rows)
    s_shards += f"\n\n- 미할당 샤드: {unassigned}"

    # ── 검색 통계 델타
    (t0, a), (t1, b) = snaps[0], snaps[-1]
    dt = max(t1 - t0, 1e-9)
    rows = []
    for nid in sorted(b, key=lambda n: masker.node(id_to_name.get(n, n))):
        sa, sb = a.get(nid), b[nid]
        if not sa:
            continue
        qa, qb = sa["indices"]["search"], sb["indices"]["search"]
        dq = qb["query_total"] - qa["query_total"]
        dqt = qb["query_time_in_millis"] - qa["query_time_in_millis"]
        df = qb["fetch_total"] - qa["fetch_total"]
        dft = qb["fetch_time_in_millis"] - qa["fetch_time_in_millis"]
        tpa, tpb = sa["thread_pool"]["search"], sb["thread_pool"]["search"]
        qmax = max(s[1][nid]["thread_pool"]["search"]["queue"] for s in snaps if nid in s[1])
        gca = sa["jvm"]["gc"]["collectors"].get("old", {})
        gcb = sb["jvm"]["gc"]["collectors"].get("old", {})
        rows.append([
            masker.node(sb["name"]),
            f"{dq / dt:.1f}", f"{dqt / dq:.2f}" if dq else "-",
            f"{df / dt:.1f}", f"{dft / df:.2f}" if df else "-",
            tpb["threads"], qmax, tpb["rejected"] - tpa["rejected"],
            sb["jvm"]["mem"]["heap_used_percent"],
            gcb.get("collection_count", 0) - gca.get("collection_count", 0),
            (sb.get("process") or {}).get("cpu", {}).get("percent", "-"),
            (sb.get("os") or {}).get("cpu", {}).get("percent", "-"),
        ])
    s_stats = (
        f"- 구간: {dt:.0f}초 · 표본 {len(snaps)}개 (요청 간격 {interval}초)\n\n"
        + table(["노드", "샤드 쿼리/초", "쿼리 ms/건", "fetch/초", "fetch ms/건", "search 스레드",
                 "큐 최대", "rejected 증가", "heap %", "old GC 증가", "프로세스 CPU %", "OS CPU %"], rows)
        + "\n\n- 샤드 쿼리/초는 샤드 단위다. 클라이언트 요청 1건이 대상 샤드 수만큼 센다."
        + "\n- 피크 시간대에 돌린 값이어야 용량 산정에 쓸 수 있다. 수집 시각을 피크와 함께 적는다."
    )

    data_md = "\n\n".join([s_cluster, s_index, s_alias, s_shards, s_stats])
    return (s_cluster, s_index, s_alias, s_shards, s_stats), leak_check(data_md, masker, leak_sources)


def leak_check(text: str, masker: Masker, extra: list[str]) -> list[str]:
    """원래 이름이 출력에 남았는지 본다. 대상은 스크립트가 클러스터에서 받은 이름 전부다."""
    found = []
    for name in sorted(masker.raw | {x for x in extra if x}):
        if len(name) < 3:
            continue
        pat = r"(?<![A-Za-z0-9_])" + re.escape(name) + r"(?![A-Za-z0-9_])"
        if re.search(pat, text, re.IGNORECASE):
            found.append(name)
    return found


TEMPLATE = """# 입력 데이터 (마스킹됨)

> 수집: {when} · `tools/opensearch-sizing/collect.py`. `<채울 것>` 은 사람이 채운다.

## 목표
- 목표 P99 검색 지연(클라이언트 기준): <채울 것> ms · 목표 가용성: <채울 것> · 월 비용 상한: <채울 것>
- AZ 1개 장애 시 허용되는 지연 저하와 용량 감소: <채울 것>

## 클러스터
- AWS 관리형 여부 · 리전 · 인스턴스 타입 · EBS 타입/IOPS/처리량: <채울 것>

{cluster}

## 인덱스
{index}

### alias
{alias}

### 샤드 배치 (노드별 primary/replica 수)
{shards}

- 인덱스별 일/주 증가량 · 색인 주기 · 풀 리인덱스 여부와 시간대: <채울 것>

## 쿼리
- 대표 쿼리 DSL 전문 · 각 쿼리의 트래픽 비중(%) · 대상 인덱스(위 가린 이름으로): <채울 것>

## 부하
- 클라이언트 RPS(앱 · 로드밸런서 기준, 인덱스별): 평균 · P95 · P99 · 피크 · 피크 지속 시간: <채울 것>
- CloudWatch SearchRate 는 노드별 · 분당 · 샤드 단위 검색 수다. RPS 로 쓰지 않는다

## 시계열 지표
- CloudWatch 노드별 CPUUtilization · JVMMemoryPressure · ThreadpoolSearchQueue · ThreadpoolSearchRejected · SearchLatency (해상도 명시): <채울 것>

### 검색 통계 델타 (_nodes/stats)
{stats}
"""


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--url", required=True)
    ap.add_argument("--user", help="basic 인증 user:password")
    ap.add_argument("--sigv4", metavar="REGION", help="AWS IAM 서명(botocore 필요)")
    ap.add_argument("--insecure", action="store_true", help="TLS 인증서 검증 끔")
    ap.add_argument("--interval", type=int, default=60, help="표본 간격 초 (기본 60)")
    ap.add_argument("--samples", type=int, default=6, help="_nodes/stats 표본 수, 2 이상 (기본 6 = 5분)")
    ap.add_argument("-o", "--out", help="출력 파일 (기본 stdout)")
    ap.add_argument("--map", default="sizing-mask-map.json", help="대응표 파일 — 공유하지 않는다")
    args = ap.parse_args()
    if args.samples < 2:
        ap.error("--samples 는 2 이상이어야 델타가 나온다")

    client = Client(args.url, args.user, args.insecure, args.sigv4)
    masker = Masker()
    sections, leaks = render(collect(client, args.interval, args.samples), masker, args.interval)
    if leaks:
        sys.exit(f"마스킹 실패 — 원래 이름이 출력에 남았다: {', '.join(leaks)}. 출력하지 않는다.")

    cluster, index, alias, shards, stats = sections
    md = TEMPLATE.format(when=time.strftime("%Y-%m-%d %H:%M %Z"), cluster=cluster, index=index,
                         alias=alias, shards=shards, stats=stats)
    with open(args.map, "w", encoding="utf-8") as f:
        json.dump(masker.maps, f, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(md)
    else:
        sys.stdout.write(md)
    print(f"대응표: {args.map} (공유 금지)", file=sys.stderr)


if __name__ == "__main__":
    main()
