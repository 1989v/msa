package com.kgd.deal.infrastructure.linkcheck

import com.kgd.deal.domain.model.LinkStatus

/** 한 링크의 점검 결과 */
data class ProbeResult(val status: LinkStatus, val statusCode: Int?)

/**
 * HTTP 응답 코드를 링크 상태로 옮기는 규칙 (ADR-0069 §5).
 *
 * [LinkStatus.UNKNOWN] 이 [LinkStatus.BROKEN] 과 분리돼 있는 것이 이 클래스의 존재 이유다.
 * 제휴사 사이트 상당수가 봇을 차단해 HEAD 에 403/405/429 를 돌려주는데, 이걸 BROKEN 으로
 * 찍으면 경고 목록이 오탐으로 가득 차고 어드민이 목록 자체를 무시하게 된다. 그 순간
 * 방치를 막으려고 만든 장치가 방치의 알리바이가 된다.
 *
 * 확실한 사망 신호(404 / 410)만 BROKEN 으로 본다.
 */
object LinkProbeRules {

    fun classify(statusCode: Int): ProbeResult = when {
        statusCode in 200..399 -> ProbeResult(LinkStatus.OK, statusCode)
        statusCode == 404 || statusCode == 410 -> ProbeResult(LinkStatus.BROKEN, statusCode)
        else -> ProbeResult(LinkStatus.UNKNOWN, statusCode)
    }

    /** 네트워크 오류·타임아웃 — 우리 쪽 문제일 수도 있어 사망 선고를 하지 않는다 */
    fun unreachable(): ProbeResult = ProbeResult(LinkStatus.UNKNOWN, null)

    /** HEAD 를 안 받는 서버가 있다. 405 면 바이트 1개짜리 GET 으로 한 번 더 물어본다. */
    fun shouldRetryWithGet(statusCode: Int): Boolean = statusCode == 405 || statusCode == 501
}
