# 추천 — 커버리지 체크리스트

원천:
- `study/docs/20-recommendation-modeling/` — 00-preview · 00-plan · 01~27 (99-concept-catalog 없음 — 본문 노트의 절 제목과 핵심 문장에서 추렸다)
- `recommendation/` 서비스 코드 · `recommendation-ann/app.py` · `recommendation-ml/*.py` · `k8s/base/recommendation-ann/`
- `docs/adr/ADR-0044`~`ADR-0049` (단계 · 파이프라인 · ANN 사이드카 · Wide & Deep · A/B + DLRM · MAB + 실시간)
- 분야 표준 — Recommender Systems Handbook · Aggarwal 「Recommender Systems」 목차: CB · CF(사용자 · 아이템) · 유사도 · MF/ALS · 암묵 피드백 · 임베딩 리트리벌 · 퍼널 · CTR 모델 계보(LR → FM → Wide&Deep → DeepFM · DCN · DLRM · 멀티태스크) · 재정렬(다양성 · 캘리브레이션 · 공정성) · 콜드 스타트 · 편향 · 오프라인 · 온라인 평가

| id | 개념 | 출처 | 배치 |
|---|---|---|---|
| rec-signal-collection | 행동 신호 수집 | study/20 §05 | placed |
| explicit-feedback | 명시 피드백 | study/20 §01 · §16 | placed |
| implicit-feedback | 암묵 피드백 | study/20 §01 · §16 | placed |
| rec-action-weighting | 행동 가중합 | study/20 §05 | placed |
| rec-dynamic-action-weight | 동적 행동 가중치 | study/20 §05 | placed |
| rec-realtime-reward-aggregation | 실시간 보상 집계 | ADR-0049 · study/20 §19 | placed |
| rec-data-sparsity | 데이터 희소성 | study/20 §02 · §03 | placed |
| rec-score-correction | 점수 보정 | study/20 §06 | placed |
| wilson-score | Wilson 점수 하한 | study/20 §06 | placed |
| bayesian-smoothing | 베이지안 평활 | study/20 §06 | placed |
| rec-small-sample-distortion | 적은 표본 점수 왜곡 | study/20 §06 | placed |
| rec-candidate-retrieval | 후보 생성 (리트리벌) | study/20 §01 · ADR-0044 | placed |
| rec-rule-based-retrieval | 룰 기반 추천 | study/20 §04 · §22 · ADR-0044 | placed |
| popularity-recommendation | 인기 추천 | study/20 §01 · §17 | placed |
| rec-category-best | 카테고리 베스트 | study/20 §04 · §22 · ADR-0044 | placed |
| rec-seasonal-window | 시즌 슬라이딩 윈도 | study/20 §08 | placed |
| rec-ctr-best | CTR 베스트 | study/20 §08 | placed |
| rec-repurchase-best | 재구매 베스트 | study/20 §08 | placed |
| rec-content-based | 콘텐츠 기반 추천 | study/20 §01 | placed |
| content-based-filtering | 콘텐츠 기반 필터링 | study/20 §01 | placed |
| more-like-this | MoreLikeThis | study/20 §11 | placed |
| rec-text-embedding-similarity | 텍스트 임베딩 유사 아이템 | study/20 §09 · §11 | placed |
| rec-collaborative | 협업 필터링 | study/20 §01 · §02 | placed |
| collaborative-filtering | 이웃 기반 협업 필터링 | study/20 §01 · §02 | placed |
| user-based-cf | 사용자 기반 CF | study/20 §01 · §02 | placed |
| item-based-cf | 아이템 기반 CF | study/20 §02 · §23 · ADR-0044 | placed |
| rec-similarity-metric | 유사도 지표 | study/20 §02 | placed |
| jaccard-similarity | Jaccard 유사도 | study/20 §02 | placed |
| pmi | PMI · PPMI | study/20 §02 | placed |
| lift | Lift | study/20 §02 | placed |
| pearson-correlation | 피어슨 상관 | study/20 §02 | placed |
| matrix-factorization | 행렬 분해 | study/20 §03 | placed |
| svd | SVD | study/20 §03 | placed |
| funk-svd | FunkSVD | study/20 §03 | placed |
| als | ALS | study/20 §03 | placed |
| implicit-als | 암묵 피드백 ALS | study/20 §03 | placed |
| rec-sgd | SGD 학습 | study/20 §03 | placed |
| rec-popularity-bias | 인기 편향 | study/20 §02 | placed |
| rec-embedding-retrieval | 임베딩 리트리벌 | study/20 §13 · §24 · ADR-0046 | placed |
| two-tower | Two-Tower | study/20 §13 · §24 · ADR-0046 | placed |
| in-batch-negative | in-batch negative | study/20 §13 · §24 · ADR-0046 | placed |
| sampling-bias-correction | 샘플링 편향 보정 (logQ) | study/20 §13 · §24 · ADR-0046 | placed |
| item2vec | item2vec | study/20 §13 · 분야 표준 | placed |
| negative-sampling | 음성 표본 추출 | study/20 §16 | placed |
| faiss | FAISS | study/20 §10 · ADR-0046 | placed |
| rec-geo-retrieval | 위치 기반 추천 | study/20 §07 | placed |
| rec-spatial-cell-index | 공간 셀 인덱싱 | study/20 §07 | placed |
| haversine-distance | 하버사인 거리 | study/20 §07 | placed |
| rec-distance-decay | 거리 감쇠 결합 | study/20 §07 | placed |
| hybrid-recommendation | 하이브리드 추천 | study/20 §01 · §11 | placed |
| rec-ranking | 랭킹 | study/20 §01 · ADR-0044 | placed |
| rec-ctr-prediction | CTR 예측 모델 | study/20 §12 · 분야 표준 | placed |
| logistic-regression-ctr | 로지스틱 회귀 CTR | study/20 §12 · 분야 표준 | placed |
| factorization-machine | Factorization Machine | ADR-0047 · 분야 표준 | placed |
| wide-and-deep | Wide & Deep | study/20 §12 · ADR-0047 | placed |
| deepfm | DeepFM | ADR-0047 · 분야 표준 | placed |
| dcn | DCN | ADR-0047 · 분야 표준 | placed |
| dlrm | DLRM | study/20 §14 · ADR-0048 | placed |
| tab-transformer | TabTransformer | study/20 §15 · ADR-0047 | placed |
| rec-multi-task-ranking | 멀티태스크 랭킹 | 분야 표준 | placed |
| rec-feature-engineering | 랭킹 특징 설계 | 분야 표준 | placed |
| feature-store | Feature Store | study/20 §18 | placed |
| onnx-runtime | ONNX Runtime | ADR-0046 · study/20 §24 | placed |
| rec-training-serving-skew | 학습-서빙 불일치 | study/20 §18 | excluded — 같은 개념 srch-train-serve-skew 로 합쳤다 |
| rec-auc | AUC | study/20 §19 · §16 | placed |
| rec-reranking | 재정렬 · 후처리 | study/20 §01 · ADR-0044 | placed |
| rec-diversification | 다양화 | study/20 §19 | placed |
| mmr | MMR | 분야 표준 | placed |
| dpp | DPP | 분야 표준 | placed |
| rec-score-boost | 점수 부스팅 · 비즈니스 규칙 | study/20 §01 · §17 | placed |
| rec-seen-filter | 이미 본 것 · 산 것 제외 | 분야 표준 | placed |
| rec-calibration | 캘리브레이션 | 분야 표준 | placed |
| rec-exposure-fairness | 노출 공정성 | 분야 표준 | placed |
| filter-bubble | 필터 버블 | 분야 표준 | placed |
| rec-cold-start | 콜드 스타트 대응 | study/20 §17 | placed |
| rec-fallback-chain | 폴백 체인 | study/20 §17 | placed |
| rec-default-preference | 기본 선호 · 인구통계 폴백 | study/20 §17 | placed |
| rec-onboarding-bandit | 온보딩 탐색 | study/20 §17 | placed |
| rec-new-item-exposure | 새 아이템 노출 · 부스트 | study/20 §17 | placed |
| rec-transfer-learning | 전이 학습 | study/20 §17 | placed |
| rec-cold-start-problem | 콜드 스타트 | study/20 §17 | placed |
| rec-serving | 추천 서빙 | study/20 §22 · ADR-0045 | placed |
| rec-precompute-cache | 사전 계산 · 캐시 서빙 | study/20 §22 · ADR-0045 | placed |
| rec-staged-key-swap | 스테이징 키 교체 | ADR-0045 · study/20 §23 | placed |
| rec-ann-sidecar | ANN 추론 사이드카 | study/20 §10 · ADR-0046 | placed |
| rec-periodic-retraining | 주기 재학습 | ADR-0046 · study/20 §24 | placed |
| rec-funnel-latency-budget | 퍼널 단계별 지연 예산 | study/20 00-preview §1 | placed |
| rec-model-staleness | 모델 · 목록 노후화 | study/20 §19 §6 | placed |
| pytorch | PyTorch | ADR-0046 · study/20 §24 | placed |
| rec-evaluation | 추천 평가 | study/20 §19 | placed |
| rec-offline-evaluation | 오프라인 평가 | study/20 §19 | placed |
| rec-temporal-split | 시간 순 분할 | study/20 §16 | placed |
| rec-offline-online-gap | 오프라인 · 온라인 괴리 | study/20 §01 §6 | excluded — 같은 개념 srch-offline-online-gap 로 합쳤다 |
| recall-at-k | Recall@K | study/20 §19 | excluded — 같은 개념 srch-recall-at-k 로 합쳤다 |
| rec-map | MAP | study/20 §19 | excluded — 같은 개념 srch-map 로 합쳤다 |
| rec-mrr | MRR | 분야 표준 | excluded — 같은 개념 srch-mrr 로 합쳤다 |
| rec-hit-rate | Hit Rate@K | 분야 표준 | placed |
| rec-catalog-coverage | 카탈로그 커버리지 | study/20 §19 | placed |
| rec-intra-list-diversity | 목록 내 다양성 | study/20 §19 | excluded — 같은 개념 srch-intra-list-diversity 로 합쳤다 |
| rec-novelty | 신규성 | study/20 §19 | placed |
| rec-serendipity | 의외성 | study/20 §19 | placed |
| rec-online-evaluation | 온라인 평가 · 실험 | study/20 §25 · ADR-0048 | placed |
| rec-experiment-variant-routing | 실험 변형 분기 | study/20 §25 · ADR-0048 | placed |
| rec-variant-bandit | 변형 선택 밴딧 | ADR-0049 · study/20 §19 §5 | placed |
| rec-impression-publishing | 추천 노출 발행 | study/20 §25 | placed |
| rec-dwell-time | 체류 시간 | study/20 §19 | excluded — 같은 개념 srch-dwell-time 로 합쳤다 |
| rec-drift-monitoring | 드리프트 감시 | study/20 §19 §6 | placed |
| rec-concept-drift | 데이터 · 개념 드리프트 | study/20 §19 §6 | placed |
| rec-feedback-loop | 되먹임 루프 | study/20 §19 §6 | placed |
| rec-sampling-bias | 음성 샘플링 편향 | study/20 §13 · §24 · ADR-0046 | placed |
| rec-interaction-matrix | 사용자 × 아이템 상호작용 행렬 | study/20 §02 · §03 | placed |
| rec-co-occurrence | 공출현 | study/20 §02 | placed |
| rec-long-tail | 긴 꼬리 | 분야 표준 | placed |
| rec-sparse-dense-features | 희소 · 밀집 특징 | study/20 §14 · ADR-0048 | placed |
| rec-latent-factor | 잠재 요인 | study/20 §03 | placed |
| rec-regularization | 정규화 항 · 편향 항 | study/20 §03 | placed |
| rec-feature-cross | 특징 교차 | study/20 §12 · ADR-0047 | placed |
| rec-memorization-generalization | 외우기 · 일반화 | study/20 §12 · ADR-0047 | placed |
| rec-funnel | 추천 퍼널 | study/20 §01 · ADR-0044 | placed |
| ab-test | A/B 테스트 · 표본 크기 · 다중 검정 | study/20 §19 §3 | excluded — owned by search (rec-online-evaluation · rec-experiment-variant-routing 이 USES) |
| bandit-exploration | MAB · Thompson Sampling · UCB · ε-greedy | study/20 §08 · §19 §5 | excluded — owned by search (rec-variant-bandit · rec-onboarding-bandit 이 USES) — UCB · ε-greedy 는 search 가 쪼갤 몫 |
| contextual-bandit | 컨텍스추얼 밴딧 (LinUCB) | study/20 §19 §5-4 | excluded — owned by search |
| beta-bernoulli-conjugate | 베타-베르누이 켤레 | study/20 §06 §4 | excluded — owned by search (bayesian-smoothing · rec-variant-bandit 이 USES) |
| embedding-model | 임베딩 모델 | study/20 §09 | excluded — owned by search (rec-text-embedding-similarity 가 USES) |
| sentence-bert | Sentence-BERT · 학습 손실(triplet · MNRL) · 한국어 모델 비교 | study/20 §09 | excluded — owned by search (임베딩 모델 가지) — 추천 쪽은 rec-text-embedding-similarity 로 쓴다 |
| ann-search | ANN 검색 | study/20 §10 | excluded — owned by search (rec-embedding-retrieval 이 USES) |
| hnsw | HNSW · M · ef_construction · ef_search | study/20 §10 | excluded — owned by search (rec-embedding-retrieval 이 USES, FAISS 설정은 faiss 에 적었다) |
| annoy-scann | Annoy · ScaNN | study/20 §10 §2 | excluded — owned by search — 레포에 없는 ANN 구현체라 search 의 ANN 가지 설명으로 충분하다 |
| cosine-similarity | 코사인 유사도 | study/20 §02 §4 | excluded — owned by search (rec-similarity-metric 이 USES) |
| ndcg | nDCG | study/20 §19 §1-2 | excluded — owned by search (rec-ranking · rec-offline-evaluation 이 MEASURED_BY) |
| recall-precision | 재현율 · 정밀도 | study/20 §19 | excluded — owned by search (rec-offline-evaluation 이 MEASURED_BY) |
| learning-to-rank | LTR · cross-encoder | study/20 00-preview | excluded — owned by search (rec-ranking 이 USES) |
| position-bias | 위치 편향 · IPW 보정 | study/20 §17 · §27 §2-4 | excluded — owned by search (off-policy-evaluation · propensity-logging 으로 잇는다) |
| off-policy-evaluation | 카운터팩추얼 평가 · IPS | study/20 §19 §7 | excluded — owned by search (rec-offline-evaluation 이 USES) |
| interleaving | 인터리빙 | 분야 표준 | excluded — owned by search (rec-online-evaluation 이 USES) |
| ctr | CTR | study/20 §05 | excluded — owned by ads (rec-online-evaluation 이 MEASURED_BY) |
| ads-cvr | CVR | study/20 §05 | excluded — owned by ads (rec-online-evaluation 이 MEASURED_BY) |
| ord-gmv | GMV | study/20 §05 | excluded — owned by commerce-order (rec-online-evaluation 이 MEASURED_BY) |
| tf-idf | TF-IDF | study/20 §11 | excluded — owned by search (스코어링 기초 — bm25 가지) · more-like-this 설명에 둔다 |
| argo-workflows | Argo Workflows | ADR-0045 | excluded — owned by infrastructure — 레포 TECHNOLOGY 소유표에 없어 rec-periodic-retraining 코드 참조로만 둔다 |
| spark-mllib | Spark · Spark MLlib ALS | study/20 §03 · §18 · §23 | excluded — 레포에서 쓰지 않는 구현체 — als 설명에 둔다 |
| engine-naming | 추천 엔진 명명규칙 (vt/st/bt …) | study/20 §04 | excluded — 특정 회사 카탈로그 명명이라 개념이 아니다 |
| movielens | MovieLens-1M | study/20 §16 | excluded — 데이터셋 이름이라 개념이 아니다 |
| recommendation-dashboard | 추천 대시보드 · 알림 | study/20 §25 §6 | excluded — owned by observability |
