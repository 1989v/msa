---
parent: 11-k8s-deep-dive
seq: 05
title: 네트워킹 심화 — CNI / kube-proxy / Service / EndpointSlice / Headless gRPC
type: deep
created: 2026-05-01
---

# 05. 네트워킹 심화

## 1. K8s 네트워크 모델 4원칙

K8s 가 강제하는 4가지:

1. **모든 Pod 는 자기 IP 를 가진다** (포트 포워딩이나 NAT 없이)
2. **모든 Pod 는 NAT 없이 다른 Pod 와 통신할 수 있다**
3. **모든 노드 ↔ 모든 Pod** 통신 (NAT 없이)
4. **Pod 가 보는 자기 IP == 다른 Pod 가 보는 그 Pod IP**

이걸 구현하는 게 **CNI (Container Network Interface, 컨테이너 네트워크 인터페이스) plugin** (Calico/Cilium/VPC CNI/...) 의 역할.

## 2. CNI — Pod 네트워크 구현체

### 동작 흐름

```
kubelet 이 Pod 시작 시:
   1. CRI(containerd) 가 빈 network namespace 생성
   2. kubelet → CNI plugin 바이너리 호출 (/opt/cni/bin/calico, .../cilium 등)
      입력: namespace 경로, cmd=ADD, conf
   3. plugin 이:
      - host veth pair 생성
      - Pod ns 안에 eth0 으로 mount
      - IP 할당 (IPAM)
      - 라우팅/iptables/ebpf 규칙 설정
   4. 결과 IP 를 kubelet 으로 반환 → PodStatus 에 기록
```

### CNI plugin 비교

| Plugin | 데이터 경로 | NetworkPolicy | 비고 |
|---|---|---|---|
| **Calico** | iptables / IPVS / eBPF (선택) | 표준 + extended | BGP 라우팅, 멀티 테넌시 강력 |
| **Cilium** | **eBPF** (kube-proxy 도 대체 가능) | 표준 + L7 (HTTP, gRPC 메서드 단위) | identity 기반, Hubble 관측성, 서비스 메시 사이드카 대체 |
| **VPC CNI (AWS)** | ENI + Secondary IP | 표준 | Pod 가 VPC IP 를 직접 받음, IP 고갈 주의 |
| **flannel** | VXLAN / host-gw | 미지원 (Calico 와 결합) | 가장 단순, learning 용 |
| **Weave** | VXLAN | 표준 | 활발도 ↓ |

EKS 의 기본은 **VPC CNI** — Pod 이 VPC 의 진짜 IP 를 받으니 보안 그룹/ALB 가 직접 인식. 단점: 노드당 Pod 수가 ENI 한도에 묶임.

### eBPF 가 왜 빨리 떴나

전통 데이터플레인: `iptables → conntrack → routing` 으로 매 패킷 stack 통과.
eBPF: socket 레벨에서 직접 hook → kube-proxy / iptables 우회.

**측정 (참고)**:
- iptables: 1k Service 시 ~30ms p99 (규칙 매칭 O(N))
- IPVS: 1k Service 시 ~5ms (해시 O(1))
- eBPF: 1k Service 시 ~2ms (socket-level redirect, conntrack 우회)

큰 클러스터(~5k Service) 에서는 eBPF 의 차이가 극적으로 벌어진다.

## 3. kube-proxy 모드 비교

```yaml
# kube-proxy 설정 (DaemonSet 의 ConfigMap 안)
mode: "ipvs"   # iptables | ipvs | none(eBPF)
```

### iptables 모드 (기본)

- 매 Service 당 chain + rule 추가
- 트래픽이 들어오면 iptables 가 nat table 에서 DNAT (ClusterIP → PodIP)
- chain 매칭은 선형 → Service 수 ↑ → CPU ↑ + p99 ↑

### IPVS 모드

```bash
# 활성화 (kubeadm)
kubeadm init --service-cidr=10.96.0.0/16 --proxy-mode=ipvs
```

- 커널 L4 LB (IPVS) 사용
- 스케줄러 알고리즘 선택: `rr`, `lc`, `dh`, `sh`, `wrr`, `wlc`
- Service 수 5k+ 에서 iptables 대비 latency p99 6배 개선 (Cilium 벤치마크 인용)
- 단점: 설치 복잡도, debug 도구 다름

### eBPF (kube-proxy 대체)

- Cilium / Calico 의 eBPF 모드
- kube-proxy DaemonSet 자체를 제거 (`kubeProxyReplacement=true`)
- socket-level LB → conntrack 우회 → 가장 빠름

## 4. Service 의 본질

`apiVersion: v1, kind: Service` 자체는 **객체일 뿐**. 트래픽을 흘리는 건:

```
Pod sends to ClusterIP (10.96.0.10:8080)
   │
   ▼
[Linux kernel iptables/IPVS or eBPF]
   │  (selector → endpoints lookup)
   │  → DNAT to one of PodIPs (10.244.0.5:8080, 10.244.1.7:8080, ...)
   ▼
Pod receives
```

