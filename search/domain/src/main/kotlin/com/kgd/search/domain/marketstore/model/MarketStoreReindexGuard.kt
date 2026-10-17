package com.kgd.search.domain.marketstore.model

/** Integer comparison accepts exactly 5%, rejecting empty runs and every ratio above 5%. */
object MarketStoreReindexGuard {
    const val DOCUMENTS_KEY = "marketStoreDocuments"
    fun check(failed: Long, attempted: Long) {
        check(attempted > 0 && failed >= 0 && failed <= attempted && failed * 20 <= attempted) {
            "Market-store failure ratio exceeds 5% ($failed/$attempted); keeping live alias"
        }
    }
}
