package com.kgd.ads.application.decision.usecase

/** 후보 인덱스를 DB 에서 다시 읽어 바꾼다. 스케줄 작업이 1분 안쪽 주기로 부르고, 테스트는 직접 부른다. */
interface RefreshCandidateIndexUseCase {
    fun refresh()
}
