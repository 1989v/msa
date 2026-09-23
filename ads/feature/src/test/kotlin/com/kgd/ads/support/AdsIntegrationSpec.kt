package com.kgd.ads.support

import io.kotest.core.annotation.EnabledCondition
import io.kotest.core.spec.Spec
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import kotlin.reflect.KClass

/**
 * ads 통합 스펙의 공통 컨텍스트. 설정이 같아야 스펙끼리 컨텍스트 캐시를 나눠 쓴다.
 * 스케줄 작업은 끄고(몇 번 도는지 테스트가 통제), 인덱스 갱신은 테스트가 직접 부른다.
 */
@SpringBootTest(
    classes = [AdsIntegrationTestApplication::class],
    webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
    properties = [
        "ads.token.secret=${AdsTestContainers.TEST_TOKEN_SECRET}",
        "ads.scheduling.enabled=false",
        "outbox.polling.enabled=false",
        "spring.jpa.open-in-view=false",
    ],
)
abstract class AdsIntegrationSpec(body: BehaviorSpec.() -> Unit) : BehaviorSpec(body) {
    override fun extensions() = listOf(SpringExtension)

    companion object {
        @JvmStatic
        @DynamicPropertySource
        fun props(registry: DynamicPropertyRegistry) = AdsTestContainers.register(registry)
    }
}

/** Docker 가 없으면 스펙을 건너뛴다(컨텍스트도 띄우지 않는다). */
class DockerAvailable : EnabledCondition {
    override fun enabled(kclass: KClass<out Spec>): Boolean = AdsTestContainers.dockerAvailable
}
