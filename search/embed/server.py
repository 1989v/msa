"""질의 인코더 사이드카 (ADR-0090 개정 2026-09-08).

검색 파드 옆에서 질의 하나를 벡터로 바꾼다. 문서 인코딩은 여기서 하지 않는다 —
전 코퍼스가 이 CPU 로 20시간이라 서비스를 굶긴다.

세 가지가 이 파일의 계약이다.

1. **연산은 fp32 로 한다.** 체크포인트가 bf16 인데 Ampere A1(Neoverse-N1)에 bf16 명령이 없어
   그대로 두면 mkldnn 이 BLAS 폴백에 떨어져 수십 배 느려진다. 하드웨어 한계가 아니라 적재 옵션이다.
   단 **단어 임베딩 표는 bf16 파일을 매핑한 채 둔다.** 표는 행을 꺼내기만 하고 연산하지 않으며,
   어휘 26만 × 640 이라 fp32 로 올리면 671MB 가 상주한다. 꺼낸 행만 fp32 로 바꿔 배율을 곱하므로
   fp32 로 전부 올렸을 때와 벡터가 비트 단위로 같다(판정 세트 질의 235개 대조, 2026-10-20).
2. **스레드를 1로 고정한다.** 실측에서 1코어 150ms · 2코어 143ms 로 차이가 거의 없다.
   코어를 더 받아도 안 빨라지므로 남은 코어는 클러스터에 남긴다.
3. **safetensors 만 읽는다.** pickle 은 역직렬화가 곧 코드 실행이다. 커스텀 코드도 거부한다.
"""
from __future__ import annotations

import ctypes
import gc
import json
import logging
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

THREADS = int(os.environ.get("ENCODER_THREADS", "1"))
os.environ.setdefault("OMP_NUM_THREADS", str(THREADS))

import numpy as np  # noqa: E402
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


class MappedScaledEmbedding(torch.nn.Module):
    """bf16 임베딩 표를 파일 매핑으로 두고, 꺼낸 행만 fp32 로 바꾼 뒤 배율을 곱한다.

    Gemma3 원본은 가중치 dtype 으로 배율을 곱한다 — 표를 bf16 으로 둔 채 원본 모듈을 쓰면
    곱셈이 bf16 이 되어 벡터가 달라진다. 표는 파라미터가 아니라 `.float()` 가 건드리지 않는다.
    """

    def __init__(self, table: torch.Tensor, scale: float, padding_idx):
        super().__init__()
        self.table = table
        self.embed_scale = torch.tensor(scale, dtype=torch.float32)
        self.padding_idx = padding_idx
        self.num_embeddings, self.embedding_dim = table.shape

    def forward(self, input_ids: torch.Tensor) -> torch.Tensor:
        rows = torch.nn.functional.embedding(input_ids, self.table).to(torch.float32)
        return rows * self.embed_scale


def mapped_table(model_dir: str, suffix: str = "embed_tokens.weight") -> torch.Tensor:
    """safetensors 안의 bf16 표를 복사 없이 매핑한다 — 읽은 페이지만 파일 캐시로 올라온다."""
    path = os.path.join(model_dir, "model.safetensors")
    with open(path, "rb") as f:
        n = int.from_bytes(f.read(8), "little")
        header = json.loads(f.read(n))
    key = next(k for k in header if k.endswith(suffix))
    meta = header[key]
    if meta["dtype"] != "BF16":
        raise SystemExit(f"임베딩 표가 bf16 이 아니다: {meta['dtype']}")
    start, end = meta["data_offsets"]
    raw = np.memmap(path, dtype=np.uint16, mode="r", offset=8 + n + start, shape=((end - start) // 2,))
    return torch.from_numpy(raw).view(torch.bfloat16).view(*meta["shape"])


def release_freed_memory() -> None:
    """적재 중 해제한 bf16 버퍼를 OS 에 돌려준다 — glibc 는 해제한 메모리를 쥐고 있는다."""
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except OSError:
        pass  # glibc 가 아닌 곳(로컬 macOS)에서는 할 일이 없다


def load() -> tuple[SentenceTransformer, str, int]:
    # bf16 으로 읽어 최고점을 낮추고, 표를 매핑으로 바꾼 뒤 나머지만 fp32 로 올린다.
    # 처음부터 fp32 로 읽으면 bf16 원본과 fp32 사본이 잠깐 함께 있어 기동 최고점이 2.0GB 였다.
    kwargs = {"torch_dtype": torch.bfloat16, "use_safetensors": True}
    model = SentenceTransformer(
        MODEL_PATH, device="cpu", trust_remote_code=False,
        revision=REVISION or None, model_kwargs=kwargs,
    )
    base = model[0].auto_model
    emb = base.embed_tokens
    base.embed_tokens = MappedScaledEmbedding(mapped_table(MODEL_PATH), float(emb.scalar_embed_scale), emb.padding_idx)
    del emb
    model.float()
    release_freed_memory()
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


# 질의 하나가 들어오는 본문이라 이보다 클 이유가 없다.
MAX_BODY = 64 * 1024


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

    def _read_body(self) -> bytes:
        """본문을 읽는다 — Content-Length 와 청크 전송 인코딩 둘 다.

        HTTP/1.1 클라이언트는 본문 길이를 미리 모르면 청크로 보낸다. Spring 6.2 의
        RestClient 가 그 경우다. Content-Length 만 읽으면 본문이 빈 것으로 보이고,
        남은 청크 틀이 다음 요청줄로 읽혀 연결이 어긋난다.
        """
        if "chunked" in self.headers.get("Transfer-Encoding", "").lower():
            chunks = bytearray()
            while True:
                size = int(self.rfile.readline().split(b";")[0].strip() or b"0", 16)
                if size == 0:
                    break
                if len(chunks) + size > MAX_BODY:
                    raise ValueError("body too large")
                chunks += self.rfile.read(size)
                self.rfile.read(2)  # 청크 뒤 CRLF
            while self.rfile.readline().strip():  # 트레일러
                pass
            return bytes(chunks)
        n = int(self.headers.get("Content-Length", "0"))
        if n > MAX_BODY:
            raise ValueError("body too large")
        return self.rfile.read(n)

    def do_POST(self) -> None:  # noqa: N802
        if self.path != "/encode":
            self._send(404, {"error": "not found"})
            return
        try:
            query = (json.loads(self._read_body() or b"{}").get("query") or "").strip()
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
