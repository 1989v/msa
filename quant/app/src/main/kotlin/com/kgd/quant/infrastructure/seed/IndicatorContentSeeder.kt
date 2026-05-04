package com.kgd.quant.infrastructure.seed

import com.kgd.quant.application.port.persistence.IndicatorContentRepositoryPort
import com.kgd.quant.domain.common.Clock
import com.kgd.quant.domain.learn.ContentId
import com.kgd.quant.domain.learn.IndicatorCategory
import com.kgd.quant.domain.learn.IndicatorContent
import com.kgd.quant.domain.learn.Slug
import io.github.oshai.kotlinlogging.KotlinLogging
import kotlinx.coroutines.runBlocking
import org.springframework.boot.context.event.ApplicationReadyEvent
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.context.event.EventListener
import org.springframework.stereotype.Component
import java.util.UUID

private val log = KotlinLogging.logger {}

/**
 * IndicatorContentSeeder — 학습 메뉴 6종 지표 시드 (ADR-0033 Phase 1).
 *
 * 시드 대상이 이미 존재(slug 기준)하면 skip — 멱등 보장.
 *
 * 활성화: `quant.learn.seed.enabled=true` (default true). 운영에선 어드민 CRUD 우선이라
 * `false` 로 둘 수 있다.
 */
@Component
@ConditionalOnProperty(name = ["quant.learn.seed.enabled"], havingValue = "true", matchIfMissing = true)
class IndicatorContentSeeder(
    private val repo: IndicatorContentRepositoryPort,
    private val clock: Clock,
) {
    @EventListener(ApplicationReadyEvent::class)
    fun seed() = runBlocking {
        SEEDS.forEach { spec ->
            val existing = repo.findBySlug(Slug(spec.slug), includeUnpublished = true)
            if (existing != null) {
                log.debug { "skip seed (already exists): ${spec.slug}" }
                return@forEach
            }
            val now = clock.now()
            repo.save(
                IndicatorContent(
                    id = ContentId(UUID.randomUUID()),
                    slug = Slug(spec.slug),
                    title = spec.title,
                    category = spec.category,
                    summary = spec.summary,
                    bodyMarkdown = spec.body,
                    formulaTeX = spec.formula,
                    examples = emptyList(),
                    createdAt = now,
                    updatedAt = now,
                    publishedAt = now,                  // 시드는 즉시 게시
                )
            )
            log.info { "seeded indicator content: ${spec.slug}" }
        }
    }

    private data class Spec(
        val slug: String,
        val title: String,
        val category: IndicatorCategory,
        val summary: String,
        val body: String,
        val formula: String?,
    )

    companion object {
        private val SEEDS = listOf(
            Spec(
                slug = "rsi",
                title = "RSI (Relative Strength Index)",
                category = IndicatorCategory.MOMENTUM,
                summary = "최근 N봉의 상승/하락 평균 비율로 과매수·과매도 영역을 판단하는 모멘텀 지표",
                body = """
                    ## 정의
                    Relative Strength Index — 최근 N봉(보통 14)의 평균 상승폭과 평균 하락폭의 비율을
                    0~100 으로 정규화한 모멘텀 지표.

                    ## 해석
                    - 70 이상: 과매수(overbought) — 단기 조정 가능성
                    - 30 이하: 과매도(oversold) — 단기 반등 가능성
                    - 50 부근: 추세 부재

                    ## 활용
                    - 임계 돌파 시그널 (예: 30 이하 → 매수 검토)
                    - 다이버전스: 가격은 신고가지만 RSI 가 동행하지 않으면 추세 약화
                """.trimIndent(),
                formula = "RSI = 100 - 100 / (1 + RS),  RS = (평균 상승폭) / (평균 하락폭)",
            ),
            Spec(
                slug = "macd",
                title = "MACD (Moving Average Convergence Divergence)",
                category = IndicatorCategory.TREND,
                summary = "단기·장기 EMA 의 차이로 추세 전환과 모멘텀을 동시에 보여주는 지표",
                body = """
                    ## 정의
                    Moving Average Convergence Divergence — 단기 EMA(12) 와 장기 EMA(26) 의 차이를
                    MACD 라인, 그 9일 EMA 를 시그널 라인이라 한다.

                    ## 해석
                    - MACD > 시그널: 상승 모멘텀 (골든 크로스)
                    - MACD < 시그널: 하락 모멘텀 (데드 크로스)
                    - 0선 돌파: 추세 전환

                    ## 활용
                    - MA Cross 시그널 strategy 의 입력
                    - 히스토그램(MACD - 시그널) 으로 모멘텀 강도 측정
                """.trimIndent(),
                formula = "MACD = EMA(12) - EMA(26),  Signal = EMA(MACD, 9)",
            ),
            Spec(
                slug = "ma",
                title = "MA (Moving Average)",
                category = IndicatorCategory.TREND,
                summary = "최근 N봉 평균값. 추세 방향과 지지/저항 라인 판단의 기본 도구",
                body = """
                    ## 정의
                    Moving Average — 최근 N봉의 종가 평균.
                    SMA(단순) 와 EMA(지수가중) 두 종류가 가장 많이 쓰인다.

                    ## 해석
                    - 가격 > MA: 상승 추세
                    - 가격 < MA: 하락 추세
                    - 단기 MA 가 장기 MA 를 상향 돌파(골든 크로스) → 매수 신호 후보
                    - 반대(데드 크로스) → 매도 신호 후보

                    ## 활용
                    - 분할 진입(Tranche) 전략의 추세 필터
                    - 이격도 측정의 기준선
                """.trimIndent(),
                formula = "SMA = ΣClose / N,  EMA = α·Close + (1-α)·EMA_prev,  α = 2/(N+1)",
            ),
            Spec(
                slug = "bb",
                title = "Bollinger Bands",
                category = IndicatorCategory.VOLATILITY,
                summary = "이동평균 ± k·표준편차 로 형성된 밴드. 변동성 확장·수축을 시각화",
                body = """
                    ## 정의
                    중간선 = SMA(N), 상단/하단 = 중간선 ± k·표준편차.
                    표준 설정은 N=20, k=2.

                    ## 해석
                    - 가격이 상단 터치/돌파: 단기 과열
                    - 하단 터치: 단기 과매도
                    - 밴드 폭 squeeze(좁아짐): 변동성 축적, 곧 큰 움직임 가능
                    - 밴드 폭 expansion: 추세 진행 중

                    ## 활용
                    - BollingerSqueeze 시그널 strategy
                    - 변동성 기반 손절폭 자동 조정
                """.trimIndent(),
                formula = "Mid = SMA(N),  Upper = Mid + k·σ,  Lower = Mid - k·σ",
            ),
            Spec(
                slug = "ichimoku",
                title = "Ichimoku Kinko Hyo (일목균형표)",
                category = IndicatorCategory.TREND,
                summary = "전환선·기준선·구름대·후행스팬으로 추세·지지/저항·시차 정보를 한 화면에",
                body = """
                    ## 정의
                    일목균형표 — 5개 라인 + 구름(Kumo) 으로 추세와 지지/저항을 동시에 표현.
                    - 전환선 (Tenkan): (9봉 고가 + 9봉 저가) / 2
                    - 기준선 (Kijun): (26봉 고가 + 26봉 저가) / 2
                    - 선행스팬 A (Senkou A): (전환선 + 기준선) / 2 → 26봉 forward
                    - 선행스팬 B (Senkou B): (52봉 고가 + 52봉 저가) / 2 → 26봉 forward
                    - 후행스팬 (Chikou): 종가 → 26봉 backward

                    ## 해석
                    - 가격이 구름 위/아래: 강한 상승/하락 추세
                    - 구름 진입 / 이탈: 추세 전환 후보
                    - 구름 두께 ≈ 추세 강도

                    ## 활용
                    - 중장기 추세 필터
                    - 지지/저항선 자동 산출
                """.trimIndent(),
                formula = "Tenkan/Kijun = (HHV + LLV) / 2,  Senkou A = (Tenkan+Kijun)/2 forward 26",
            ),
            Spec(
                slug = "volume",
                title = "Volume (거래량)",
                category = IndicatorCategory.VOLUME,
                summary = "단위 시간당 체결된 자산 수량. 가격 움직임의 신뢰도 검증 도구",
                body = """
                    ## 정의
                    한 봉 동안 체결된 거래 수량.

                    ## 해석
                    - 가격 상승 + 거래량 증가: 신뢰도 높은 상승
                    - 가격 상승 + 거래량 감소: 모멘텀 약화 (거짓 돌파 가능)
                    - 거래량 spike (직전 평균의 N배): 강한 관심 변화 신호

                    ## 활용
                    - VolumeSpike 시그널 strategy 의 입력
                    - OBV(On-Balance Volume) 등 파생 지표
                """.trimIndent(),
                formula = null,
            ),
        )
    }
}
