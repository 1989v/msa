package com.kgd.quant.domain.asset

/**
 * Asset — 시계열 가격이 정의되는 거래 대상 (자산).
 *
 * 자산 클래스에 무관한 단일 추상 모델 — 주식·암호화폐 모두 동일 인터페이스로 다룬다 (ADR-0033).
 *
 * - `code` 는 자산 식별자 (예: "BTC", "AAPL", "005930").
 * - `assetClass` 는 도메인 분류 (CRYPTO / STOCK_KR / STOCK_US).
 * - `displayName` 은 UI 노출용 — 영구 보장 X (외부 카탈로그 변경 시 갱신 가능).
 *
 * Phase 1 은 CRYPTO 만 활성. STOCK_* 는 Phase 2 에서 ingest sidecar 로 데이터 공급 후 활성.
 */
data class Asset(
    val code: AssetCode,
    val assetClass: AssetClass,
    val displayName: String,
) {
    init {
        require(displayName.isNotBlank()) { "displayName must not be blank" }
    }
}
