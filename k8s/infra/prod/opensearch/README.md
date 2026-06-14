# OpenSearch Operator (prod)

Production OpenSearch cluster via the official
[opensearch-k8s-operator](https://github.com/opensearch-project/opensearch-k8s-operator)
(ADR-0055 — ECK Elasticsearch 에서 전환). `search` + `code-dictionary` 서비스가 사용.

## Install the operator

```bash
helm repo add opensearch-operator \
  https://opensearch-project.github.io/opensearch-k8s-operator/
helm upgrade --install opensearch-operator \
  opensearch-operator/opensearch-operator \
  --namespace opensearch-operator-system --create-namespace
```

## Apply the cluster

```bash
kubectl apply -f opensearch-cluster.yaml
```

Wait for Ready:

```bash
kubectl -n commerce get opensearchcluster commerce-os -w
```

## Notes

- 앱 접속 호스트명은 alias Service `opensearch:9200` — local overlay
  (`k8s/infra/local/opensearch/`) 와 동일해 `application-kubernetes.yml` 이
  환경 구분 없이 동작한다.
- nori 플러그인은 `general.pluginsList` 로 노드 기동 시 설치된다.
- 보안(admin 자격/TLS)은 operator 기본 demo 설정을 쓰지 않도록 운영 적용 시
  `security.config` 에 SealedSecrets 로 주입할 것 (백업/시크릿 정책은
  `k8s/infra/prod/sealed-secrets/` 참조).
- 전환 후 데이터 백필: ES 인덱스는 파생 데이터 — `search:batch` full reindex +
  code-dictionary `/reindex` 1회 실행으로 충분 (ADR-0055 D4).
