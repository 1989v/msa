-- ADR-0050 Phase 3 — product.brand 필드 신설.
-- Phase 3 MultiScopeBanditBlender 의 brand-scope MAB 활성화 + Seller diversity (brand key) 활용 전제.
ALTER TABLE products
    ADD COLUMN brand VARCHAR(100) NULL AFTER status;
