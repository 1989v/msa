# OpenSearch + analysis-nori 베이크 이미지 (ADR-0055)
#
# OCI(oci-arm) 는 default-deny egress 라 파드 기동 시 플러그인 다운로드가 불가능하다.
# nori 를 이미지에 구워 기동이 외부 네트워크에 의존하지 않게 한다.
# (k3s-lite 로컬은 egress 가 열려 있어 statefulset 의 기동 래퍼가 설치를 대신한다)
#
# 빌드/푸시 (arm64, OCI 대상):
#   docker build --platform linux/arm64 \
#     -t ap-chuncheon-1.ocir.io/axyooxbyk5yv/opensearch-nori:3.3.0 docker/opensearch
#   docker push ap-chuncheon-1.ocir.io/axyooxbyk5yv/opensearch-nori:3.3.0
#
# 버전은 opensearch-java 클라이언트(3.8.0)와 정렬된 3.3.0 고정 —
# 베이스 업그레이드 시 태그도 함께 올리고 oci-arm kustomization 의 newTag 를 갱신한다.
FROM opensearchproject/opensearch:3.3.0

RUN /usr/share/opensearch/bin/opensearch-plugin install --batch analysis-nori
