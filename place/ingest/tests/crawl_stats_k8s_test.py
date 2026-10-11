"""봇 요청 집계 잡의 쿠버네티스 배선 — 권한·라벨·egress 가 스펙대로 좁혀져 있는지.

이 잡의 SA 는 commerce 네임스페이스 전 파드의 로그를 읽을 수 있다(RBAC 은 라벨로 대상을 못 좁힌다).
그래서 **그 파드가 밖으로 못 나간다**는 것이 이 배선의 전부다 — 라벨 하나만 `place-ingest` 로 돌아가도
외부 443 정책(11)이 그 파드를 고르고, `part-of` 라벨 하나만 붙어도 12 가 commerce 안 전부로 연다.
매니페스트를 직접 읽어 판정한다(CI 가 place/ingest 를 테스트하지 않으므로 커밋 전 로컬 게이트다).

표준 라이브러리만 쓰는 이미지라 PyYAML 이 없다. 아래 `_load` 는 이 레포 매니페스트가 쓰는
부분집합(블록 맵·목록, `[a, b]`·`{ k: v }` 흐름 표기, 따옴표 문자열)만 읽는다.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = next(p for p in Path(__file__).resolve().parents if (p / "settings.gradle.kts").is_file())
K8S = REPO / "k8s"
NAME = "place-crawl-stats"
CRONJOB = K8S / "base/place-ingest/cronjob-crawl-stats.yaml"
RBAC = K8S / "base/place-ingest/rbac-crawl-stats.yaml"
NP_DIR = K8S / "base/network-policy"
EGRESS = NP_DIR / "21-allow-crawl-stats-egress.yaml"
OCI = K8S / "overlays/oci-arm"
APISERVER_PATCH = OCI / "patches/crawl-stats-apiserver-egress.yaml"


# ─── YAML 부분집합 ────────────────────────────────────────────────────────────

def _strip_comment(line: str) -> str:
    quote = None
    for i, ch in enumerate(line):
        if quote:
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch == "#" and (i == 0 or line[i - 1] in " \t"):
            return line[:i].rstrip()
    return line.rstrip()


def _scalar(s: str):
    s = s.strip()
    if len(s) >= 2 and s[0] == s[-1] and s[0] in "\"'":
        return s[1:-1]
    if s in ("true", "false"):
        return s == "true"
    if re.fullmatch(r"-?\d+", s):
        return int(s)
    return s


def _flow(s: str, i: int = 0):
    while s[i] == " ":
        i += 1
    if s[i] in "[{":
        close = "]" if s[i] == "[" else "}"
        out: list | dict = [] if close == "]" else {}
        i += 1
        while True:
            while s[i] in " ,":
                i += 1
            if s[i] == close:
                return out, i + 1
            if close == "]":
                v, i = _flow(s, i)
                out.append(v)
            else:
                colon = s.index(":", i)
                key = _scalar(s[i:colon])
                v, i = _flow(s, colon + 1)
                out[key] = v
    if s[i] in "\"'":
        end = s.index(s[i], i + 1)
        return s[i + 1:end], end + 1
    j = i
    while j < len(s) and s[j] not in ",]}":
        j += 1
    return _scalar(s[i:j]), j


def _value(s: str):
    s = s.strip()
    return _flow(s)[0] if s[:1] in "[{" else _scalar(s)


def _split_key(text: str) -> tuple[str, str] | None:
    quote = None
    for i, ch in enumerate(text):
        if quote:
            if ch == quote:
                quote = None
        elif ch in "\"'":
            quote = ch
        elif ch in "[{":
            return None
        elif ch == ":" and (i + 1 == len(text) or text[i + 1] == " "):
            return _scalar(text[:i]), text[i + 1:].strip()
    return None


def _block(lines: list[list], i: int, ind: int):
    is_list = lines[i][1].startswith("- ") or lines[i][1] == "-"
    out: list | dict = [] if is_list else {}
    while i < len(lines) and lines[i][0] == ind:
        text = lines[i][1]
        if is_list:
            if not (text.startswith("- ") or text == "-"):
                break
            item = text[1:].strip()
            if not item:
                v, i = _block(lines, i + 1, lines[i + 1][0])
            elif _split_key(item):
                lines[i] = [ind + 2, item]
                v, i = _block(lines, i, ind + 2)
            else:
                v, i = _value(item), i + 1
            out.append(v)
        else:
            if text.startswith("- "):
                break
            key, rest = _split_key(text)
            i += 1
            if rest:
                out[key] = _value(rest)
            elif i < len(lines) and (lines[i][0] > ind or (lines[i][0] == ind and lines[i][1].startswith("- "))):
                out[key], i = _block(lines, i, lines[i][0])
            else:
                out[key] = None
    return out, i


def _load(path: Path) -> list:
    docs, cur = [], []
    for raw in path.read_text(encoding="utf-8").splitlines() + ["---"]:
        if raw.strip() == "---":
            if cur:
                docs.append(_block(cur, 0, cur[0][0])[0])
            cur = []
            continue
        line = _strip_comment(raw)
        if line.strip():
            cur.append([len(line) - len(line.lstrip(" ")), line.strip()])
    return docs


def _one(path: Path, kind: str, name: str) -> dict:
    found = [d for d in _load(path) if d.get("kind") == kind and d["metadata"]["name"] == name]
    assert len(found) == 1, f"{path.name} 에 {kind}/{name} 가 하나가 아니다: {len(found)}"
    return found[0]


def _selected_names(selector: dict) -> set[str]:
    names = set()
    label = (selector.get("matchLabels") or {}).get("app.kubernetes.io/name")
    if label:
        names.add(label)
    for expr in selector.get("matchExpressions") or []:
        if expr["key"] == "app.kubernetes.io/name" and expr["operator"] == "In":
            names |= set(expr["values"])
    return names


def _pod_spec() -> dict:
    return _one(CRONJOB, "CronJob", NAME)["spec"]["jobTemplate"]["spec"]["template"]["spec"]


# ─── 단언 ────────────────────────────────────────────────────────────────────

def test_role_is_exactly_pods_list_and_pods_log_get():
    role = _one(RBAC, "Role", NAME)
    assert role["metadata"]["namespace"] == "commerce"
    granted: dict[str, set[str]] = {}
    for rule in role["rules"]:
        assert rule["apiGroups"] == [""], f"core 그룹 밖 권한: {rule['apiGroups']}"
        assert not rule.get("resourceNames")
        for resource in rule["resources"]:
            granted.setdefault(resource, set()).update(rule["verbs"])
    assert granted == {"pods": {"list"}, "pods/log": {"get"}}


def test_service_account_and_binding_tie_only_this_role():
    sa = _one(RBAC, "ServiceAccount", NAME)
    assert sa["metadata"]["namespace"] == "commerce"
    binding = _one(RBAC, "RoleBinding", NAME)
    assert binding["roleRef"] == {"apiGroup": "rbac.authorization.k8s.io", "kind": "Role", "name": NAME}
    assert binding["subjects"] == [{"kind": "ServiceAccount", "name": NAME, "namespace": "commerce"}]


def test_only_this_cronjob_uses_the_service_account():
    users = []
    for path in K8S.rglob("*.yaml"):
        for m in re.finditer(r"^\s*serviceAccountName:\s*([\w-]+)", path.read_text(encoding="utf-8"), re.M):
            if m.group(1) == NAME:
                users.append(path.relative_to(REPO).as_posix())
    assert users == ["k8s/base/place-ingest/cronjob-crawl-stats.yaml"]

    spec = _pod_spec()
    assert spec["serviceAccountName"] == NAME
    assert spec["automountServiceAccountToken"] is True

    others = [p for p in (K8S / "base/place-ingest").glob("cronjob-*.yaml") if p != CRONJOB]
    assert others, "다른 place-ingest CronJob 을 못 찾았다"
    for path in others:
        assert "serviceAccountName" not in path.read_text(encoding="utf-8"), f"{path.name} 에 SA 가 붙었다"


def test_pod_label_is_dedicated_and_has_no_part_of():
    cron = _one(CRONJOB, "CronJob", NAME)
    pod_labels = cron["spec"]["jobTemplate"]["spec"]["template"]["metadata"]["labels"]
    assert pod_labels["app.kubernetes.io/name"] == NAME
    assert "app.kubernetes.io/part-of" not in pod_labels
    # CronJob 메타데이터의 part-of 는 oci-arm 의 OCIR pull secret 패치가 대상을 고르는 데 쓴다
    assert cron["metadata"]["labels"]["app.kubernetes.io/part-of"] == "commerce-platform"


def test_no_public_egress_policy_selects_the_pod():
    # 이름 상수가 아니라 CronJob 이 실제로 붙인 파드 라벨로 본다 — 라벨이 place-ingest 로 돌아가면 여기서도 빨개진다
    cron = _one(CRONJOB, "CronJob", NAME)
    pod_name = cron["spec"]["jobTemplate"]["spec"]["template"]["metadata"]["labels"]["app.kubernetes.io/name"]
    checked = 0
    for path in K8S.rglob("*.yaml"):
        text = path.read_text(encoding="utf-8")
        if "kind: NetworkPolicy" not in text or "0.0.0.0/0" not in text:
            continue
        for doc in _load(path):
            if doc.get("kind") != "NetworkPolicy":
                continue
            cidrs = [peer.get("ipBlock", {}).get("cidr") for rule in doc["spec"].get("egress") or []
                     for peer in rule.get("to") or []]
            if "0.0.0.0/0" not in cidrs:
                continue
            checked += 1
            assert pod_name not in _selected_names(doc["spec"]["podSelector"]), path.relative_to(REPO)
    assert checked >= 1, "외부 egress 정책(11)을 하나도 못 읽었다 — 검사가 아무것도 안 본다"


def test_clickhouse_ingress_admits_the_pod():
    policy = _one(NP_DIR / "09-allow-app-to-clickhouse.yaml", "NetworkPolicy", "allow-app-to-clickhouse")
    admitted = set()
    for rule in policy["spec"]["ingress"]:
        for peer in rule["from"]:
            admitted |= _selected_names(peer["podSelector"])
    assert NAME in admitted


def test_egress_is_clickhouse_8123_plus_one_apiserver_address():
    policy = _one(EGRESS, "NetworkPolicy", "allow-crawl-stats-egress")
    spec = policy["spec"]
    assert spec["podSelector"] == {"matchLabels": {"app.kubernetes.io/name": NAME}}
    assert spec["policyTypes"] == ["Egress"]
    assert spec["egress"] == [{
        "to": [{"podSelector": {"matchLabels": {"app.kubernetes.io/name": "clickhouse"}}}],
        "ports": [{"port": 8123, "protocol": "TCP"}],
    }]

    # API 서버 주소는 노드마다 달라 overlay 가 한 줄을 더한다(k3s 는 서비스 IP 가 아니라 DNAT 뒤 노드 :6443 으로 판정)
    ops = _load(APISERVER_PATCH)[0]
    assert len(ops) == 1
    op = ops[0]
    assert (op["op"], op["path"]) == ("add", "/spec/egress/-")
    assert len(op["value"]["to"]) == 1
    cidr = op["value"]["to"][0]["ipBlock"]["cidr"]
    assert re.fullmatch(r"\d+\.\d+\.\d+\.\d+/32", cidr), cidr
    assert op["value"]["ports"] == [{"port": 6443, "protocol": "TCP"}]

    overlay = (OCI / "kustomization.yaml").read_text(encoding="utf-8")
    assert re.search(r"- path: patches/crawl-stats-apiserver-egress\.yaml\n\s+target: "
                     r"\{kind: NetworkPolicy, name: allow-crawl-stats-egress\}", overlay)


def test_env_has_no_secret_and_security_context_is_locked_down():
    text = CRONJOB.read_text(encoding="utf-8")
    assert "secretKeyRef" not in text and "envFrom" not in text and "valueFrom" not in text

    spec = _pod_spec()
    assert len(spec["containers"]) == 1
    container = spec["containers"][0]
    assert container["args"] == ["--job=crawl-stats"]
    assert {e["name"]: e["value"] for e in container["env"]} == {
        "CLICKHOUSE_URL": "http://clickhouse:8123",
        "CLICKHOUSE_USER": "analytics",
        "CLICKHOUSE_PASSWORD": "analytics",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    assert container["securityContext"] == {
        "runAsNonRoot": True,
        "runAsUser": 65534,
        "readOnlyRootFilesystem": True,
        "allowPrivilegeEscalation": False,
        "capabilities": {"drop": ["ALL"]},
    }
    assert container["resources"] == {"requests": {"cpu": "50m", "memory": "64Mi"}, "limits": {"memory": "128Mi"}}


def test_schedule_and_job_history_are_short():
    cron = _one(CRONJOB, "CronJob", NAME)["spec"]
    assert cron["schedule"] == "5 * * * *"
    assert cron["concurrencyPolicy"] == "Forbid"
    assert (cron["successfulJobsHistoryLimit"], cron["failedJobsHistoryLimit"]) == (1, 2)
    job = cron["jobTemplate"]["spec"]
    assert (job["backoffLimit"], job["activeDeadlineSeconds"], job["ttlSecondsAfterFinished"]) == (0, 600, 3600)


def test_manifests_are_registered():
    place = (K8S / "base/place-ingest/kustomization.yaml").read_text(encoding="utf-8")
    assert re.search(r"^\s+- cronjob-crawl-stats\.yaml$", place, re.M)
    assert re.search(r"^\s+- rbac-crawl-stats\.yaml$", place, re.M)
    netpol = (NP_DIR / "kustomization.yaml").read_text(encoding="utf-8")
    assert re.search(r"^\s+- 21-allow-crawl-stats-egress\.yaml$", netpol, re.M)
