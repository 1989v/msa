-- 검색 시스템 계층에 「용어 사전」 가지를 더한다 — 플랜 docs/plans/2026-09-09-search-architecture-graph.md §3.5.
--   도메인 루트마다 `<도메인>-glossary` 한 가지: 단계·장치가 아니라 **그것을 읽는 데 필요한 말**(CRF · 비터비 · 문맥 ID …)을 모은다.
--   용어는 사전 아래에도, 그 용어가 쓰이는 장치 아래에도 같이 건다(DAG) — 사전에서 찾아도, 장치를 펼쳐도 나온다.
--   깊이는 짧은 경로(사전 쪽, 3)로 잡히므로 장치 아래 행은 「놓인 위치의 깊이」로만 내려간다(FE hierarchyModel).
-- 이미 장치로 있는 것(RRF · nDCG · HNSW · BM25 · 위치 편향 …)은 용어 사전에 중복으로 넣지 않는다.

INSERT INTO concept (concept_id, name, category, level, description) VALUES
('search-glossary', '검색 용어 사전', 'BASICS', 'BEGINNER', '검색 계층을 읽는 데 필요한 말. 단계·장치가 아니라 그것을 설명하는 용어를 모은다. 용어는 쓰이는 장치 아래에도 같이 걸린다'),
('glossary-morphology', '형태소 분석 용어', 'BASICS', 'BEGINNER', '한국어 형태소 분석기(nori · MeCab 계열)가 단어를 자르는 원리와 사전 형식의 말'),
('glossary-vector', '벡터 검색 용어', 'BASICS', 'BEGINNER', '임베딩과 근사 최근접 탐색의 말'),
('glossary-learning', '학습 · 평가 용어', 'BASICS', 'BEGINNER', '랭킹 학습 · 온라인 학습 · 오프폴리시 평가의 말'),

('morpheme', '형태소', 'BASICS', 'BEGINNER', '뜻을 가진 가장 작은 단위. 「먹었다」= 먹 + 었 + 다. 형태소 분석은 문장을 이 단위와 품사로 가른다'),
('surface-form', '표층형', 'BASICS', 'BEGINNER', '문장에 실제로 나타난 글자열. 사전은 표층형으로 찾고, 활용형은 기본형과 다를 수 있다. 사용자 사전 항목은 표층형이 맞을 때만 걸린다'),
('pos-tag', '품사 태그', 'DATA', 'BEGINNER', '한국어 분석기는 세종 품사 체계를 쓴다 — NNG 일반명사 · NNP 고유명사 · NR 수사 · MAG 일반부사 · VV 동사 … 품사 필터와 동의어 규칙이 이 태그를 본다. 같은 글자도 문맥 비용에 따라 다른 태그를 받는다'),
('lattice', '격자', 'DATA_STRUCTURE', 'INTERMEDIATE', '글자 경계마다 노드를 두고 사전에 있는 후보 단어를 간선으로 깐 그래프. 형태소 분석의 탐색 공간이고, 사전에 없는 단어는 간선 자체가 없다'),
('viterbi-algorithm', '비터비 알고리즘', 'ALGORITHM', 'INTERMEDIATE', '격자에서 총비용 최소 경로를 왼쪽에서 오른쪽으로 한 번 훑어 찾는 동적 계획법. 노드마다 「여기까지의 최소 비용과 직전 간선」만 남긴다'),
('word-cost', '단어 비용', 'DATA', 'INTERMEDIATE', '사전 항목마다 붙은 비용. 낮을수록 그 분해를 선호한다. 사용자 사전 항목은 −100000 으로 고정돼 경쟁 없이 이긴다'),
('connection-cost', '연접 비용', 'DATA', 'INTERMEDIATE', '앞 단어의 우 문맥 ID 와 뒤 단어의 좌 문맥 ID 로 행렬(matrix.def)에서 찾는 이음 비용. 「명사 뒤에 조사」 같은 품사 연쇄의 자연스러움을 값으로 갖는다'),
('context-id', '문맥 ID', 'DATA', 'INTERMEDIATE', '사전 항목의 좌·우 문맥 ID. 품사 계열과 받침 유무로 정해지며(left-id.def · right-id.def) 연접 비용표의 행·열 키다'),
('crf', 'CRF', 'ALGORITHM', 'ADVANCED', '조건부 무작위장(Conditional Random Field). 문장 전체를 보고 각 위치의 라벨(형태소 경계·품사) 열을 확률로 매기는 판별 모델. MeCab 계열은 학습한 CRF 가중치를 단어 비용·연접 비용으로 바꿔 사전에 굽는다'),
('mecab-ko-dic', 'mecab-ko-dic', 'DATA', 'INTERMEDIATE', 'MeCab 형식의 한국어 사전. 세종 말뭉치로 학습한 비용이 붙은 품사별 CSV 와 연접 비용 행렬(matrix.def) · 학습 모델(model.def)로 이뤄지고, Lucene nori 가 이것을 바이너리로 구워 쓴다'),
('sejong-corpus', '세종 말뭉치', 'DATA', 'BEGINNER', '21세기 세종계획 말뭉치. 형태소·품사가 사람 손으로 달린 대규모 한국어 코퍼스로, 범용 형태소 분석기 비용의 원천이다. 신문·소설 분포라 도메인 용어는 일반어 조각으로 갈린다'),

