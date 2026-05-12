"""
Phase 3 / 3.5 — Two-Tower retrieval 모델 학습.

학습 자료: study/docs/20-recommendation-modeling/13-paper-two-tower.md + 16-toy-training-movielens.md

흐름:
1. ClickHouse 의 recommendation_events 에서 (user_id, item_id, action_type) 추출
2. Train/Test temporal split (마지막 20% test set)
3. PyTorch Two-Tower 학습 (in-batch CE + Sampling Bias Correction)
4. Recall@K offline metric 측정
5. user_tower 를 ONNX 로 export
6. 모든 item embedding 사전 계산 + numpy 저장

산출물 (OUTPUT_DIR 에):
- user_tower.onnx
- item_embeddings.npy
- item_ids.npy
- user_ids.npy
- training_metrics.json — loss curve + Recall@K

Phase 3.5 추가:
- Sampling Bias Correction (Yi et al. RecSys 2019) — popular item bias 회피
- Recall@K (K=10, 50, 100) offline metric
- Temporal train/test split
- 더 정교한 logging
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
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "64"))
HIDDEN_DIM = int(os.environ.get("HIDDEN_DIM", "128"))
WINDOW_DAYS = int(os.environ.get("WINDOW_DAYS", "30"))
EPOCHS = int(os.environ.get("EPOCHS", "30"))
BATCH_SIZE = int(os.environ.get("BATCH_SIZE", "128"))
LR = float(os.environ.get("LR", "5e-4"))
RECALL_K = [10, 50, 100]
SEED = 42


def _set_seed(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)


class UserTower(nn.Module):
    def __init__(self, n_users: int, embedding_dim: int, hidden_dim: int):
        super().__init__()
        self.user_emb = nn.Embedding(n_users + 1, 32)
        self.mlp = nn.Sequential(
            nn.Linear(32, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(hidden_dim, embedding_dim),
        )

    def forward(self, user_id: torch.Tensor) -> torch.Tensor:
        x = self.user_emb(user_id)
        out = self.mlp(x)
        return nn.functional.normalize(out, dim=-1)


class ItemTower(nn.Module):
    def __init__(self, n_items: int, embedding_dim: int, hidden_dim: int):
        super().__init__()
        self.item_emb = nn.Embedding(n_items + 1, 32)
        self.mlp = nn.Sequential(
            nn.Linear(32, hidden_dim),
            nn.ReLU(),
            nn.Dropout(0.1),
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
    def __init__(self, pairs):
        self.pairs = pairs

    def __len__(self) -> int:
        return len(self.pairs)

    def __getitem__(self, idx: int):
        user_id, item_id = self.pairs[idx]
        return torch.tensor(user_id, dtype=torch.long), torch.tensor(item_id, dtype=torch.long)


def fetch_interactions():
    """ClickHouse 에서 (user_id, item_id, ts) 추출."""
    client = Client(
        host=CLICKHOUSE_HOST, port=CLICKHOUSE_PORT,
        user=CLICKHOUSE_USER, password=CLICKHOUSE_PASSWORD,
        database="analytics",
    )
    rows = client.execute(f"""
        SELECT user_id, item_id, max(toUnixTimestamp(timestamp)) AS ts
        FROM recommendation_events
        WHERE timestamp >= now() - INTERVAL {WINDOW_DAYS} DAY
          AND action_type IN ('click', 'addwish', 'reservation')
          AND user_id > 0
        GROUP BY user_id, item_id
    """)
    return [(int(r[0]), int(r[1]), int(r[2])) for r in rows]


def temporal_split(triples, test_ratio=0.2):
    """사용자별 timestamp 정렬 후 마지막 ratio 를 test set 으로."""
    by_user = {}
    for u, i, t in triples:
        by_user.setdefault(u, []).append((t, i))

    train_pairs = []
    test_set = {}
    for u, lst in by_user.items():
        lst.sort()
        n_test = max(1, int(len(lst) * test_ratio))
        train_part = lst[:-n_test] if len(lst) > n_test else []
        test_part = lst[-n_test:]
        train_pairs.extend((u, i) for (_, i) in train_part)
        if test_part:
            test_set[u] = {i for (_, i) in test_part}
    return train_pairs, test_set


def compute_item_freq(pairs, item_id_to_idx):
    """Sampling Bias Correction — item batch sampling probability 추정."""
    n_items = len(item_id_to_idx)
    counts = np.zeros(n_items + 1, dtype=np.float64)
    for _, item_id in pairs:
        counts[item_id_to_idx[item_id]] += 1
    total = counts.sum()
    if total == 0:
        return torch.ones(n_items + 1)
    freq = counts / total
    return torch.tensor(freq, dtype=torch.float32)


def recall_at_k(model, test_set, user_id_to_idx, item_idx_to_id, k_values):
    model.eval()
    max_k = max(k_values)
    with torch.no_grad():
        all_item_idx = torch.arange(1, len(item_idx_to_id), dtype=torch.long)
        item_vecs = model.item_tower(all_item_idx)

        recalls = {k: [] for k in k_values}
        for user_id, true_items in test_set.items():
            if user_id not in user_id_to_idx:
                continue
            u_idx = torch.tensor([user_id_to_idx[user_id]], dtype=torch.long)
            u_vec = model.user_tower(u_idx)
            scores = (u_vec @ item_vecs.T).squeeze(0)
            top_idx = torch.topk(scores, k=max_k).indices.tolist()
            top_ids = [item_idx_to_id[i + 1] for i in top_idx]
            for k in k_values:
                hits = sum(1 for x in top_ids[:k] if x in true_items)
                recalls[k].append(hits / len(true_items))

    return {k: float(np.mean(v)) if v else 0.0 for k, v in recalls.items()}


def train():
    _set_seed(SEED)

    print(f"[1/6] Fetching interactions from ClickHouse ({CLICKHOUSE_HOST}:{CLICKHOUSE_PORT})...")
    triples = fetch_interactions()
    print(f"  → {len(triples)} (user, item, ts) triples")

    if len(triples) < 100:
        print("ERROR: 학습 데이터 부족 (< 100). seed 적재하세요.")
        return

    user_ids = sorted({t[0] for t in triples})
    item_ids = sorted({t[1] for t in triples})
    user_id_to_idx = {uid: i + 1 for i, uid in enumerate(user_ids)}
    item_id_to_idx = {iid: i + 1 for i, iid in enumerate(item_ids)}
    item_idx_to_id = [None] + item_ids

    n_users, n_items = len(user_ids), len(item_ids)
    print(f"  → users={n_users} items={n_items}")

    print("[2/6] Temporal train/test split (80/20 per user)...")
    train_pairs, test_set = temporal_split(triples, test_ratio=0.2)
    print(f"  → train pairs={len(train_pairs)} / test users={len(test_set)}")

    train_idx_pairs = [(user_id_to_idx[u], item_id_to_idx[i]) for (u, i) in train_pairs]
    item_freq = compute_item_freq(train_pairs, item_id_to_idx)

    print(f"[3/6] Building Two-Tower (dim={EMBEDDING_DIM}, hidden={HIDDEN_DIM})...")
    user_tower = UserTower(n_users, EMBEDDING_DIM, HIDDEN_DIM)
    item_tower = ItemTower(n_items, EMBEDDING_DIM, HIDDEN_DIM)
    model = TwoTower(user_tower, item_tower)
    optimizer = torch.optim.Adam(model.parameters(), lr=LR)

    print(f"[4/6] Training ({EPOCHS} epochs, batch={BATCH_SIZE}, sampling bias correction)...")
    loader = DataLoader(InteractionDataset(train_idx_pairs), batch_size=BATCH_SIZE, shuffle=True)
    history = {"loss": [], "recall": []}
    log_item_freq = torch.log(item_freq + 1e-8)

    for epoch in range(EPOCHS):
        model.train()
        total_loss = 0.0
        n_batches = 0
        for user_batch, item_batch in loader:
            u = model.user_tower(user_batch)
            v = model.item_tower(item_batch)
            scores = u @ v.T
            # Sampling Bias Correction (Yi et al. 2019)
            batch_item_log_freq = log_item_freq[item_batch].unsqueeze(0)
            corrected_scores = scores - batch_item_log_freq

            labels = torch.arange(scores.size(0))
            loss = nn.functional.cross_entropy(corrected_scores, labels)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()
            total_loss += loss.item()
            n_batches += 1

        avg = total_loss / max(1, n_batches)
        history["loss"].append(avg)

        if (epoch + 1) % 5 == 0 or epoch == EPOCHS - 1:
            r = recall_at_k(model, test_set, user_id_to_idx, item_idx_to_id, RECALL_K)
            history["recall"].append({"epoch": epoch + 1, **{f"R@{k}": v for k, v in r.items()}})
            r_str = " / ".join(f"R@{k}={r[k]:.3f}" for k in RECALL_K)
            print(f"  epoch {epoch+1}/{EPOCHS}  loss={avg:.4f}  {r_str}")
        else:
            print(f"  epoch {epoch+1}/{EPOCHS}  loss={avg:.4f}")

    final_recall = history["recall"][-1] if history["recall"] else {}
    model.eval()

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    print("[5/6] Exporting user_tower to ONNX...")
    class UserTowerForServe(nn.Module):
        def __init__(self, user_tower, user_ids):
            super().__init__()
            self.user_tower = user_tower
            max_id = max(user_ids) if user_ids else 0
            id_to_idx = torch.zeros(max_id + 2, dtype=torch.long)
            for i, uid in enumerate(user_ids):
                id_to_idx[uid] = i + 1
            self.register_buffer("id_to_idx", id_to_idx)
            self.max_known_id = max_id

        def forward(self, user_id):
            clamped = torch.clamp(user_id, max=self.max_known_id)
            idx = self.id_to_idx[clamped]
            return self.user_tower(idx)

    serve_user = UserTowerForServe(model.user_tower, user_ids)
    serve_user.eval()
    dummy_input = torch.tensor([user_ids[0]], dtype=torch.long)
    torch.onnx.export(
        serve_user,
        (dummy_input,),
        os.path.join(OUTPUT_DIR, "user_tower.onnx"),
        input_names=["user_id"],
        output_names=["user_embedding"],
        dynamic_axes={"user_id": {0: "batch"}, "user_embedding": {0: "batch"}},
        opset_version=14,
    )

    print("[6/6] Pre-computing item embeddings + saving artifacts...")
    with torch.no_grad():
        all_item_idx = torch.arange(1, n_items + 1, dtype=torch.long)
        item_embeddings = model.item_tower(all_item_idx).numpy().astype(np.float32)

    np.save(os.path.join(OUTPUT_DIR, "item_embeddings.npy"), item_embeddings)
    np.save(os.path.join(OUTPUT_DIR, "item_ids.npy"), np.array(item_ids, dtype=np.int64))
    np.save(os.path.join(OUTPUT_DIR, "user_ids.npy"), np.array(user_ids, dtype=np.int64))

    metrics = {
        "n_users": n_users,
        "n_items": n_items,
        "n_train_pairs": len(train_pairs),
        "n_test_users": len(test_set),
        "epochs": EPOCHS,
        "embedding_dim": EMBEDDING_DIM,
        "hidden_dim": HIDDEN_DIM,
        "history": history,
        "final_recall": final_recall,
    }
    with open(os.path.join(OUTPUT_DIR, "training_metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\n✅ Done. Output dir: {OUTPUT_DIR}/")
    if final_recall:
        rk = [f"{k}={v:.3f}" for k, v in final_recall.items() if k.startswith('R@')]
        print(f"   Final {' / '.join(rk)}")


if __name__ == "__main__":
    train()
