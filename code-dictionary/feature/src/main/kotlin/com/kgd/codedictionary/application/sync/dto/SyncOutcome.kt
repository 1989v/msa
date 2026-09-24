package com.kgd.codedictionary.application.sync.dto

/** 색인 한 번의 결과 */
sealed interface SyncOutcome {
    /** 별칭을 옮겼고 `derived_hash` 에 [targetHash] 를 적었다 */
    data class Done(val newIndex: String, val indexedCount: Int, val targetHash: String) : SyncOutcome

    /** 다른 인스턴스가 리스를 쥐고 색인 중이다 */
    data object Busy : SyncOutcome
}
