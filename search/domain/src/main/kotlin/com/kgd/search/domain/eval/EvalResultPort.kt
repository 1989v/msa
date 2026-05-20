package com.kgd.search.domain.eval

interface EvalResultPort {
    fun saveAll(results: List<EvalResult>)
}
