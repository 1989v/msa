-- 랭킹 기록을 회원과 잇는다.
--
-- game_score 는 닉네임만 갖고 있었다(게스트 제출 허용이 전제). 그래서 "이 회원의 랭킹" 을
-- 정확히 뽑을 수 없었고, 상세 화면의 개인 기록 패널이 성립하지 않았다.
--
-- 기존 행은 채우지 않는다. 닉네임으로 회원을 역추적하면 남의 기록을 남에게 붙일 수 있다 —
-- 닉네임은 유일하지 않고 게스트도 같은 이름을 쓸 수 있다. **이후 제출부터** 연결한다.

ALTER TABLE game_score
    ADD COLUMN member_id BIGINT NULL COMMENT '제출 당시 로그인 회원. 게스트 제출이면 NULL' AFTER nickname;

-- 개인 기록 조회는 (회원, 게임) 으로 들어온다
CREATE INDEX idx_game_score_member ON game_score (member_id, game_id);
