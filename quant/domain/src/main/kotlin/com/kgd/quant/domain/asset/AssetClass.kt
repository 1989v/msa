package com.kgd.quant.domain.asset

/**
 * AssetClass — 자산의 도메인 분류.
 *
 * - [CRYPTO] : 암호화폐 (Phase 1 활성)
 * - [STOCK_KR] : 한국 주식 (Phase 2)
 * - [STOCK_US] : 미국 주식 (Phase 2)
 *
 * 미래 확장 후보: ETF, 인덱스, 외환, 원자재.
 */
enum class AssetClass {
    CRYPTO,
    STOCK_KR,
    STOCK_US,
}
