"""Domain model — Embedding (32-dim float vector). No framework imports."""
from dataclasses import dataclass

EMBEDDING_DIM = 32


@dataclass
class Embedding:
    vector: list[float]

    def __post_init__(self) -> None:
        if len(self.vector) != EMBEDDING_DIM:
            raise ValueError(
                f"Embedding must have exactly {EMBEDDING_DIM} dimensions, got {len(self.vector)}."
            )
