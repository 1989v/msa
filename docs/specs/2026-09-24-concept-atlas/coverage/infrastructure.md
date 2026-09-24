# 인프라 · 배포 — 커버리지 체크리스트

원천:
- study/docs/11-k8s-deep-dive/99-concept-catalog.md (§1-A 갭 55개 · §2 A~J 개념 트리)
- study/docs/11-k8s-deep-dive/01~20 본문 노트 (control plane · core resources · controller · CRD/operator · networking · ingress/Gateway API · storage · scheduling · autoscaling · deployment strategies · Helm/Kustomize · GitOps · service mesh · security · Argo Rollouts)
- k8s/CLAUDE.md (실제로 터진 배포 함정) · docs/adr/ADR-0019-k8s-migration.md · docs/adr/ADR-0073-deploy-pipeline-guardrails.md
- 볼트 system-resources-cheatsheet.md §01·§06 (cgroup · namespace · OOMKilled · requests/limits · QoS)
- 레포 k8s/ · .github/workflows/ · buildSrc Jib 컨벤션 (코드 참조 확인)
- 분야 표준 — Kubernetes 공식 문서 Concepts 목차, OCI 이미지 · 런타임 규격, Continuous Delivery · DORA, IaC · GitOps(OpenGitOps) 원칙, SLSA

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| infra-platform | 인프라 · 배포 | 구조 노드 (활동 묶음) | placed |
| infra-build-packaging | 빌드 · 패키징 | 구조 노드 (활동 묶음) | placed |
| git-submodule | Git 서브모듈 | k8s/CLAUDE.md Key Rules · 레포 CI 워크플로 | placed |
| container | 컨테이너 | 볼트 시스템 자원 한 판 §06 · 분야 표준(OCI 규격) | placed |
| infra-linux-namespace | 리눅스 네임스페이스 | 볼트 시스템 자원 한 판 §06 · 분야 표준(OCI 규격) | placed |
| infra-cgroup | cgroup | 볼트 시스템 자원 한 판 §06 · 분야 표준(OCI 규격) | placed |
| infra-union-filesystem | 유니온 파일 시스템 | 볼트 시스템 자원 한 판 §06 · 분야 표준(OCI 규격) | placed |
| infra-container-runtime | 컨테이너 런타임 | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| containerd | containerd / CRI-O (런타임 제품) | 카탈로그 §1-A 15 | excluded — k3s 에 내장돼 레포가 직접 다루지 않는 제품이라 TECHNOLOGY 로 두지 않는다 — infra-container-runtime 동의어로 흡수 |
| infra-image-build | 이미지 빌드 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-multi-stage-build | 멀티 스테이지 빌드 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-layer-caching | 레이어 캐싱 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-multi-arch-build | 멀티 아키텍처 빌드 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-minimal-base-image | 최소 베이스 이미지 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-immutable-image-tag | 불변 이미지 태그 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| docker | Docker | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| jib | Jib | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-supply-chain-security | 소프트웨어 공급망 보안 | study/11 14 §7 · 분야 표준(SLSA) | placed |
| infra-image-scanning | 이미지 취약점 스캔 | study/11 14 §7 · 분야 표준(SLSA) | placed |
| infra-image-signing | 이미지 서명 | study/11 14 §7 · 분야 표준(SLSA) | placed |
| infra-mutable-tag | 태그 덮어쓰기 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-image-bloat | 이미지 비대 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-vulnerable-image | 취약한 이미지 | study/11 14 §7 · 분야 표준(SLSA) | placed |
| infra-image-size | 이미지 크기 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-delivery-pipeline | 배포 파이프라인 | 구조 노드 (활동 묶음) | placed |
| ci-cd | CI/CD | 분야 표준(Continuous Delivery · DORA) | placed |
| infra-trunk-based-development | 트렁크 기반 개발 | 분야 표준(Continuous Delivery · DORA) | placed |
| infra-pipeline-gate | 파이프라인 게이트 | k8s/CLAUDE.md Key Rules · 레포 CI 워크플로 | placed |
| infra-change-detection-build | 변경 감지 빌드 | k8s/CLAUDE.md Key Rules · 레포 CI 워크플로 | placed |
| infra-build-once-promote | 한 번 빌드 · 승격 | 분야 표준(Continuous Delivery · DORA) | placed |
| infra-manifest-commit-back | 매니페스트 태그 커밋백 | k8s/CLAUDE.md Key Rules · 레포 CI 워크플로 | placed |
| infra-pipeline-concurrency-control | 파이프라인 동시 실행 제어 | k8s/CLAUDE.md Key Rules · 레포 CI 워크플로 | placed |
| github-actions | GitHub Actions | k8s/CLAUDE.md Key Rules · 레포 CI 워크플로 | placed |
| infra-silent-image-skip | 이미지 누락 | k8s/CLAUDE.md Key Rules · 레포 CI 워크플로 | placed |
| infra-deploy-frequency | 배포 빈도 | 분야 표준(Continuous Delivery · DORA) | placed |
| infra-lead-time-for-changes | 변경 리드 타임 | 분야 표준(Continuous Delivery · DORA) | placed |
| infra-change-failure-rate | 변경 실패율 | 분야 표준(Continuous Delivery · DORA) | placed |
| infra-declarative-config | 선언형 구성 | 구조 노드 (활동 묶음) | placed |
| infrastructure-as-code | IaC | 분야 표준(IaC) · 지난 라운드 운영 행 | placed |
| infra-plan-apply | 변경 계획 후 적용 | 분야 표준(IaC) · 지난 라운드 운영 행 | placed |
| infra-immutable-infrastructure | 불변 인프라 | 분야 표준(IaC) · 지난 라운드 운영 행 | placed |
| infra-manifest-composition | 매니페스트 조립 | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| terraform | Terraform | 분야 표준(IaC 도구) | excluded — 레포에 없는 제품 — 개념은 infrastructure-as-code · infra-plan-apply 에 흡수 |
| kustomize | Kustomize | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| helm | Helm | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| infra-manifest-patch | 매니페스트 패치 | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| infra-config-generator | 설정 생성기 | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| infra-gitops | GitOps | study/11 12·19-gitops · 카탈로그 §2G · §1-A 31·50 | placed |
| infra-sync-policy | 동기화 정책 | study/11 12·19-gitops · 카탈로그 §2G · §1-A 31·50 | placed |
| flux | Flux v2 | study/11 12 §4 · 19 §10 | excluded — 레포에 없는 제품 — 개념은 infra-gitops · infra-image-update-automation 에 흡수 |
| infra-sync-wave | 동기화 웨이브 · 훅 | study/11 12·19-gitops · 카탈로그 §2G · §1-A 31·50 | placed |
| infra-app-of-apps | App of Apps · ApplicationSet | study/11 12·19-gitops · 카탈로그 §2G · §1-A 31·50 | placed |
| infra-image-update-automation | 이미지 갱신 자동화 | study/11 12·19-gitops · 카탈로그 §2G · §1-A 31·50 | placed |
| infra-server-side-apply | 서버 측 적용 | study/11 12·19-gitops · 카탈로그 §2G · §1-A 31·50 | placed |
| infra-sync-watchdog | 동기화 워치독 | ADR-0073 · k8s/CLAUDE.md | placed |
| argo-cd | Argo CD | study/11 12·19-gitops · 카탈로그 §2G · §1-A 31·50 | placed |
| infra-config-drift | 구성 드리프트 | ADR-0073 · k8s/CLAUDE.md | placed |
| infra-stuck-sync | 동기화 정지 | ADR-0073 · k8s/CLAUDE.md | placed |
| infra-sync-duration | 동기화 소요 시간 | ADR-0073 · k8s/CLAUDE.md | placed |
| infra-orchestration | 컨테이너 오케스트레이션 | 구조 노드 (활동 묶음) | placed |
| infra-cluster-architecture | 클러스터 구성 | 구조 노드 (활동 묶음) | placed |
| infra-control-plane | 제어 평면 | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| infra-kube-apiserver | kube-apiserver | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| infra-aggregated-apiserver | Aggregated APIServer | 카탈로그 §1-A 52 | excluded — CRD 로 대체되어 표준 학습 목차 밖인 확장 경로 |
| infra-cluster-state-store | 클러스터 상태 저장소 | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| leader-election | 리더 선출 (Lease) | 카탈로그 §1-A 51 | excluded — owned by distributed — 컨트롤러 HA 는 그 개념을 쓴다 |
| infra-kube-scheduler | kube-scheduler | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| infra-controller-manager | kube-controller-manager | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| infra-cloud-controller-manager | cloud-controller-manager | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| infra-data-plane | 노드 구성 요소 | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| infra-kubelet | kubelet | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| infra-kube-proxy | kube-proxy | study/11 01-control-plane · 카탈로그 §1-A 14·15 | placed |
| net-grpc-client-lb | 헤드리스 + gRPC 클라이언트 측 분산 | study/11 05 §6 | excluded — owned by network (net-grpc-client-lb · net-http2-connection-imbalance) — infra-kube-proxy 가 CAUSES 로 잇는다 |
| infra-single-node-cluster | 단일 노드 클러스터 | study/11 01 §10 · k8s/CLAUDE.md (kine 비대) | placed |
| infra-multi-cluster | 멀티 클러스터 운영 | 카탈로그 §1-A 19·46 · §2H | placed |
| infra-node-lifecycle | 노드 유지보수 | 카탈로그 §1-A 45 · §2H | placed |
| infra-state-store-compaction | 상태 저장소 컴팩션 | study/11 01 §10 · k8s/CLAUDE.md (kine 비대) | placed |
| infra-state-store-bloat | 상태 저장소 비대 | study/11 01 §10 · k8s/CLAUDE.md (kine 비대) | placed |
| infra-workload-management | 워크로드 관리 | 구조 노드 (활동 묶음) | placed |
| infra-deployment-workload | Deployment | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-statefulset | StatefulSet | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-daemonset | DaemonSet | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-batch-job | Job | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-cronjob | CronJob | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-init-container | 초기화 컨테이너 | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-sidecar-container | 사이드카 컨테이너 | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-graceful-shutdown | 우아한 종료 | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-crashloop-backoff | CrashLoopBackOff | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-oom-killed | OOMKilled | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-cron-overlap | 예약 작업 겹침 | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-restart-count | 재시작 횟수 | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-config-injection | 설정 · 시크릿 주입 | 구조 노드 (활동 묶음) | placed |
| infra-configmap | ConfigMap | study/11 02 §7~10 · 17 Q6 | placed |
| infra-k8s-secret | Secret | study/11 02 §7~10 · 17 Q6 | placed |
| infra-secret-management | GitOps 시크릿 전달 | study/11 12 §6 · 19 §9 · 카탈로그 §1-A 29·30 | placed |
| infra-sealed-secrets | Sealed Secrets | study/11 12 §6 · 19 §9 · 카탈로그 §1-A 29·30 | placed |
| sec-secrets-management | 시크릿 관리 (일반) | 카탈로그 §2D | excluded — owned by security — infra-secret-management 가 USES 로 잇는다 |
| infra-encrypted-file-secrets | 파일 단위 시크릿 암호화 | study/11 12 §6 · 19 §9 · 카탈로그 §1-A 29·30 | placed |
| infra-external-secrets | 외부 시크릿 동기화 | study/11 12 §6 · 19 §9 · 카탈로그 §1-A 29·30 | placed |
| infra-config-reload | 설정 변경 반영 | study/11 02 §7~10 · 17 Q6 | placed |
| infra-secret-leak | 시크릿 유출 | study/11 12 §6 · 19 §9 · 카탈로그 §1-A 29·30 | placed |
| infra-stale-config | 옛 설정으로 도는 파드 | study/11 02 §7~10 · 17 Q6 | placed |
| infra-storage-provisioning | 스토리지 프로비저닝 | 구조 노드 (활동 묶음) | placed |
| infra-persistent-volume | PV · PVC 바인딩 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-storage-class | StorageClass | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-dynamic-resource-allocation | DRA (동적 자원 할당) | 카탈로그 §1-A 6 | excluded — GPU · 특수 장치 전용 신기능이라 백엔드 표준 목차 밖 |
| infra-csi | CSI | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-volume-snapshot | 볼륨 스냅샷 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-local-volume | 로컬 볼륨 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-ephemeral-volume | 임시 볼륨 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-node-bound-volume | 노드에 묶인 볼륨 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-volume-data-loss | 볼륨 데이터 삭제 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-scheduling | 스케줄링 · 자원 배분 | 구조 노드 (활동 묶음) | placed |
| infra-resource-requests-limits | 자원 요청 · 한도 | study/11 02 §2 · 볼트 시스템 자원 한 판 §01·§04 · 카탈로그 §1-A 8 | placed |
| infra-node-affinity | 노드 어피니티 | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-pod-affinity | 파드 어피니티 · 안티 어피니티 | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-taint-toleration | 테인트 · 톨러레이션 | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-topology-spread | 토폴로지 분산 제약 | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-priority-preemption | 우선순위 · 선점 | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-pod-disruption-budget | PodDisruptionBudget | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-resource-quota | 자원 쿼터 · 기본 한도 | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-pending-pod | Pending 파드 | study/11 08-scheduling · 카탈로그 §1-A 4·5·7·43·44 | placed |
| infra-cpu-throttling | CPU 스로틀링 | study/11 02 §2 · 볼트 시스템 자원 한 판 §01·§04 · 카탈로그 §1-A 8 | placed |
| infra-request-allocation-ratio | 요청 할당률 | study/11 02 §2 · 볼트 시스템 자원 한 판 §01·§04 · 카탈로그 §1-A 8 | placed |
| infra-autoscaling | 오토스케일링 | 구조 노드 (활동 묶음) | placed |
| infra-metrics-server | 리소스 메트릭 API | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| auto-scaler | 오토 스케일러 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| infra-custom-metric-autoscaling | 사용자 지표 기반 확장 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| infra-event-driven-autoscaling | 이벤트 기반 확장 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| keda | KEDA | 카탈로그 §1-A 11 | excluded — 레포에 없는 제품 — infra-event-driven-autoscaling 동의어로 흡수 |
| infra-vertical-autoscaling | 수직 확장 자동화 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| infra-cluster-autoscaling | 노드 자동 확장 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| karpenter | Karpenter | 카탈로그 §1-A 12 | excluded — 레포에 없는 제품 — infra-cluster-autoscaling 동의어로 흡수 |
| infra-over-provisioning | 여유 용량 선확보 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| infra-scaling-flapping | 스케일 출렁임 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| infra-scale-out-lag | 확장 지연 | study/11 09-autoscaling · 카탈로그 §1-A 9~13 | placed |
| infra-cluster-networking | 클러스터 네트워킹 | 구조 노드 (활동 묶음) | placed |
| infra-cni | CNI | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-cluster-dns | 클러스터 DNS | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| net-cluster-dns-search | ndots · 검색 도메인 증폭 | study/11 05 §7 · 06 §5 | excluded — owned by network (net-cluster-dns-search · net-ndots-amplification) — infra-cluster-dns 가 USES · CAUSES 로 잇는다 |
| infra-external-dns | 외부 DNS 자동 등록 | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-network-policy | 쿠버네티스 NetworkPolicy | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| cloud-microsegmentation | 마이크로 세그멘테이션 | 카탈로그 §1-A 24 | excluded — owned by cloud — 쿠버네티스 NetworkPolicy 가 USES 로 잇는다 |
| infra-gateway-api | Gateway API | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-ebpf-dataplane | eBPF 데이터 평면 | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| service-mesh | 서비스 메시 (Istio · Linkerd · Ambient) | study/11 13 · 카탈로그 §1-A 18 | excluded — owned by distributed |
| net-mtls | mTLS | study/11 13 §10 | excluded — owned by network |
| infra-topology-aware-routing | 토폴로지 인지 라우팅 | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-silent-policy-block | 정책 차단으로 인한 무응답 | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-cluster-extension | 클러스터 확장 | 구조 노드 (활동 묶음) | placed |
| infra-crd | CRD | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-operator | 오퍼레이터 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-reconcile-loop | 조정 루프 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-finalizer | 파이널라이저 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-status-subresource | status 하위 리소스 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-owner-reference | 소유자 참조 · 가비지 컬렉션 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-admission-control | 입장 제어 | study/11 04 §8 · 카탈로그 §2E · §1-A 22 | placed |
| infra-admission-webhook | 입장 웹훅 | study/11 04 §8 · 카탈로그 §2E · §1-A 22 | placed |
| infra-validating-admission-policy | CEL 입장 정책 | study/11 04 §8 · 카탈로그 §2E · §1-A 22 | placed |
| infra-reconcile-hot-loop | 조정 무한 루프 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-stuck-terminating | 삭제 중 멈춤 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-cluster-security | 클러스터 보안 | 구조 노드 (활동 묶음) | placed |
| infra-k8s-rbac | 쿠버네티스 RBAC | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| rbac | RBAC (일반) | study/11 14 §2 | excluded — owned by security — infra-k8s-rbac 가 USES 로 잇는다 |
| infra-pod-security-standards | 파드 보안 표준 | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| infra-pod-security-policy | PodSecurityPolicy | 카탈로그 §1-A 26 | excluded — 폐기된 API — 후속인 infra-pod-security-standards 에 흡수 |
| infra-security-context | 보안 컨텍스트 | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| infra-policy-as-code | 정책 코드화 | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| infra-audit-logging | API 감사 로그 | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| infra-secret-encryption-at-rest | 저장소 시크릿 암호화 | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| infra-over-privilege | 과잉 권한 | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| health-check | 헬스 체크 | study/11 02 §2 · 지난 라운드 운영 행 | placed |
| kubernetes | 쿠버네티스 | study/11 01 §10 · k8s/CLAUDE.md (kine 비대) | placed |
| k3s | k3s | study/11 01 §10 · k8s/CLAUDE.md (kine 비대) | placed |
| infra-resource-contention | 노드 자원 경합 | study/11 02 §2 · 지난 라운드 운영 행 | placed |
| infra-cpu-utilization | CPU 사용률 | study/11 02 §2 · 지난 라운드 운영 행 | placed |
| infra-rollout | 롤아웃 | 구조 노드 (활동 묶음) | placed |
| infra-rolling-update | 롤링 업데이트 | study/11 10 · ADR-0019 · 지난 라운드 운영 행 | placed |
| infra-recreate-deployment | 재생성 배포 | study/11 10·20-canary-bluegreen-argo-rollouts | placed |
| blue-green-deployment | 블루-그린 배포 | study/11 10 · ADR-0019 · 지난 라운드 운영 행 | placed |
| canary-deployment | 카나리 배포 | study/11 10 · ADR-0019 · 지난 라운드 운영 행 | placed |
| infra-progressive-delivery | 점진적 전달 | study/11 10·20-canary-bluegreen-argo-rollouts | placed |
| argo-rollouts | Argo Rollouts · Flagger | study/11 20 | excluded — 레포에 없는 제품 — infra-progressive-delivery 동의어로 흡수 |
| infra-shadow-traffic | 섀도 트래픽 | study/11 10·20-canary-bluegreen-argo-rollouts | placed |
| infra-feature-flag | 기능 플래그 | study/11 10·20-canary-bluegreen-argo-rollouts | placed |
| infra-rollback | 롤백 | study/11 10·20-canary-bluegreen-argo-rollouts | placed |
| infra-deploy-downtime | 배포 순단 | study/11 10 · ADR-0019 · 지난 라운드 운영 행 | placed |
| infra-incompatible-rollout | 버전 비호환 롤아웃 | study/11 10·20-canary-bluegreen-argo-rollouts | placed |
| data-expand-contract | 확장-축소 마이그레이션 | study/11 20 §8-3 | excluded — owned by data — 롤아웃 비호환의 완화책으로 잇기를 보고에 적는다 |
| infra-deploy-error-rate | 배포 중 오류율 | study/11 10 · ADR-0019 · 지난 라운드 운영 행 | placed |
| infra-traffic-routing | 트래픽 라우팅 | 구조 노드 (활동 묶음) | placed |
| reverse-proxy | 리버스 프록시 | 지난 라운드 운영 행 · study/11 06 | placed |
| api-gateway | API 게이트웨이 | 지난 라운드 운영 행 · study/11 06 | placed |
| load-balancer | 로드 밸런서 | 지난 라운드 운영 행 · study/11 06 | placed |
| cloud-l7-load-balancer | L4 · L7 로드 밸런서 종류 | study/11 20 §7-4 | excluded — owned by cloud |
| service-discovery | 서비스 디스커버리 | 지난 라운드 운영 행 · study/11 06 | placed |
| infra-cert-renewal | 인증서 자동 발급 · 갱신 | 지난 라운드 운영 행 · study/11 06 | placed |
| ingress-nginx | ingress-nginx | 지난 라운드 운영 행 · study/11 06 | placed |
| cert-manager | cert-manager | 지난 라운드 운영 행 · study/11 06 | placed |
| infra-cert-expiry | 인증서 만료 | 지난 라운드 운영 행 · study/11 06 | placed |
| infra-backup-dr | 백업 · 재해 복구 | 구조 노드 (활동 묶음) | placed |
| infra-scheduled-backup | 정기 백업 작업 | 카탈로그 §2I · §1-A 37·38·54 · k8s/base/db-backup | placed |
| data-logical-backup | 논리 · 물리 백업 · PITR | k8s/base/db-backup · 카탈로그 §2I | excluded — owned by data — infra-scheduled-backup 이 USES 로 잇는다 |
| infra-offsite-backup | 오프사이트 사본 | 카탈로그 §2I · §1-A 37·38·54 · k8s/base/db-backup | placed |
| cloud-dr-strategy | DR 전략 (파일럿 라이트 · 웜 스탠바이) | 카탈로그 §2I | excluded — owned by cloud |
| infra-cluster-state-backup | 클러스터 상태 백업 | 카탈로그 §2I · §1-A 37·38·54 · k8s/base/db-backup | placed |
| infra-restore-drill | 복구 리허설 | 카탈로그 §2I · §1-A 37·38·54 · k8s/base/db-backup | placed |
| infra-colocated-backup | 원본과 같은 곳의 백업 | 카탈로그 §2I · §1-A 37·38·54 · k8s/base/db-backup | placed |
| infra-rpo | RPO | 카탈로그 §2I · §1-A 37·38·54 · k8s/base/db-backup | placed |
| infra-rto | RTO | 카탈로그 §2I · §1-A 37·38·54 · k8s/base/db-backup | placed |
| infra-glossary | 인프라 용어 사전 | 구조 노드 (용어 가지) | placed |
| infra-glossary-image | 이미지 · 구성 용어 | 구조 노드 (용어 가지) | placed |
| infra-container-image | 컨테이너 이미지 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-oci-image-spec | OCI 규격 | 볼트 시스템 자원 한 판 §06 · 분야 표준(OCI 규격) | placed |
| infra-image-layer | 이미지 레이어 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-base-image | 베이스 이미지 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-image-tag | 이미지 태그 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-image-digest | 이미지 다이제스트 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| infra-sbom | SBOM | study/11 14 §7 · 분야 표준(SLSA) | placed |
| infra-image-registry | 이미지 레지스트리 | 분야 표준(컨테이너 이미지 빌드) · 레포 Jib · Dockerfile | placed |
| oci | OCIR (OCI 레지스트리 제품) | k8s/CLAUDE.md | excluded — owned by cloud (oci TECHNOLOGY) |
| infra-artifact | 빌드 산출물 | 분야 표준(Continuous Delivery · DORA) | placed |
| infra-desired-state | 원하는 상태 | 분야 표준(IaC) · 지난 라운드 운영 행 | placed |
| infra-overlay | 오버레이 | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| infra-helm-chart | Helm 차트 | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| infra-helm-values | values 파일 | study/11 11-helm-vs-kustomize · 카탈로그 §1-A 33·34 | placed |
| infra-glossary-cluster | 클러스터 용어 | 구조 노드 (용어 가지) | placed |
| infra-pod | 파드 | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-replicaset | ReplicaSet | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-k8s-namespace | 쿠버네티스 네임스페이스 | study/11 02 §7~10 · 17 Q6 | placed |
| infra-label-selector | 레이블 · 셀렉터 | study/11 02 §7~10 · 17 Q6 | placed |
| infra-annotation | 어노테이션 | study/11 02 §7~10 · 17 Q6 | placed |
| infra-k8s-service | Service | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-service-types | Service 타입 | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-headless-service | 헤드리스 Service | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-endpoint-slice | EndpointSlice | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-ingress | Ingress | study/11 05·06 · 카탈로그 §2B · §1-A 1~3·16·17·24 | placed |
| infra-probe | 프로브 | study/11 02 §2 · 지난 라운드 운영 행 | placed |
| infra-qos-class | QoS 클래스 | study/11 02 §2 · 볼트 시스템 자원 한 판 §01·§04 · 카탈로그 §1-A 8 | placed |
| infra-service-account | ServiceAccount | study/11 14-k8s-security · 카탈로그 §2D · §1-A 23·25~28·53 | placed |
| infra-custom-resource | 커스텀 리소스 | study/11 03·04·18 · 카탈로그 §2F · §1-A 21·35·48·49 | placed |
| infra-pod-phase | 파드 단계 | study/11 02-core-resources · 카탈로그 §2A · §1-A 40~42 | placed |
| infra-exit-code | 종료 코드 | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-k8s-event | 이벤트 | study/11 17 Q4·Q38 · 볼트 시스템 자원 한 판 §01·§06 | placed |
| infra-kubeconfig | kubeconfig | study/11 02 §7~10 · 17 Q6 | placed |
| infra-glossary-storage | 스토리지 용어 | 구조 노드 (용어 가지) | placed |
| infra-access-mode | 접근 모드 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
| infra-reclaim-policy | 회수 정책 | study/11 07-storage · 카탈로그 §2C · §1-A 39 | placed |
