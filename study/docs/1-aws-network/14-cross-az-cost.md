---
parent: 1-aws-network
subtopic: cross-az-cost
index: 14
created: 2026-04-16
level: deep
---

# Cross-AZ 트래픽 비용 최적화 — Deep Study

## 1. 재확인

AZ 간 데이터 전송은 **양방향 GB 당 $0.01** 씩 부과. 대량 트래픽 환경에서 예상 외 큰 비용 발생. Kafka, RDS 동기 복제, LB 분산 등이 주요 원인.

## 2. 내부 메커니즘

### 2.1 AWS 트래픽 비용 구조

```
같은 AZ 내 트래픽         → 무료
Cross-AZ (같은 리전)      → 양방향 $0.01/GB  (보내는 쪽 + 받는 쪽)
Cross-Region             → $0.02 ~ $0.09/GB
Internet Egress (대부분)  → $0.09/GB (첫 1GB 무료)
```

**양방향** 이란: 10GB 전송 시 **보내는 $0.10 + 받는 $0.10 = $0.20** (사실상 2배).

### 2.2 Cross-AZ 가 숨어있는 곳

1. **Kafka Consumer Fetch**
   - 기본: Consumer 가 Leader Replica 에서만 읽음
   - Leader 가 다른 AZ 면 매 fetch 마다 Cross-AZ 트래픽
   - 대형 Kafka 클러스터에서 월 수백~수천 달러

2. **RDS Multi-AZ 동기 복제**
   - Primary(AZ-a) → Standby(AZ-b) 동기 복제
   - 쓰기 발생 시마다 Cross-AZ
   - 쓰기 부하 많은 서비스면 비용 큼

3. **ALB → Target (Cross-Zone LB 활성)**
   - ALB 가 모든 AZ 의 Target 에 균등 분배
   - 요청의 대부분이 다른 AZ 로 감
   - `enable_cross_zone_load_balancing = false` 로 비활성 가능

4. **ElastiCache Replica 복제**
   - Primary ↔ Replica 간
   - Cross-AZ 복제 트래픽

5. **EKS Pod 간 통신**
   - Pod 이 여러 AZ 에 분산 → 같은 Service 의 Pod 간 호출도 Cross-AZ

### 2.3 Topology Aware Routing (K8s)

- K8s 1.30+ `spec.trafficDistribution: PreferClose`
- Service 의 엔드포인트 중 **같은 AZ** 의 Pod 을 우선 선택
- 이전 버전의 `Topology Keys` 를 대체

### 2.4 Kafka Rack Awareness (KIP-392)

- Broker 에 `broker.rack=AZ명` 설정
- Consumer 가 같은 `rack` 의 Follower Replica 에서 읽기 가능 (fetch-from-follower)
- Cross-AZ 트래픽 대폭 감소

## 3. 설계 결정과 트레이드오프

### 3.1 최적화 4가지 접근

**1. Locality-aware Routing**
- K8s: `PreferClose` 활성화
- Kafka: `broker.rack` + `client.rack` + `fetch-from-follower`

**2. Cross-Zone LB 비활성**
- ALB `enable_cross_zone_load_balancing = false`
- 같은 AZ 의 Target 만 분배
- **단점**: 부하 균등성 저하 (AZ 별 Target 수가 다르면 불균형)

**3. 단일 AZ 집중 (HA 포기)**
- 비용 극우선일 때
- 개발/스테이징 환경에 적합
- 프로덕션은 권장 안 함

**4. Replica 토폴로지 최적화**
- RDS: Read Replica 를 같은 AZ 에 두기 (Write 는 어쩔 수 없이 Cross-AZ)
- ElastiCache: Cluster Mode 로 샤딩 + 로컬 읽기

### 3.2 모니터링

**VPC Flow Logs** → Athena 쿼리로 AZ 간 트래픽 분석:

```sql
SELECT 
  srcaddr, dstaddr,
  sum(bytes) as total_bytes
FROM vpc_flow_logs
WHERE ...
GROUP BY srcaddr, dstaddr
ORDER BY total_bytes DESC
LIMIT 100
```

CloudWatch 로 **Data Transfer 비용** 지속 관찰.

### 3.3 비용 vs HA 트레이드오프

| 전략 | Cross-AZ 비용 | HA | 권장 |
|---|---|---|---|
| 단일 AZ | **$0** | X | 개발만 |
| 멀티 AZ + Cross-Zone LB on | 높음 | O | 기본 |
| 멀티 AZ + Cross-Zone LB off | 낮음 | O | 일반 |
| 멀티 AZ + Topology Aware | 최저 | O | **최적** |

## 4. 실제 코드/msa 연결

### 4.1 K8s Topology Aware Routing

```yaml
apiVersion: v1
kind: Service
metadata:
  name: product
spec:
  selector:
    app: product
  ports:
  - port: 8080
  trafficDistribution: PreferClose  # K8s 1.30+
```

### 4.2 Kafka Rack Awareness

**Broker 설정** (`server.properties`):
```
broker.rack=ap-northeast-2a
```

**Consumer 설정**:
```
client.rack=ap-northeast-2a
replica.selector.class=org.apache.kafka.common.replica.RackAwareReplicaSelector
```

### 4.3 ALB Cross-Zone 비활성

```hcl
resource "aws_lb" "this" {
  name                             = "commerce-alb"
  load_balancer_type               = "application"
  enable_cross_zone_load_balancing = false  # 기본은 true
  # ...
}
```

