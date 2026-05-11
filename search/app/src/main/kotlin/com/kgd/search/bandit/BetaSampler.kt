package com.kgd.search.bandit

import java.util.concurrent.ThreadLocalRandom
import kotlin.math.ln
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Beta(α, β) sampler.
 *
 * Beta(α, β) = X / (X + Y),  X ~ Gamma(α, 1), Y ~ Gamma(β, 1).
 *
 * Gamma sampling uses Marsaglia & Tsang (2000):
 *   - shape >= 1: standard method
 *   - shape <  1: boosting trick — sample Gamma(shape+1) then multiply by U^(1/shape).
 */
object BetaSampler {

    fun sample(alpha: Double, beta: Double): Double {
        require(alpha > 0.0 && beta > 0.0) { "alpha and beta must be > 0" }
        val x = sampleGamma(alpha)
        val y = sampleGamma(beta)
        val denom = x + y
        return if (denom == 0.0) 0.5 else x / denom
    }

    private fun sampleGamma(shape: Double): Double {
        val rng = ThreadLocalRandom.current()
        if (shape < 1.0) {
            val u = rng.nextDouble()
            return sampleGammaShapeGte1(shape + 1.0) * u.pow(1.0 / shape)
        }
        return sampleGammaShapeGte1(shape)
    }

    private fun sampleGammaShapeGte1(shape: Double): Double {
        val rng = ThreadLocalRandom.current()
        val d = shape - 1.0 / 3.0
        val c = 1.0 / sqrt(9.0 * d)
        while (true) {
            var x: Double
            var v: Double
            do {
                x = rng.nextGaussian()
                v = 1.0 + c * x
            } while (v <= 0.0)
            val v3 = v * v * v
            val u = rng.nextDouble()
            val xSq = x * x
            if (u < 1.0 - 0.0331 * xSq * xSq) return d * v3
            if (ln(u) < 0.5 * xSq + d * (1.0 - v3 + ln(v3))) return d * v3
        }
    }
}
