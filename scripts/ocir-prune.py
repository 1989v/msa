#!/usr/bin/env python3
"""OCIR 에 쌓인 옛 빌드 이미지를 정리한다.

OCIR 은 보관 개수 설정이 없다(ArtifactsClient 에 retention API 자체가 없음). 그래서 CI 가
푸시할 때마다 태그가 무한히 쌓이고, 무료 한도 10GB 를 넘으면 저장 용량으로 과금된다.

빌드 태그는 커밋 short sha 라 **git 커밋 순서가 곧 최신 순서**다. 레지스트리에 날짜를
물어볼 필요가 없어 tags/list 한 번이면 판정이 끝난다.

보존 규칙 (하나라도 걸리면 남긴다):
  1. sha 태그가 아닌 것 — latest, 3.3.0 같은 고정 태그
  2. k8s/overlays/oci-arm 에 적힌 배포 중 태그
  3. git 순서로 최신 KEEP 개

Registry v2 API 만 쓰므로 CI 에 이미 있는 OCIR_USERNAME / OCIR_TOKEN 이면 충분하다
(Artifacts API 는 별도 서명키가 필요하다).
"""
import argparse, base64, json, os, re, subprocess, sys, urllib.error, urllib.request

ACCEPT = ",".join([
    "application/vnd.oci.image.index.v1+json",
    "application/vnd.docker.distribution.manifest.list.v2+json",
    "application/vnd.oci.image.manifest.v1+json",
    "application/vnd.docker.distribution.manifest.v2+json",
])
SHA_TAG = re.compile(r"^[0-9a-f]{7,40}$")


def req(url, method="GET", token=None, user=None, pw=None, accept=None):
    r = urllib.request.Request(url, method=method)
    if token:
        r.add_header("Authorization", f"Bearer {token}")
    elif user is not None:
        b = base64.b64encode(f"{user}:{pw}".encode()).decode()
        r.add_header("Authorization", f"Basic {b}")
    if accept:
        r.add_header("Accept", accept)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            return resp.status, resp.headers, resp.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers, e.read()


class Registry:
    def __init__(self, region, ns, user, token):
        self.base = f"https://{region}.ocir.io"
        self.realm = f"{self.base}/20180419/docker/token"
        self.service = f"{region}.ocir.io"
        self.ns, self.user, self.pw = ns, user, token
        self._cache = {}

    def token(self, repo):
        if repo not in self._cache:
            url = (f"{self.realm}?service={self.service}"
                   f"&scope=repository:{self.ns}/{repo}:pull,push")
            st, _, body = req(url, user=self.user, pw=self.pw)
            if st != 200:
                raise RuntimeError(f"token 실패 {repo}: {st} {body[:200]!r}")
            self._cache[repo] = json.loads(body).get("token") or json.loads(body)["access_token"]
        return self._cache[repo]

    def repos(self):
        # _catalog 는 리포지토리 스코프가 아니라 registry 스코프 토큰을 쓴다.
        st, _, body = req(f"{self.realm}?service={self.service}", user=self.user, pw=self.pw)
        tok = json.loads(body).get("token")
        st, _, body = req(f"{self.base}/v2/_catalog?n=1000", token=tok)
        if st != 200:
            raise RuntimeError(f"_catalog 실패: {st}")
        out = []
        for full in json.loads(body).get("repositories", []):
            out.append(full.split("/", 1)[1] if "/" in full else full)
        return sorted(out)

    def tags(self, repo):
        st, _, body = req(f"{self.base}/v2/{self.ns}/{repo}/tags/list",
                          token=self.token(repo))
        if st != 200:
            return []
        return json.loads(body).get("tags") or []

    def manifest(self, repo, ref):
        st, hdr, body = req(f"{self.base}/v2/{self.ns}/{repo}/manifests/{ref}",
                            token=self.token(repo), accept=ACCEPT)
        if st != 200:
            return None, None
        return hdr.get("Docker-Content-Digest"), json.loads(body)

    def delete(self, repo, digest):
        st, _, body = req(f"{self.base}/v2/{self.ns}/{repo}/manifests/{digest}",
                          method="DELETE", token=self.token(repo))
        return st in (200, 202, 404), st, body[:160]


def repo_bytes(reg, repo, tags):
    """태그들이 참조하는 blob(레이어·config)을 digest 로 중복 제거해 합한다 — 과금이 세는 모양과 같다.
    인덱스 태그는 하위 매니페스트(플랫폼별·attestation)까지 따라간다."""
    seen = {}
    for t in tags:
        _, man = reg.manifest(repo, t)
        if not man:
            continue
        mans = [man]
        for c in man.get("manifests", []):
            _, cm = reg.manifest(repo, c["digest"])
            if cm:
                mans.append(cm)
        for m in mans:
            blobs = list(m.get("layers", []))
            if m.get("config"):
                blobs.append(m["config"])
            for b in blobs:
                seen[b["digest"]] = b.get("size", 0)
    return sum(seen.values())


def git_order():
    """short sha → 최신일수록 작은 순번."""
    out = subprocess.run(["git", "log", "--format=%h", "--abbrev=7"],
                         capture_output=True, text=True, check=True).stdout.split()
    return {s: i for i, s in enumerate(out)}


