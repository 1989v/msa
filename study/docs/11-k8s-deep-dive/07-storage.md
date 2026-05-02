---
parent: 11-k8s-deep-dive
seq: 07
title: Storage — PV / PVC / StorageClass / CSI / StatefulSet
type: deep
created: 2026-05-01
---

# 07. Storage 심화

## 1. 한 장 모델

```
[user]                                       [admin / cloud-provider]
 PVC                                          StorageClass
  │ (요구: 10Gi RWO, gp3)                       │ (provisioner, params, reclaimPolicy)
  ▼                                              ▼
controller-manager 의 PV controller ── 동적 프로비저닝 ──► CSI driver ── EBS volume 생성
  │
  │ PVC ↔ PV bind
  ▼
PV (volumeName=pvc-abc, capacity=10Gi)
  │
  ▼
kubelet → CSI ControllerPublishVolume → AttachToNode → NodePublishVolume → mount
```

핵심 어휘:
- **PV (PersistentVolume)** — 클러스터 레벨 볼륨 객체 (실제 EBS / NFS / ...)
- **PVC (PersistentVolumeClaim)** — namespace 의 "10Gi RWO 주세요" 요청
- **StorageClass** — 동적 프로비저닝 템플릿 (provisioner = CSI driver)
- **CSI** (Container Storage Interface) — 표준 스토리지 plugin 인터페이스
- **AccessModes** — RWO / ROX / **RWX** / RWOP

## 2. AccessModes

| 모드 | 의미 | 대표 |
|---|---|---|
| `ReadWriteOnce` (RWO) | 단일 노드에서 R/W | EBS, GP-PD, local SSD |
| `ReadOnlyMany` (ROX) | 여러 노드에서 R | 거의 안 씀 |
| `ReadWriteMany` (RWX) | 여러 노드에서 R/W | EFS, NFS, CephFS |
| `ReadWriteOncePod` (RWOP) | 단일 Pod 만 (1.22+) | 진짜 단일 점유 강제 |

**RWX 가 필요한 상황은 보통 좋은 설계가 아니다** — 대부분 RWO + S3 같은 객체 스토리지로 우회. msa 도 RWX 사용 안 함.

## 3. StorageClass — 동적 프로비저닝의 핵심

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
reclaimPolicy: Delete
allowVolumeExpansion: true
```

### 핵심 필드

- **`provisioner`** — 어떤 CSI driver 가 처리할 것인가
- **`parameters`** — driver 별 옵션 (EBS gp3 / IOPS / 암호화)
- **`volumeBindingMode`**:
  - `Immediate` — PVC 만들면 즉시 PV 생성
  - **`WaitForFirstConsumer`** — Pod 가 스케줄될 때까지 PV 생성 보류 → 같은 zone 에 생성 (멀티-AZ EBS 함정 회피). **표준 권장**.
- **`reclaimPolicy`**:
  - `Delete` — PVC 삭제 시 실제 볼륨도 삭제 (개발/임시)
  - `Retain` — 볼륨 보존 (운영 DB 권장 — 실수 보호)
- **`allowVolumeExpansion: true`** — `kubectl edit pvc` 로 용량 증설 가능 (driver 지원 필수)

### msa 권장 매핑

| 환경 | StorageClass | reclaimPolicy |
|---|---|---|
| k3s-lite | `local-path` (기본) | Delete |
| EKS prod | `gp3` (EBS) | **Retain** (DB 류) |
| GKE prod | `pd-ssd` | Retain |

DB 의 reclaimPolicy 는 Retain 강제. 실수로 PVC 삭제해도 PV 와 볼륨이 남아 복구 가능.

## 4. CSI 의 역할

CSI driver = "K8s 와 외부 스토리지 시스템 사이 어댑터". 표준 인터페이스라 EBS/Cinder/Ceph/등이 모두 같은 모양.

### CSI 컴포넌트 3개

```
[Controller Plugin]   ── StatefulSet, namespace=kube-system
  - CreateVolume / DeleteVolume
  - ControllerPublishVolume (= AWS EBS Attach)
  - CreateSnapshot / DeleteSnapshot
  
[Node Plugin]         ── DaemonSet, 모든 워커 노드
  - NodeStageVolume   (포맷 + 호스트 mount)
  - NodePublishVolume (Pod ns 안으로 bind mount)
  
