---
parent: 11-k8s-deep-dive
seq: 17
title: 면접 Q&A 카드 — 30+
type: deep
created: 2026-05-01
---

# 17. K8s 면접 Q&A — 한국 대기업 백엔드 10년차 대비

> 답변 길이는 30초 - 1분 30초 사이로 자르는 게 좋다. 길게 가는 답은 첫 줄에 결론 → 부연 → 함정 사례 1개 → 다음 단계 의 4단 구조.

---

## Phase 1 — Control Plane / Resource

### Q1. **kubectl apply 한 줄이 클러스터 안에서 어떻게 흘러가나요?**

> 8단계예요. (1) 클라이언트가 kubeconfig 로 인증 토큰 결정 → (2) OpenAPI 스키마로 default 채우고 last-applied annotation 으로 3-way merge 계산 → (3) HTTPS 로 api-server 호출 → (4) api-server 가 인증 → 인가(RBAC (Role-Based Access Control, 역할 기반 접근 제어)) → mutating admission → schema validation → validating admission → (5) etcd write 후 resourceVersion 증가 → (6) controller-manager 가 watch 로 받아 ReplicaSet/Pod 만듦 → (7) scheduler 가 nodeName bind → (8) kubelet 이 CRI/CNI/CSI 호출해 컨테이너 시작.
> 핵심은 **api-server 만 etcd 를 만진다** 는 점이에요. 그래서 RBAC/admission 의 단일 게이트가 되고, 그게 K8s 보안 모델의 중심이에요.

### Q2. **Deployment 와 StatefulSet 의 차이?**

> Deployment 는 Pod 가 동등하고 random hash 이름, 동시 시작/종료, PVC 없음 또는 공유. StatefulSet 은 Pod 이름이 `name-0/1/2` 로 정렬 + 순차 시작/역순 종료, `volumeClaimTemplates` 로 Pod 마다 고유 PVC, Headless Service 로 안정적 DNS.
> 운영 차이의 본질은 "**identity** 가 필요한가" 예요. Kafka/MySQL 처럼 같은 Pod 이 같은 데이터를 보장해야 하면 StatefulSet, gateway/order 처럼 stateless 면 Deployment. msa 도 인프라는 StatefulSet, 앱은 모두 Deployment.

### Q3. **scheduler 가 Pod 를 시작시키나요?**

> 아니요. 시작시키는 건 kubelet 입니다. scheduler 는 Pod 의 `.spec.nodeName` 만 채워줘요(= bind). 그 후 해당 노드의 kubelet 이 watch 로 감지해서 CRI 로 컨테이너 시작, CNI 로 IP, CSI 로 볼륨 마운트, probe 실행.
> 이 분리 때문에 scheduler 가 잠시 죽어도 기존 Pod 는 영향 없고, kubelet 만 살아있으면 노드의 워크로드는 유지됩니다.

### Q4. **Pod 가 OOMKilled 되는데 JVM heap 은 멀쩡합니다. 왜?**

> JVM heap 외 metaspace, direct buffer, 네티 native memory, 스레드 스택 (1MB × 스레드 수) 까지 합쳐 cgroup limit 을 넘어선 거예요. msa 의 Jib convention 은 `-XX:MaxRAMPercentage=75` 로 heap 비율을 75% 로 제한하지만, 나머지 25% 가 metaspace+direct+stack 으로 모자랄 수 있어요.
> 진단: `kubectl top pod`, `jcmd <pid> VM.native_memory summary`. 처방: limit 상향, MaxRAMPercentage 70 으로 낮춤, 또는 Netty `-Dio.netty.maxDirectMemory` 명시.

### Q5. **readiness 와 liveness 차이?**

> readiness 가 fail 하면 Endpoints 에서 Pod 가 빠져 트래픽 차단. liveness 가 fail 하면 Pod 가 kill 되고 재시작. 둘 다 같은 endpoint 로 두면 부팅 중 OOM 이 liveness 도 fail 시켜 무한 restart 루프에 빠지기 쉬워요. msa 는 Spring Boot Actuator 의 `/actuator/health/{readiness,liveness}` 분리 endpoint 를 사용.
> 추가로 startupProbe 를 두면 다른 probe 가 비활성화돼 부팅 시간 보장이 더 안전해요.

