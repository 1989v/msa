-- bee-guard 개편 반영: 「벌 막기」 → 「그어서 막기」.
--
-- 무엇이 바뀌었나: 위협이 전부 같은 입자였다(b.x += vx*DT 뿐). 변주가 지형에만 있어서
-- 판이 달라도 요구되는 답이 같았다. 그래서 **막기 유형 3종**으로 나누고 위협마다 물리 성질을
-- 다르게 줬다 — 물(흐름·고임·부착) · 돌(무게로 선이 부러짐·깨짐·관통) · 벌(분열·밀기·반사).
-- 위협 14종, 판 10 → 27.
-- 리스킨이 아님은 수치로 증명됐다: 같은 방어선을 세 유형에 그어 보면 순위가 뒤집힌다
-- (천막이 물 1009점·돌 798점으로 최고인데 벌은 383점으로 나쁘다 — 막으면 갈라지기 때문).
--
-- slug 는 바꾸지 않는다 — URL·색인·서버 세이브를 갈아엎을 이유가 없다(V40 재작명 정책과 동일).
--
-- ★ sdk_integrated 0 → 1, tags 에 leaderboard 추가
--   V54 는 "정해진 판을 푸는 퍼즐이라 점수를 겨루는 축이 없다. 억지로 만들면 잉크를 아끼는
--   대회가 된다" 를 근거로 랭킹을 뺐다. 그 판단은 판 모드에 대해서는 지금도 맞다 —
--   **판 모드는 여전히 랭킹이 없다.**
--   대신 **끝없이 모드**를 신설해 거기서만 점수를 받는다. 잉크를 회복 자원으로 둬서
--   아끼기 대회가 되지 않는 것을 실측했다: 최대 절약(안 그림) 전략이 세 유형 전부에서 최저다
--   (물 113 대 1009 · 돌 97 대 798 · 벌 168 대 383). 10초면 잉크가 다 차므로 아낄 이유가 없고
--   남는 변수는 '어디에 긋느냐' 뿐이다.
--
-- 랭킹 보드는 유형별로 3개다(leak / rockfall / bee). 게임은 runEnd 에 board 를 실어 보내고,
-- 판 모드에서는 호출하지 않는다(실측: 판 모드 승/패 모두 0회, 끝없이 사망·중단 각 1회).
-- ※ 플랫폼의 ScoreTrack 은 아직 BASE/MODDED 뿐이라 보드 분리는 별도 작업이다.
--
-- 실측: 27판 전수 검사 통과(모범답안 성공·빈손 실패·예산 내) · 죽은 입력 200칸 0 ·
--       완주 회귀 27판 예외 0 · 120fps(120입자+260파티클 최악 부하 포함) · 외부 요청 0 ·
--       모바일 390x844 터치 드로잉 확인(가상패드 미배선 — 손으로 그리는 게임이라 패드가 판을 가린다)

UPDATE game
SET title              = '그어서 막기',
    title_en           = 'Draw to Guard',
    description        = '선을 그어 막는다 — 막기 유형 세 가지. 물은 흐르니 막는 게 아니라 흘려보낼 각도를 찾아야 하고, 돌은 무거워 받침 없는 선을 부러뜨리며, 벌은 막으면 갈라진다. 위협 14종이 저마다 다른 답을 요구한다. 정해진 판을 푸는 판 모드 27판과, 계속 몰려오는 끝없이 모드가 유형마다 있다. 잉크는 시간이 지나면 차오르니 아끼지 말고 어디에 그을지를 고민하면 된다.',
    description_en     = 'Draw a line and hold it back — in three flavours. Water flows, so the answer is an angle that drains it rather than a wall; rocks are heavy and snap any stroke without support; bees split in two when you block them. Fourteen hazards, each asking a different question. Twenty-seven hand-built puzzles plus an endless mode for every flavour. Ink refills over time, so the question is never how little to draw but where.',
    sdk_integrated     = 1,
    tags               = '["puzzle","drawing","leaderboard"]',
    content_updated_at = NOW(6),
    updated_at         = NOW(6)
WHERE slug = 'bee-guard';

INSERT IGNORE INTO game_tag_map (game_id, tag_slug)
SELECT g.id, t.slug
FROM game g
         CROSS JOIN (SELECT 'puzzle' AS slug UNION ALL SELECT 'drawing' UNION ALL SELECT 'leaderboard') t
WHERE g.slug = 'bee-guard';