def deployed_tags(root="k8s/overlays/oci-arm"):
    """오버레이에 적힌 배포 중 태그. 이건 무슨 일이 있어도 남긴다."""
    pat = re.compile(r'newName:\s*\S*?ocir\.io/\w+/([\w-]+)\s*\n\s*newTag:\s*"?([\w.-]+)"?')
    found = {}
    for dirpath, _, files in os.walk(root):
        for f in files:
            if not f.endswith((".yaml", ".yml")):
                continue
            p = os.path.join(dirpath, f)
            with open(p, encoding="utf-8", errors="ignore") as fh:
                for m in pat.finditer(fh.read()):
                    found.setdefault(m.group(1), set()).add(m.group(2))
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", type=int, default=20, help="repo 당 남길 빌드 태그 수")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--repo", action="append", help="특정 repo 만 (반복 지정)")
    ap.add_argument("--cache-digest", metavar="REPO",
                    help="REPO:buildcache 의 지금 digest 를 출력하고 끝낸다(없으면 빈 줄)")
    ap.add_argument("--drop", nargs=2, metavar=("REPO", "DIGEST"),
                    help="밀려난 캐시 매니페스트 하나를 digest 로 지우고 끝낸다")
    ap.add_argument("--budget-gib", type=float, metavar="GIB",
                    help="정리 뒤 남은 저장량(저장소별 중복 제거 blob 합)이 이 값을 넘으면 종료 코드 1")
    a = ap.parse_args()

    need = ["OCIR_REGION", "OCIR_NAMESPACE", "OCIR_USERNAME", "OCIR_TOKEN"]
    miss = [k for k in need if not os.environ.get(k)]
    if miss:
        sys.exit(f"환경변수 없음: {', '.join(miss)}")

    reg = Registry(os.environ["OCIR_REGION"], os.environ["OCIR_NAMESPACE"],
                   os.environ["OCIR_USERNAME"], os.environ["OCIR_TOKEN"])
    # buildcache 태그는 빌드마다 새 캐시로 바뀌고, 밀려난 매니페스트는 태그 없이 남아 그 빌드의 레이어를
    # 계속 붙잡는다 — 옛 sha 태그를 지워도 레이어가 회수되지 않아 portal-fe 하나가 246개 · 15GB 를 쌓았다
    # (2026-10-02). 태그 없는 매니페스트는 Registry v2 로 목록을 볼 수 없으니, 빌드 직전 digest 를 적어 두고
    # 빌드 뒤 바뀌었으면 그 하나를 지운다.
    if a.cache_digest:
        digest, _ = reg.manifest(a.cache_digest, "buildcache")
        print(digest or "")
        return
    if a.drop:
        repo, digest = a.drop
        ok, st, body = reg.delete(repo, digest)
        print(f"[{repo}] 밀려난 캐시 {digest[:19]} 삭제 {'완료' if ok else '실패'} ({st})")
        return

    order, dep = git_order(), deployed_tags()
    repos = a.repo or reg.repos()

    total_del = total_keep = 0
    kept_tags = {}  # 저장량 계산용 — 정리 뒤 남는 태그
    for repo in repos:
        tags = reg.tags(repo)
        if not tags:
            continue
        builds = sorted([t for t in tags if SHA_TAG.match(t) and t in order],
                        key=lambda t: order[t])
        protected = set(dep.get(repo, set())) | {t for t in tags if t not in builds}
        doomed = [t for t in builds[a.keep:] if t not in protected]
        kept = len(tags) - len(doomed)
        total_keep += kept
        kept_tags[repo] = [t for t in tags if t not in doomed]
        if not doomed:
            continue
        print(f"[{repo}] 태그 {len(tags)} → 보존 {kept} / 삭제 {len(doomed)}")
        for t in doomed:
            digest, man = reg.manifest(repo, t)
            if not digest:
                print(f"    ? {t}: manifest 조회 실패 — 건너뜀")
                continue
            children = [m["digest"] for m in (man or {}).get("manifests", [])]
            if a.dry_run:
                print(f"    - {t} {digest[:19]} (하위 {len(children)})")
                total_del += 1
                continue
            # 인덱스를 먼저 지운다. 중간에 실패해도 태그가 깨진 채 남지 않는다.
            ok, st, body = reg.delete(repo, digest)
            if not ok:
                print(f"    ! {t}: index 삭제 실패 {st} {body!r}")
                continue
            for c in children:
                reg.delete(repo, c)
            total_del += 1
    verb = "삭제 예정" if a.dry_run else "삭제"
    print(f"\n합계: {verb} {total_del} 태그 / 보존 {total_keep} 태그 (keep={a.keep})")

    if a.budget_gib is None:
        return
    # 무료 한도는 Object Storage 버킷과 합산이라 이미지 몫은 10 GiB 보다 작다. 넘으면 과금되기 전에 잡을 실패시켜 알린다.
    sizes = {repo: repo_bytes(reg, repo, tags) / 2 ** 30 for repo, tags in kept_tags.items()}
    total = sum(sizes.values())
    top = ", ".join(f"{r} {g:.2f}" for r, g in sorted(sizes.items(), key=lambda kv: -kv[1])[:5])
    print(f"남은 저장량 {total:.2f} GiB / 예산 {a.budget_gib:g} GiB — 큰 저장소: {top}")
    if total > a.budget_gib:
        print(f"::error::OCIR 저장량 {total:.2f} GiB 가 예산 {a.budget_gib:g} GiB 를 넘었다 — "
              f"무료 10 GiB·월을 백업 버킷과 나눠 쓴다. 큰 저장소부터 본다: {top}")
        sys.exit(1)


if __name__ == "__main__":
    main()
