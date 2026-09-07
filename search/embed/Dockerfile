# 질의 인코더 사이드카 — 모델 가중치를 이미지에 굽는다.
#
# 런타임에 HuggingFace 를 부르지 않는 이유가 둘이다.
#   1. 파드에 egress 가 없다(NetworkPolicy). 밖으로 나갈 길이 없으면 유출 경로도 없다.
#   2. 기동 때마다 받으면 허브 장애가 곧 검색 장애다.
FROM python:3.12-slim AS weights
ARG MODEL=microsoft/harrier-oss-v1-270m
ARG REVISION
RUN pip install --no-cache-dir "huggingface_hub[cli]==0.27.1"
# safetensors 만 받는다 — pickle 가중치는 이미지에 들이지 않는다
RUN python -c "\
from huggingface_hub import snapshot_download; \
snapshot_download('${MODEL}', revision='${REVISION}' or None, local_dir='/weights', \
  allow_patterns=['*.safetensors','*.json','*.txt','*.model','1_Pooling/*','2_Normalize/*'])"

FROM python:3.12-slim
ARG MODEL=microsoft/harrier-oss-v1-270m
ARG REVISION
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
RUN pip install --no-cache-dir \
      --index-url https://download.pytorch.org/whl/cpu "torch==2.14.0" \
 && pip install --no-cache-dir "sentence-transformers==6.0.1" \
 && rm -rf /root/.cache
COPY --from=weights /weights /opt/model
COPY server.py /opt/encoder/server.py
ENV ENCODER_MODEL=/opt/model ENCODER_THREADS=1 ENCODER_PORT=8099
# 스탬프는 허브 id + 리비전이다 — 도구가 만든 문서 벡터와 같은 공간이어야 한다
ENV ENCODER_MODEL_ID=${MODEL} ENCODER_REVISION=${REVISION}
RUN useradd -u 10001 -m encoder && chown -R encoder /opt
USER 10001
EXPOSE 8099
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s \
  CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8099/healthz').read()"
CMD ["python", "/opt/encoder/server.py"]
