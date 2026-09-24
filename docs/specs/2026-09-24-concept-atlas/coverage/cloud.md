# 클라우드 · 네트워크 인프라 — 커버리지 체크리스트

원천:
- study/docs/1-aws-network/ — 99-concept-catalog.md 와 본문 노트 01~21 (벤더 중립 이름으로 옮김, 제품 이름은 동의어)
- 볼트 system-resources-cheatsheet.md §07 (NetworkPolicy · 이그레스 차단)
- 레포 k8s/overlays/oci-arm (cloudflared · origin-lockdown) · k8s/base/network-policy · k8s/base/db-backup · .github/workflows/images.yml · ADR-0061
- 분야 표준 — 클라우드 3사 네트워킹 문서 공통 목차(VPC · 로드 밸런싱 · CDN · 사설 연결 · DNS 라우팅 · 멀티 리전 DR · 데이터 전송 비용)

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| cloud | 클라우드 · 네트워크 인프라 | 분야 표준 | placed |
| cloud-network-design | 사설 네트워크 설계 | 분야 표준 | placed |
| cloud-vpc | VPC (가상 사설 네트워크) | study/1 §01 VPC | placed |
| cloud-cidr-planning | CIDR 대역 계획 | study/1 §01 VPC | placed |
| cloud-subnet | 서브넷 | study/1 §02 서브넷 | placed |
| cloud-public-subnet | 퍼블릭 서브넷 | study/1 §02 서브넷 | placed |
| cloud-private-subnet | 프라이빗 서브넷 | study/1 §02 서브넷 | placed |
| cloud-ipam | IP 주소 관리 (IPAM) | study/1 §20 IPv6 · IPAM | placed |
| cloud-dual-stack | 듀얼 스택 · IPv6 전용 서브넷 | study/1 §20 IPv6 · IPAM | placed |
| cloud-static-public-ip | 고정 공인 IP | study/1 §08 EIP | placed |
| cloud-byoip | BYOIP (자체 IP 반입) | study/1 §08 EIP | placed |
| oci | Oracle Cloud Infrastructure | 레포 k8s · ADR-0061 | placed |
| cloud-cidr-overlap | CIDR 충돌 | study/1 §01 VPC | placed |
| cloud-ip-exhaustion | 서브넷 IP 고갈 | study/1 §02 서브넷 | placed |
| cloud-routing | 라우팅 · 인터넷 출입 | study/1 §04 라우팅 테이블 | placed |
| cloud-route-table | 라우팅 테이블 | study/1 §04 라우팅 테이블 | placed |
| cloud-internet-gateway | 인터넷 게이트웨이 | study/1 §03 IGW | placed |
| cloud-nat-gateway | NAT 게이트웨이 | study/1 §07 NAT GW | placed |
| cloud-egress-only-gateway | 이그레스 전용 게이트웨이 | study/1 §03 IGW | placed |
| cloud-snat-port-exhaustion | SNAT 포트 고갈 | study/1 §07 NAT GW | placed |
| cloud-traffic-filtering | 트래픽 통제 | 분야 표준 | placed |
| cloud-security-group | 보안 그룹 | study/1 §05 보안 그룹 | placed |
| cloud-sg-reference | 보안 그룹 참조 | study/1 §05 보안 그룹 | placed |
| cloud-network-acl | 네트워크 ACL | study/1 §06 NACL | placed |
| cloud-prefix-list | 프리픽스 목록 | study/1 카탈로그 §B | placed |
| cloud-network-firewall | 네트워크 방화벽 · IDS | study/1 카탈로그 §B | placed |
| cloud-waf | WAF (웹 애플리케이션 방화벽) | study/1 카탈로그 §B | placed |
| cloud-ddos-protection | DDoS 방어 | study/1 카탈로그 §B | placed |
| cloud-egress-control | 이그레스 통제 | study/1 §18 개선안 · 볼트 시스템 자원 §07 | placed |
| cloud-microsegmentation | 마이크로 세그멘테이션 · 네트워크 정책 | study/1 §18 개선안 · 볼트 시스템 자원 §07 | placed |
| cloud-origin-lockdown | 오리진 잠금 | 레포 k8s · ADR-0061 | placed |
| cloud-zero-trust-access | 제로 트러스트 접근 · 아웃바운드 터널 | 레포 k8s · ADR-0061 | placed |
| cloud-ddos-attack | DDoS 공격 | 분야 표준 | placed |
| cloud-load-balancing | 로드 밸런서 선택 · 구성 | 분야 표준 | placed |
| cloud-l4-load-balancer | L4 로드 밸런서 | study/1 §10 NLB | placed |
| cloud-l7-load-balancer | L7 로드 밸런서 | study/1 §09 ALB | placed |
| cloud-gateway-load-balancer | 게이트웨이 로드 밸런서 | study/1 카탈로그 §C | placed |
| cloud-lb-algorithm | 분배 알고리즘 | study/1 §09 ALB | placed |
| cloud-round-robin | 라운드 로빈 · 가중 라운드 로빈 | study/1 §09 ALB | placed |
| cloud-least-connections | 최소 연결 · 최소 대기 | study/1 §09 ALB | placed |
| cloud-cross-zone-lb | 교차 영역 분배 | study/1 §09 ALB | placed |
| cloud-connection-draining | 연결 드레이닝 | study/1 카탈로그 §C | placed |
| cloud-sticky-session | 세션 고정 | study/1 카탈로그 §C | placed |
| cloud-client-ip-preservation | 클라이언트 IP 보존 | study/1 §10 NLB | placed |
| cloud-hot-target | 대상 쏠림 | 분야 표준 | placed |
| cloud-edge-delivery | 엣지 전달 | 분야 표준 | placed |
| cloud-cdn | CDN | study/1 카탈로그 §C | placed |
| cloud-edge-caching | 엣지 캐시 키 · TTL | study/1 카탈로그 §C | placed |
| cloud-cache-purge | 캐시 무효화 (purge) | 레포 k8s · ADR-0061 | placed |
| cloud-origin-shield | 오리진 실드 · 계층형 캐시 | study/1 카탈로그 §C | placed |
| cloud-signed-url | 서명 URL · 서명 쿠키 | study/1 카탈로그 §C | placed |
| cloud-anycast-edge | 애니캐스트 엣지 가속 | study/1 카탈로그 §C | placed |
| cloud-edge-compute | 엣지 컴퓨팅 | 분야 표준 | placed |
| cloud-edge-stale-content | 엣지 캐시 잔존 | 레포 k8s · ADR-0061 | placed |
| cloud-private-connectivity | 사설 연결 | 분야 표준 | placed |
| cloud-vpc-peering | VPC 피어링 | study/1 §12 VPC 상호연결 | placed |
| cloud-transit-hub | 트랜짓 허브 | study/1 §12 VPC 상호연결 | placed |
| cloud-private-endpoint | 사설 엔드포인트 (인터페이스형) | study/1 §11 VPC 엔드포인트 | placed |
| cloud-gateway-endpoint | 게이트웨이 엔드포인트 (경로형) | study/1 §11 VPC 엔드포인트 | placed |
| cloud-endpoint-service | 엔드포인트 서비스 (제공자 측) | study/1 §12 VPC 상호연결 | placed |
| cloud-site-to-site-vpn | 사이트 간 VPN | study/1 카탈로그 §D | placed |
| cloud-dedicated-interconnect | 전용 회선 연결 | study/1 카탈로그 §D | placed |
| cloud-service-network | 관리형 서비스 네트워크 | study/1 §21 DNS · SG 심화 | placed |
| cloud-resource-sharing | 계정 간 네트워크 자원 공유 | study/1 카탈로그 §D | placed |
| cloud-non-transitive-routing | 비전이 라우팅 | study/1 §12 VPC 상호연결 | placed |
| cloud-dns-traffic | DNS 기반 트래픽 관리 | 분야 표준 | placed |
| cloud-private-dns-zone | 사설 DNS 영역 | study/1 §15 Route 53 | placed |
| cloud-split-horizon-dns | 스플릿 호라이즌 DNS | study/1 §21 DNS · SG 심화 | placed |
| cloud-hybrid-dns-resolver | 하이브리드 DNS 포워딩 | study/1 §21 DNS · SG 심화 | placed |
| cloud-dns-routing-policy | DNS 라우팅 정책 | study/1 §15 Route 53 | placed |
| cloud-weighted-dns | 가중치 라우팅 | study/1 §15 Route 53 | placed |
| cloud-latency-dns | 지연 기반 라우팅 | study/1 §15 Route 53 | placed |
| cloud-geo-dns | 지역 기반 라우팅 | study/1 §15 Route 53 | placed |
| cloud-failover-dns | DNS 장애 전환 | study/1 §15 Route 53 | placed |
| cloud-alias-record | 별칭 레코드 · CNAME 평탄화 | study/1 §15 Route 53 | placed |
| cloud-availability-design | 가용성 · 재해 복구 설계 | study/1 §19 면접 · 설계 | placed |
| cloud-multi-az | 멀티 AZ 배치 | study/1 §19 면접 · 설계 | placed |
| cloud-multi-region | 멀티 리전 배치 | 분야 표준 | placed |
| cloud-active-active | 액티브-액티브 | 분야 표준 | placed |
| cloud-active-passive | 액티브-패시브 | 분야 표준 | placed |
| cloud-dr-strategy | 재해 복구 전략 | 분야 표준 | placed |
| cloud-pilot-light | 파일럿 라이트 | 분야 표준 | placed |
| cloud-warm-standby | 웜 스탠바이 | 분야 표준 | placed |
| cloud-single-point-of-failure | 단일 장애 구역 의존 | study/1 §19 면접 · 설계 | placed |
| cloud-network-cost | 네트워크 비용 관리 | study/1 §14 영역 간 비용 | placed |
| cloud-topology-aware-routing | 토폴로지 인식 라우팅 | study/1 §14 영역 간 비용 | placed |
| cloud-data-transfer-cost | 데이터 전송 비용 | study/1 §14 영역 간 비용 | placed |
| cloud-cross-zone-traffic-cost | 영역 간 트래픽 비용 | study/1 §14 영역 간 비용 | placed |
| cloud-nat-processing-cost | NAT 처리 비용 | study/1 §07 NAT GW | placed |
| cloud-network-diagnostics | 네트워크 진단 | study/1 카탈로그 §F | placed |
| cloud-flow-logs | 플로 로그 | study/1 카탈로그 §F | placed |
| cloud-reachability-analysis | 도달성 분석 | study/1 카탈로그 §F | placed |
| cloud-traffic-mirroring | 트래픽 미러링 | study/1 카탈로그 §F | placed |
| cloud-glossary | 클라우드 네트워크 용어 사전 | 분야 표준 | placed |
| cloud-term-region | 리전 | study/1 §01 VPC | placed |
| cloud-term-availability-zone | 가용 영역 | study/1 §02 서브넷 | placed |
| cloud-term-edge-location | 엣지 거점 · 로컬 존 | study/1 카탈로그 §G | placed |
| cloud-term-stateful-stateless | 상태 추적 · 상태 비추적 필터 | study/1 §05 보안 그룹 | placed |
| cloud-term-target-group | 대상 그룹 | study/1 §09 ALB | placed |
| cloud-term-traffic-direction | 남북 · 동서 트래픽 | 분야 표준 | placed |
| cloud-term-origin | 오리진 | 분야 표준 | placed |
| health-check | 헬스 체크 · 대상 그룹 헬스 | study/1 §09 · §15 | excluded — owned by infrastructure — 로드 밸런서 · DNS 장애 전환이 USES 로 잇는다 |
| load-balancer | 로드 밸런서 (일반) | study/1 §09 | excluded — owned by infrastructure — 종류(L4 · L7 · GWLB)만 이 파일에 둔다 |
| api-gateway | 관리형 API 게이트웨이 | study/1 카탈로그 §C | excluded — owned by infrastructure |
| infra-rto | RTO | 분야 표준 | excluded — owned by infrastructure — cloud-dr-strategy 가 MEASURED_BY 로 잇는다 |
| infra-rpo | RPO | 분야 표준 | excluded — owned by infrastructure — cloud-dr-strategy 가 MEASURED_BY 로 잇는다 |
| infra-offsite-backup | 백업 · 복원 (오프사이트 사본) | 레포 k8s db-backup | excluded — owned by infrastructure — oci 가 IMPLEMENTS, cloud-dr-strategy 가 USES 로 잇는다 |
| infra-cni | VPC CNI · 대체 CNI (Calico · Cilium) | study/1 §13 · 카탈로그 §E | excluded — owned by infrastructure |
| cloud-prefix-delegation | Prefix Delegation | study/1 §13 | excluded — 벤더 한정 CNI 설정값 |
| cloud-pod-security-group | 파드 단위 보안 그룹 | study/1 §05 · §13 | excluded — 벤더 한정 기능 — 개념은 cloud-microsegmentation |
| cloud-lb-controller | AWS Load Balancer Controller | study/1 §09 · §13 | excluded — 벤더 한정 컨트롤러 — 개념은 cloud-l7-load-balancer |
| cloud-cluster-endpoint-access | 클러스터 API 엔드포인트 공개 · 사설 | study/1 §13 · §18 | excluded — owned by infrastructure |
| infra-kube-proxy | Service 타입 → LB 매핑 · kube-proxy | study/1 §13 | excluded — owned by infrastructure |
| infrastructure-as-code | Terraform · CDK | study/1 §16 | excluded — owned by infrastructure |
| service-mesh | 서비스 메시 (App Mesh · Istio) | study/1 카탈로그 §E | excluded — owned by distributed — cloud-service-network 가 USES 로 잇는다 |
| cloud-threat-detection | Macie · GuardDuty | study/1 카탈로그 §B | excluded — owned by security |
| cloud-audit-log | CloudTrail (네트워크 변경 감사) | study/1 카탈로그 §F | excluded — owned by observability |
| cloud-network-metrics | CloudWatch 네트워크 메트릭 | study/1 카탈로그 §F | excluded — owned by observability |
| net-alpn | ALPN (NLB TLS) | study/1 카탈로그 §C | excluded — owned by network |
| websocket | WebSocket · gRPC over ALB | study/1 카탈로그 §C | excluded — owned by network — 유휴 타임아웃은 cloud-l7-load-balancer 가 CAUSES 로 잇는다 |
| net-dhcp | DHCP options set | study/1 §21 | excluded — owned by network |
| cloud-vpc-dns-switches | enableDnsSupport · enableDnsHostnames | study/1 §21 | excluded — 벤더 한정 설정값 |
| cloud-wan | Cloud WAN | study/1 카탈로그 §D | excluded — 벤더 한정 제품 — 개념은 cloud-transit-hub |
| cloud-outposts | Outposts · Wavelength | study/1 카탈로그 §G | excluded — 벤더 한정 제품 — 개념은 cloud-term-edge-location |
| cloud-snowball | Snowball · Snowmobile | study/1 카탈로그 §G | excluded — 오프라인 데이터 이전 장비라 네트워크 개념이 아니다 |
| sec-origin-bypass | 엣지 우회 (오리진 직접 접근) | 레포 k8s · ADR-0061 | excluded — owned by security — cloud-origin-lockdown · cloud-zero-trust-access 가 MITIGATES 로 잇는다 |
| sec-bot-detection | 봇 관리 | 레포 k8s · ADR-0061 | excluded — owned by security — cloudflare 가 IMPLEMENTS 로 잇는다 |
| sec-ssrf | 메타데이터 엔드포인트 노출 (SSRF) | study/1 §18 · 분야 표준 | excluded — owned by security — cloud-egress-control 이 MITIGATES 로 잇는다 |
| cloudflare | Cloudflare | 레포 k8s | excluded — owned by network — 이 파일의 cloud-cdn · cloud-waf 등을 IMPLEMENTS 로 잇는다 |
