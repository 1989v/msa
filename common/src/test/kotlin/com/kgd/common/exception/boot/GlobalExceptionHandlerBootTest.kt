package com.kgd.common.exception.boot

import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.common.response.ApiResponse
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.extensions.spring.SpringExtension
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration
import org.springframework.boot.jdbc.autoconfigure.DataSourceTransactionManagerAutoConfiguration
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.context.annotation.Import
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.context.WebApplicationContext

/**
 * GlobalExceptionHandler 를 **Spring Boot 자동 구성 그대로** 띄워 검증한다.
 *
 * 각 서비스가 실제로 겪는 경로 — `WebMvcAutoConfiguration` 의 기본 정적 리소스 매핑
 * (`spring.web.resources.add-mappings=true`) 때문에 매핑 없는 하위 경로에서
 * `NoResourceFoundException` 이 던져지는 상황 — 을 그대로 재현한다.
 * DataSource 계열 자동 구성만 제외해 Docker/DB 없이 돈다.
 */
@SpringBootTest(classes = [ErrorHandlingBootTestApp::class])
class GlobalExceptionHandlerBootTest(
    @Autowired private val webApplicationContext: WebApplicationContext,
) : BehaviorSpec({

    extensions(SpringExtension)

    val mockMvc = MockMvcBuilders.webAppContextSetup(webApplicationContext).build()

    given("Spring Boot 기본 WebMVC 자동 구성으로 기동한 서비스") {
        `when`("매핑되지 않은 하위 경로를 호출하면") {
            then("404 + ApiResponse.error(NOT_FOUND)") {
                val res = mockMvc.perform(get("/api/v1/boot-probe/nope")).andReturn().response

                res.status shouldBe 404
                res.contentAsString shouldContain "\"code\":\"NOT_FOUND\""
                res.contentAsString shouldNotContain "nope"
            }
        }

        `when`("POST 전용 경로를 GET 하면") {
            then("405") {
                mockMvc.perform(get("/api/v1/boot-probe/post-only")).andReturn().response.status shouldBe 405
            }
        }

        `when`("컨트롤러가 예상치 못한 예외를 던지면") {
            then("500 + INTERNAL_ERROR") {
                val res = mockMvc.perform(get("/api/v1/boot-probe/boom")).andReturn().response

                res.status shouldBe 500
                res.contentAsString shouldContain "\"code\":\"INTERNAL_ERROR\""
            }
        }
    }
})

@SpringBootApplication(
    exclude = [DataSourceAutoConfiguration::class, DataSourceTransactionManagerAutoConfiguration::class],
)
@Import(GlobalExceptionHandler::class)
open class ErrorHandlingBootTestApp

@RestController
open class BootProbeController {

    @PostMapping("/api/v1/boot-probe/post-only")
    open fun postOnly(): ApiResponse<String> = ApiResponse.success("ok")

    @GetMapping("/api/v1/boot-probe/boom")
    open fun boom(): Nothing = throw IllegalStateException("internal-secret-detail")
}
