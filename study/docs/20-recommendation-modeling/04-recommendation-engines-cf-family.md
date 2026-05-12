---
parent: 20-recommendation-modeling
seq: 04
title: 추천 엔진 명명규칙 + CF 패밀리 카탈로그 — 산업 사례 매핑 (사용자 익숙 영역, 압축)
type: deep
created: 2026-05-12
---

# 04. 추천 엔진 명명규칙 + CF 패밀리 카탈로그

> **사용자 익숙 영역**. 본 파일은 산업 추천 엔진 카탈로그의 명명규칙을 §02-03 의 알고리즘에 매핑하는 역할. 명명규칙 자체의 deep 설명은 입력 자료 `study/notes/archive/2026-05-12-ota-추천엔진-카탈로그.md` 참조. 여기서는 학습 관점의 매핑 표 + 짚어둘 운영 발견만.

---

## 1. 명명규칙 핵심 표 (한눈에)

산업 (여행 OTA — Online Travel Agency, 온라인 여행사) 의 추천 엔진 카탈로그에서 굳어진 명명 패턴.

| 약어 | Full Name | 의미 | §02-03 매핑 |
|---|---|---|---|
| **vt** | View Together | 동시 조회 CF | Item-Item CF + Jaccard/Cosine/PMI |
| **st** | Search Together | 동시 검색 CF | Item-Item CF (검색어 기준) |
| **bt** | Buy Together | 동시 구매 CF | Item-Item CF (transactional, 가중치 강) |
| **ct** | City Together | 도시 페이지 액션 CF | Item-Item CF (도시 컨텍스트) |
| **cb** | Category Best | 도시×카테고리 인기 | 룰 기반 — 행동 가중합 (Phase 2 §05) |
| **rs** | Related Searches | 연관 검색어 | 검색어 co-occurrence (NLP) |
| **mr** | Meta Reference | 섹션 매핑 reference | 룰 기반 — meta DB |
| **sba** | Season Best Accommodation | 시즌 인기 숙소 | 룰 기반 — sliding window (Phase 4 §08) |
| **th** | Trip Home | 통합 score | 룰 기반 — weighted sum |
| **stb** | Section preference | 섹션 임프레션 기반 | 룰 기반 → MAB 후보 (Phase 4) |
| **lb** | Landmark Best | 랜드마크 인기 | 룰 기반 + Geo (Phase 3 §07) |
| **ldp** | Landmark Display Preference | 도시별 랜드마크 인기도 | 룰 기반 + Geo |
| **c2dp** | Category2 Default Preference | 도시×카테고리2 default | Cold-start fallback (Phase 7 §17) |
| **urb** | Urban | 도시×카테고리 CTR | 룰 기반 + CTR 강화 (Phase 2 §05) |
| **rc** | Rentcar | 렌터카 VT 변형 | Item-Item CF (도메인 특화) |
| **nero** | NER 서버 | 검색어 NER 인프라 | 추천 아님 (검색 보조) |

**한 줄 정리**: vt/st/bt/ct = 동시 행동 CF, cb/lb/sba/th = 룰 기반, mr/c2dp/stb = 메타/cold-start, urb = CTR 강화.

---

## 2. 접미사 의미

도메인 변형 표시. 동일 알고리즘을 다른 상품군에 적용.

| 접미사 | 의미 | 대표 활용 |
|---|---|---|
| `-acc` | 숙소 (accommodation) | vt-acc, st-acc, cb-acc |
| `-mi` | 민박 | vt-mi, cb-mi |
| `-pkg` | 패키지 상품 | vt-pkg, cb-pkg |
| `-com` | 커뮤니티 콘텐츠 | morelike-com, cb-com |
| `-vtf` | 항공 cross-sell 용 VT (View Together for Flight) | vtf, vtf-cp, cb-vtf |
| `-cp` | cross-product 집계 | vtf-cp |
| `-deep` | 딥러닝 버전 | vt-deep (14종 모델 — Phase 6) |

**관찰**: 접미사가 **알고리즘 차이가 아니라 도메인 차이** 를 표시. 같은 vt 알고리즘이 일반 투어 vs 숙소 vs 민박 vs 패키지에 따라 데이터 소스와 파라미터만 다름.

---

## 3. CF 패밀리 알고리즘 매핑

§02 (유사도 메트릭) 와 §03 (Matrix Factorization) 의 알고리즘이 산업에서 어떻게 적용되는지:

### 3-1. 동시 행동 CF 패밀리 — Scala Spark Dataproc

