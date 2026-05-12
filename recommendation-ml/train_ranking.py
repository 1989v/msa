"""
Phase 4 — Wide & Deep Ranking 모델 학습 (ADR-0047).

학습 자료: study/docs/20-recommendation-modeling/12-paper-wide-and-deep.md

흐름:
1. ClickHouse 의 recommendation_events 에서 (user_id, item_id, action_type, city_id, category_id) 추출
2. Positive pair (강한 행동) + Random negative sampling (4:1)
3. Wide & Deep 모델 학습 (Joint training, BCE loss)
4. ranker.onnx 로 export — (user_id, item_id, user_city, item_city, item_category) → score

Wide Component:
- manual cross: user_city == item_city (binary), city_x_category onehot
Deep Component:
- user_emb(32) + item_emb(32) + city_emb(8) + category_emb(8)
- MLP [128, 64, 1]
final_score = sigmoid(score_wide + score_deep)

ONNX 입력은 batch of (user_id, item_id) tuples.
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
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "32"))
WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "30"))
EPOCHS = int(os.environ.get("RANKING_EPOCHS", "20"))
BATCH_SIZE = int(os.environ.get("RANKING_BATCH_SIZE", "256"))
LR = float(os.environ.get("RANKING_LR", "1e-3"))
NEG_PER_POS = int(os.environ.get("NEG_PER_POS", "4"))
N_CITIES = 4   # 0=unknown, 1, 2, 3
N_CATEGORIES = 4
SEED = 42


def _set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


class WideAndDeep(nn.Module):
    """
    Wide & Deep — joint training of linear (memorization) + DNN (generalization).

    Wide: manual cross features (sparse, linear).
    Deep: user/item/city/category embedding → MLP.
    """

    def __init__(self, n_users: int, n_items: int, embedding_dim: int = EMBEDDING_DIM):
        super().__init__()
        # Embeddings — id 0 = padding/OOV
        self.user_emb = nn.Embedding(n_users + 1, embedding_dim)
        self.item_emb = nn.Embedding(n_items + 1, embedding_dim)
        self.city_emb = nn.Embedding(N_CITIES, 8)
        self.category_emb = nn.Embedding(N_CATEGORIES, 8)

        # Wide: cross feature (user_city == item_city → 1, else 0) + city_x_category onehot (N_CITIES × N_CATEGORIES = 16)
        wide_dim = 1 + N_CITIES * N_CATEGORIES
        self.wide = nn.Linear(wide_dim, 1)

        # Deep
        deep_in = 2 * embedding_dim + 8 + 8 + 8
        self.deep = nn.Sequential(
            nn.Linear(deep_in, 128),
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
        # Wide features
        same_city = (user_city == item_city).float().unsqueeze(-1)  # (B, 1)
        city_x_cat_idx = item_city * N_CATEGORIES + item_category  # (B,)
        city_x_cat = torch.nn.functional.one_hot(city_x_cat_idx, N_CITIES * N_CATEGORIES).float()
        wide_feat = torch.cat([same_city, city_x_cat], dim=-1)
        wide_logit = self.wide(wide_feat).squeeze(-1)

        # Deep features
        ue = self.user_emb(user_idx)
        ie = self.item_emb(item_idx)
        uce = self.city_emb(user_city)
        ice = self.city_emb(item_city)
        icat = self.category_emb(item_category)
        deep_in = torch.cat([ue, ie, uce, ice, icat], dim=-1)
        deep_logit = self.deep(deep_in).squeeze(-1)

        return torch.sigmoid(wide_logit + deep_logit)


class RankingDataset(Dataset):
    def __init__(self, samples):
        self.samples = samples  # list[(u_idx, i_idx, u_city, i_city, i_cat, label)]

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
    """Positive + item metadata 추출."""
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

    # Item metadata
    item_rows = client.execute(f"""
        SELECT item_id, any(city_id) AS city_id, any(category_id) AS category_id
        FROM recommendation_events
        WHERE timestamp >= now() - INTERVAL {WINDOW_DAYS} DAY
        GROUP BY item_id
    """)
    item_meta = {int(r[0]): (int(r[1]), int(r[2])) for r in item_rows}

    return pos, item_meta


def build_samples(pos, item_meta, user_id_to_idx, item_id_to_idx, all_item_ids):
    """Positive + random negative sampling."""
    samples = []
    pos_set = {(u, i) for (u, i, _) in pos}

    for u, i, ucity in pos:
        u_idx = user_id_to_idx[u]
        if i not in item_meta or i not in item_id_to_idx:
            continue
        i_idx = item_id_to_idx[i]
        i_city, i_cat = item_meta[i]
        samples.append((u_idx, i_idx, ucity, i_city, i_cat, 1.0))

        # Negative sampling
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

    print(f"[1/5] Fetching dataset from ClickHouse ({CLICKHOUSE_HOST}:{CLICKHOUSE_PORT})...")
    pos, item_meta = fetch_dataset()
    print(f"  → {len(pos)} positives / {len(item_meta)} item metadata")

    if len(pos) < 100:
        print("ERROR: 학습 데이터 부족 (< 100). seed 적재하세요.")
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
    n_neg = sum(1 for s in samples if s[5] == 0.0)
    print(f"  → total={len(samples)} (pos={n_pos} / neg={n_neg})")

    print(f"[3/5] Building Wide & Deep (dim={EMBEDDING_DIM})...")
    model = WideAndDeep(n_users, n_items, EMBEDDING_DIM)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"[4/5] Training ({EPOCHS} epochs, batch={BATCH_SIZE}, joint Wide+Deep, BCE)...")
    loader = DataLoader(RankingDataset(samples), batch_size=BATCH_SIZE, shuffle=True)
    history = {"loss": [], "auc": []}

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        n_batches = 0
        all_preds = []
        all_labels = []
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
        # Quick AUC 측정 (training set 기준, 간이)
        preds = np.concatenate(all_preds)
        labels = np.concatenate(all_labels)
        try:
            from sklearn.metrics import roc_auc_score
            auc = float(roc_auc_score(labels, preds))
        except Exception:
            auc = float("nan")
        history["loss"].append(avg)
        history["auc"].append(auc)
        print(f"  epoch {epoch+1}/{EPOCHS}  loss={avg:.4f}  train_auc={auc:.4f}")

    model.eval()
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("[5/5] Exporting Wide & Deep to ONNX...")
    # Serve-side wrapper — id (실제) → idx mapping 내장
    class RankerForServe(nn.Module):
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

    serve = RankerForServe(model, user_ids, item_ids)
    serve.eval()

    dummy = (
        torch.tensor([user_ids[0]], dtype=torch.long),
        torch.tensor([item_ids[0]], dtype=torch.long),
        torch.tensor([1], dtype=torch.long),
        torch.tensor([1], dtype=torch.long),
        torch.tensor([1], dtype=torch.long),
    )
    torch.onnx.export(
        serve,
        dummy,
        os.path.join(OUTPUT_DIR, "ranker.onnx"),
        input_names=["user_id", "item_id", "user_city", "item_city", "item_category"],
        output_names=["score"],
        dynamic_axes={
            "user_id": {0: "batch"},
            "item_id": {0: "batch"},
            "user_city": {0: "batch"},
            "item_city": {0: "batch"},
            "item_category": {0: "batch"},
            "score": {0: "batch"},
        },
        opset_version=14,
    )

    # Item metadata 저장 — ann 측이 item_id → (city, category) lookup
    item_metadata_arr = np.array(
        [[iid, item_meta[iid][0], item_meta[iid][1]] for iid in item_ids],
        dtype=np.int64,
    )
    np.save(os.path.join(OUTPUT_DIR, "item_metadata.npy"), item_metadata_arr)

    metrics = {
        "model": "wide_and_deep",
        "n_users": n_users,
        "n_items": n_items,
        "n_pos": n_pos,
        "n_neg": n_neg,
        "epochs": EPOCHS,
        "history": history,
    }
    with open(os.path.join(OUTPUT_DIR, "ranking_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\n✅ Done. Output dir: {OUTPUT_DIR}/")
    print(f"   ranker.onnx          (Wide & Deep)")
    print(f"   item_metadata.npy    ({n_items} items)")
    if history["auc"]:
        print(f"   Final train AUC = {history['auc'][-1]:.4f}")


if __name__ == "__main__":
    train()