### Q6. **ConfigMap 변경했는데 Pod 가 새 값을 못 받아요.**

> env 로 주입한 경우 자동 갱신 안 됩니다. Pod 재시작 필요. volumeMount 로 마운트한 경우 약 1분 지연 후 자동 갱신.
> 깔끔한 해법은 Kustomize 의 `configMapGenerator` — ConfigMap 이름에 hash suffix 가 붙어서, 값이 바뀌면 새 ConfigMap 이름이 되고, Deployment.template 안의 reference 도 새 이름이 되니 자동으로 새 ReplicaSet 생성 → Pod 재시작 → 새 값.

---

## Phase 2 — Controller / Operator

### Q7. **Controller 와 Operator 의 차이?**

> Controller 는 일반 K8s 리소스(ReplicaSet/Deployment 등) 를 reconcile 하는 모든 코드를 부르는 일반 용어. Operator 는 그 위에 **도메인 지식 + CRD** 가 결합된 특수 형태예요. cert-manager 가 ACME 프로토콜을 자동화하는 게 Operator. 단순 ReplicaSet 컨트롤러는 그냥 Controller.
> 핵심 패턴은 같음 — Watch → Workqueue → Reconcile (idempotent, level-triggered).

### Q8. **CRD 만 만들면 무엇이 동작하나요?**

> kubectl get / describe / apply 가 즉시 동작하고, RBAC / OpenAPI validation / watch 까지 무료로 제공돼요. 단 desired state 를 실제 자원으로 만들려면 컨트롤러가 별도로 있어야 해요. CRD 만 있으면 그냥 etcd 의 KV 저장소.

### Q9. **Reconcile 함수 작성 시 가장 주의할 점?**

> **idempotent** 하게 만드는 것. 100번 호출되어도 같은 결과여야 합니다. K8s 컨트롤러는 level-triggered 라 이벤트 누락이 있어도 다음 List 때 reconcile 하면 되니까요.
> 함수 인자는 항상 `(namespace, name)` 키만. 안에서 직접 GET 해서 현재 상태 확인 → diff → update. 변수로 상태를 들고 있으면 안 됩니다 — 죽었다 살아나도 멀쩡해야 해요.

### Q10. **Finalizer 가 왜 필요?**

> 외부 자원을 정리할 시간을 확보하기 위해서. K8s 의 삭제는 2단계예요. 사용자 DELETE → api-server 가 `DeletionTimestamp` 만 설정 (실제 삭제 X) → 모든 finalizer 가 제거되면 GC 가 진짜 삭제. 내 컨트롤러가 만든 클라우드 LB / S3 버킷을 정리한 뒤에야 finalizer 를 빼야 누수 없습니다.

### Q11. **CRD 의 status subresource 가 왜 분리?**

> 사용자와 컨트롤러의 역할 분리. spec 은 사용자가 쓰고, status 는 컨트롤러만 씁니다. subresource 를 켜면 사용자가 status 직접 수정 못 하고 `/status` 엔드포인트만 사용 가능. 또 spec 변경 시 `metadata.generation` 만 증가 → `status.observedGeneration` 비교로 "내 변경이 처리됐나" 알 수 있어요.

---

## Phase 3 — Networking

### Q12. **Service 의 ClusterIP 는 실제 어디 있나요?**

> 어디에도 없습니다. 가상 IP 예요. iptables/IPVS 또는 eBPF 가 차지하는 NAT 룰일 뿐. 트래픽이 그 IP 로 들어오면 커널이 endpoint 중 하나로 DNAT. 그래서 ClusterIP 자체에는 ping 도 안 가요 (구현마다 다름).

### Q13. **gRPC 를 ClusterIP Service 뒤에 두면 한 Pod 으로만 흐르는 이유?**

> kube-proxy 의 DNAT 은 TCP connection 단위인데 gRPC 는 HTTP/2 multiplexing 으로 connection 1개에 RPC 를 쌓아요. connection 이 한 번 Pod-1 로 묶이면 그 connection 의 모든 RPC 가 Pod-1 만 향합니다.
> 해결: (1) Headless Service + gRPC client-side LB (round_robin), (2) Service Mesh (sidecar 가 L7 LB), (3) gRPC 전용 Service 분리.
> msa 는 gRPC 사용 안 하지만 Lettuce Redis cluster 도 같은 패턴 — Headless 로 토폴로지 디스커버리.

