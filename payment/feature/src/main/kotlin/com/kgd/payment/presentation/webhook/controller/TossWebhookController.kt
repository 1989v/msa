package com.kgd.payment.presentation.webhook.controller

import com.kgd.payment.application.payment.usecase.ResolvePaymentUseCase
import com.kgd.payment.presentation.webhook.dto.TossWebhookRequest
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Value
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.security.MessageDigest

/**
 * 토스 결제 상태 웹훅 — `payment.pg=toss` 일 때만 빈이 생긴다. 기본(모의 PG)에서는 이 경로가 404 다.
 *
 * 검증 방식: 토스의 결제 상태 변경 웹훅에는 HMAC 서명이 없다. 그래서 ① 공유 비밀 헤더([SECRET_HEADER])를
 * 상수 시간 비교로 확인하고(틀리면 401) ② 본문의 상태·금액은 **무시**하고 orderId 로 PG 를 다시 조회해
 * 그 결과로만 전이한다 — 비밀이 새도 위조 본문으로 상태를 바꿀 수 없다. 이미 결론 난 결제는 no-op.
 */
@RestController
@ConditionalOnProperty(prefix = "payment", name = ["pg"], havingValue = "toss")
@RequestMapping("/api/v1/payments/webhooks")
class TossWebhookController(
    private val resolvePaymentUseCase: ResolvePaymentUseCase,
    @Value("\${payment.toss.webhook-secret}") webhookSecret: String,
) {
    private val log = KotlinLogging.logger {}
    private val secret: ByteArray = webhookSecret
        .also { require(it.isNotBlank()) { "TOSS_WEBHOOK_SECRET 가 비었습니다 — payment.pg=toss 는 키 없이 기동하지 않는다" } }
        .toByteArray()

    @PostMapping("/toss")
    fun receive(
        @RequestHeader(value = SECRET_HEADER, required = false) presented: String?,
        @RequestBody body: TossWebhookRequest,
    ): ResponseEntity<Void> {
        if (presented == null || !MessageDigest.isEqual(secret, presented.toByteArray())) {
            log.warn { "토스 웹훅 비밀 불일치 — 거부" }
            return ResponseEntity.status(401).build()
        }
        val orderNo = body.data?.orderId?.takeIf { it.isNotBlank() } ?: return ResponseEntity.badRequest().build()
        val outcome = resolvePaymentUseCase.resolveByOrderNo(orderNo)
        log.info { "토스 웹훅 처리: orderNo=$orderNo, outcome=$outcome" }
        return ResponseEntity.ok().build()
    }

    companion object {
        const val SECRET_HEADER = "X-Toss-Webhook-Secret"
    }
}
