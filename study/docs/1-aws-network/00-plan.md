---
id: 1
title: AWS 네트워크 인프라
status: completed
created: 2026-04-16
updated: 2026-04-16
tags: [aws, vpc, network, nat, alb, nlb, firewall, security-group]
difficulty: intermediate-to-advanced
estimated-hours: 35
codebase-relevant: true
learner-level: basic
---

# AWS 네트워크 인프라

## 1. 개요

AWS 환경에서 서비스를 운영하기 위한 네트워크 인프라 전반을 학습한다. VPC 설계부터 서브넷 분리, 보안 그룹/NACL을 통한 방화벽 구성, NAT Gateway를 통한 아웃바운드 트래픽 관리, ALB/NLB를 통한 로드 밸런싱까지 프로덕션 환경에서 필수적인 네트워크 아키텍처를 다룬다.

현재 msa 프로젝트가 K8s(k3d 로컬 / managed K8s 프로덕션) 기반으로 운영되고 있어, AWS managed K8s(EKS) 환경에서의 네트워크 설계와 직접적으로 연결된다.

## 2. 학습 목표

- VPC + 서브넷 설계를 직접 구성할 수 있다 (public/private 분리 근거 설명 가능)
- Security Group과 NACL의 차이를 설명하고 적절한 방화벽 규칙을 설계할 수 있다
- NAT Gateway의 동작 원리와 비용 구조를 이해하고 대안을 비교할 수 있다
- ALB와 NLB의 동작 레이어 차이를 설명하고 워크로드에 맞는 선택 근거를 제시할 수 있다
- EKS 환경에서 AWS 네트워크가 K8s 네트워킹과 어떻게 매핑되는지 설명할 수 있다
- 면접에서 "왜 이렇게 설계했는가?" 꼬리 질문에 트레이드오프 기반으로 답변할 수 있다

## 2.1 학습자 프로필

- **현재 수준**: 기초 (VPC/서브넷 개념은 들어봤지만 직접 설계 경험 없음, SG vs NACL 혼동)
- **학습 전략**: Phase 1 기본 개념을 꼼꼼하게 다지고 Phase 2 심화는 Phase 1 개념을 보강하는 수준으로 조정
- **스킵 가능 영역**: 없음 (모든 기본 개념을 처음부터 학습)

## 2.2 학습 범위

- **범위**: AWS 네트워크 + EKS 네트워킹 매핑까지 포함
- **근거**: 현재 msa 프로젝트가 K8s 기반이라 EKS 매핑 학습이 실무 연결과 면접 "왜 이 구조인가" 답변에 필수
- **Phase 2 EKS 영역**: VPC CNI 플러그인, Pod/Service 네트워킹, K8s Service type → AWS LB 매핑, Ingress Controller
- **Phase 3 집중 대상**: msa 프로젝트의 `k8s/overlays/prod-k8s/`, `k8s/base/frontend-ingress.yaml`, `k8s/infra/local/ingress-nginx/` 에서 AWS 네트워크 개념 대응 확인

## 2.3 면접 대비 비중

- **비중**: 높음 (~40%, 14h / 35h)
- **목표**: 이직/면접 임박 수준의 준비도
- **구성**:
  - 꼬리 질문 3단계 (Q → Q-1 → Q-1-1 → Q-1-1-1)
  - 함정 질문 / 오해 포인트 상세 정리
  - 시스템 설계 시나리오 2-3개 (예: "멀티 리전 고가용 웹 서비스 VPC 설계", "프라이빗 EKS 클러스터 네트워킹")
  - 실무 경험 연결 스토리 (Phase 3-4 기반 "저는 이 프로젝트에서 ~" 답변)
  - 면접 시뮬레이션용 Q&A 카드

## 2.4 면접 컨텍스트

- **대상**: 한국 대기업/중견 (네카라쿠배 등)
- **면접 특성**: 정형화된 기술 면접, CS 기반 깊이 질문, "왜?" 꼬리물기
- **답변 언어**: 한국어
- **우선순위**:
  - CS 기초 연결 (OSI/TCP 레이어, 라우팅 원리 → AWS 네트워크 서비스로 매핑)
  - "왜?" 꼬리 질문 대응 (3단계까지)
  - 실무 경험 연결 (msa 프로젝트 k8s 설정 기반 스토리)