### Q14. **kube-proxy 의 iptables / IPVS / eBPF 언제 바꿔?**

> Service 수가 1k 이상이거나 latency-critical 이면 IPVS 또는 eBPF. iptables 는 매칭이 O(N) 이라 5k Service 면 p99 가 30ms 단위. IPVS 는 해시 O(1) 로 ~5ms. Cilium eBPF 는 socket-level redirect 로 conntrack 도 우회 → 가장 빠름.
> msa 같은 ~30 Service 규모는 iptables 도 충분.

### Q15. **DNS 가 느린데 왜?**

> ndots:5 함정이에요. Pod 의 `/etc/resolv.conf` 가 ndots:5 라 도메인 안 점이 5개 미만이면 search list 4개를 모두 시도. 외부 도메인(`api.example.com`, 점 2개) 은 매 호출마다 4 NXDOMAIN + 1 성공 → 5번 RTT.
> 해법: (1) FQDN (`api.example.com.` 끝점), (2) `dnsConfig.options ndots:1`, (3) NodeLocal DNSCache 도입 (DaemonSet 으로 노드별 캐시) — 이게 가장 효과 큼.

### Q16. **NetworkPolicy 만 적용하면 보안 끝인가요?**

> 아닙니다. CNI 가 NetworkPolicy 를 지원해야 동작 — flannel 만 깔린 클러스터에서는 무시됩니다. 또 NetworkPolicy 는 L3/L4 (IP/포트) 만 — HTTP method/path 단위 제어는 Cilium L7 정책 또는 Service Mesh 가 필요.
> 그래도 **deny-default + allowlist** 의 1차 적용은 가장 효율적인 보안 win 이에요. msa 는 현재 0건이라 즉시 도입 후보.

### Q17. **Ingress 와 Gateway API 의 차이?**

> Ingress 는 L7 HTTP/S 만, controller 별 annotation 이 표준 외 영역, 권한 분리 약함. Gateway API 는 GatewayClass / Gateway / Route 의 3-layer 분리로 인프라/앱 권한 분리, TCP/UDP/gRPC 까지, 가중치 라우팅 표준화.
> 아직 ingress-nginx 가 충분하면 그대로 가도 OK. Argo Rollouts Canary + 멀티팀 모델 도입 시점에 Gateway API 가 자연스럽게 함께 들어옵니다.

---

## Phase 4 — Storage / Scheduling / Autoscaling

### Q18. **PV 와 PVC 의 차이?**

> PV 는 클러스터 자원 — 관리자 또는 CSI 가 만듦. PVC 는 namespace 단위 요청 — 개발자가 만듦. PVC 가 PV 와 bind 되어야 사용 가능. StorageClass 가 있으면 PVC 만 만들어도 PV 가 동적으로 생성됩니다.

### Q19. **`WaitForFirstConsumer` 가 왜 필요?**

> 멀티 AZ 클러스터에서 EBS 는 한 zone 에 묶입니다. `Immediate` 모드면 PVC 만들면 즉시 PV 가 어떤 zone 에 생기고, 나중에 Pod 가 다른 zone 노드로 스케줄되면 attach 실패. `WaitForFirstConsumer` 는 Pod 스케줄될 때까지 기다렸다가 같은 zone 에 PV 생성 → 항상 attach 성공.

### Q20. **HPA 와 Cluster Autoscaler 의 관계는?**

> HPA 는 Pod 수를, CA 는 노드 수를 조정합니다. HPA 가 Pod 늘리려는데 자원 부족하면 Pending → CA 가 watch 해서 노드 추가 → Pending Pod 가 새 노드에 스케줄. 두 단계라 latency 가 합쳐 2-5분 걸려요. user-facing 트래픽이면 over-provisioning (낮은 priority pause Pod) 으로 흡수.

### Q21. **HPA 의 metrics 종류?**

> 4종류: (1) Resource — CPU/Memory (metrics-server 제공), (2) Pods — Pod 별 평균 (custom.metrics.k8s.io, Prometheus Adapter), (3) Object — 단일 객체의 metric (예: Ingress RPS), (4) External — 외부 메트릭 (Kafka lag 등).
> CPU 70% 만으로는 트래픽 패턴 반영 부족. msa 라면 gateway 의 RPS, search-consumer 의 Kafka lag 같은 진짜 시그널이 효과적.

