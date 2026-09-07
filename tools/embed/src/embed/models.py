"""모델 스펙과 후보 등록부. model_ref = hf_id@rev7#d{dim} 가 벡터 공간의 식별자다."""
from __future__ import annotations

from dataclasses import dataclass, replace


@dataclass(frozen=True)
class ModelSpec:
    key: str
    hf_id: str
    dim: int                       # MRL 로 자른 뒤 저장할 차원 (native_dim 이하)
    native_dim: int
    pooling: str                   # "mean" | "last" | "cls" — sentence-transformers 모델 설정이 이미 갖고 있다. 기록용
    mrl: bool                      # Matryoshka 지원(자르기 허용). False 면 dim == native_dim 이어야 한다
    query_prompt: str | None       # 질의 앞에 붙이는 문자열. 문서에는 붙이지 않는다
    doc_prompt: str | None = None
    revision: str | None = None    # HF commit sha. None 이면 resolve_revision() 으로 채운다
    load_kwargs: dict | None = None  # sentence_transformers.SentenceTransformer(model_kwargs=...) 용
    normalize: bool = True
    fp16_ok: bool = True           # False 면 fp32 로 로드한다. harrier-270m 은 fp16 에서 NaN 이 난다(2026-09-05 MPS 실측)

    @property
    def ref(self) -> str:
        if not self.revision:
            raise ValueError(f"{self.key}: revision 이 아직 없다 — resolve_revision() 먼저")
        return f"{self.hf_id}@{self.revision[:7]}#d{self.dim}"

    def with_dim(self, dim: int) -> "ModelSpec":
        if dim != self.native_dim and not self.mrl:
            raise ValueError(f"{self.key}: MRL 을 지원하지 않아 {dim} 으로 못 자른다 (native {self.native_dim})")
        if dim > self.native_dim:
            raise ValueError(f"{self.key}: dim {dim} > native {self.native_dim}")
        return replace(self, dim=dim)


QWEN3_QUERY = "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: "
HARRIER_QUERY = "Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: "

#: **선정 모델은 `qwen3-4b`** (ADR-0090 D5, 2026-09-07 개정) — 전 코퍼스 nDCG@10 0.7764 로 후보 7종 중 1위.
#: 나머지는 그 판단의 대조군으로 남긴다. 지우지 않는다 — 모델을 다시 고를 때 같은 표를 다시 만들어야 한다.
CANDIDATES: dict[str, ModelSpec] = {
    # 8B 는 4B 보다 낮았다(재순위 0.7686 vs 0.7765, 시간은 두 배). 절단 폭 탓으로 보인다:
    # 4096 → 1024 는 3/4 를 버리고 4B 의 2560 → 1024 는 60% 다. 4096 을 그대로 쓰는 길은 색인이 막는다(플랜 §8.4-1).
    "qwen3-8b": ModelSpec("qwen3-8b", "Qwen/Qwen3-Embedding-8B", 1024, 4096, "last", True, QWEN3_QUERY,
                          load_kwargs={"quantize_8bit": True}),
    "qwen3-4b": ModelSpec("qwen3-4b", "Qwen/Qwen3-Embedding-4B", 1024, 2560, "last", True, QWEN3_QUERY),
    "arctic-ko": ModelSpec("arctic-ko", "dragonkue/snowflake-arctic-embed-l-v2.0-ko", 1024, 1024, "cls", True, "query: "),
    # 위 모델의 **베이스**(Snowflake 공식). 한국어 파인튜닝이 개인 계정이라는 점이 걸릴 때의 대안이고,
    # 한국어를 얼마나 잃는지는 재 봐야 안다 — 그것이 이 후보를 넣는 이유다.
    "arctic-official": ModelSpec("arctic-official", "Snowflake/snowflake-arctic-embed-l-v2.0", 1024, 1024, "cls", True, "query: "),
    # P0 후보 조사에서 빠졌던 기준선. 한국어 검색에서 가장 널리 쓰이는 다국어 모델 중 하나다.
    # **접두어를 쓰지 않는다**(모델 카드: "no longer requires adding instructions to the queries").
    # MRL 을 공식 지원하지 않아 1024 고정 — 우리 목표 차원과 같아서 문제되지 않는다.
    "bge-m3": ModelSpec("bge-m3", "BAAI/bge-m3", 1024, 1024, "cls", False, None),
    "harrier-0.6b": ModelSpec("harrier-0.6b", "microsoft/harrier-oss-v1-0.6b", 1024, 1024, "last", False, HARRIER_QUERY, fp16_ok=False),
    "harrier-270m": ModelSpec("harrier-270m", "microsoft/harrier-oss-v1-270m", 640, 640, "last", False, HARRIER_QUERY, fp16_ok=False),
    # gemma 는 HF 에서 gated(라이선스 수락 + 토큰) — 로컬 무토큰 환경에서는 못 받는다. Colab 에서 HF_TOKEN 을 넣고 돈다
    "gemma-300m": ModelSpec("gemma-300m", "google/embeddinggemma-300m", 768, 768, "mean", True,
                            "task: search result | query: ", doc_prompt="title: none | text: "),
    # 기준선(플랜 v1 실측 모델) — 작은 모델이 "충분한가"를 같은 표에서 본다
    "e5-small": ModelSpec("e5-small", "intfloat/multilingual-e5-small", 384, 384, "mean", False, "query: ", doc_prompt="passage: "),
    # IBM Granite R2 (2026-04) — 첫 후보 조사(2026-09-05) 때 목록에만 있고 재지 않았다.
    # Apache-2.0 · 한국어 명시 지원 · 97m 은 e5-small(118M)보다 작으면서 노드 1코어 36.5ms 로 더 빠르다.
    # 체크포인트가 bf16 이라 **fp32 로 적재해야 한다** — Neoverse-N1 에 bf16 명령이 없어
    # 그대로 두면 mkldnn 이 BLAS 폴백에 떨어져 쓸 수 없을 만큼 느려진다(2026-09-08 실측).
    "granite-97m": ModelSpec("granite-97m", "ibm-granite/granite-embedding-97m-multilingual-r2",
                             384, 384, "cls", False, None, fp16_ok=False),
    "granite-311m": ModelSpec("granite-311m", "ibm-granite/granite-embedding-311m-multilingual-r2",
                              768, 768, "cls", False, None, fp16_ok=False),
}


def resolve_revision(spec: ModelSpec) -> ModelSpec:
    """HF 허브에서 현재 커밋 sha 를 읽어 스탬프에 박는다. 네트워크가 필요하다."""
    if spec.revision:
        return spec
    from huggingface_hub import model_info  # 무거운 의존은 필요할 때만
    sha = model_info(spec.hf_id).sha
    if not sha:
        raise RuntimeError(f"{spec.hf_id}: HF sha 를 못 읽었다")
    return replace(spec, revision=sha)
