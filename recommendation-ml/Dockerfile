FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY train_two_tower.py .

# 학습 산출물 디렉토리 (PVC 또는 mount 로 외부 공유)
ENV OUTPUT_DIR=/models
VOLUME /models

ENTRYPOINT ["python", "train_two_tower.py"]
