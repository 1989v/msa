-- 유니티 라인 세 게임이 「새로 나온 게임」 컬렉션과 신작 탭(sort=new)에서 빠져 있었다.
--
-- 원인: released_at 이 NULL 이었다. 정렬이 released_at DESC NULLS LAST 라 새 게임일수록 맨 뒤로
--   밀렸다. 캔버스 시드는 released_at 에 NOW(6) 을 넣는데, 유니티 첫 시드(V69)에서 score_boards
--   컬럼이 하나 늘면서 값 자리가 밀려 `NULL, NULL` 이 됐고 V73·V74 가 그 형식을 복사했다.
--   BETA 승격(V70)도 채우지 않았고, 도메인의 launchBeta() 도 채우지 않았다(publish 만 채웠다).
--   운영에서 PUBLISHED 73개는 NULL 0개, BETA·DRAFT 4개만 NULL — 정확히 새 게임들만 빠지는 구조였다.
--
-- 세 겹으로 막는다:
--   ① 정렬은 COALESCE(released_at, created_at) — 비어도 뒤로 밀리지 않는다 (GameQueryRepository)
--   ② 도메인 launchBeta(now) 가 처음 노출되는 순간 released_at 을 찍는다 (Game.kt)
--   ③ 이 파일 — 이미 들어간 행을 채우고, **노출 상태면 released_at 이 비어 있을 수 없다**는 CHECK 를
--      건다. 시드가 또 BETA 를 NULL 로 넣으면 마이그레이션이 실패해 테스트 게이트에서 잡힌다.
--      잡히게 만드는 것보다 쓸 수 없게 만드는 편이 낫다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).

-- 노출 상태인데 비어 있는 것 전부 — 그 행이 마지막으로 바뀐 시점을 출시 시점으로 삼는다
-- (아홉 종·마지막 한 사람은 그것이 BETA 로 오른 순간이다)
UPDATE game
SET released_at = COALESCE(content_updated_at, created_at)
WHERE status IN ('BETA', 'PUBLISHED')
  AND released_at IS NULL;

-- 인피니티 스탭 — DRAFT → BETA. 캐릭터가 아홉 종 리그의 틴트라 DRAFT 로 두었는데, 아홉 종 자체가
-- 같은 상태로 BETA 에 올라가 있으므로 같은 기준을 적용한다. 전용 캐릭터는 BETA 위에서 갈아 끼운다.
UPDATE game
SET status = 'BETA',
    released_at = NOW(6),
    content_updated_at = NOW(6)
WHERE slug = 'infinity-step'
  AND status = 'DRAFT';

-- 노출 상태(BETA·PUBLISHED)면 released_at 이 있어야 한다. DRAFT·REVIEW 는 아직 출시 전이라 비어 있고,
-- SUSPENDED 는 PUBLISHED 에서 내려온 것이라 값이 있지만 제약 밖에 둔다(정지 처분이 값에 걸리면 안 된다).
ALTER TABLE game
    ADD CONSTRAINT chk_game_released_when_visible
        CHECK (status NOT IN ('BETA', 'PUBLISHED') OR released_at IS NOT NULL);
