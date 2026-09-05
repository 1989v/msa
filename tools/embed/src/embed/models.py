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

CANDIDATES: dict[str, ModelSpec] = {
    "qwen3-8b": ModelSpec("qwen3-8b", "Qwen/Qwen3-Embedding-8B", 1024, 4096, "last", True, QWEN3_QUERY,
                          load_kwargs={"quantize_8bit": True}),
    "qwen3-4b": ModelSpec("qwen3-4b", "Qwen/Qwen3-Embedding-4B", 1024, 2560, "last", True, QWEN3_QUERY),
    "arctic-ko": ModelSpec("arctic-ko", "dragonkue/snowflake-arctic-embed-l-v2.0-ko", 1024, 1024, "cls", True, "query: "),
    "harrier-0.6b": ModelSpec("harrier-0.6b", "microsoft/harrier-oss-v1-0.6b", 1024, 1024, "last", False, HARRIER_QUERY),
    "gemma-300m": ModelSpec("gemma-300m", "google/embeddinggemma-300m", 768, 768, "mean", True,
                            "task: search result | query: ", doc_prompt="title: none | text: "),
    # 기준선(플랜 v1 실측 모델) — 작은 모델이 "충분한가"를 같은 표에서 본다
    "e5-small": ModelSpec("e5-small", "intfloat/multilingual-e5-small", 384, 384, "mean", False, "query: ", doc_prompt="passage: "),
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