[CSI Sidecars]        ── 표준 K8s sidecar 컨테이너들
  - external-provisioner  → PVC watch → Controller.CreateVolume
  - external-attacher     → VolumeAttachment watch
  - external-resizer      → PVC capacity 변경 watch
  - external-snapshotter  → VolumeSnapshot CRD
```

### Snapshot

```yaml
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata: { name: mysql-2026-05-01 }
spec:
  volumeSnapshotClassName: csi-aws-vsc
  source:
    persistentVolumeClaimName: data-mysql-0
```

→ EBS Snapshot 생성 → 이걸 dataSource 로 새 PVC 만들면 복원. msa 의 백업 (`k8s/infra/prod/backup/`) 은 XtraBackup 기반 + binlog PITR 이라 CSI Snapshot 과 별개 — 둘이 중복이 아니라 보완 (XtraBackup 은 일관성 있는 dump, Snapshot 은 빠른 클러스터 복제).

## 5. StatefulSet 과 PVC

`volumeClaimTemplates` 는 StatefulSet 만의 무기:

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata: { name: redis }
spec:
  serviceName: redis-headless
  replicas: 3
  template: ...
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: gp3
        resources: { requests: { storage: 20Gi } }
```

→ Pod `redis-0` 이 시작될 때 PVC `data-redis-0` 자동 생성, `redis-1` 시작 시 `data-redis-1` 생성, ...

PVC 이름 규칙: `<volumeClaimTemplate.name>-<sts.name>-<ordinal>`.

특징:
- **scale up** → 새 PVC 생성
- **scale down** → PVC **유지** (실수 보호). 수동 삭제 필요.
- **Pod 재기동** → 같은 ordinal 의 PVC 재mount → 데이터 보존
- **Pod 삭제 후 재생성** → 같은 PVC → 같은 데이터

이 보장이 RDB / Kafka / ES 의 운영 가능성을 만든다.

## 6. msa 의 StatefulSet 패턴

`k8s/infra/local/` 의 모든 인프라가 동일한 패턴:

```yaml
# k8s/infra/local/redis/statefulset.yaml
spec:
  serviceName: redis-headless
  replicas: 1
  ...
  volumeClaimTemplates:
    - metadata: { name: data }
      spec:
        accessModes: [ReadWriteOnce]
        resources: { requests: { storage: 1Gi } }
```

`storageClassName` 미지정 → 클러스터 기본 SC 사용 (k3d 의 `local-path`).

prod 는 Operator 들이 자체 PV 관리:
- Strimzi: `KafkaNodePool.spec.storage.type=persistent-claim, size: 20Gi`
- Percona: `PerconaServerMySQL.spec.mysql.volumeSpec.persistentVolumeClaim`
- ECK: `Elasticsearch.spec.nodeSets[].volumeClaimTemplates`

## 7. 흔한 함정 7가지

1. **Pod 가 Pending — PVC bound 인데 Pod 가 안 뜸**
   → `volumeBindingMode: Immediate` + 멀티-AZ. PVC 가 us-east-1a 에서 만들어졌는데 스케줄러가 us-east-1b 노드를 골라 attach 실패. **WaitForFirstConsumer** 가 표준.
2. **PVC 삭제 후 PV 가 Released 상태로 남음**
   → reclaimPolicy=Retain. 다른 PVC 가 이걸 못 잡음. 명시적 PV.spec.claimRef 정리 또는 새 PV 생성.
3. **`kubectl delete sts redis`** 만 하면 PVC 가 안 지워짐
   → SS 삭제 시 PVC 보존이 의도된 동작. 데이터 폐기까지 원하면 `kubectl delete pvc -l app=redis`. 1.27+ 의 `whenDeleted/whenScaled` 정책으로 자동화 가능.
4. **`local-path` SC 의 데이터가 사라짐**
   → 노드의 hostPath. 노드가 죽거나 PV 가 다른 노드로 갈 수 없음. 단일 노드 전용.
5. **EBS Snapshot 의 cross-region 복제**
   → CSI Snapshot 자체는 같은 region. 외부 스크립트로 copy 또는 AWS Backup.
6. **RWX 필요해서 EFS 선택했는데 비싸고 느림**
   → POSIX 가 진짜 필요한가? 객체 스토리지(S3) + presigned URL 로 우회 가능한지 점검.
