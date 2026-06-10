package com.kgd.search.job

import com.kgd.search.domain.eval.EvalResult
import com.kgd.search.domain.eval.EvalResultPort
import com.kgd.search.domain.eval.JudgmentLoadPort
import com.kgd.search.domain.eval.RankingExecutionPort
import com.kgd.search.domain.eval.RankingMetrics
import com.kgd.search.infrastructure.eval.EvalProperties
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.batch.core.job.Job
import org.springframework.batch.core.job.builder.JobBuilder
import org.springframework.batch.core.repository.JobRepository
import org.springframework.batch.core.step.Step
import org.springframework.batch.core.step.builder.StepBuilder
import org.springframework.batch.infrastructure.repeat.RepeatStatus
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.transaction.PlatformTransactionManager
import java.util.UUID

/**
 * ADR-0050 Phase 4 — 검색 ranking 오프라인 평가 잡.
 *
 * 흐름:
 *  1. judgment load (ClickHouse `search_judgments`)
 *  2. 각 query 별 ES top-K 실행 → NDCG@10/MRR/MAP@10/Precision@5,10 산출
 *  3. ClickHouse `search_eval_results` 적재
 *
 * 운영: K8s CronJob 으로 daily 02:00. variant 별 ConfigMap 두 벌로 A/B 비교 실행.
 *
 * 기존 reindex job (ProductDb/ProductApi) 와 별도 라이프사이클.
 */
@Configuration
class SearchEvaluationJobConfig(
    private val jobRepository: JobRepository,
    private val transactionManager: PlatformTransactionManager,
    private val judgmentLoadPort: JudgmentLoadPort,
    private val rankingExecutionPort: RankingExecutionPort,
    private val evalResultPort: EvalResultPort,
    private val properties: EvalProperties
) {
    private val log = KotlinLogging.logger {}

    companion object {
        const val JOB_NAME = "searchEvaluationJob"
        const val STEP_NAME = "searchEvaluationStep"
    }

    @Bean(name = [JOB_NAME])
    fun searchEvaluationJob(): Job =
        JobBuilder(JOB_NAME, jobRepository)
            .start(searchEvaluationStep())
            .build()

    @Bean(name = [STEP_NAME])
    fun searchEvaluationStep(): Step =
        StepBuilder(STEP_NAME, jobRepository)
            .tasklet({ _, _ ->
                if (!properties.enabled) {
                    log.info { "Search eval job disabled (search.eval.enabled=false) — skip" }
                    return@tasklet RepeatStatus.FINISHED
                }
                executeEvaluation()
                RepeatStatus.FINISHED
            }, transactionManager)
            .build()

    private fun executeEvaluation() {
        val judgments = judgmentLoadPort.loadAll()
        if (judgments.isEmpty()) {
            log.warn { "No judgments found — skipping eval" }
            return
        }
        val evalId = UUID.randomUUID().toString()
        val results = judgments.map { (query, judgmentMap) ->
            val ranked = rankingExecutionPort.searchTopK(query, maxOf(properties.topK, 10))
            EvalResult(
                evalId = evalId,
                variant = properties.variant,
                query = query,
                ndcg10 = RankingMetrics.ndcgAtK(ranked, judgmentMap, 10),
                mrr = RankingMetrics.mrr(ranked, judgmentMap, properties.threshold),
                map10 = RankingMetrics.apAtK(ranked, judgmentMap, 10, properties.threshold),
                precisionAt5 = RankingMetrics.precisionAtK(ranked, judgmentMap, 5, properties.threshold),
                precisionAt10 = RankingMetrics.precisionAtK(ranked, judgmentMap, 10, properties.threshold),
                resultSize = ranked.size
            )
        }
        evalResultPort.saveAll(results)
        log.info { "Search eval done: evalId=$evalId, variant=${properties.variant}, queries=${results.size}" }
    }
}