- **비중 조정**: 시스템 설계 시나리오는 간략하게 (1-2개), CS 기초 + 꼬리 질문 트리에 비중 확대

## 2.5 시간 제약

- **주당 투자 가능**: 15-20시간 (평일 2-3h + 주말 집중)
- **예상 완료**: 2주 (35h / ~17h/주)
- **페이스**: 집중 스터디 — 각 Phase 간 interval 최소화하여 기억 유지

## 2.6 출력 형태

- **복합 출력**: 노트 + Q&A 카드 + 핵심 요약 치트시트
- **Phase 1-4**: 서사형 노트 중심 (개념 설명 + 다이어그램 텍스트 + Terraform 예제)
- **Phase 5**: Q&A 카드 형식 (면접 대비 직접 활용 가능)
- **각 Phase 끝**: 1-페이지 치트시트 (용어 표, 명령어 표, 비교표, 결정 트리)
- **목적**: 학습 과정 기록 + 면접 직전 빠른 복기 + 실무 참고 모두 커버

## 2.7 학습 깊이

- **방식**: 개념 + Terraform 실습 (CDK는 개념 비교만)
- **IaC 도구**: Terraform (HCL) — 업계 표준, 멀티 클라우드 지원, 면접 우대
- **CDK 처리**: Phase 2 심화에서 "Terraform vs CDK 차이" 를 개념 레벨로 학습 (Construct/Stack 개념, CloudFormation 연계, 언제 CDK 가 유리한지)
- **실습 범위 (예정)**:
  - VPC + 서브넷 + IGW + Route Table 모듈 작성
  - Security Group / NACL 규칙 정의
  - NAT Gateway 배치
  - ALB + Target Group + Listener 규칙
  - (선택) EKS cluster + VPC CNI 설정
- **근거**: 기초 레벨이지만 면접/실무에서 "구성해본 적 있나요?" 질문에 IaC 실습으로 답변 가능
- **예상 시간**: 35h (IaC 학습 오버헤드 포함)

## 3. 선수 지식

- OSI 7계층 기본 이해 (L4 vs L7 구분)
- TCP/IP 기초 (IP 주소, CIDR, 포트, 라우팅)
- K8s Service/Ingress 개념 (현재 프로젝트에서 이미 사용 중)
- 기본적인 리눅스 네트워킹 (iptables, route table 개념)

## 4. 학습 로드맵

### Phase 1: 기본 개념

- **VPC (Virtual Private Cloud)**: 논리적 네트워크 격리, CIDR 블록 설계
- **서브넷**: public vs private 서브넷, AZ별 배치 전략
- **인터넷 게이트웨이 (IGW)**: VPC의 인터넷 연결 지점
- **라우트 테이블**: 서브넷별 라우팅 규칙, 기본 경로(0.0.0.0/0)
- **Security Group**: 상태 기반(stateful) 방화벽, 인바운드/아웃바운드 규칙
- **NACL (Network ACL)**: 상태 비기반(stateless) 서브넷 레벨 방화벽
- **NAT Gateway**: private 서브넷의 아웃바운드 인터넷 접근
- **Elastic IP**: 고정 IP 할당과 사용 시나리오
- **ALB (Application Load Balancer)**: L7 로드밸런서, 경로 기반 라우팅
- **NLB (Network Load Balancer)**: L4 로드밸런서, 고성능/저지연

### Phase 2: 심화

- **VPC Peering vs Transit Gateway**: 멀티 VPC 연결 전략, 비용/복잡도 트레이드오프
- **VPC Endpoint (Gateway / Interface)**: S3, DynamoDB 등 AWS 서비스 프라이빗 접근
- **NAT Gateway 비용 최적화**: NAT Instance 대안, VPC Endpoint로 트래픽 우회
- **ALB vs NLB 심화 비교**: 지연 시간, WebSocket, gRPC, IP 보존, 비용
- **AWS WAF + Shield**: ALB 연동 보안 레이어
- **Cross-AZ 트래픽 비용**: AZ 간 데이터 전송 비용 구조와 최적화
- **EKS 네트워킹**: VPC CNI 플러그인, Pod 네트워킹, Service → ALB/NLB 매핑
- **PrivateLink**: 서비스 간 프라이빗 연결, SaaS 연동
- **DNS (Route 53)**: VPC 내부 DNS, private hosted zone, 서비스 디스커버리