### Q22. **KEDA 와 일반 HPA 의 차이?**

> KEDA 는 0 까지 scale down 가능 (HPA 는 최소 1). 30+ scaler 빌트인 — Kafka, SQS, Redis Streams, Prometheus 등 이벤트 소스 직접 watch. 내부적으로는 KEDA 가 ScaledObject 를 보고 HPA 객체를 생성해 metric 을 제공. 워커형(비동기) 워크로드에 효과적.

### Q23. **PDB 가 노드 crash 도 막나요?**

> 안 막습니다. PDB 는 voluntary disruption (drain, cluster autoscaler, operator delete) 만 막아요. 노드 OS crash, kubelet 죽음, OOM 같은 involuntary 는 못 막음. 그건 PriorityClass + replicas 분산 + readiness probe 로 대응.

### Q24. **nodeAffinity required 와 preferred 의 차이?**

> required 는 hard 조건 — 못 맞추면 Pending. preferred 는 점수 가산 — 다른 노드라도 스케줄. 작은 클러스터에서 required 를 남발하면 스케줄 실패 빈번. 대부분 preferred 가 안전.
> 같은 의도를 더 깔끔히 표현하는 건 `topologySpreadConstraints` — zone/노드 별 균등 분산을 maxSkew 로 명시.

---

## Phase 5 — Deployment / Helm / GitOps

### Q25. **Rolling / Blue-Green / Canary 언제?**

> Rolling 은 기본. 자원 1.25× 로 빠르고 단순. Blue-Green 은 두 환경 병행 → selector swap 으로 즉시 전환. 자원 2× 비싸지만 롤백 가장 빠름. Canary 는 트래픽 5% → 25% → 100% 점진 + 메트릭 자동 분석. 자원 +10%, 가장 안전, 복잡도 가장 높음.
> 의사결정: Tier 1 (gateway/order) 은 Canary, Tier 2 는 Rolling, single-instance (msa 의 quant) 는 Recreate.

### Q26. **Argo Rollouts 와 Flagger 차이?**

> Argo Rollouts 는 Argo CD 생태계와 자연 통합, Rollout CRD 가 Deployment 를 대체. Flagger 는 Service Mesh (Istio/Linkerd) 친화, Canary CRD 로 자동 배포. 핵심 기능(Canary, Blue-Green, AnalysisRun) 은 비슷.
> Argo CD 쓰면 Argo Rollouts, Mesh 쓰면 Flagger 가 더 자연스러워요.

### Q27. **maxSurge / maxUnavailable 어떻게 정해?**

> 자원 여유 + 가용성 SLA. 자원 빠듯하면 `maxSurge=0, maxUnavailable=1` (1개씩 교체, 추가 자원 X). user-facing 가용성 중요하면 `maxSurge=1+, maxUnavailable=0` (새거 띄우고 옛거 죽임). msa 는 기본 25%/25% 이지만 Tier 1 은 maxSurge=1, maxUnavailable=0 권장.

### Q28. **GitOps 가 기존 CD 와 무엇이 다른가요?**

> 4가지: (1) push → pull, 클러스터 안 에이전트가 git 을 watch, (2) drift 자동 수정, (3) git 이 SoT, (4) 자격증명이 클러스터 안에 → CI 에 줄 필요 X.
> 추가로 rollback = git revert, audit = git history 라 변경 추적이 자연스러워요.

### Q29. **Helm 과 Kustomize 어떻게 골라?**

> "변수+함수+조건+의존성" 이 강하게 필요하면 Helm. "base + 환경별 overlay 의 명확한 모델 + 순수 YAML diff" 가 우선이면 Kustomize. msa 는 후자라 Kustomize. 다만 인프라 (cert-manager, Strimzi, kube-prometheus-stack) 는 차트 생태계가 풍부해서 Helm 그대로 깔고, 앱 매니페스트만 Kustomize — 둘이 자연스럽게 분리.

### Q30. **GitOps 에서 Secret 어떻게 처리?**

