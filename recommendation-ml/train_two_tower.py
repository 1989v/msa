"""
Phase 3 PoC — Two-Tower retrieval 모델 학습.

학습 자료: study/docs/20-recommendation-modeling/13-paper-two-tower.md + 16-toy-training-movielens.md

흐름:
1. ClickHouse 의 recommendation_events 에서 (user_id, item_id, action_type) 추출
2. PyTorch Two-Tower 모델 (user_tower + item_tower) 학습 (in-batch CE)
3. user_tower 를 ONNX 로 export
4. 모든 item embedding 사전 계산 + numpy 저장

산출물:
- models/user_tower.onnx
- models/item_embeddings.npy
- models/item_ids.npy
- models/user_ids.npy

PoC 단순화:
- Embedding dim 32 → MLP → 64
- CPU 학습 (작은 데이터)
- 5-10 epoch
"""
import os
import numpy as np
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from clickhouse_driver import Client

CLICKHOUSE_HOST = os.environ.get("CLICKHOUSE_HOST", "localhost")
CLICKHOUSE_PORT = int(os.environ.get("CLICKHOUSE_PORT", "9000"))
CLICKHOUSE_USER = os.environ.get("CLICKHOUSE_USER", "analytics")
CLICKHOUSE_PASSWORD = os.environ.get("CLICKHOUSE_PASSWORD", "analytics")
OUTPUT_DIR = os.environ.get("OUTPUT_DIR", "models")
EMBEDDING_DIM = 64
HIDDEN_DIM = 64
WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "30"))
EPOCHS = int(os.environ.get("EPOCHS", "10"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "64"))
LR = 1e-3


class UserTower(nn.Module):
    def __init__(self, n_users: int, embedding_dim: int = EMBEDDING_DIM, hidden_dim: int = HIDDEN_DIM):
        super().__init__()
        self.user_emb = nn.Embedding(n_users + 1, 32)  # +1 for OOV / padding (id=0)
        self.mlp = nn.Sequential(
            nn.Linear(32, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, embedding_dim),
        )

    def forward(self, user_id: torch.Tensor) -> torch.Tensor:
        x = self.user_emb(user_id)
        out = self.mlp(x)
        # L2 normalize → cosine similarity == dot product
        return nn.functional.normalize(out, dim=-1)


class ItemTower(nn.Module):
    def __init__(self, n_items: int, embedding_dim: int = EMBEDDING_DIM, hidden_dim: int = HIDDEN_DIM):
        super().__init__()
        self.item_emb = nn.Embedding(n_items + 1, 32)
        self.mlp = nn.Sequential(
            nn.Linear(32, hidden_dim),
            nn.ReLU(),
            nn.Linear(hidden_dim, embedding_dim),
        )

    def forward(self, item_id: torch.Tensor) -> torch.Tensor:
        x = self.item_emb(item_id)
        out = self.mlp(x)
        return nn.functional.normalize(out, dim=-1)


class TwoTower(nn.Module):
    def __init__(self, user_tower: UserTower, item_tower: ItemTower):
        super().__init__()
        self.user_tower = user_tower
        self.item_tower = item_tower


class InteractionDataset(Dataset):
    def __init__(self, pairs: list[tuple[int, int]]):
        self.pairs = pairs

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int):
        user_id, item_id = self.pairs[idx]
        return torch.tensor(user_id, dtype=torch.long), torch.tensor(item_id, dtype=torch.long)


def fetch_interactions() -> tuple[list[tuple[int, int]], list[int], list[int]]:
    client = Client(
        host=CLICKHOUSE_HOST,
        port=CLICKHOUSE_PORT,
        user=CLICKHOUSE_USER,
        password=CLICKHOUSE_PASSWORD,
        database="analytics",
    )
    # 강한 시그널만 학습 데이터로
    rows = client.execute(f"""
        SELECT user_id, item_id
        FROM recommendation_events
        WHERE timestamp >= now() - INTERVAL {WINDOW_DAYS} DAY
          AND action_type IN ('click', 'addwish', 'reservation')
          AND user_id > 0
        GROUP BY user_id, item_id
    """)
    pairs = [(int(r[0]), int(r[1])) for r in rows]
    user_ids = sorted(set(p[0] for p in pairs))
    item_ids = sorted(set(p[1] for p in pairs))
    return pairs, user_ids, item_ids


