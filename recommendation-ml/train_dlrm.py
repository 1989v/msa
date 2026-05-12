"""
Phase 5 — DLRM (Meta 2019) Ranking 모델 학습 (ADR-0048).

학습 자료: study/docs/20-recommendation-modeling/14-paper-dlrm.md

흐름:
1. ClickHouse 의 recommendation_events 추출 (positive + 4x random negative)
2. DLRM 학습 (Bottom MLP + Embeddings + Pairwise dot product + Top MLP)
3. dlrm.onnx export

DLRM 구조 (학습 §14 §2):
- Sparse: user_id (32 dim), item_id (32 dim), city (8 dim) — embedding tables
- Dense: city_idx float, category_idx float — Bottom MLP → embedding_dim 정렬
- Feature interaction: 모든 vector pair 의 dot product (upper triangle)
- Top MLP → sigmoid

Wide&Deep 대비 차이:
- Manual cross 제거 → pairwise interaction 자동
- Bottom MLP 가 dense feature 를 embedding 공간으로 정렬
"""
import json
import os
import random
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
EMBEDDING_DIM = 32
WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "30"))
EPOCHS = int(os.environ.get("DLRM_EPOCHS", "20"))
BATCH_SIZE = int(os.environ.get("DLRM_BATCH_SIZE", "256"))
LR = float(os.environ.get("DLRM_LR", "1e-3"))
NEG_PER_POS = int(os.environ.get("NEG_PER_POS", "4"))
N_CITIES = 4
N_CATEGORIES = 4
SEED = 42


def _set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