**ClusterIP 는 가상이다** — 어떤 노드/Pod 에도 실제 binding 안 된다. iptables/IPVS 가 차지하는 "가짜 주소".

### Service 객체에서 EndpointSlice 까지

```
Service { selector: app=gateway } 
       │
       │ Endpoints/EndpointSlice controller (controller-manager)
       ▼
EndpointSlice {
   ports: [http=8080]
   endpoints: [
     { addresses: [10.244.0.5], conditions: { ready: true }, nodeName: node-1 },
     { addresses: [10.244.1.7], conditions: { ready: true }, nodeName: node-2 }
   ]
}
       │
       │ kube-proxy / eBPF watch
       ▼
실제 라우팅 규칙
```

readiness probe 가 fail → controller 가 endpoint 의 `ready: false` 로 변경 → kube-proxy 가 라우팅 테이블에서 제외 → 트래픽 차단.

### EndpointSlice 가 도입된 이유

기존 `Endpoints` 객체는 Service 1개당 1개 → 1k Pod 면 1MB 짜리 객체 → watch 마다 전체 전송 → 컨트롤플레인 CPU 폭발. EndpointSlice 는 100개 단위로 분할 → watch 비용이 변경된 slice 만으로 한정.

1.21+ 부터 기본 활성. 1.31+ 에서 `Endpoints` 는 deprecated.

## 5. Service 타입 5가지 (다시 자세히)

### ClusterIP (기본)

```yaml
spec:
  type: ClusterIP
  clusterIP: 10.96.0.10        # 보통 자동 할당
  ports: [{ port: 80, targetPort: 8080 }]
  selector: { app: gateway }
```

- 클러스터 내부에서만 도달
- DNS: `gateway.commerce.svc.cluster.local`

### NodePort

```yaml
spec:
  type: NodePort
  ports: [{ port: 80, targetPort: 8080, nodePort: 30080 }]
```

- 모든 노드의 30080 포트 → 자동으로 Service 로 forward
- 외부에서 `<any-node-ip>:30080` 접근 가능
- 데모/CI 용. 운영은 LB 앞에 둠.

### LoadBalancer

```yaml
spec:
  type: LoadBalancer
  ports: [{ port: 80, targetPort: 8080 }]
```

- 클라우드(EKS/GKE/AKS) 의 cloud-controller-manager 가 클라우드 LB 생성 (AWS NLB, GCP TCP/HTTP LB)
- LB 가 NodePort 로 forward → kube-proxy 가 Pod 로
- 비용: LB 1개당 월 ~$20+. 그래서 **앱마다 LB 만들지 말고 Ingress 1개로 묶기**.

### ExternalName

```yaml
spec:
  type: ExternalName
  externalName: my-rds.us-east-1.rds.amazonaws.com
```

- DNS CNAME 만 만듦. selector / IP 없음
- 외부 RDS / S3 endpoint 를 클러스터 내 이름으로 참조 (ConfigMap 변경 없이 환경 전환 가능)

### Headless (clusterIP: None)

```yaml
spec:
  clusterIP: None
  selector: { app: kafka }
  ports: [{ port: 9092 }]
```

- ClusterIP 없음. kube-proxy 라우팅 X
- DNS A 레코드가 모든 Pod IP 를 반환 → 클라이언트가 직접 LB
- StatefulSet (Pod 별 DNS 필요) + gRPC client-side LB + Lettuce Redis cluster discovery 의 핵심

## 6. Headless + gRPC LB 함정 (#18 cross-ref)

### 문제: ClusterIP Service 뒤의 gRPC 는 1 Pod 으로만 흐른다

```
gRPC client ──TCP/HTTP2──► ClusterIP (kube-proxy) ──DNAT──► Pod-1
                                                               (영구 connection)
```

kube-proxy 의 DNAT 은 **TCP connection 단위**. gRPC 는 HTTP/2 multiplexing 으로 한 connection 위에 여러 RPC 를 쌓는다 → connection 1개가 Pod-1 로 묶이면 Pod-2/3 로 절대 안 간다.

### 해법 1: Headless Service + client-side LB

```yaml
# Service
spec: { clusterIP: None, ... }
```

```kotlin
// gRPC client (Java/Kotlin)
val channel = ManagedChannelBuilder.forTarget("dns:///product:9090")
    .defaultLoadBalancingPolicy("round_robin")
    .build()
```

DNS 가 모든 Pod IP 를 반환 → gRPC 가 Pod 별로 sub-channel 유지 → round-robin.

### 해법 2: Service Mesh (Istio/Linkerd)

sidecar 가 L7 LB → connection 1개여도 RPC 별로 다른 Pod 로 보냄. 부가 비용: 사이드카 메모리/지연.

### 해법 3: gRPC 전용 Service 분리 + headlessness

같은 앱에 HTTP+gRPC 가 있으면 ClusterIP/Headless 둘 다 만들어 분리.

