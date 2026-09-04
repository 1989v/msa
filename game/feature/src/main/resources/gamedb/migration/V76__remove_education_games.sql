-- 학습(EDUCATION) 축을 통째로 걷어낸다 — 장르 · 태그 · 홈 컬렉션 · 게임 5종.
--
-- 이 축의 게임은 코드 사전 개념을 문제로 내던 초기 프로토타입(V2 내장 4종)과
-- 끝말잇기(word-chain, V20)이고, 다섯 개를 합친 플레이가 1회다.
-- 장르 칩 한 자리와 홈의 한 행을 계속 차지할 근거가 없어 노출이 아니라 존재를 지운다.
--
-- FK 가 없으므로(FK-as-ID 컨벤션) 종속 표를 명시적으로 지운다.
-- 지울 대상을 slug 로 잡는 이유는 id 가 환경마다 다를 수 있어서다.

-- 1) 답글 → 제안 (제안 id 를 먼저 쓰므로 답글이 앞선다)
DELETE
FROM game_suggestion_reply
WHERE suggestion_id IN (SELECT id
                        FROM game_suggestion
                        WHERE game_id IN (SELECT id
                                          FROM game
                                          WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier',
                                                         'concept-cascade', 'word-chain')));

DELETE
FROM game_suggestion
WHERE game_id IN (SELECT id
                  FROM game
                  WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier',
                                 'concept-cascade', 'word-chain'));

-- 2) game_id 를 직접 가진 표
DELETE FROM game_play_session WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_rating       WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_save_data    WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_run          WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_score        WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_score_daily  WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_release_note WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM reward_grant      WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_stats        WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));
DELETE FROM game_tag_map      WHERE game_id IN (SELECT id FROM game WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain'));

-- 3) 게임
DELETE
FROM game
WHERE slug IN ('concept-memory', 'fill-blank-quiz', 'code-magnifier', 'concept-cascade', 'word-chain');

-- 4) 남은 education 태그 매핑 — 위 5종 밖에 붙은 것이 있다면 여기서 끊는다.
DELETE FROM game_tag_map WHERE tag_slug = 'education';
DELETE FROM game_tag WHERE slug = 'education';

-- 역정규화된 game.tags 에서도 뺀다 (V27 이 map 과 맞춰 둔 사본)
UPDATE game
SET tags       = JSON_REMOVE(tags, JSON_UNQUOTE(JSON_SEARCH(tags, 'one', 'education'))),
    updated_at = NOW(6)
WHERE JSON_SEARCH(tags, 'one', 'education') IS NOT NULL;

-- 5) 홈의 '학습 게임' 행 (TAG_BASED = education 이라 태그가 사라지면 영원히 빈 행이다)
DELETE FROM game_collection WHERE slug = 'education-picks';

-- 6) 장르 축에서 제거. 위에서 두 게임이 사라져 남은 행이 없어야 하지만,
--    어드민이 만든 행이 있으면 Genre enum 에서 값을 빼는 순간 조회가 깨지므로 되돌린다.
UPDATE game SET genre = 'PUZZLE', updated_at = NOW(6) WHERE genre = 'EDUCATION';