class DLRM(nn.Module):
    """
    DLRM (Naumov et al., Meta 2019) — Sparse + Dense + Pairwise interaction.

    Bottom MLP: dense (city_idx, category_idx as float) → embedding_dim 정렬
    Embeddings: user_id, item_id, user_city, item_city, item_category
    Interaction: 모든 (n+1) vectors 의 pairwise dot product (upper triangle)
    Top MLP: interaction + dense_vec → sigmoid
    """

    def __init__(self, n_users: int, n_items: int, embedding_dim: int = EMBEDDING_DIM):
        super().__init__()
        self.embedding_dim = embedding_dim

        # Bottom MLP: 2 dense features (city_idx, category_idx) → embedding_dim
        self.bottom_mlp = nn.Sequential(
            nn.Linear(2, 32),
            nn.ReLU(),
            nn.Linear(32, embedding_dim),
        )

        # Embedding tables (id 0 = padding/OOV)
        self.user_emb = nn.Embedding(n_users + 1, embedding_dim)
        self.item_emb = nn.Embedding(n_items + 1, embedding_dim)
        self.user_city_emb = nn.Embedding(N_CITIES, embedding_dim)
        self.item_city_emb = nn.Embedding(N_CITIES, embedding_dim)
        self.item_category_emb = nn.Embedding(N_CATEGORIES, embedding_dim)

        # Top MLP — interaction(upper triangle of (n+1)x(n+1)) + dense_vec → 1
        n_vectors = 6  # dense_vec + 5 embeddings
        # Precompute upper-triangle indices (torch.triu_indices 는 ONNX opset14 미지원 → buffer)
        idx_i, idx_j = torch.triu_indices(n_vectors, n_vectors, offset=1)
        self.register_buffer("triu_i", idx_i)
        self.register_buffer("triu_j", idx_j)
        interaction_dim = n_vectors * (n_vectors - 1) // 2
        self.top_mlp = nn.Sequential(
            nn.Linear(embedding_dim + interaction_dim, 128),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(128, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
        )

    def forward(
        self,
        user_idx: torch.Tensor,
        item_idx: torch.Tensor,
        user_city: torch.Tensor,
        item_city: torch.Tensor,
        item_category: torch.Tensor,
    ) -> torch.Tensor:
        # Dense features → embedding-dim vector
        dense = torch.stack([user_city.float(), item_category.float()], dim=-1)
        dense_vec = self.bottom_mlp(dense)  # (B, embedding_dim)

        # Sparse embeddings
        ue = self.user_emb(user_idx)
        ie = self.item_emb(item_idx)
        uce = self.user_city_emb(user_city)
        ice = self.item_city_emb(item_city)
        icat = self.item_category_emb(item_category)

        # Stack vectors: (B, 6, D)
        vectors = torch.stack([dense_vec, ue, ie, uce, ice, icat], dim=1)

        # Pairwise dot product (B, 6, 6) → upper triangle (B, 15)
        bmm = torch.bmm(vectors, vectors.transpose(1, 2))
        interaction = bmm[:, self.triu_i, self.triu_j]  # (B, 15)

        # Top MLP: concat dense + interaction
        top_in = torch.cat([dense_vec, interaction], dim=-1)
        return torch.sigmoid(self.top_mlp(top_in).squeeze(-1))


class RankingDataset(Dataset):
    def __init__(self, samples):
        self.samples = samples

    def __len__(self) -> int:
        return len(self.samples)

    def __getitem__(self, idx: int):
        s = self.samples[idx]
        return (
            torch.tensor(s[0], dtype=torch.long),
            torch.tensor(s[1], dtype=torch.long),
            torch.tensor(s[2], dtype=torch.long),
            torch.tensor(s[3], dtype=torch.long),
            torch.tensor(s[4], dtype=torch.long),
            torch.tensor(s[5], dtype=torch.float32),
        )


def fetch_dataset():
    client = Client(
        host=CLICKHOUSE_HOST, port=CLICKHOUSE_PORT,
        user=CLICKHOUSE_USER, password=CLICKHOUSE_PASSWORD,
        database="analytics",
    )
    pos_rows = client.execute(f"""
        SELECT user_id, item_id, max(city_id) AS user_city
        FROM recommendation_events
        WHERE timestamp >= now() - INTERVAL {WINDOW_DAYS} DAY
          AND action_type IN ('click', 'addwish', 'reservation')
          AND user_id > 0
        GROUP BY user_id, item_id
    """)
    pos = [(int(r[0]), int(r[1]), int(r[2])) for r in pos_rows]
    item_rows = client.execute(f"""
        SELECT item_id, any(city_id), any(category_id)
        FROM recommendation_events
        WHERE timestamp >= now() - INTERVAL {WINDOW_DAYS} DAY
        GROUP BY item_id
    """)
    item_meta = {int(r[0]): (int(r[1]), int(r[2])) for r in item_rows}
    return pos, item_meta


def build_samples(pos, item_meta, user_id_to_idx, item_id_to_idx, all_item_ids):
    samples = []
    pos_set = {(u, i) for (u, i, _) in pos}
    for u, i, ucity in pos:
        if i not in item_meta or i not in item_id_to_idx:
            continue
        u_idx = user_id_to_idx[u]
        i_idx = item_id_to_idx[i]
        i_city, i_cat = item_meta[i]
        samples.append((u_idx, i_idx, ucity, i_city, i_cat, 1.0))
        for _ in range(NEG_PER_POS):
            for _retry in range(10):
                neg_item = random.choice(all_item_ids)
                if (u, neg_item) not in pos_set and neg_item in item_meta:
                    n_city, n_cat = item_meta[neg_item]
                    samples.append((u_idx, item_id_to_idx[neg_item], ucity, n_city, n_cat, 0.0))
                    break
    return samples


def train():
    _set_seed(SEED)

    print(f"[1/5] Fetching dataset...")
    pos, item_meta = fetch_dataset()
    print(f"  → {len(pos)} positives / {len(item_meta)} items")

    if len(pos) < 100:
        print("ERROR: 데이터 부족 (< 100).")
        return

    user_ids = sorted({u for (u, _, _) in pos})
    item_ids = sorted(item_meta.keys())
    user_id_to_idx = {uid: i + 1 for i, uid in enumerate(user_ids)}
    item_id_to_idx = {iid: i + 1 for i, iid in enumerate(item_ids)}
    n_users, n_items = len(user_ids), len(item_ids)
    print(f"  → users={n_users} items={n_items}")

    print(f"[2/5] Building positive + {NEG_PER_POS}x negative samples...")
    samples = build_samples(pos, item_meta, user_id_to_idx, item_id_to_idx, item_ids)
    n_pos = sum(1 for s in samples if s[5] == 1.0)
    n_neg = len(samples) - n_pos
    print(f"  → total={len(samples)} (pos={n_pos} / neg={n_neg})")

    print(f"[3/5] Building DLRM (dim={EMBEDDING_DIM})...")
    model = DLRM(n_users, n_items, EMBEDDING_DIM)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"[4/5] Training ({EPOCHS} epochs, batch={BATCH_SIZE}, pairwise interaction)...")
    loader = DataLoader(RankingDataset(samples), batch_size=BATCH_SIZE, shuffle=True)
    history = {"loss": [], "auc": []}

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        n_batches = 0
        all_preds, all_labels = [], []
        for batch in loader:
            u_idx, i_idx, u_city, i_city, i_cat, label = batch
            pred = model(u_idx, i_idx, u_city, i_city, i_cat)
            loss = nn.functional.binary_cross_entropy(pred, label)
            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1
            all_preds.append(pred.detach().numpy())
            all_labels.append(label.numpy())

        avg = total_loss / max(1, n_batches)
        try:
            from sklearn.metrics import roc_auc_score
            auc = float(roc_auc_score(np.concatenate(all_labels), np.concatenate(all_preds)))
        except Exception:
            auc = float("nan")
        history["loss"].append(avg)
        history["auc"].append(auc)
        print(f"  epoch {epoch+1}/{EPOCHS}  loss={avg:.4f}  train_auc={auc:.4f}")

    model.eval()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("[5/5] Exporting DLRM to ONNX...")

    class DLRMForServe(nn.Module):
        def __init__(self, model, user_ids, item_ids):
            super().__init__()
            self.model = model
            max_u = max(user_ids)
            max_i = max(item_ids)
            u_to_idx = torch.zeros(max_u + 2, dtype=torch.long)
            for i, uid in enumerate(user_ids):
                u_to_idx[uid] = i + 1
            i_to_idx = torch.zeros(max_i + 2, dtype=torch.long)
            for i, iid in enumerate(item_ids):
                i_to_idx[iid] = i + 1
            self.register_buffer("u_to_idx", u_to_idx)
            self.register_buffer("i_to_idx", i_to_idx)
            self.max_u = max_u
            self.max_i = max_i

        def forward(self, user_id, item_id, user_city, item_city, item_category):
            u_idx = self.u_to_idx[torch.clamp(user_id, max=self.max_u)]
            i_idx = self.i_to_idx[torch.clamp(item_id, max=self.max_i)]
            return self.model(u_idx, i_idx, user_city, item_city, item_category)

    serve = DLRMForServe(model, user_ids, item_ids)
    serve.eval()
    dummy = (
        torch.tensor([user_ids[0]], dtype=torch.long),
        torch.tensor([item_ids[0]], dtype=torch.long),
        torch.tensor([1], dtype=torch.long),
        torch.tensor([1], dtype=torch.long),
        torch.tensor([1], dtype=torch.long),
    )
    torch.onnx.export(
        serve, dummy,
        os.path.join(OUTPUT_DIR, "dlrm.onnx"),
        input_names=["user_id", "item_id", "user_city", "item_city", "item_category"],
        output_names=["score"],
        dynamic_axes={k: {0: "batch"} for k in ["user_id", "item_id", "user_city", "item_city", "item_category", "score"]},
        opset_version=14,
    )

    metrics = {
        "model": "dlrm",
        "n_users": n_users,
        "n_items": n_items,
        "n_pos": n_pos,
        "n_neg": n_neg,
        "epochs": EPOCHS,
        "history": history,
    }
    with open(os.path.join(OUTPUT_DIR, "dlrm_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\n✅ DLRM Done. Final train AUC = {history['auc'][-1]:.4f}")


if __name__ == "__main__":
    train()
