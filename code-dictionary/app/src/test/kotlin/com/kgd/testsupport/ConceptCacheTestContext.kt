package com.kgd.testsupport

import com.kgd.codedictionary.application.concept.port.ConceptRepositoryPort
import com.kgd.codedictionary.application.concept.service.ConceptService
import com.kgd.codedictionary.application.graph.service.GraphService
import com.kgd.codedictionary.application.index.port.ConceptIndexRepositoryPort
import io.mockk.mockk
import org.springframework.boot.SpringBootConfiguration
import org.springframework.cache.CacheManager
import org.springframework.cache.annotation.EnableCaching
import org.springframework.cache.caffeine.CaffeineCacheManager
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.ComponentScan

/**
 * `@CacheEvict` 검증용 최소 컨텍스트 — 실제 `CacheConfig` / 자동설정을 import 하지 않고
 * 캐시 + ComponentScan 만 활성화하여 JPA / Flyway / DataSource 부팅을 회피한다.
 *
 * **`com.kgd` 하위이되 앱 스캔 대상 패키지 밖**에 둔다. `CodeDictionaryApplication` 은
 * `com.kgd.codedictionary` 를 스캔하므로, 이 설정이 그 안에 있으면 전체 컨텍스트 기동 시
 * `cacheManager` 가 중복 정의되어 `BeanDefinitionOverrideException` 으로 부팅이 깨진다.
 */
@SpringBootConfiguration
@EnableCaching
@ComponentScan(
    basePackageClasses = [
        ConceptService::class,
        GraphService::class,
    ],
)
open class ConceptCacheTestContext {

    @Bean
    open fun cacheManager(): CacheManager = CaffeineCacheManager("conceptCategoryStats")

    @Bean
    open fun conceptRepositoryPort(): ConceptRepositoryPort = mockk(relaxed = false)

    @Bean
    open fun conceptIndexRepositoryPort(): ConceptIndexRepositoryPort = mockk(relaxed = false)
}
