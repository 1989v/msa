package com.kgd.search.domain.bandit.model

data class BanditPosterior(val alpha: Double, val beta: Double) {
    init {
        require(alpha > 0.0) { "alpha must be > 0: $alpha" }
        require(beta > 0.0) { "beta must be > 0: $beta" }
    }

    fun mean(): Double = alpha / (alpha + beta)
}