> 4가지: (1) **Sealed Secrets** — 클러스터 키로 암호화, git 에 암호문 commit, 가장 단순. (2) **SOPS** — KMS 로 yaml 부분 암호화, diff 일부만. (3) **External Secrets Operator** — git 에는 참조만, 실제 값은 AWS Secrets Manager / OCI Vault, 키 회전 자동. (4) Vault — 풍부하지만 운영 비용 큼.
> 장기적으로 ESO 가 가장 클린. msa 는 현재 Sealed Secrets, ESO 로 점진 마이그레이션 계획.

### Q31. **selfHeal: true 의 위험?**

> 누군가 `kubectl edit` 으로 임시 변경한 게 즉시 git 으로 복구돼요. 디버깅 중이면 곤란. 그래서 운영 룰: dev/stage 는 selfHeal: false (디버깅 허용), prod 는 true (drift 금지). 또 emergency 시 임시로 비활성 가능.

---

## Phase 6 — Security / Mesh

### Q32. **RBAC 의 4-tuple?**

> Subject (사용자/SA/그룹) + Role 또는 ClusterRole + RoleBinding 또는 ClusterRoleBinding + verb + resource. 핵심: Role 은 namespace 한정, ClusterRole 은 cluster 광역. 최소 권한 원칙으로 cluster-admin 직접 부여, `*` 사용을 피하고, 각 앱 SA 분리.

### Q33. **Pod Security Standards 의 3단계?**

> privileged (제한 없음), baseline (privileged 컨테이너/hostNetwork 차단), restricted (runAsNonRoot, readOnlyRootFS, capabilities drop ALL).
> namespace label 로 enforce/audit/warn 모드 적용. 단계적 도입: warn → audit → enforce 순으로 위험 적게.

### Q34. **OPA 와 Kyverno 차이?**

> OPA Gatekeeper 는 Rego 언어 (학습곡선, 강력). Kyverno 는 YAML (단순, K8s 친화). 단순 정책(resources 필수, image registry 화이트리스트) 은 Kyverno, 복잡한 비즈니스 정책은 OPA. 둘 다 admission controller 로 동작.

### Q35. **Service Mesh 가 정말 필요한가요?**

> 보통 mTLS + 관측성 + 정책 + 트래픽 제어 의 4개 중 2개 이상이 진짜 필요할 때. msa 같은 단일 클러스터 + 30 서비스 + 평문 internal 허용 환경은 NetworkPolicy + cert-manager + Prometheus + Argo Rollouts 가중치 로 충분. 메시 도입 시그널은 멀티 클러스터, B2B mTLS 의무, 50+ 서비스 같은 복잡도 임계점.

---

## Phase 7 — 종합 시나리오

### Q36. **K8s 클러스터에 처음 들어왔어요. 가용성 점검을 위해 첫 5분 동안 확인할 것?**

> (1) `kubectl get nodes` — Ready 상태, 디스크/메모리 pressure taint 확인. (2) `kubectl get pods --all-namespaces -o wide | grep -v Running` — 비정상 Pod. (3) `kubectl top nodes / pods` — metrics-server 동작 + 자원 분포. (4) `kubectl get events --sort-by=.lastTimestamp` — 최근 알림. (5) HPA / PDB 적용 여부. (6) ServiceMonitor / Prometheus 알람 페이지. msa 라면 `kubectl get hpa,pdb -n commerce` 로 각 17개 확인.

### Q37. **갑자기 Pod 들이 Pending 상태에 빠졌어요. 원인 파악 절차?**

> (1) `kubectl describe pod <pod>` 의 Events — 가장 흔한 건 (a) FailedScheduling: insufficient cpu/memory, (b) PVC bound 대기, (c) image pull 실패. (2) `kubectl get events` 로 cluster-wide 패턴. (3) `kubectl describe node` 로 자원 분포 + taint. (4) Cluster Autoscaler 로그 — 새 노드 시도 중인지. 자주 막힌 시나리오: (a) `WaitForFirstConsumer` 의 PVC 가 zone affinity 미스, (b) HPA 의 minReplicas 가 클러스터 capacity 초과, (c) NetworkPolicy 가 image registry 차단.

### Q38. **K8s 위에서 Spring Boot 앱이 OOMKilled 가 반복돼요. 어떻게 진단하나요?**

