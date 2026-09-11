package com.kgd.codedictionary.application.sync.usecase

import com.kgd.codedictionary.application.sync.dto.IndexSyncJob

/** 개념 → 검색 색인 동기화 작업 제출·조회. 실행 자체는 비동기다. */
interface SyncConceptIndexUseCase {
    /** 동기 트리거 — jobId 즉시 반환, 백그라운드에서 실행된다. */
    fun submit(): IndexSyncJob
    fun get(jobId: String): IndexSyncJob?
}