7. **`volumeMode: Filesystem` 기본 vs `Block`**
   → Filesystem 이 99%. Block 은 DB 가 raw block 다루고 싶을 때 (Percona, Cassandra 일부 advanced).

## 8. CSI 의 발전 — Generic Ephemeral Volume

```yaml
spec:
  containers:
    - volumeMounts: [{ name: scratch, mountPath: /scratch }]
  volumes:
    - name: scratch
      ephemeral:
        volumeClaimTemplate:
          spec:
            accessModes: [ReadWriteOnce]
            resources: { requests: { storage: 1Gi } }
            storageClassName: gp3
```

Pod 와 함께 만들어지고, Pod 삭제 시 사라지는 PVC. emptyDir 의 큰 버전.

## 9. 백업 / DR 전략 (msa 기준)

ADR-0019 §7 에서 결정된 2단계:

1. **Phase 5 (현재)** — `docker/backup/` 셸 스크립트(XtraBackup + binlog) 를 Dockerfile 로 패키징 → `CronJob` + PVC mount. 자세한 구조는 `k8s/infra/prod/backup/` 폴더 참조.
2. **Phase 후속** — Percona Operator 의 `BackupSchedule` CR 로 리팩터.

CSI Snapshot 은 **빠른 PoC/QA 환경 클론** 용도로 별도 활용 가치. 운영 DR 의 SSOT 는 XtraBackup + binlog 가 유지.

```
                ┌───────────────────────────────┐
                │  CronJob (binlog every 10min) │
                │     ↓                          │
                │  PVC: backup-storage          │
                │     ↓                          │
                │  storage-providers/ → S3      │
                └───────────────────────────────┘
                ┌───────────────────────────────┐
                │  CronJob (full daily 03:00)   │
                │     ↓                          │
                │  PVC: backup-storage          │
                │     ↓                          │
                │  storage-providers/ → S3      │
                └───────────────────────────────┘
```

`docker/backup/storage-providers/` 의 S3/GCS/Local 플러그인 패턴이 여기서 그대로 재사용된다 (ADR-0019 §7 + `k8s/infra/prod/backup/README.md`).

## 10. 면접 빈출 5

1. **"PV 와 PVC 차이?"** → PV 는 클러스터 자원 (관리자/CSI 가 만듦). PVC 는 namespace 단위 요청 (개발자가 만듦). 둘이 매칭(bound) 되어야 사용.
2. **"StorageClass 의 `WaitForFirstConsumer` 가 왜 필요?"** → 멀티 AZ 클러스터에서 EBS 는 한 zone 에 묶임. Pod 스케줄될 때까지 기다렸다가 같은 zone 에 PV 생성 → attach 실패 회피.
3. **"StatefulSet 의 PVC 는 scale down 시 어떻게 되나?"** → 보존. 실수 방지 + 다시 scale up 시 같은 데이터. 폐기는 명시적으로.
4. **"CSI 의 Controller 와 Node plugin 차이?"** → Controller 는 클라우드 API (Create/Attach), Node 는 노드 OS (mount). 분리되어 권한 최소화.
5. **"Snapshot 으로 DB 복원은 안전?"** → CSI snapshot 은 application-consistent 가 아님 (file-system level). MySQL/PG 는 quiesce 또는 XtraBackup 같은 도구 필요. ES/Kafka 는 자체 snapshot/replication 우선.

## 11. msa 매핑 요약

- **k3s-lite**: `local-path` SC, 모든 PVC 1Gi 단위, reclaim=Delete (개발 편의)
- **prod-k8s**: 클라우드 SC (gp3 / pd-ssd), Operator 가 PVC 관리, reclaim=Retain 권장
- **백업**: `k8s/infra/prod/backup/` 의 CronJob + PVC + S3 storage-provider 패턴
- **개선 후보** (16번 글에서 다룰 것):
  - `BackupPolicy` Operator 도입으로 서비스별 RTO/RPO 정책 표준화
  - PVC `Retain` 명시 (현재 SC 의존 — 상속 정책 명시 가치)
  - VolumeSnapshot 으로 staging 환경 클론 PoC

다음: [08-scheduling.md](08-scheduling.md) — Affinity / Taint / Toleration / PDB / Topology Spread.
