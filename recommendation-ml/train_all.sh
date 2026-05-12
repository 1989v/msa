#!/bin/sh
# Phase 3 + 4 — Two-Tower retrieval + Wide & Deep ranking 일괄 학습.
# Argo CronWorkflow / K8s Job entrypoint.
set -eu

echo "[train_all] Two-Tower retrieval 학습..."
python train_two_tower.py

echo ""
echo "[train_all] Wide & Deep ranking 학습..."
python train_ranking.py

echo ""
echo "[train_all] DLRM ranking 학습..."
python train_dlrm.py

echo ""
echo "[train_all] 완료. ${OUTPUT_DIR:-/models} 의 산출물:"
ls -la "${OUTPUT_DIR:-/models}"
