FROM python:3.11-slim

WORKDIR /app

# 시스템 의존성 (numpy/pandas wheel 빌드 회피용)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src ./src
RUN pip install --no-cache-dir -e .

ENTRYPOINT ["python", "-m", "src.scheduler"]
CMD ["--mode=incremental", "--interval=1d"]