| 엔진 | 시그널 강도 | 데이터 소스 | 산업 표준 메트릭 |
|---|---|---|---|
| **vt (View Together)** | 약함 (implicit) | 페이지뷰 로그 | PMI/PPMI (popular item bias 회피) |
| **st (Search Together)** | 약함 (implicit) | 검색 로그 | Jaccard (단순 집합) 또는 PMI |
| **bt (Buy Together)** | **가장 강함** (transactional) | 구매 로그 | Cosine (transactional 은 sparse 가 적음) |
| **ct (City Together)** | 중간 (context-aware) | 도시 페이지 액션 | 도메인별 가중 PMI |

**핵심 매핑**:
- 모두 **Item-Item CF** (§02 §2-1 — 사용자 수 > 아이템 수, item similarity 안정적)
- 산출물은 **item × item similarity matrix** → Redis 또는 Bigtable 에 캐시
- 실시간 추천 시: 사용자 행동 이력 → 각 아이템의 top similar 룩업 → 합산

### 3-2. 딥러닝 패밀리 (vt-deep)

`vt-deep` 은 14종 딥러닝 모델의 묶음. 산업에서 흔히 라인업되는 모델:
- **Wide & Deep** (Google 2016) — Phase 6 §12
- **Two-Tower / DNN candidate generation** (YouTube 2016/2019) — Phase 6 §13
- **DLRM** (Meta 2019) — Phase 6 §14
- **Tab-Transformer** (Amazon 2020) — Phase 6 §15
- 그 외: DeepFM, xDeepFM, DCN-v2, AutoInt, NCF (Neural Collaborative Filtering) 등 변형

> **vt-deep 14종의 정확한 라인업** 은 Phase 6 §16 (toy training) 에서 사용자 본인이 코드 직접 확인 후 일반 산업 패밀리에 매핑한다.

### 3-3. 룰 기반 패밀리 — Pure BigQuery + Airflow DAG

| 엔진 | 본질 | Phase 2 §05 와의 매핑 |
|---|---|---|
| **cb / cb2 / cb-***| 행동 가중합 (`reservation×100 + click×20 + addwish×10 + pageview×1`) | 직접 매핑 |
| **urb** | 월간 CTR 피처 기반 cb 변형 | 동적 가중치 (dynamic action weight) |
| **lb / ldp** | 행동 가중합 + 랜드마크 컨텍스트 | dynamic weight + Geo |
| **th** | TNA + 통합 숙박 풀 통합 랭킹 | 다중 source weighted sum |
| **sba** | 예약일 ±7일 sliding window | 시즌성 윈도우 (Phase 4 §08) |
| **ctr-best** | 중기 CTR 피처 기준 도시×product_type Top-N | CTR 기반 ranking |
| **resale-best** | 재구매 사용자 수 기반 | loyalty 시그널 |

**핵심**: 룰 기반은 산업에서 **production 의 75%+** 를 차지한다 — 단순하고 운영 가능하고 cold-start 안전망. 딥러닝 추천을 도입해도 룰 기반은 fallback 으로 유지된다.

### 3-4. NLP 임베딩 패밀리 — Python 추론 워크로드

| 엔진 | 알고리즘 | Phase 5 매핑 |
|---|---|---|
| **morelike-com / morelike-offer** | Sentence-BERT (KoBERT / Electra / RoBERTa / BART) 임베딩 + cosine | §09, §11 |
| **rs (Related Searches)** | 형태소 분석 + search_term co-occurrence | NLP CF 변형 |

**관찰**: morelike-com 과 morelike-offer 의 `src/morelike/main.py` 가 **동일** — 운영상 DAG 만 분리. **GitOps 패턴의 흔한 안티패턴** (코드 중복) 이지만 도메인별 모니터링 분리에는 유효.

### 3-5. 메타 / 보정 패밀리

| 엔진 | 역할 | Phase 7 §17 매핑 |
|---|---|---|
| **mr** | 섹션 매핑 reference DB (home / main_ / xsell) | 메타 |
| **c2dp** | 도시×카테고리2 default preference | cold-start fallback |
| **union-stay-score** | 통합 숙박 풀 점수 부스팅 | business rule injection |

---

## 4. 빌드/배포 패턴 — 4종

산업 추천 엔진의 빌드/배포 패턴 4종 (사용자 익숙 영역, 비교 표만):

