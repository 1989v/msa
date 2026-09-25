package com.kgd.payment.presentation.webhook.controller

import com.kgd.payment.application.payment.usecase.ResolvePaymentUseCase
import com.kgd.payment.presentation.webhook.dto.TossWebhookRequest
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 토스 결제 상태 웹훅 — `payment.pg=toss` 일 때만 빈이 생긴다. 기본(모의 PG)에서는 이 경로가 404 다.
 *
 * 웹훅은 **재조회 신호일 뿐**이다. 토스 결제 상태 웹훅에는 서명이 없고 임의 헤더도 못 붙이므로 본문·헤더를 믿지 않는다 —
 * 본문에서 읽는 것은 다시 물어볼 주문번호(`data.orderId`) 하나이고, 상태·금액은 그 주문번호로 PG 를 재조회한 결과로만 정한다.
 * 그래서 위조 본문은 "이 주문을 지금 다시 조회하라" 이상을 할 수 없다. 이미 결론 난 결제·없는 주문번호는 PG 를 부르지 않는다.
 * 공개 경로라 게이트웨이가 신원 헤더를 벗기고 레이트 리밋을 건다.
 */
@RestController
@ConditionalOnProperty(prefix = "payment", name = ["pg"], havingValue = "toss")
@RequestMapping("/api/v1/payments/webhooks")
class TossWebhookController(
    private val resolvePaymentUseCase: ResolvePaymentUseCase,
) {
    private val log = KotlinLogging.logger {}

    @PostMapping("/toss")
    fun receive(@RequestBody body: TossWebhookRequest): ResponseEntity<Void> {
        val orderNo = body.data?.orderId?.takeIf { it.isNotBlank() } ?: return ResponseEntity.badRequest().build()
        val outcome = resolvePaymentUseCase.resolveByOrderNo(orderNo)
        log.info { "토스 웹훅 → 재조회: orderNo=$orderNo, outcome=$outcome" }
        return ResponseEntity.ok().build()
    }
}