> (1) `kubectl describe pod` 의 Last State: Terminated, Reason: OOMKilled 확인. (2) `kubectl top pod` 로 메모리 추이. (3) Pod 안에서 `jcmd <pid> VM.native_memory summary` — JVM 의 영역별 사용 (heap, metaspace, direct, thread stack). (4) Jib `MaxRAMPercentage=75` + cgroup limit 의 비율 점검. (5) Lettuce/Netty 의 direct buffer 가 비정상 큰 경우 `-Dio.netty.maxDirectMemory=...` 로 명시.
> 처방 후보: limit 상향, MaxRAMPercentage 낮춤, leak 의 경우 heap dump 분석 (`-XX:+HeapDumpOnOutOfMemoryError`).

### Q39. **HPA 가 갑자기 Pod 를 늘렸다 줄였다 합니다 (flapping). 원인?**

> `behavior.scaleDown.stabilizationWindowSeconds` 가 너무 짧거나 metric 자체가 jittery. 처방: stabilization window 5분 권장, scale-up 도 `Pods: 2 / 30s` 같은 rate limit. JVM warmup 으로 첫 1분 CPU 100% 라면 startupProbe 로 끝까지 trafifc 차단 + warmup window 도입.

### Q40. **운영 K8s 에 GitOps 도입을 제안하려면 1줄로 어떤 가치를 내세우나요?**

> "**git 이 SoT 가 되면 변경 추적/롤백/drift 차단/secret 관리/멀티 클러스터 일관성 5가지를 한 번에 얻고, 그 대가로 Argo CD 운영 비용만 추가** — 그 비용은 운영 1주 + 학습 2주" 라고 답변. 그 이상은 Phase 도입 매트릭스 (Sprint 1-5) 로 풀어 설명.

---

## 종합 주관식 (긴 답변 1개)

### Q41. **"K8s 위에 30개 마이크로서비스가 있을 때 핵심 운영 지표 5개를 말해보세요."**

> (1) **Pod restart rate** — 5분 단위 컨테이너 재시작 비율. liveness fail 폭증 또는 OOMKilled 이슈 조기 감지.
> (2) **HPA effective utilization** — desired vs actual replicas + metric value. 70% 목표인데 실제 90% 면 maxReplicas 부족.
> (3) **Endpoints 수 / Service** — Service 가 매칭한 Pod 수. readiness fail 로 0이 되면 503.
> (4) **API server p99 latency + 4xx/5xx rate** — controller 의 watch/list 부하, RBAC denial 패턴.
> (5) **etcd write QPS + DB size** — etcd 가 K8s 의 Achilles' heel. 100MB 임계점 + 8GB 한계.
> 추가 보너스: **Pending Pod 수** (스케줄 / PVC / image / quota), **PodDisruptionBudget 의 ALLOWED DISRUPTIONS** (운영 위험 신호), **NetworkPolicy 위반 시도 수** (Cilium Hubble), **CronJob 의 successful schedule timestamp** (백업 누락 감지).

---

## 회독 가이드

- **Phase 1-2 (Q1-11)** — 첫 인터뷰 안전망
- **Phase 3 (Q12-17)** — 네트워크 깊이 어필 포인트
- **Phase 4 (Q18-24)** — 자원/스케줄링은 SRE 직무 핵심
- **Phase 5 (Q25-31)** — 한국 대기업 GitOps 도입 흐름과 일치, 어필 가치 큼
- **Phase 6 (Q32-35)** — 보안 어필
- **Phase 7 (Q36-41)** — 시나리오 답변, "트러블슈팅 경험" 면접 답변에 사용

회독 주기: 학습 종료 후 1주일 / 2주일 / 1개월. 매번 Q 만 보고 답을 입으로 30초 내 말해보기. 막히는 카드만 다시 본문 참조.

---

## 추가 학습 추천

- **Kelsey Hightower 의 kubernetes-the-hard-way** — control plane 깊이
- **Kubernetes in Action (Marko Lukša)** — 정석
- **Programming Kubernetes (Hausenblas)** — controller-runtime / Operator
- **CNCF Landscape** — 도구 생태계 한눈에
- **K8s 공식 문서 — concepts/architecture** 챕터를 1년에 1회 회독
- **Argo CD / Argo Rollouts 공식 docs** — 도입 시점에 정독

본 학습의 17개 deep file 도 1주일 회독 + 1개월 회독 권장.