msa 의 Lettuce Redis cluster 클라이언트가 같은 패턴으로 동작 — `redis-headless` 를 통한 노드 디스커버리 + 직접 연결.

## 7. DNS — CoreDNS

K8s 의 service discovery 는 DNS:

```
gateway.commerce.svc.cluster.local
└──┬───┘ └──┬───┘ └─┬─┘ └────┬─────┘
service   ns    type    cluster domain
```

CoreDNS Pod 가 `kube-system` 에서 동작. Pod 의 `/etc/resolv.conf`:

```
search commerce.svc.cluster.local svc.cluster.local cluster.local
nameserver 10.96.0.10
options ndots:5
```

### ndots:5 함정

`ndots:5` 의미: 도메인 안 점이 5개 이상이면 absolute, 미만이면 search list 순회.

`http://product` 호출 → search 목록 4개 모두 시도 → 4번 NXDOMAIN 후 absolute 시도 → **5번 DNS 조회 후 성공**. 외부 도메인 (`api.example.com`, 점 2개) 도 search list 4번 다 시도 → 매 호출마다 4 NX + 1 성공.

증상: latency 폭증, CoreDNS QPS 비정상.

해결:
1. **FQDN 사용** — `http://product.commerce.svc.cluster.local.` (마지막 점 중요)
2. `dnsConfig.options: [{ name: ndots, value: "1" }]` 로 Pod 단위 override
3. `dnsPolicy: ClusterFirstWithHostNet` 등 적절히
4. NodeLocal DNSCache 도입 (DaemonSet 으로 노드별 캐시) — CoreDNS 부하 ↓ + 응답 ms 단위 ↓

NodeLocal DNSCache 가 표준 추천 — 큰 클러스터에서 효과 매우 큼.

## 8. ServiceCIDR / PodCIDR

- `--service-cluster-ip-range=10.96.0.0/16` — Service 가 가져갈 IP 범위
- `--cluster-cidr=10.244.0.0/16` — Pod IP 범위 (CNI 가 이 범위에서 할당)

VPC CNI 는 `--cluster-cidr` 무시 — VPC subnet 에서 직접 가져옴.

설계 시 주의: 두 범위가 VPC/온프렘 사설 대역과 겹치면 라우팅 충돌. EKS 에서 secondary CIDR + custom networking 으로 회피.

## 9. NetworkPolicy 미리보기

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata: { name: deny-all-default, namespace: commerce }
spec:
  podSelector: {}        # 모든 Pod
  policyTypes: [Ingress, Egress]
```

이 한 개만 적용하면 namespace 의 모든 Pod 가 default-deny. 그 위에 allow 규칙을 추가하는 패턴.

자세한 NetworkPolicy 와 Gateway API 는 [06-ingress-gateway-api.md](06-ingress-gateway-api.md).

## 10. 면접 빈출 7

1. **"Service 의 ClusterIP 가 실제 어디 있어?"** → 어디에도 없다. 가상. iptables/IPVS/eBPF 의 NAT 룰일 뿐.
2. **"gRPC 가 LB 안 되는 이유?"** → §6 답변. Headless + client-side LB 또는 Mesh.
3. **"iptables vs IPVS 언제 바꿔?"** → Service 수가 1k 이상이거나 latency-critical 이면 IPVS 또는 eBPF.
4. **"NodePort 의 단점?"** → 노드 IP 노출, 포트 범위 제한, LB 없으면 한 노드 죽으면 traffic loss. 보통 Ingress 또는 LoadBalancer 앞단에 둠.
5. **"DNS 가 느린데 왜?"** → ndots:5 + search list 다중 조회. NodeLocal DNSCache 도입 또는 FQDN.
6. **"EndpointSlice 가 왜 도입됐어?"** → 큰 Service 의 watch 폭증 완화. 100개 단위 분할.
7. **"VPC CNI 의 단점?"** → 노드당 ENI 수 한계로 Pod 밀도 제한. prefix delegation 으로 완화 가능.

## 11. msa 매핑

- 현재 모든 Service 는 `ClusterIP`. Headless 는 `infra/local/{kafka,redis,clickhouse,opensearch,elasticsearch}-headless` (StatefulSet 용)
- gRPC 사용 안 함 (`#18 학습`에서 결정) — REST + Kafka 위주라 §6 함정 회피
- Lettuce Redis cluster 가 prod 의 Redis Operator 환경에서 standalone 으로 강제됨 (`patches/redis-standalone-*.yaml`) — 이게 #16 Async 학습에서 본 분기
- `kube-proxy` 모드는 EKS 의 경우 기본 iptables. 서비스 수 ~30개로 크지 않아 IPVS 전환 가치 미정 → [16-improvements.md](16-improvements.md) 에서 검토
- DNS: `dnsConfig.options ndots:1` 적용 흔적 없음 → 외부 호출 많은 charting 등은 검토 필요

다음: [06-ingress-gateway-api.md](06-ingress-gateway-api.md) — Ingress 의 한계, Gateway API 의 새 모델, NetworkPolicy 의 deny-default 패턴.