### 4.4 VPC Flow Logs

```hcl
resource "aws_flow_log" "this" {
  vpc_id          = aws_vpc.this.id
  traffic_type    = "ALL"
  log_destination = aws_s3_bucket.flow_logs.arn
  log_destination_type = "s3"
}
```

### 4.5 msa 프로젝트 관점

- Kafka 가 analytics, product, order 등에서 활발 사용
- EKS 이전 시 **Kafka rack awareness** 필수 적용
- `docs/architecture/kafka-convention.md` 에 rack 설정 추가 필요

## 5. 장애 시나리오 3개

### 시나리오 1: "월 청구서에 Data Transfer $2,000 폭증"

**증상**: 갑자기 Data Transfer 비용이 전월 대비 5배.

**진단**:
1. VPC Flow Logs 분석
2. Kafka Consumer 가 다른 AZ 의 Broker 에서 매일 TB 급 읽기
3. 최근 Kafka Consumer replica 증가로 트래픽 증폭

**해결**:
- Broker + Consumer 에 rack awareness 적용 (fetch-from-follower)
- 이전 설정 복원 고려

### 시나리오 2: "ALB Cross-Zone 비활성 후 일부 Pod 과부하"

**증상**: Cross-Zone 비활성 했더니 AZ-a 의 Pod 만 과부하 발생.

**진단**: AZ-a 에 Pod 이 더 많이 배치되어 있었고, AZ-a 에서 오는 트래픽도 많음.

**해결**:
- **Pod 을 AZ 별 균등 배치** (`topologySpreadConstraints`)
- Cross-Zone 재활성 (비용 감수)
- Locality + 균등 배치 둘 다 맞추기

### 시나리오 3: "Topology Aware Routing 활성 후 응답 실패"

**증상**: `trafficDistribution: PreferClose` 적용 후 특정 AZ 의 트래픽만 실패.

**진단**: 해당 AZ 에 healthy Pod 이 0개. PreferClose 는 **선호**지 엄격 제한은 아니지만 K8s 버전에 따라 동작 차이.

**해결**:
- 모든 AZ 에 최소 1개 Pod 확보 (`topologySpreadConstraints` + `minReadySeconds`)
- 또는 AZ 별 HPA 하한 설정

## 6. 면접 꼬리 질문 트리

```
Q14: Cross-AZ 트래픽 비용을 들어봤나요?
├── Q14-1: 얼마인가요?
│   └── Q14-1-1: 양방향이라는 게 무슨 뜻?
├── Q14-2: 어디서 숨어있나요?
│   └── Q14-2-1: Kafka 에서 특히 문제되는 이유?
│       └── Q14-2-1-1: fetch-from-follower 가 해결책인가요?
└── Q14-3: 최적화 방법 중 가장 효과적인 건?
    └── Q14-3-1: Topology Aware Routing 이 뭔가요?
```

**Q14 답변**: AZ 간 데이터 전송은 양방향 GB 당 $0.01. 대규모 환경에서 월 수백~수천 달러 발생 가능. Kafka, RDS, ALB 등이 주요 원인.

**Q14-1-1 답변**: 보내는 쪽 + 받는 쪽 **둘 다 과금**. 10GB 전송 → $0.20. 일방적 Ingress/Egress 로 이해하면 실제 계산이 틀림.

**Q14-2-1-1 답변**: KIP-392 — Consumer 가 같은 AZ 의 **Follower Replica** 에서 읽기 가능. 기본은 Leader 만 읽어서 Leader 가 다른 AZ 면 Cross-AZ 지속. rack-awareness + `RackAwareReplicaSelector` 조합으로 트래픽 대폭 감소.

**Q14-3-1 답변**: K8s Service 가 엔드포인트 중 **같은 AZ** 의 Pod 를 우선 선택. `trafficDistribution: PreferClose` (K8s 1.30+) 로 선언적 활성화. Cross-AZ 호출 최소화.

## 7. 함정 질문 / 오해 포인트

| 오해 | 실제 |
|---|---|
| "Cross-AZ 트래픽은 무료" | **$0.01/GB 양방향** |
| "같은 VPC 면 트래픽 무료" | VPC 내부여도 AZ 가 다르면 과금 |
| "ALB Cross-Zone 비활성이 무조건 좋음" | 부하 불균형 발생 가능 |
| "Kafka rack awareness 가 모든 걸 해결" | Consumer + Broker 둘 다 설정 필요 |
| "Topology Aware = 엄격 제한" | **선호** (fallback 있음) |

## 8. 자가 점검 체크리스트

- [ ] Cross-AZ 단가 ($0.01/GB 양방향) 암기
- [ ] 4가지 주요 Cross-AZ 발생 지점 나열
- [ ] K8s Topology Aware Routing 개념 + 적용 방법
- [ ] Kafka rack awareness + fetch-from-follower 이해
- [ ] VPC Flow Logs 활용 방법
- [ ] ALB Cross-Zone LB 기본값 + 비활성 트레이드오프
- [ ] RDS Multi-AZ 복제의 Cross-AZ 비용 인지
- [ ] Cross-Region vs Cross-AZ 비용 차이
- [ ] topologySpreadConstraints 의 역할
- [ ] 비용 모니터링 전략 (Athena/CloudWatch)

## 9. 참고 자료

- AWS Data Transfer 비용 문서
- KIP-392 (Allow consumers to fetch from closest replica)
- K8s Topology Aware Routing 공식 문서
- "Reducing AWS Data Transfer Costs" 블로그
