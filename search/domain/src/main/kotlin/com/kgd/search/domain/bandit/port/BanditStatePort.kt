package com.kgd.search.domain.bandit.port

import com.kgd.search.domain.bandit.model.BanditKey
import com.kgd.search.domain.bandit.model.BanditState

interface BanditStatePort {
    fun fetch(key: BanditKey): BanditState?
    fun fetchBatch(keys: Collection<BanditKey>): Map<BanditKey, BanditState>
}
