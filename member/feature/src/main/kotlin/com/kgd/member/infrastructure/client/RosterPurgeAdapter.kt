package com.kgd.member.infrastructure.client

import com.kgd.member.application.member.port.RosterPurgePort
import io.github.oshai.kotlinlogging.KotlinLogging
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient

private val log = KotlinLogging.logger {}

/**
 * 친구 그룹 파기 호출 (ADR-0092). game 은 다른 JVM(code-dictionary 폴드)이라 네트워크로 잇는다.
 *
 * **예외를 밖으로 내보내지 않는다.** 이 호출은 탈퇴의 전제가 아니라 부가 작업이고, 실패하면
 * 보존 정리 배치가 같은 행을 나중에 지운다. 대신 실패를 error 로 남겨 조용히 묻히지 않게 한다.
 *
 * WebFlux 를 끌어오지 않으려고 `RestClient` 를 쓴다 — 호출이 동기라 리액티브 스택이 필요 없고,
 * member 는 도메인 feature 중 의존이 가장 얇은 축이라 그 성질을 유지한다.
 *
 * **`RestClient.Builder` 를 필수 의존으로 받지 않는다.** 그 빈은 호스트의 웹 자동 구성이
 * 만드는 것이라 서블릿 컨텍스트에서만 있다 — 폴드 호스트를 `WebEnvironment.NONE` 으로 띄우는
 * 컨텍스트 로드 검사에서는 없고, 그러면 이 빈 하나가 **호스트 전체의 기동을 막는다**(실제로
 * commerce 테스트 게이트를 막아 그 커밋의 모든 이미지가 안 만들어졌다). 있으면 쓰고 없으면
 * 직접 만든다 — 부가 호출 하나가 호스트의 웹 구성을 전제하지 않게.
 */
@Component
class RosterPurgeAdapter(
    builders: ObjectProvider<RestClient.Builder>,
    @Value("\${member.roster-purge.base-url:http://code-dictionary:8089}") baseUrl: String,
) : RosterPurgePort {

    private val client = builders.getIfAvailable { RestClient.builder() }.baseUrl(baseUrl).build()

    override fun purgeByMember(memberId: Long) {
        runCatching {
            client.delete()
                .uri("/internal/party/rosters/members/{memberId}", memberId)
                .retrieve()
                .toBodilessEntity()
        }.onFailure {
            // 그물이 있다는 것을 함께 적는다 — 이 로그를 보는 사람이 수동 복구를 찾지 않도록.
            log.error(it) { "친구 그룹 파기 호출 실패 — member=$memberId. 보존 정리 배치가 나중에 지운다" }
        }
    }
}