('cosine-similarity', '코사인 유사도', 'ALGORITHM', 'BEGINNER', '두 벡터의 각도로 재는 유사도(내적 ÷ 크기의 곱). 정규화된 벡터에선 내적과 같다. 벡터 검색의 기본 거리'),
('matryoshka-embedding', '마트료시카 임베딩', 'ALGORITHM', 'ADVANCED', '앞쪽 차원만 잘라 써도 뜻이 보존되게 학습한 임베딩(MRL). 2560 차원 모델을 1024 로 잘라 저장하는 식으로 메모리와 정확도를 맞바꾼다'),
('hnsw-parameters', 'HNSW 파라미터', 'DATA_STRUCTURE', 'ADVANCED', 'm(노드당 이웃 수) · ef_construction(색인 때 탐색 폭) · ef_search(질의 때 탐색 폭). 올리면 재현율과 메모리·지연이 같이 오른다'),

('ltr-loss-families', '랭킹 손실 세 갈래', 'ALGORITHM', 'ADVANCED', '포인트와이즈(문서 하나의 점수) · 페어와이즈(두 문서의 순서) · 리스트와이즈(목록 전체 지표). LambdaMART 는 nDCG 변화량을 그래디언트에 넣는 리스트와이즈 계열'),
('query-level-cross-validation', '쿼리 단위 교차검증', 'TESTING', 'INTERMEDIATE', '쿼리 단위로 fold 를 나누는 교차검증. 같은 쿼리의 문서가 학습·검증에 갈라지면 점수가 새어 과대평가된다'),
('exploration-exploitation', '탐색 · 활용', 'ALGORITHM', 'INTERMEDIATE', '확실히 좋은 팔을 쓰는 것(활용)과 불확실한 팔을 시험하는 것(탐색)의 균형. 탐색이 0 이면 새 후보는 영영 못 올라온다'),
('beta-bernoulli-conjugate', '베타-베르누이 켤레', 'ALGORITHM', 'ADVANCED', '클릭/노출 같은 성공·실패 관측에 베타 분포 사전을 두면 사후도 베타 분포다(α = 클릭 + α₀, β = 비클릭 + β₀). Thompson Sampling 이 팔마다 여기서 표본을 뽑아 순서를 정한다'),
('inverse-propensity-scoring', '성향 역수 가중', 'ALGORITHM', 'ADVANCED', '로그 정책이 그 노출을 고를 확률(성향)의 역수로 가중해 다른 정책의 지표를 추정한다(IPS). SNIPS 는 가중치 합으로 나눠 분산을 줄인다'),
('team-draft-interleaving', '팀 드래프트 인터리빙', 'TESTING', 'ADVANCED', '두 랭커가 번갈아 상위 문서를 뽑아 한 목록으로 섞고, 클릭이 어느 팀 문서에 갔는지로 승자를 가른다. A/B 보다 적은 트래픽으로 판정한다');

INSERT INTO concept_synonym (concept_id, synonym) VALUES
((SELECT id FROM concept WHERE concept_id = 'search-glossary'), 'glossary'),
((SELECT id FROM concept WHERE concept_id = 'search-glossary'), '용어집'),
((SELECT id FROM concept WHERE concept_id = 'surface-form'), 'surface form'),
((SELECT id FROM concept WHERE concept_id = 'pos-tag'), 'POS tag'),
((SELECT id FROM concept WHERE concept_id = 'pos-tag'), '세종 품사'),
((SELECT id FROM concept WHERE concept_id = 'lattice'), 'lattice'),
((SELECT id FROM concept WHERE concept_id = 'viterbi-algorithm'), 'Viterbi'),
((SELECT id FROM concept WHERE concept_id = 'connection-cost'), 'matrix.def'),
((SELECT id FROM concept WHERE concept_id = 'context-id'), 'left-id · right-id'),
((SELECT id FROM concept WHERE concept_id = 'crf'), 'Conditional Random Field'),
((SELECT id FROM concept WHERE concept_id = 'crf'), '조건부 무작위장'),
((SELECT id FROM concept WHERE concept_id = 'mecab-ko-dic'), 'MeCab'),
((SELECT id FROM concept WHERE concept_id = 'cosine-similarity'), 'cosine'),
((SELECT id FROM concept WHERE concept_id = 'matryoshka-embedding'), 'MRL'),
((SELECT id FROM concept WHERE concept_id = 'matryoshka-embedding'), 'Matryoshka Representation Learning'),
((SELECT id FROM concept WHERE concept_id = 'hnsw-parameters'), 'ef_search'),
((SELECT id FROM concept WHERE concept_id = 'ltr-loss-families'), 'listwise'),
((SELECT id FROM concept WHERE concept_id = 'ltr-loss-families'), 'pairwise'),
((SELECT id FROM concept WHERE concept_id = 'exploration-exploitation'), 'explore-exploit'),
((SELECT id FROM concept WHERE concept_id = 'beta-bernoulli-conjugate'), 'Beta-Bernoulli'),
((SELECT id FROM concept WHERE concept_id = 'inverse-propensity-scoring'), 'IPS'),
((SELECT id FROM concept WHERE concept_id = 'inverse-propensity-scoring'), 'SNIPS'),
((SELECT id FROM concept WHERE concept_id = 'team-draft-interleaving'), 'team draft');

