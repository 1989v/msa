package com.kgd.quant.infrastructure.persistence.payload

import com.kgd.quant.domain.market.MarketCode
import com.kgd.quant.domain.strategy.BollingerSqueeze
import com.kgd.quant.domain.strategy.FixedKrw
import com.kgd.quant.domain.strategy.FixedQuantity
import com.kgd.quant.domain.strategy.KimchiPremiumThreshold
import com.kgd.quant.domain.strategy.MaCross
import com.kgd.quant.domain.strategy.PercentBalance
import com.kgd.quant.domain.strategy.RsiBreakout
import com.kgd.quant.domain.strategy.SignalConfig
import com.kgd.quant.domain.strategy.VolumeSpike
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import tools.jackson.databind.ObjectMapper
import java.math.BigDecimal

/**
 * `signal_strategy` 의 JSON 컬럼 저장 포맷 계약.
 *
 * 판별자 문자열은 **이미 DB 에 들어 있는 값**이라 바꾸면 기존 행을 못 읽는다. 프레젠테이션 DTO 를
 * 그대로 직렬화하던 때는 API 응답 이름을 고치면 여기가 조용히 깨졌고, 배포 뒤에야 드러났다.
 */
class SignalConfigPayloadSpec : BehaviorSpec({
    val mapper = ObjectMapper()

    Given("저장 포맷 판별자") {
        val cases = listOf(
            "VOLUME_SPIKE" to VolumeSpike(BigDecimal("2.5"), 20),
            "RSI_BREAKOUT" to RsiBreakout(14, BigDecimal("70"), RsiBreakout.Direction.OVERBOUGHT),
            "MA_CROSS" to MaCross(5, 20, MaCross.CrossDirection.GOLDEN),
            "BB_SQUEEZE" to BollingerSqueeze(20, BigDecimal("2.0"), BigDecimal("0.05")),
            "KIMCHI_PREMIUM" to KimchiPremiumThreshold(BigDecimal("3"), BigDecimal("1"), MarketCode("BINANCE")),
        )

        When("도메인을 저장 포맷으로 직렬화하면") {
            Then("판별자가 고정된 이름으로 나간다") {
                cases.forEach { (discriminator, config) ->
                    mapper.writeValueAsString(SignalConfigPayload.from(config as SignalConfig)) shouldContain
                        """"type":"$discriminator""""
                }
            }
        }

        When("저장된 JSON 을 다시 읽으면") {
            Then("같은 도메인 값으로 돌아온다") {
                cases.forEach { (_, config) ->
                    val json = mapper.writeValueAsString(SignalConfigPayload.from(config as SignalConfig))
                    mapper.readValue(json, SignalConfigPayload::class.java).toDomain() shouldBe config
                }
            }
        }
    }

    Given("포지션 사이징 저장 포맷") {
        val cases = listOf(
            "FIXED_KRW" to FixedKrw(BigDecimal("100000")),
            "PERCENT_BALANCE" to PercentBalance(BigDecimal("10")),
            "FIXED_QUANTITY" to FixedQuantity(BigDecimal("0.5")),
        )

        When("왕복시키면") {
            Then("판별자와 값이 모두 보존된다") {
                cases.forEach { (discriminator, sizing) ->
                    val json = mapper.writeValueAsString(PositionSizingPayload.from(sizing))
                    json shouldContain """"type":"$discriminator""""
                    mapper.readValue(json, PositionSizingPayload::class.java).toDomain() shouldBe sizing
                }
            }
        }
    }
})
