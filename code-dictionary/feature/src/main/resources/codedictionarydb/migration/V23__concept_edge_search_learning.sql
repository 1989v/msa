-- 검색 시스템 계층(V22)에 학습이 붙는 가지를 더한다 — 플랜 docs/plans/2026-09-22-search-learning-roadmap.md §7.
--   분석기 커스텀 층    : 색인 계약 › 분석기 와 쿼리 언더스탠딩 › 형태소 분석 두 부모 아래 (DAG)
--   학습 랭킹           : 후처리 › 리랭킹 아래 — 크로스인코더와 달리 트리라 CPU 로 된다
--   온라인 학습 장치    : 검색 평가 › 온라인 평가 아래 — 원장 → 성향 로깅 → 오프폴리시 평가 → 밴딧 순
--   벡터 저장 양자화    : 벡터 필드 · HNSW 두 부모 아래. 모델 가중치 양자화와는 다른 축이다
-- 새 진입점은 만들지 않는다. 기존 개념(user-dictionary · reranking · judgment-set …)은 행을 건드리지 않고 간선만 더한다.

INSERT INTO concept (concept_id, name, category, level, description) VALUES
('analyzer-customization-layers', '형태소 분석기 커스텀 층', 'DATA', 'INTERMEDIATE', '분해 결과를 바꾸는 손잡이 셋 — 사용자 사전(L1) · 시스템 사전 항목(L2) · 비용 재학습(L3). 층이 깊을수록 플러그인 빌드와 라벨 코퍼스가 따라온다'),
('lattice-viterbi', '격자 · 비터비 · 비용', 'ALGORITHM', 'ADVANCED', '글자 경계마다 노드를 두고 사전 후보를 간선으로 깐 격자에서, 단어 비용 + 연접 비용의 합이 가장 낮은 경로를 비터비로 고른다. 노리는 규칙이 아니라 이 비용으로 자른다'),
('decompound-mode', '복합어 분해 모드', 'DATA', 'INTERMEDIATE', '복합어를 통째로(none) · 조각만(discard, 기본값) · 둘 다(mixed) 색인할지. 색인과 질의 양쪽이 같아야 통째 토큰이 매칭된다'),
('system-dictionary-entry', '시스템 사전 항목', 'DATA', 'ADVANCED', '사전 CSV 에 품사 · 비용 · 문맥 ID 를 직접 줘서 비터비 경쟁에 정상 참여시킨다. 기존 항목의 교정 · 삭제가 되는 유일한 층이고, 플러그인을 다시 굽는다'),
('tokenizer-cost-retraining', '분해 비용 재학습', 'ALGORITHM', 'ADVANCED', '정답 분해가 붙은 도메인 코퍼스로 비용표(CRF)를 다시 배운다. 형태소 분석기의 「지도학습」은 이 층을 가리킨다. 라벨 코퍼스가 없으면 착수가 아니다'),
('learning-to-rank', 'Learning to Rank', 'ALGORITHM', 'ADVANCED', '(쿼리, 문서, 등급) 라벨로 재정렬 함수를 배운다. LambdaMART 같은 트리 모델은 GPU 없이 상위 N 을 몇 ms 에 다시 채점한다. 토큰이 어긋난 문서는 여기까지 오지 않는다'),
('ranking-features', '랭킹 피처', 'DATA', 'INTERMEDIATE', '리랭커가 보는 값 — 융합 점수 · 제목 일치 · 의도 일치 · 문서 완성도. 학습 피처와 서빙 피처가 같아야 한다. 서빙에서 못 얻는 값은 학습에서도 뺀다'),
('click-weak-labels', '클릭 약지도 라벨', 'DATA', 'INTERMEDIATE', '노출 · 클릭 원장에서 관련도 라벨을 만든다. 사람 판정보다 싸지만 위치 편향이 섞여 있어 그대로 쓰면 1위를 1위라서 배운다'),
('position-bias', '위치 편향', 'TESTING', 'INTERMEDIATE', '위에 있는 결과가 맞아서가 아니라 위에 있어서 눌린다. 클릭을 라벨이나 보상으로 쓰려면 노출 성향으로 나눠야 한다'),
('impression-click-ledger', '노출 · 클릭 원장', 'DATA', 'INTERMEDIATE', '대상 × 동작 두 축(entity_type · action)과 계층 위치(screen · section · item_index)로 남긴 노출과 클릭. 온라인 학습과 CTR 지표의 유일한 원천'),
('propensity-logging', '탐색 · 성향 로깅', 'DATA', 'ADVANCED', '노출 순서를 정한 정책과 그 선택 확률을 원장에 같이 남긴다. 가끔(ε) 순서를 섞어야 다른 정책의 결과를 나중에 추정할 수 있다. 트래픽이 오기 전에 깔아야 한다'),
('off-policy-evaluation', '오프폴리시 평가', 'TESTING', 'ADVANCED', '로그를 남긴 정책과 다른 정책을 냈으면 지표가 얼마였을지 성향 역수 가중(IPS · SNIPS)으로 추정한다. 배포 없이 새 랭커를 온라인 지표로 잰다'),
('bandit-exploration', '밴딧 · 탐색', 'ALGORITHM', 'ADVANCED', '팔(노출 후보)마다 보상 분포를 갖고 Thompson Sampling 으로 고른다. 확실한 팔을 쓰면서 불확실한 팔을 시험한다. 보상이 즉시 오는 1단계 문제라 강화학습 본체는 쓰지 않는다'),
('contextual-bandit', '컨텍스추얼 밴딧', 'ALGORITHM', 'ADVANCED', '팔의 보상을 문맥(시간대 · 기기 · 이전 클릭)의 함수로 배운다(LinUCB). 팔당 노출이 수백 건은 쌓인 뒤의 일이다'),
('vector-quantization', '벡터 양자화', 'DATA', 'ADVANCED', '저장된 벡터를 1-bit · int8 로 눌러 상주 메모리를 줄인다(1-bit 는 32×). 모델 가중치 양자화와 다른 축이고, 정밀도 손실은 재채점으로 메운다'),
('rescore-oversample', '재채점 · 오버샘플', 'ALGORITHM', 'INTERMEDIATE', '양자화 벡터로 k 의 몇 배를 뽑은 뒤 원본 벡터로 다시 채점해 상위 k 를 낸다. 배수를 올리면 정확도가 오르고 지연이 는다'),
('search-node-memory', '검색 노드 메모리', 'INFRASTRUCTURE', 'INTERMEDIATE', '한도 = JVM 힙 + 힙 밖 네이티브(~1 GB) + 색인 한 벌의 페이지 캐시. 캐시가 0 이 되면 벡터 파일이 질의마다 디스크에서 올라와 kNN 만 100초대가 된다');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'analyzer-customization-layers'), 'nori 커스텀'),
((SELECT id FROM concept WHERE concept_id = 'lattice-viterbi'), 'Viterbi'),
((SELECT id FROM concept WHERE concept_id = 'system-dictionary-entry'), 'mecab-ko-dic'),
((SELECT id FROM concept WHERE concept_id = 'learning-to-rank'), 'LTR'),
((SELECT id FROM concept WHERE concept_id = 'learning-to-rank'), 'LambdaMART'),
((SELECT id FROM concept WHERE concept_id = 'click-weak-labels'), 'weak supervision'),
((SELECT id FROM concept WHERE concept_id = 'position-bias'), 'position bias'),
((SELECT id FROM concept WHERE concept_id = 'propensity-logging'), 'propensity'),
((SELECT id FROM concept WHERE concept_id = 'off-policy-evaluation'), 'IPS'),
((SELECT id FROM concept WHERE concept_id = 'off-policy-evaluation'), 'counterfactual evaluation'),
((SELECT id FROM concept WHERE concept_id = 'bandit-exploration'), 'Thompson Sampling'),
((SELECT id FROM concept WHERE concept_id = 'bandit-exploration'), 'multi-armed bandit'),
((SELECT id FROM concept WHERE concept_id = 'contextual-bandit'), 'LinUCB'),
((SELECT id FROM concept WHERE concept_id = 'vector-quantization'), 'BBQ'),
((SELECT id FROM concept WHERE concept_id = 'vector-quantization'), 'Better Binary Quantization'),
((SELECT id FROM concept WHERE concept_id = 'vector-quantization'), '1-bit quantization'),
((SELECT id FROM concept WHERE concept_id = 'rescore-oversample'), 'oversample factor');