-- ===== 사전 쪽 층 (CONTAINS) — 루트의 넷째 가지 =====
INSERT INTO concept_edge (from_concept_id, to_concept_id, kind, ordinal) VALUES
('search-system', 'search-glossary', 'CONTAINS', 4),
('search-glossary', 'glossary-morphology', 'CONTAINS', 1),
('search-glossary', 'glossary-vector', 'CONTAINS', 2),
('search-glossary', 'glossary-learning', 'CONTAINS', 3),

('glossary-morphology', 'morpheme', 'CONTAINS', 1),
('glossary-morphology', 'surface-form', 'CONTAINS', 2),
('glossary-morphology', 'pos-tag', 'CONTAINS', 3),
('glossary-morphology', 'lattice', 'CONTAINS', 4),
('glossary-morphology', 'viterbi-algorithm', 'CONTAINS', 5),
('glossary-morphology', 'word-cost', 'CONTAINS', 6),
('glossary-morphology', 'connection-cost', 'CONTAINS', 7),
('glossary-morphology', 'context-id', 'CONTAINS', 8),
('glossary-morphology', 'crf', 'CONTAINS', 9),
('glossary-morphology', 'mecab-ko-dic', 'CONTAINS', 10),
('glossary-morphology', 'sejong-corpus', 'CONTAINS', 11),

('glossary-vector', 'cosine-similarity', 'CONTAINS', 1),
('glossary-vector', 'matryoshka-embedding', 'CONTAINS', 2),
('glossary-vector', 'hnsw-parameters', 'CONTAINS', 3),

('glossary-learning', 'ltr-loss-families', 'CONTAINS', 1),
('glossary-learning', 'query-level-cross-validation', 'CONTAINS', 2),
('glossary-learning', 'exploration-exploitation', 'CONTAINS', 3),
('glossary-learning', 'beta-bernoulli-conjugate', 'CONTAINS', 4),
('glossary-learning', 'inverse-propensity-scoring', 'CONTAINS', 5),
('glossary-learning', 'team-draft-interleaving', 'CONTAINS', 6);

-- ===== 장치 쪽에도 같은 용어를 건다 (CONTAINS, DAG) — 장치를 펼치면 그 장치의 말이 나온다 =====
INSERT INTO concept_edge (from_concept_id, to_concept_id, kind, ordinal) VALUES
('morphological-analysis', 'morpheme', 'CONTAINS', 2),
('morphological-analysis', 'pos-tag', 'CONTAINS', 3),
('user-dictionary', 'surface-form', 'CONTAINS', 1),
('lattice-viterbi', 'lattice', 'CONTAINS', 1),
('lattice-viterbi', 'viterbi-algorithm', 'CONTAINS', 2),
('lattice-viterbi', 'word-cost', 'CONTAINS', 3),
('lattice-viterbi', 'connection-cost', 'CONTAINS', 4),
('lattice-viterbi', 'context-id', 'CONTAINS', 5),
('system-dictionary-entry', 'mecab-ko-dic', 'CONTAINS', 1),
('tokenizer-cost-retraining', 'crf', 'CONTAINS', 1),
('tokenizer-cost-retraining', 'sejong-corpus', 'CONTAINS', 2),
('ann-search', 'cosine-similarity', 'CONTAINS', 2),
('embedding-model', 'matryoshka-embedding', 'CONTAINS', 1),
('hnsw', 'hnsw-parameters', 'CONTAINS', 2),
('learning-to-rank', 'ltr-loss-families', 'CONTAINS', 2),
('learning-to-rank', 'query-level-cross-validation', 'CONTAINS', 3),
('bandit-exploration', 'exploration-exploitation', 'CONTAINS', 2),
('bandit-exploration', 'beta-bernoulli-conjugate', 'CONTAINS', 3),
('off-policy-evaluation', 'inverse-propensity-scoring', 'CONTAINS', 1),
('interleaving', 'team-draft-interleaving', 'CONTAINS', 1);

-- ===== 같은 층 안 흐름 (FLOWS_TO) — 격자를 깔고, 비용을 붙이고, 비터비로 고른다 =====
INSERT INTO concept_edge (from_concept_id, to_concept_id, kind, ordinal) VALUES
('lattice', 'word-cost', 'FLOWS_TO', 1),
('word-cost', 'connection-cost', 'FLOWS_TO', 2),
('connection-cost', 'viterbi-algorithm', 'FLOWS_TO', 3);
