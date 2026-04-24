package com.kgd.sevensplit.domain.credential

/**
 * 지원 거래소.
 *
 * Phase 1은 두 개만 지원 (빗썸/업비트). 추가 거래소는 enum 확장 + adapter 구현.
 */
enum class Exchange {
    BITHUMB,
    UPBIT
}
