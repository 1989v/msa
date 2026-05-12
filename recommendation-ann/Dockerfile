FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py .

# Phase 3.5 — 모델 파일은 PVC mount 로 외부에서 공유 (image baked-in 제거).
# recommendation-ml K8s Job 이 학습 후 PVC /models 에 적재.
# PVC 가 비어있어도 ann 은 degraded 모드로 기동, reindex 호출 시 활성화.
ENV MODELS_DIR=/models

EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--log-level", "info"]
