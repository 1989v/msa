package com.kgd.search

import com.kgd.search.application.attraction.config.AttractionAnswerEvidenceProperties
import com.kgd.search.application.attraction.config.AttractionConditionWordsProperties
import com.kgd.search.application.attraction.config.AttractionHybridProperties
import com.kgd.search.application.queryvector.config.QueryVectorProperties
import com.kgd.search.application.ranking.config.BanditProperties
import com.kgd.search.application.ranking.config.DiversityProperties
import com.kgd.search.infrastructure.client.QueryEncoderProperties
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.infrastructure.client.SearchExperimentProperties
import com.kgd.search.infrastructure.opensearch.AttractionClickBoostProperties
import com.kgd.search.infrastructure.opensearch.AttractionRankingProperties
import com.kgd.search.infrastructure.opensearch.RankingProperties
import com.kgd.search.infrastructure.opensearch.RankingVariantsProperties
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import org.springframework.kafka.annotation.EnableKafka
import org.springframework.scheduling.annotation.EnableScheduling

// 공통 예외 처리기(BusinessException → 404 등)를 함께 스캔한다 — 빠져 있던 동안 「없는 관광지」가 500 으로 나가
// 화면이 「찾을 수 없음」 대신 「잠시 후 다시 시도」를 보였다. 다른 호스트(auth · commerce)와 같은 방식이다.
@SpringBootApplication(scanBasePackages = ["com.kgd.search", "com.kgd.common.exception"])
// 분류 사전 주기 갱신 (CategoryLexiconService) — 질의 경로에 네트워크를 두지 않기 위한 것
@EnableScheduling
@EnableConfigurationProperties(
    RankingProperties::class,
    RankingVariantsProperties::class,
    BanditProperties::class,
    DiversityProperties::class,
    SearchExperimentProperties::class,
    AttractionRankingProperties::class,
    AttractionClickBoostProperties::class,
    QueryVectorProperties::class,
    QueryEncoderProperties::class,
    AttractionHybridProperties::class,
    AttractionConditionWordsProperties::class,
    AttractionAnswerEvidenceProperties::class,
    AttractionRenderProperties::class,
)
@EnableKafka
class SearchApplication

fun main(args: Array<String>) {
    runApplication<SearchApplication>(*args)
}
