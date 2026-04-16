---
id: 1
title: AWS 네트워크 인프라
status: draft
created: 2026-04-16
updated: 2026-04-16
tags: [aws, vpc, network, nat, alb, nlb, firewall, security-group]
difficulty: intermediate
estimated-hours: 12
codebase-relevant: true
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

### Phase 3: 실전 적용

- 현재 msa 프로젝트의 k8s Ingress → ALB 매핑 분석
- k8s Service type (ClusterIP, NodePort, LoadBalancer) → AWS 네트워크 매핑
- prod-k8s overlay의 네트워크 관련 설정 분석
- 현재 인프라의 보안 그룹 / 네트워크 정책 패턴

### Phase 4: 면접 대비

- "VPC 설계해보세요" 시스템 설계 질문 대비
- ALB vs NLB 선택 근거 질문
- 보안 그룹 vs NACL 차이 및 적용 시나리오
- NAT Gateway 비용 문제 및 대안
- EKS에서 Pod 네트워크가 어떻게 동작하는지

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

- 학습 범위: 순수 AWS 네트워크만 vs EKS 네트워킹까지 포함?
- 깊이: 개념 이해 수준 vs Terraform/CDK로 직접 구성 실습까지?
- 면접 대비 비중: 전체 학습의 몇 %를 면접 Q&A에 할애할지?
- 시간 제약: 주당 투자 가능 시간?

## 8. 원본 메모

aws 인프라 환경에서 network / 방화벽 / nat / alb / nlb 등 스터디
