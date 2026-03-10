FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for psycopg binary
RUN apt-get update && apt-get install -y \
    libpq-dev \
    gcc \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY src ./src
COPY alembic ./alembic
COPY alembic.ini .

EXPOSE 8010

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8010"]
