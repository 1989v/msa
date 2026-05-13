package com.kgd.codedictionary.application.sync.dto

import java.time.Instant

enum class IndexSyncStatus { PENDING, RUNNING, SUCCESS, FAILED }

data class IndexSyncJob(
    val jobId: String,
    val status: IndexSyncStatus,
    val startedAt: Instant,
    val finishedAt: Instant? = null,
    val newIndex: String? = null,
    val indexedCount: Int = 0,
    val error: String? = null
)
