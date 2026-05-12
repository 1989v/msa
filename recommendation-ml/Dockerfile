FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY train_two_tower.py train_ranking.py train_all.sh ./
RUN chmod +x train_all.sh

# 학습 산출물 디렉토리 (PVC 또는 mount 로 외부 공유)
ENV OUTPUT_DIR=/models
VOLUME /models

# Phase 4 — Two-Tower retrieval + Wide & Deep ranking 일괄 학습.
# K8s Job 의 command override 로 개별 학습 가능 (예: command: ["python", "train_ranking.py"]).
ENTRYPOINT ["./train_all.sh"]
