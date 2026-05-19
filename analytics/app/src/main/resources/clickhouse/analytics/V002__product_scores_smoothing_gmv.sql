-- ADR-0050 Phase 2: CTR/CVR Bayesian smoothing 의 raw 디버그 컬럼 + GMV 1h 컬럼.
--
-- ctr_raw / cvr_raw : smoothing 적용 전 원시 비율 (디버그/평가 용)
-- gmv_1h           : 해당 window 의 GMV 합 (ORDER_COMPLETE payload 의 amount/totalPrice/gmv key 합산)
--
-- 추후 search:batch 의 평가 잡 + admin-fe side-by-side UI 에서 raw 컬럼 사용.

ALTER TABLE analytics.product_scores
    ADD COLUMN IF NOT EXISTS ctr_raw Float64 DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS cvr_raw Float64 DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS gmv_1h  Float64 DEFAULT 0.0;
