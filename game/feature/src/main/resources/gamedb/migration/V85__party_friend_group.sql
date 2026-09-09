-- 친구 그룹 (ADR-0092) — 파티에서 쓰는 참가자 명부.
--
-- **이 파일을 고치지 마라** — 커밋한 마이그레이션은 이미 적용됐을 수 있고, 되고치면
-- 체크섬 불일치로 code-dictionary 가 통째로 기동하지 못한다(폴드 호스트라 7개 도메인이 함께 죽는다).
--
-- ## 왜 game_db 인가
-- member 에 두지 않는다. 그 서비스는 소셜에서 이메일·실명을 안 받는 것으로 식별을 최소화하는데
-- (ADR-0078), 거기에 사용자가 손으로 적은 이름을 넣으면 그 원칙이 깨진다. 다만 **위치를 옮긴
-- 것이지 위험을 줄인 것이 아니다** — 별칭은 자유 텍스트라 실명이 들어올 수 있고, 저장 대상이
-- 내가 아니라 **내 친구**다. 그래서 옵트인·즉시 삭제·보존기간·방침 넷이 함께 간다.
--
-- ## 옵트인은 행의 존재로 표현한다
-- `party_roster_optin` 에 행이 있으면 켜진 것이고, 끄면 행과 그룹을 **함께 하드 삭제**한다.
-- 플래그 컬럼을 두면 「꺼졌는데 데이터는 남은」 상태가 생기고, 그것이 방침 위반이다.

CREATE TABLE party_roster_optin
(
    member_id  BIGINT      NOT NULL COMMENT '이 회원이 계정 저장을 켰다',
    created_at DATETIME(6) NOT NULL DEFAULT NOW(6),
    PRIMARY KEY (member_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='친구 그룹 계정 저장 옵트인 — 행이 있으면 켜진 것';

CREATE TABLE party_friend_group
(
    id           BIGINT      NOT NULL AUTO_INCREMENT,
    member_id    BIGINT      NOT NULL COMMENT 'FK-as-ID. member 스키마를 참조하지 않는다',
    name         VARCHAR(24) NOT NULL COMMENT '그룹 이름. 사용자에게 보이는 구분자',
    -- 마지막으로 판에 쓰인 때. 보존기간(마지막 사용 후 365일)이 이 값으로 잰다.
    last_used_at DATETIME(6) NOT NULL DEFAULT NOW(6),
    created_at   DATETIME(6) NOT NULL DEFAULT NOW(6),
    updated_at   DATETIME(6) NOT NULL DEFAULT NOW(6) ON UPDATE NOW(6),
    PRIMARY KEY (id),
    -- 이름이 그룹의 사용자 쪽 식별자다. 겹치면 업로드가 말없이 덮어 다른 기기에서 만든
    -- 그룹이 사라지므로, DB 가 막고 애플리케이션이 물어본다.
    UNIQUE KEY uk_party_group_member_name (member_id, name),
    KEY idx_party_group_last_used (last_used_at)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='친구 그룹 (ADR-0092)';

CREATE TABLE party_friend_group_member
(
    id         BIGINT      NOT NULL AUTO_INCREMENT,
    group_id   BIGINT      NOT NULL,
    -- **실명일 수 있다고 전제한다.** 별명 사용을 권하는 안내가 화면에 뜨지만 막을 수는 없다.
    -- 로그·메트릭·에러 리포트·분석 이벤트에 이 값을 싣지 않는다.
    alias      VARCHAR(12) NOT NULL,
    sort_order INT         NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_party_group_member_group (group_id)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4
  COLLATE = utf8mb4_unicode_ci COMMENT ='친구 그룹의 별칭 — 제3자의 이름이다';
