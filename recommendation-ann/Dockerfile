FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Phase 3 PoC — 학습된 모델을 image 에 baked-in.
# Production 화 시점에 PVC mount + recommendation-ml Job 으로 일일 재학습 분리.
COPY models/ /models/

ENV MODELS_DIR=/models

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
