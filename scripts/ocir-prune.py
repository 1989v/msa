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
    a = ap.parse_args()

    need = ["OCIR_REGION", "OCIR_NAMESPACE", "OCIR_USERNAME", "OCIR_TOKEN"]
    miss = [k for k in need if not os.environ.get(k)]
    if miss:
        sys.exit(f"환경변수 없음: {', '.join(miss)}")

    reg = Registry(os.environ["OCIR_REGION"], os.environ["OCIR_NAMESPACE"],
                   os.environ["OCIR_USERNAME"], os.environ["OCIR_TOKEN"])
    order, dep = git_order(), deployed_tags()
    repos = a.repo or reg.repos()

    total_del = total_keep = 0
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


if __name__ == "__main__":
    main()
