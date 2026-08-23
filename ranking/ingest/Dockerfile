# ranking-ingest — 오피넷 주유소 수집 CronJob (ADR-0081).
#
# 서드파티 의존이 없다(표준 라이브러리만). KATEC 좌표 변환도 pyproj 대신 직접 편다 —
# pyproj 는 PROJ 데이터까지 끌고 와 이미지가 수십 MB 커지고, 변환식은 표준 공식이라
# 골든 좌표 테스트로 검증할 수 있다 (tests/test_katec.py).
FROM python:3.11-slim

WORKDIR /app
COPY src ./src

ENV PYTHONUNBUFFERED=1
ENTRYPOINT ["python", "-m", "src.main"]
CMD ["--job=gas-stations"]
