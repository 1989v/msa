#!/usr/bin/env python3
# source: docs/standards/unity-game-pipeline.md
"""게임 폴더를 로컬에서 서빙한다 — 운영 nginx 와 같은 헤더로.

Unity WebGL 은 Gzip 으로 굽고 압축 폴백을 끈 상태다(설정 오류가 숨지 않게). 그래서 서버가
`.gz` 에 `Content-Encoding: gzip` 과 원래 MIME 을 붙여야 브라우저가 푼다. python -m http.server
는 그걸 안 하므로 그대로 열면 로딩 0% 에서 멈춘다 — 게임 버그로 오진하기 딱 좋다.

이 스크립트가 붙이는 헤더는 portal-fe/nginx.conf 의 Unity 블록과 같은 규칙이다.
둘이 어긋나면 로컬에서 되는데 배포에서 안 되는 상태가 된다.

  scripts/serve-games.py [--port 8100]
  → http://localhost:8100/games/<slug>/index.html
"""

from __future__ import annotations

import argparse
import functools
import http.server
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / "portal-fe" / "public"

# .gz 를 벗긴 뒤의 확장자로 원래 타입을 정한다 — 브라우저는 Content-Type 으로 파서를 고른다.
INNER_TYPES = {
    ".wasm": "application/wasm",
    ".js": "text/javascript",
    ".data": "application/octet-stream",
    ".symbols.json": "application/json",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self) -> None:
        path = self.translate_path(self.path)
        if path.endswith(".gz"):
            self.send_header("Content-Encoding", "gzip")
        # 게임 자산은 파일명이 고정이라 캐시를 남기면 배포 후에도 구버전이 나간다.
        # Unity 의 Build/ 만 파일명에 해시가 있어 예외다.
        if "/Build/" in self.path:
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def guess_type(self, path):  # type: ignore[override]
        if str(path).endswith(".gz"):
            stem = str(path)[:-3]
            for suffix, mime in INNER_TYPES.items():
                if stem.endswith(suffix):
                    return mime
            return "application/octet-stream"
        return super().guess_type(path)

    def log_message(self, fmt: str, *args) -> None:
        if "404" in (fmt % args):
            super().log_message(fmt, *args)


def main() -> int:
    ap = argparse.ArgumentParser(description="게임 로컬 서빙 (Unity gzip 헤더 포함)")
    ap.add_argument("--port", type=int, default=8100)
    args = ap.parse_args()

    os.chdir(ROOT)
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as httpd:
        print(f"serving {ROOT} → http://localhost:{args.port}/games/")
        httpd.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