| 패턴 | 사용 엔진 | 인프라 | 특징 |
|---|---|---|---|
| **Scala 2.11 + Spark 2.4.4 Dataproc** | bt, ct, rc, rs, sba, season-best-tna, st, st-acc, vt, vt-acc, vt-mi, vt-pkg, vtf | GCP Dataproc | 대규모 CF 잡. ALS / co-occurrence 계산 |
| **Pure BigQuery + Airflow DAG** | c2dp, cb*, cross-nearby, ctr-best, lb, ldp, long-stay-nearby, mr, nearby-products, nearby-tna, resale-best, stb, th, union-stay-score, urb, vtf-cp | BigQuery + Airflow | 룰 기반 + 피처 score. SQL 만으로 표현 가능한 것 |
| **Python 추론 워크로드 (딥러닝)** | vt-deep, morelike-com, morelike-offer | AWS GPU (p2/g5) | TensorFlow / PyTorch. 학습 → 임베딩 export |
| **Python Flask 서비스** | nero | AWS GPU AMI, 6060 포트 | KLUE-BERT NER 추론. Flask + waitress |

**산업 관찰**:
- 빠른 ROI (Return on Investment) → BigQuery + Airflow 패턴 (룰 기반, SQL 만)
- 정밀 추천 → Spark Dataproc (CF, MF)
- 차세대 → Python 딥러닝 (Two-Tower, DLRM)
- 보조 인프라 → Python Flask (NLP NER, 임베딩 서빙)

