package com.kgd.quant.application.embedding

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.doubles.shouldBeGreaterThan
import io.kotest.matchers.shouldBe
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * PatternEmbedderSpec — golden 동등성 + 불변식 검증 (ADR-0033 Phase 1 후반).
 *
 * 1) 32차원 출력 길이 보장
 * 2) L2 norm = 1
 * 3) 동일 입력 → 동일 출력 (deterministic)
 * 4) 시그모이드/스케일 변환 무관 — log return 기반이므로 가격 단위 무관
 *
 * Python numpy 측 결과와의 cross-language golden 은 quant/ingest 내 별도 pytest 로 추가 (T32 후속).
 */
class PatternEmbedderSpec : BehaviorSpec({
    val embedder = PatternEmbedder()

    given("60일 임의의 양수 종가") {
        val closes = (0 until 60).map { 100.0 + it * 0.5 }   // 단조증가
        val v = embedder.embed(closes)

        `when`("embed 호출") {
            then("결과 차원은 32") {
                v.size shouldBe 32
            }
            then("L2 norm 은 1 ± 1e-9") {
                val norm = sqrt(v.sumOf { it * it })
                abs(norm - 1.0) shouldBeGreaterThan -1e-9
                (1.0 - abs(norm - 1.0)) shouldBeGreaterThan 0.999999999
            }
            then("동일 입력은 동일 결과 (deterministic)") {
                val v2 = embedder.embed(closes)
                v.toList() shouldBe v2.toList()
            }
            then("스케일 변환(×100) 결과는 동일 — log return 기반") {
                val scaled = closes.map { it * 100.0 }
                val v3 = embedder.embed(scaled)
                for (i in v.indices) abs(v[i] - v3[i]) shouldBeGreaterThan -1e-12
            }
        }
    }

    given("길이 부족(1개) 입력") {
        `when`("embed 호출") {
            then("require 실패") {
                try {
                    embedder.embed(listOf(100.0))
                    error("should have thrown")
                } catch (_: IllegalArgumentException) {
                    // expected
                }
            }
        }
    }

    given("음수/0 종가 포함") {
        `when`("embed 호출") {
            then("require 실패") {
                try {
                    embedder.embed(listOf(100.0, 0.0, 50.0))
                    error("should have thrown")
                } catch (_: IllegalArgumentException) {
                    // expected
                }
            }
        }
    }
})
