package com.kgd.ads.application.decision.port

import com.kgd.ads.application.decision.dto.CandidateSource
import com.kgd.ads.application.decision.dto.CounterQuery
import com.kgd.ads.application.decision.dto.DecisionCounters
import com.kgd.ads.application.decision.dto.ServeTally
import java.time.Duration
import java.time.LocalDateTime

interface CandidateSourcePort {
    /** 후보 인덱스의 원료를 한 읽기 트랜잭션에서 읽는다. [dayStart] 는 오늘(KST) 00:00 — 오늘 청구 누계의 시작. */
    fun load(dayStart: LocalDateTime): CandidateSource
}

interface DecisionCounterPort {
    /** 빈도·캠페인 지출·광고주 지출을 **한 번의 왕복**으로 읽는다. 실패·타임아웃이면 null. */
    fun read(query: CounterQuery): DecisionCounters?

    /** 지면 요청·유료 채움·미등록 지면 카운터를 **한 번의 쓰기 명령**으로 올린다. 실패하면 false. */
    fun record(tally: ServeTally): Boolean
}

interface DecisionMetricsPort {
    fun recordLatency(elapsed: Duration)

    /** 지면별 결과. [placement] 는 등록된 지면 키이거나 `unregistered` — 요청 값을 그대로 태그로 쓰지 않는다. */
    fun recordOutcome(placement: String, outcome: String)

    fun recordIndexRefreshed(at: LocalDateTime)
}
