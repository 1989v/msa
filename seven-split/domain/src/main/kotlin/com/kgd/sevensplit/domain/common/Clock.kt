package com.kgd.sevensplit.domain.common

import java.time.Instant

/**
 * Clock — 시간 의존성 추상화.
 *
 * ## 배치 위치
 * 도메인 레이어. `StrategyRun.end(now)`, 백테스트 엔진 tick 루프 등 도메인 로직이
 * 직접 시간에 의존하기 때문에 port 를 domain 에 둔다 (spec.md §4, ADR-0014).
 *
 * ## 계약
 * - `now()` 는 monotonically non-decreasing 을 보장할 필요는 없다. (NTP 보정 허용)
 * - 예외를 던지지 않는다. 실패 시 기본 구현이 `Instant.now()` 로 폴백하도록 요구한다.
 *
 * ## 구현체
 * - `SystemClock` (페이퍼/실매매) — `Instant.now()` 위임.
 * - `FakeClock` (백테스트/테스트) — Bar timestamp 또는 고정값.
 */
fun interface Clock {
    fun now(): Instant
}