배포 sync: 모든 엔진의 `cloudbuild-dags.yaml` 이 동일하게 Airflow 워크플로 레포로 SQL/DAG 자동 sync — **GitOps 패턴** (#11 K8s GitOps 와 cross-ref).

---

## 5. 짚어둘 운영 발견 (잡학)

산업 카탈로그에서 학습 가치 있는 운영 패턴 / 안티패턴:

### 5-1. README 복붙 안티패턴 (vt-pkg)

`vt-pkg/README.md` 가 `vt-acc` 의 README 를 그대로 복붙된 상태. 패키지 버전 설명과 실제 코드가 어긋남.

→ **시니어 백엔드 교훈**: 도메인 변형 엔진을 fork 할 때 README 동기화가 가장 자주 빠지는 부분. CI 에서 README 의 placeholder (예: `{{domain}}`) 가 치환되지 않은 경우 fail 시키는 lint 가 필요.

### 5-2. 코드 중복 + DAG 분리 (morelike-com / morelike-offer)

두 엔진의 `src/morelike/main.py` 가 동일. 운영상 DAG 만 분리.

**왜 이렇게 하나**:
- ✅ 도메인별 모니터링 — 커뮤니티 vs 상품의 학습 실패가 독립
- ✅ 도메인별 SLA — 한쪽이 fail 해도 다른쪽 영향 없음
- ✅ 도메인별 데이터 스케줄 — 새벽 vs 낮 분리

**왜 안티패턴이기도 한가**:
- ❌ 알고리즘 변경 시 두 곳 동기화 필요
- ❌ 의존성 업그레이드도 두 곳

**산업 표준 대안**: 공통 라이브러리 + 두 DAG 가 import. 인스턴스화만 분리. Phase 10 §21 의 msa recommendation 모듈 설계 시 참고.

### 5-3. 행동 가중치 통일 (cb 계열)

cb 계열 (cb, cb2, cb-acc, cb-mi, cb-pkg, ...) 의 행동 가중치는 모두 동일:
```
reservation × 100 + click_purchase/reservation × 20 + addwish × 10 + pageview × 1
```

**관찰**: 도메인이 달라도 가중치 비율은 보존. 산업 표준 `100:20:10:1` 비율.

**Phase 2 §05 에서 deep-dive**: 이 비율이 어떻게 도출됐는지, 다른 비율 (예: `50:30:15:5`) 이 가능한지, KPI 별 최적 비율 차이.

### 5-4. 동적 가중치 (lb, urb)

cb 계열과 달리 lb / urb 는 `dyn_action_weight` 컬럼 사용 — 시간/카테고리별 동적 weight.

**왜**: 인기 카테고리는 작은 가중치 차이로도 ranking 이 흔들림 → 동적 보정. 예: 액티비티는 reservation 가중치 ×100 인데 호텔은 ×150 으로 다르게.

### 5-5. NER (nero) 는 추천 아님

`nero` 는 카탈로그 안에 있지만 **검색 NER 인프라**. 추천 모델 통계에서 분리 필요. KLUE-BERT 한국어 NER → 검색어에서 "지역/카테고리/상품명" 추출.

**시니어 관점**: 검색과 추천이 같은 팀에서 운영되면 카탈로그가 섞이기 쉬움. 도메인 경계 명시가 중요 (msa 의 `search` vs (가상의) `recommendation` 서비스 분리 원칙과 동일).

---

## 6. Phase 1 → Phase 2 연결

Phase 1 (CF 기초) 의 4 파일이 완료됐다:
- §01: 추천 시스템 개론 + Funnel + Two-Stage Retrieval (시스템 패턴) ≠ Two-Tower (모델)
- §02: CF 유사도 메트릭 deep-dive (Jaccard / Cosine / PMI / Lift / Pearson)
- §03: Matrix Factorization (SVD / FunkSVD / ALS / Implicit ALS → Two-Tower)
- §04 (이 파일): 산업 명명규칙 + 패밀리 매핑

**Phase 2 (베스트 랭킹) 로 넘어가는 연결고리**:
- §02-03 이 "비슷한 아이템 찾기" 였다면, Phase 2 는 "어떤 아이템이 인기인가?"
- 산업 cb 계열의 행동 가중합 (`100:20:10:1`) 이 왜 산업 표준인가
- 노출 적은 아이템 점수 신뢰도 — **Wilson score / Bayesian smoothing** (사용자 약점 영역)
- CTR vs CVR vs GMV 의 KPI 별 weight 차이

**다음 deep file**:
- **§05**: 행동 가중합 + CTR/CVR/GMV KPI (도출 과정 중심, 사용자 익숙 영역은 압축)
- **§06**: Wilson score / Bayesian smoothing (사용자 약점 영역, 수식 deep-dive)

---

## 7. 꼬리 질문 (§26 면접 카드 후보, 짧음)

1. **Item-Item CF 가 산업 표준이 된 운영 이유는?**
   - 답: (1) 사용자 수 > 아이템 수 → 계산 효율, (2) item similarity 가 user 보다 시간적으로 안정 → 매일 재학습 불필요, (3) cold-start 사용자도 한 번 행동하면 동작.

2. **vt (View Together) 와 bt (Buy Together) 의 시그널 차이가 알고리즘 선택에 어떻게 영향?**
   - 답: vt 는 implicit 약 시그널 (popular item bias 강함) → PMI/PPMI 안전. bt 는 transactional 강 시그널 + sparse data 적음 → cosine 도 OK. 시그널 강도 따라 메트릭 선택.

3. **산업에서 룰 기반 추천이 production 의 75% 를 차지하는 이유는?**
   - 답: (1) cold-start 안전망 — 신규 user/item 도 동작, (2) 운영 개입 가능 — 비즈니스 룰 inject, (3) 디버깅 쉬움 — 결정론적, (4) 빠른 ROI — Spark/딥러닝보다 빠른 배포. 딥러닝 도입해도 fallback 으로 유지.

4. **morelike-com / morelike-offer 같이 코드 동일한데 DAG 분리하는 이유는?**
   - 답: 도메인별 모니터링 / SLA / 데이터 스케줄 분리. 한쪽 실패가 다른쪽 영향 없음. 대신 코드 동기화 안티패턴 — 공통 라이브러리 + 분리된 DAG 가 산업 표준 대안.

---

## 8. cross-ref

| 주제 | 연결된 study |
|---|---|
| Item-Item CF + 유사도 메트릭 | §02 (PMI/PPMI 가 산업 vt/st/bt 에 안전) |
| ALS / MF Spark 잡 | §03 (Spark MLlib ALS — 산업 CF 패밀리의 구현) |
| 행동 가중합 도출 | Phase 2 §05 (cb 계열의 `100:20:10:1` 출처) |
| Wilson / Bayesian | Phase 2 §06 (노출 적은 아이템 보정) |
| Geo (Geohash / S2 / H3) | Phase 3 §07 (lb/ldp 의 랜드마크 인기도) |
| 시즌 sliding window | Phase 4 §08 (sba 의 ±7일 윈도우) |
| Sentence-BERT / ANN | Phase 5 §09-11 (morelike-com/offer 의 임베딩) |
| 딥러닝 모델 라인업 | Phase 6 §12-16 (vt-deep 14종 실체 확인) |
| Cold-start fallback | Phase 7 §17 (c2dp 의 default preference) |
| GitOps 코드 sync | #11 K8s GitOps (cloudbuild-dags.yaml 패턴) |
| msa recommendation 모듈 설계 | Phase 10 §21 (공통 라이브러리 + DAG 분리 교훈 적용) |
