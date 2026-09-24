package com.kgd.codedictionary.infrastructure.ontology

import com.kgd.codedictionary.application.ontology.usecase.ApplyOntologyUseCase
import com.kgd.codedictionary.application.ontology.usecase.RefreshOntologyDerivedUseCase
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.boot.ApplicationArguments
import org.springframework.boot.ApplicationRunner
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty
import org.springframework.stereotype.Component
import java.util.concurrent.Executor
import java.util.concurrent.RejectedExecutionException

/**
 * 부팅 때 온톨로지 파일을 적용하고, 파생물(캐시·색인) 갱신을 색인 실행기로 넘긴다.
 *
 * 실패해도 기동을 멈추지 않는다 — 이 호스트의 다른 도메인(포트폴리오·전시·이력서)까지 같이 죽이지 않는다.
 * `ontology.loader.enabled` 는 관계 kind 를 문자열로 읽는 코드가 운영에 먼저 나간 **다음 배포**에서 켠다(ADR-0100).
 */
@Component
@ConditionalOnProperty(name = ["ontology.loader.enabled"], havingValue = "true")
class OntologyLoaderRunner(
    private val apply: ApplyOntologyUseCase,
    private val refresh: RefreshOntologyDerivedUseCase,
    @Qualifier("indexSyncExecutor") private val executor: Executor,
) : ApplicationRunner {
    private val log = KotlinLogging.logger {}

    override fun run(args: ApplicationArguments) {
        try {
            val report = apply.applyFromSource()
            log.info { "온톨로지 로더: ${report.outcome} (파일 r${report.fileRevision} · DB r${report.dbRevision}) 개념 ${report.concepts} · 간선 ${report.edges} · 관리 해제 ${report.released}" }
        } catch (e: Exception) {
            log.error(e) { "온톨로지 적용 실패 — 전부 롤백했고 기동은 계속한다" }
        }
        try {
            executor.execute { refresh.refreshIfStale() }
        } catch (e: RejectedExecutionException) {
            log.warn { "색인 실행기가 가득 차 파생물 갱신을 걸지 못했다 — 다음 부팅에 다시 본다" }
        }
    }
}