def train():
    print(f"[1/5] Fetching interactions from ClickHouse ({CLICKHOUSE_HOST}:{CLICKHOUSE_PORT})...")
    pairs, user_ids, item_ids = fetch_interactions()
    print(f"  → {len(pairs)} (user, item) pairs / {len(user_ids)} users / {len(item_ids)} items")

    if len(pairs) < 10:
        print("ERROR: 학습 데이터 부족 (< 10 pairs). seed 데이터를 먼저 적재하세요.")
        return

    # Build id index — model 은 contiguous index 사용, 실제 id 는 mapping 으로 복원
    user_id_to_idx = {uid: i + 1 for i, uid in enumerate(user_ids)}  # 0 = padding
    item_id_to_idx = {iid: i + 1 for i, iid in enumerate(item_ids)}
    idx_pairs = [(user_id_to_idx[u], item_id_to_idx[i]) for (u, i) in pairs]

    n_users = len(user_ids)
    n_items = len(item_ids)

    print(f"[2/5] Building Two-Tower model (n_users={n_users}, n_items={n_items}, dim={EMBEDDING_DIM})...")
    user_tower = UserTower(n_users, EMBEDDING_DIM, HIDDEN_DIM)
    item_tower = ItemTower(n_items, EMBEDDING_DIM, HIDDEN_DIM)
    model = TwoTower(user_tower, item_tower)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"[3/5] Training ({EPOCHS} epochs, batch={BATCH_SIZE})...")
    loader = DataLoader(InteractionDataset(idx_pairs), batch_size=BATCH_SIZE, shuffle=True)
    for epoch in range(EPOCHS):
        total_loss = 0.0
        n_batches = 0
        for user_batch, item_batch in loader:
            # In-batch CrossEntropy: 같은 batch 의 다른 (u, i) 가 negative
            u = model.user_tower(user_batch)  # (B, D)
            v = model.item_tower(item_batch)  # (B, D)
            scores = u @ v.T  # (B, B)
            labels = torch.arange(scores.size(0))
            loss = nn.functional.cross_entropy(scores, labels)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1
        avg = total_loss / max(1, n_batches)
        print(f"  epoch {epoch+1}/{EPOCHS}  avg loss={avg:.4f}")

    model.eval()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("[4/5] Exporting user_tower to ONNX...")
    # ONNX 의 user_id input 은 contiguous index 가 아닌 실제 user_id 가 들어옴.
    # → wrap module 로 id_to_idx mapping 까지 포함
    class UserTowerForServe(nn.Module):
        def __init__(self, user_tower: UserTower, user_ids: list[int]):
            super().__init__()
            self.user_tower = user_tower
            # ONNX 가 sparse dictionary lookup 어색 — index tensor 로 만들고 gather
            max_id = max(user_ids) if user_ids else 0
            id_to_idx = torch.zeros(max_id + 2, dtype=torch.long)  # 0 = padding
            for i, uid in enumerate(user_ids):
                id_to_idx[uid] = i + 1
            self.register_buffer("id_to_idx", id_to_idx)
            self.max_known_id = max_id

        def forward(self, user_id: torch.Tensor) -> torch.Tensor:
            # OOV (unknown user) 는 idx=0 (padding) — random embedding 반환
            clamped = torch.clamp(user_id, max=self.max_known_id)
            idx = self.id_to_idx[clamped]
            return self.user_tower(idx)

    serve_user = UserTowerForServe(model.user_tower, user_ids)
    serve_user.eval()
    dummy_input = torch.tensor([user_ids[0]], dtype=torch.long) if user_ids else torch.tensor([1], dtype=torch.long)
    torch.onnx.export(
        serve_user,
        (dummy_input,),
        os.path.join(OUTPUT_DIR, "user_tower.onnx"),
        input_names=["user_id"],
        output_names=["user_embedding"],
        dynamic_axes={"user_id": {0: "batch"}, "user_embedding": {0: "batch"}},
        opset_version=14,
    )

    print("[5/5] Pre-computing item embeddings...")
    with torch.no_grad():
        all_item_idx = torch.arange(1, n_items + 1, dtype=torch.long)
        item_embeddings = model.item_tower(all_item_idx).numpy().astype(np.float32)

    np.save(os.path.join(OUTPUT_DIR, "item_embeddings.npy"), item_embeddings)
    np.save(os.path.join(OUTPUT_DIR, "item_ids.npy"), np.array(item_ids, dtype=np.int64))
    np.save(os.path.join(OUTPUT_DIR, "user_ids.npy"), np.array(user_ids, dtype=np.int64))

    print(f"\n✅ Done. Output dir: {OUTPUT_DIR}/")
    print(f"   user_tower.onnx        ({n_users} known users)")
    print(f"   item_embeddings.npy    ({n_items} items × {EMBEDDING_DIM} dim)")
    print(f"   item_ids.npy / user_ids.npy")


if __name__ == "__main__":
    train()
