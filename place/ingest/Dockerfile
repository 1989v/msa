# place-ingest — TourAPI 개요 수집 + 외부 콘텐츠 수집 CronJob (ADR-0070).
#
# 서드파티 의존이 없다(표준 라이브러리 urllib 만 쓴다) — pyproject / pip install 이 없는 이유다.
# 의존이 생기면 그때 quant/ingest 처럼 pyproject 를 넣는다.
FROM python:3.11-slim

WORKDIR /app
COPY src ./src

ENV PYTHONUNBUFFERED=1
ENTRYPOINT ["python", "-m", "src.main"]
CMD ["--job=stats"]