### Phase 3: 코드베이스 탐색 + Terraform 실습

**3a. 코드베이스 탐색**
- 현재 msa 프로젝트의 k8s Ingress → ALB 매핑 분석
- k8s Service type (ClusterIP, NodePort, LoadBalancer) → AWS 네트워크 매핑
- `k8s/overlays/prod-k8s/` overlay의 네트워크 관련 설정 분석
- `k8s/infra/local/ingress-nginx/` 로컬 Ingress 컨트롤러 패턴
- `gateway/` 서비스의 K8s DNS 라우팅 구조

**3b. Terraform 실습**
- VPC + 서브넷 + IGW + Route Table 모듈 작성
- Security Group / NACL 규칙 정의 (msa 프로젝트의 서비스 간 통신 기준)
- NAT Gateway 배치 + Elastic IP
- ALB + Target Group + Listener 규칙 (path 기반 라우팅)
- EKS cluster + VPC CNI 설정 (최소 구성)
- (선택) `terraform plan` / `terraform apply` 실행하여 실제 AWS 리소스 생성/삭제

### Phase 4: 적용 포인트 분석

- msa 프로젝트가 실제 EKS 로 배포된다면 어디에 무엇이 필요한지
- 현재 Kustomize overlay 와 Terraform 조합 제안
- 네트워크 비용 최적화 포인트 (Cross-AZ 트래픽, NAT Gateway 대안)
- 미적용 베스트 프랙티스 식별 (VPC Endpoint, PrivateLink 등)

### Phase 5: 면접 대비 (한국 대기업/중견 기준)

**기본 Q&A 카드 (10+개)**
- "VPC와 서브넷을 설계해보세요"
- "ALB vs NLB 선택 근거"
- "Security Group vs NACL 차이 및 시나리오"
- "NAT Gateway 비용 문제와 대안"
- "EKS에서 Pod 네트워크가 어떻게 동작하는지"
- "Terraform vs CDK 차이 및 선택 근거"
- "Cross-AZ 트래픽 비용 최적화"
- "Public/Private 서브넷을 나누는 이유"

**꼬리 질문 트리 (3단계)**
- 각 기본 질문당 Q → Q-1 → Q-1-1 구조로 트리 확장

**함정 질문 / 오해 포인트**
- SG는 stateful, NACL은 stateless (흔한 혼동)
- NAT Gateway와 NAT Instance 차이
- ALB 의 "health check" 가 실제로 검증하는 범위
- VPC CNI 와 kubenet 의 차이

**시스템 설계 시나리오 (1-2개)**
- "멀티 AZ 고가용 웹 서비스 VPC 설계"
- "프라이빗 EKS 클러스터 + RDS 네트워킹"

**실무 경험 스토리**
- Phase 3 의 msa 프로젝트 분석을 "저는 이 프로젝트에서 ~ 했습니다" 답변으로 변환

## 5. 코드베이스 연관성

현재 msa 프로젝트에서 관련된 영역:

- **k8s/infra/**: Ingress 설정, Service manifest, NetworkPolicy (있다면)
- **k8s/overlays/prod-k8s/**: 프로덕션 K8s 네트워크 오버레이
- **k8s/base/frontend-ingress.yaml**: 프론트엔드 Ingress 라우팅 규칙
- **k8s/infra/local/ingress-nginx/**: 로컬 Ingress 컨트롤러 설정
- **gateway/**: API Gateway 서비스 (K8s DNS 라우팅)
- **docs/adr/ADR-0019**: K8s 전환 관련 네트워크 결정 사항

## 6. 참고 자료

- AWS VPC 공식 문서
- AWS EKS Best Practices Guide — Networking
- "Amazon VPC CNI plugin" 공식 문서

## 7. 미결 사항

없음. 모든 사항은 2026-04-16 브레인스토밍 세션에서 결정 (섹션 2.1-2.7 참조).

## 8. 원본 메모

aws 인프라 환경에서 network / 방화벽 / nat / alb / nlb 등 스터디