-- ===== 층 (CONTAINS) — ordinal 은 형제 순서. 기존 형제 뒤에 잇는다 =====
INSERT INTO concept_edge (from_concept_id, to_concept_id, kind, ordinal) VALUES
('analyzer-tokenizer', 'analyzer-customization-layers', 'CONTAINS', 1),
('morphological-analysis', 'analyzer-customization-layers', 'CONTAINS', 1),
('analyzer-customization-layers', 'lattice-viterbi', 'CONTAINS', 1),
('analyzer-customization-layers', 'user-dictionary', 'CONTAINS', 2),
('analyzer-customization-layers', 'decompound-mode', 'CONTAINS', 3),
('analyzer-customization-layers', 'system-dictionary-entry', 'CONTAINS', 4),
('analyzer-customization-layers', 'tokenizer-cost-retraining', 'CONTAINS', 5),

('reranking', 'learning-to-rank', 'CONTAINS', 1),
('learning-to-rank', 'ranking-features', 'CONTAINS', 1),

('judgment-set', 'click-weak-labels', 'CONTAINS', 4),
('click-weak-labels', 'position-bias', 'CONTAINS', 1),

('online-evaluation', 'impression-click-ledger', 'CONTAINS', 3),
('online-evaluation', 'propensity-logging', 'CONTAINS', 4),
('online-evaluation', 'off-policy-evaluation', 'CONTAINS', 5),
('online-evaluation', 'bandit-exploration', 'CONTAINS', 6),
('bandit-exploration', 'contextual-bandit', 'CONTAINS', 1),
('search-ops-metrics', 'impression-click-ledger', 'CONTAINS', 4),
('search-ops-metrics', 'search-node-memory', 'CONTAINS', 5),

('vector-field', 'vector-quantization', 'CONTAINS', 2),
('hnsw', 'vector-quantization', 'CONTAINS', 1),
('vector-quantization', 'rescore-oversample', 'CONTAINS', 1);

-- ===== 같은 층 안 흐름 (FLOWS_TO) =====
INSERT INTO concept_edge (from_concept_id, to_concept_id, kind, ordinal) VALUES
('user-dictionary', 'system-dictionary-entry', 'FLOWS_TO', 1),
('system-dictionary-entry', 'tokenizer-cost-retraining', 'FLOWS_TO', 2),
('impression-click-ledger', 'propensity-logging', 'FLOWS_TO', 1),
('propensity-logging', 'off-policy-evaluation', 'FLOWS_TO', 2),
('off-policy-evaluation', 'bandit-exploration', 'FLOWS_TO', 3);
