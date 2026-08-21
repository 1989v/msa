-- ADR-0072 — blog_post.status 에서 SCHEDULED 제거.
--
-- V14 에 SCHEDULED 를 넣었다가 예약 발행을 범위에서 뺐다(폴드된 라이브러리가 호스트에
-- @EnableScheduling 을 얹는 일이라 요구에 없는 기능을 위해 호스트 실행 모델을 바꾸게 된다).
--
-- **V14 를 고치지 않고 새 버전으로 뺀 이유**: V14 는 이미 운영 DB 에 적용된 뒤였다.
-- 적용된 마이그레이션 파일을 고치면 Flyway 체크섬이 어긋나 그 서비스가 통째로 부팅에
-- 실패한다 — 실제로 code-dictionary 가 CrashLoopBackOff 로 떨어졌다(2026-08-21).
-- 적용된 마이그레이션은 불변이다. 바꿔야 하면 언제나 다음 번호다.

ALTER TABLE blog_post DROP CHECK chk_blog_post_status;

ALTER TABLE blog_post
    ADD CONSTRAINT chk_blog_post_status CHECK (status IN ('DRAFT', 'PUBLISHED', 'ARCHIVED'));
