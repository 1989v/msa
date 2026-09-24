package com.kgd.codedictionary.application.sync.usecase

import com.kgd.codedictionary.application.sync.dto.IndexSyncJob
import com.kgd.codedictionary.application.sync.dto.SyncOutcome

/** 개념 → 검색 색인 동기화 작업 제출·조회. */
interface SyncConceptIndexUseCase {
    /** 수동 트리거 — jobId 즉시 반환, 실행은 색인 전용 실행기에서 한다. */
    fun submit(): IndexSyncJob
    fun get(jobId: String): IndexSyncJob?

    /**
     * 호출한 스레드에서 한 번 색인한다. 파드 간 리스를 잡은 쪽만 돌고(못 잡으면 [SyncOutcome.Busy]),
     * 시작 때 고정한 대상 해시가 별칭 교체 직전에 바뀌어 있으면 만든 인덱스를 버리고 최신으로 다시 돈다.
     * 실패는 예외로 나간다.
     */
    fun syncNow(): SyncOutcome
}
