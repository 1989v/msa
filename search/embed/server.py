"""질의 인코더 사이드카 (ADR-0090 개정 2026-09-08).

검색 파드 옆에서 질의 하나를 벡터로 바꾼다. 문서 인코딩은 여기서 하지 않는다 —
전 코퍼스가 이 CPU 로 20시간이라 서비스를 굶긴다.

세 가지가 이 파일의 계약이다.

1. **fp32 로 적재한다.** 체크포인트가 bf16 인데 Ampere A1(Neoverse-N1)에 bf16 명령이 없어
   그대로 두면 mkldnn 이 BLAS 폴백에 떨어져 수십 배 느려진다. 하드웨어 한계가 아니라 적재 옵션이다.
2. **스레드를 1로 고정한다.** 실측에서 1코어 150ms · 2코어 143ms 로 차이가 거의 없다.
   코어를 더 받아도 안 빨라지므로 남은 코어는 클러스터에 남긴다.
3. **safetensors 만 읽는다.** pickle 은 역직렬화가 곧 코드 실행이다. 커스텀 코드도 거부한다.
"""
from __future__ import annotations

import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

THREADS = int(os.environ.get("ENCODER_THREADS", "1"))
os.environ.setdefault("OMP_NUM_THREADS", str(THREADS))

import torch  # noqa: E402  — 스레드 수를 먼저 정하고 불러야 한다
from sentence_transformers import SentenceTransformer  # noqa: E402

torch.set_num_threads(THREADS)

# 적재 경로와 **스탬프에 쓰는 논리 id 를 분리한다.** 가중치는 이미지 안 경로에서 읽지만
# 스탬프는 허브 id 여야 도구가 만든 문서 벡터와 같은 공간으로 인식된다.
# 이 둘이 어긋나면 벡터 레그가 조용히 꺼진다(embeddingModel 필터가 아무것도 못 찾는다).
MODEL_PATH = os.environ.get("ENCODER_MODEL", "microsoft/harrier-oss-v1-270m")
MODEL_ID = os.environ.get("ENCODER_MODEL_ID", MODEL_PATH)
REVISION = os.environ.get("ENCODER_REVISION", "")
PROMPT = os.environ.get(
    "ENCODER_QUERY_PROMPT",
    "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: ",
)
PORT = int(os.environ.get("ENCODER_PORT", "8099"))

log = logging.getLogger("encoder")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

_lock = threading.Lock()


def load() -> tuple[SentenceTransformer, str, int]:
    kwargs = {"torch_dtype": torch.float32, "use_safetensors": True}
    model = SentenceTransformer(
        MODEL_PATH, device="cpu", trust_remote_code=False,
        revision=REVISION or None, model_kwargs=kwargs,
    )
    dim = model.get_sentence_embedding_dimension()
    if not REVISION:
        # 스탬프에 리비전이 없으면 어느 가중치인지 특정할 수 없다 — 조용히 도는 것보다 낫다.
        raise SystemExit("ENCODER_REVISION 이 비어 있다 — 스탬프를 만들 수 없다")
    rev = REVISION[:7]
    ref = f"{MODEL_ID}@{rev}#d{dim}"
    log.info("loaded %s (dim %d, threads %d)", ref, dim, THREADS)
    return model, ref, dim


MODEL, MODEL_REF, DIM = load()


def encode(query: str) -> list[float]:
    # 한 프로세스에 스레드 1개이므로 직렬화한다 — 동시 요청이 서로의 배치를 흔들지 않게.
    with _lock:
        v = MODEL.encode([query], prompt=PROMPT, batch_size=1,
                         normalize_embeddings=True, convert_to_numpy=True,
                         show_progress_bar=False)[0]
    return [float(x) for x in v]


class Handler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send(self, code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path in ("/healthz", "/health"):
            self._send(200, {"status": "UP", "modelRef": MODEL_REF})
        elif self.path == "/model":
            self._send(200, {"modelRef": MODEL_REF, "dim": DIM, "threads": THREADS})
        else:
            self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/encode":
            self._send(404, {"error": "not found"})
            return
        try:
            n = int(self.headers.get("Content-Length", "0"))
            query = (json.loads(self.rfile.read(n) or b"{}").get("query") or "").strip()
        except Exception:
            self._send(400, {"error": "bad json"})
            return
        if not query:
            self._send(400, {"error": "query is empty"})
            return
        try:
            self._send(200, {"vector": encode(query), "dim": DIM, "modelRef": MODEL_REF})
        except Exception as e:  # 인코딩 실패는 500 — 호출자가 BM25 로 답한다
            log.exception("encode failed")
            self._send(500, {"error": str(e)})

    def log_message(self, *args) -> None:  # 접근 로그는 끈다 — 질의가 로그에 남지 않게
        pass


if __name__ == "__main__":
    ThreadingHTTPServer(("0.0.0.0", PORT), Handler).serve_forever()
