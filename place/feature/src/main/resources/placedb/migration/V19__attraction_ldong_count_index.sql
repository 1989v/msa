-- 행정구역 드릴다운의 건수 집계(ADR-0071, `GET /api/places/administrative-regions?lang=…`)가
-- 운영에서 **14초**였다. 프리렌더가 이 엔드포인트를 지역 수만큼 부르므로 배포 빌드가 통째로 막혔다.
--
-- 원인은 인덱스가 **필터와 그룹 키를 함께 덮지 않는 것**이었다. `AttractionJpaRepository.countByLdong` 은
--   WHERE lang=? AND status='ACTIVE' AND category IN (4종) AND ldong_regn_cd IS NOT NULL
--   GROUP BY ldong_regn_cd, ldong_signgu_cd
-- 인데, 있던 인덱스는 `(category)` 와 `(ldong_regn_cd, ldong_signgu_cd)` 둘뿐이라 옵티마이저가
-- **ldong 인덱스를 통째로 훑으며**(EXPLAIN type=index, rows 56,062, filtered 0.19%) lang·status·category 를
-- 뒤에서 걸렀다. 실제 대상은 18,491 행이다.
--
-- 그래서 필터 셋을 앞에, 그룹 키를 뒤에 둔 복합 인덱스를 만든다 — InnoDB 는 PK(id)를 보조 인덱스에
-- 실으므로 COUNT(id) 까지 **커버링**이 된다(테이블 접근 0).
--
-- 기존 `idx_attractions_ldong` 은 남긴다: 법정동 코드만으로 찾는 다른 경로(수집기 대조)가 쓴다.
--
-- **이 파일을 고치지 마라** — 커밋된 마이그레이션은 이미 적용됐을 수 있고, 고치면
-- 체크섬 불일치로 폴드 호스트가 통째로 기동하지 못한다.

CREATE INDEX idx_attractions_ldong_count
    ON attractions (lang, status, category, ldong_regn_cd, ldong_signgu_cd);
