package com.kgd.common.exception

import com.kgd.common.response.ApiResponse
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.string.shouldContain
import io.kotest.matchers.string.shouldNotContain
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.mock.web.MockServletContext
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.context.support.AnnotationConfigWebApplicationContext
import org.springframework.web.servlet.config.annotation.EnableWebMvc
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

/**
 * GlobalExceptionHandler 의 WebMVC 통합 스펙.
 *
 * ## 왜 webAppContextSetup 인가
 * `standaloneSetup` 은 정적 리소스 핸들러를 등록하지 않아 매핑 없는 경로에서
 * `NoResourceFoundException` 이 발생하지 않는다. 실제 서비스(Spring Boot 기본값
 * `spring.web.resources.add-mappings=true`)와 동일한 조건을 만들기 위해
 * catch-all ResourceHandler 를 등록한 `@EnableWebMvc` 컨텍스트를 직접 띄운다.
 * Boot 컨텍스트를 쓰지 않으므로 DataSource/Flyway bootstrap 도 회피된다.
 */
class GlobalExceptionHandlerWebMvcTest : BehaviorSpec({

    val webContext = AnnotationConfigWebApplicationContext().apply {
        servletContext = MockServletContext()
        register(GlobalExceptionHandlerTestConfig::class.java)
        refresh()
    }
    val mockMvc: MockMvc = MockMvcBuilders.webAppContextSetup(webContext).build()

    afterSpec { webContext.close() }

    given("매핑이 존재하는 경로") {
        `when`("정상 호출하면") {
            then("200 + ApiResponse(success=true)") {
                mockMvc.perform(get("/api/v1/probe/ok"))
                    .andReturn().response
                    .let { res ->
                        res.status shouldBe 200
                        res.contentAsString shouldContain "\"success\":true"
                    }
            }
        }
    }

    given("매핑이 존재하지 않는 하위 경로") {
        `when`("GET 요청하면") {
            then("404 + ApiResponse.error(NOT_FOUND) — 500 이 아니어야 한다") {
                val res = mockMvc.perform(get("/api/v1/probe/does-not-exist")).andReturn().response

                res.status shouldBe 404
                res.contentAsString shouldContain "\"success\":false"
                res.contentAsString shouldContain "\"code\":\"NOT_FOUND\""
            }

            then("본문에 요청 경로·예외 클래스명 등 내부 정보가 노출되지 않는다") {
                val body = mockMvc.perform(get("/api/v1/probe/does-not-exist")).andReturn().response.contentAsString

                body shouldNotContain "does-not-exist"
                body shouldNotContain "Exception"
                body shouldNotContain "static resource"
                body shouldNotContain "org.springframework"
            }
        }
    }

    given("존재하는 경로에 지원하지 않는 HTTP 메서드") {
        `when`("POST 전용 경로를 GET 하면") {
            then("405 + Allow 헤더") {
                val res = mockMvc.perform(get("/api/v1/probe/post-only")).andReturn().response

                res.status shouldBe 405
                res.getHeader("Allow") shouldContain "POST"
            }
        }
    }

    given("기존 예외 처리 (회귀 방지)") {
        `when`("BusinessException(NOT_FOUND) 이 발생하면") {
            then("404 + error.code=NOT_FOUND 로 기존과 동일하게 응답한다") {
                val res = mockMvc.perform(get("/api/v1/probe/business-not-found")).andReturn().response

                res.status shouldBe 404
                res.contentAsString shouldContain "\"code\":\"NOT_FOUND\""
                res.contentAsString shouldContain ErrorCode.NOT_FOUND.message
            }
        }

        `when`("BusinessException(INSUFFICIENT_STOCK) 이 발생하면") {
            then("400 + error.code=INSUFFICIENT_STOCK 로 기존과 동일하게 응답한다") {
                val res = mockMvc.perform(get("/api/v1/probe/business-stock")).andReturn().response

                res.status shouldBe 400
                res.contentAsString shouldContain "\"code\":\"INSUFFICIENT_STOCK\""
            }
        }

        `when`("@Valid 위반(MethodArgumentNotValidException)이 발생하면") {
            then("400 + INVALID_INPUT + 필드 메시지로 기존과 동일하게 응답한다") {
                val res = mockMvc.perform(
                    post("/api/v1/probe/validate")
                        .contentType("application/json")
                        .content("""{"name":""}"""),
                ).andReturn().response

                res.status shouldBe 400
                res.contentAsString shouldContain "\"code\":\"INVALID_INPUT\""
                res.contentAsString shouldContain "name:"
            }
        }

        `when`("경로 변수 타입 불일치(MethodArgumentTypeMismatchException)가 발생하면") {
            then("400 + INVALID_INPUT + 기존 메시지 포맷을 유지한다") {
                val res = mockMvc.perform(get("/api/v1/probe/typed/not-a-number")).andReturn().response

                res.status shouldBe 400
                res.contentAsString shouldContain "\"code\":\"INVALID_INPUT\""
                res.contentAsString shouldContain "파라미터 타입이 올바르지 않습니다: id"
            }
        }

        `when`("본문 JSON 이 깨져 있으면(HttpMessageNotReadableException)") {
            then("400 + INVALID_INPUT — 500 이 아니어야 한다") {
                val res = mockMvc.perform(
                    post("/api/v1/probe/validate")
                        .contentType("application/json")
                        .content("""{"name":"""),
                ).andReturn().response

                res.status shouldBe 400
                res.contentAsString shouldContain "\"code\":\"INVALID_INPUT\""
            }

            then("파서 내부 구조·클래스명이 본문에 노출되지 않는다") {
                val body = mockMvc.perform(
                    post("/api/v1/probe/validate")
                        .contentType("application/json")
                        .content("""{"name":"""),
                ).andReturn().response.contentAsString

                body shouldNotContain "Exception"
                body shouldNotContain "com.fasterxml"
                body shouldNotContain "ProbeBody"
            }
        }

        `when`("본문이 아예 비어 있으면") {
            then("400 + INVALID_INPUT") {
                val res = mockMvc.perform(
                    post("/api/v1/probe/validate").contentType("application/json"),
                ).andReturn().response

                res.status shouldBe 400
                res.contentAsString shouldContain "\"code\":\"INVALID_INPUT\""
            }
        }

        `when`("진짜 예상치 못한 예외가 발생하면") {
            then("여전히 500 + INTERNAL_ERROR 이고 내부 메시지를 노출하지 않는다") {
                val res = mockMvc.perform(get("/api/v1/probe/boom")).andReturn().response

                res.status shouldBe 500
                res.contentAsString shouldContain "\"code\":\"INTERNAL_ERROR\""
                res.contentAsString shouldNotContain "internal-secret-detail"
            }
        }
    }
})

@Configuration
@EnableWebMvc
private open class GlobalExceptionHandlerTestConfig : WebMvcConfigurer {

    // Spring Boot WebMvcAutoConfiguration 기본값(`spring.web.resources.add-mappings=true`)과
    // 동일한 `/**` 정적 리소스 매핑 — 매핑 없는 경로에서 NoResourceFoundException 을 유발한다.
    override fun addResourceHandlers(registry: ResourceHandlerRegistry) {
        registry.addResourceHandler("/**").addResourceLocations("classpath:/static/")
    }

    @Bean
    open fun globalExceptionHandler() = GlobalExceptionHandler()

    @Bean
    open fun probeController() = ProbeController()
}

@RestController
private open class ProbeController {

    @GetMapping("/api/v1/probe/ok")
    open fun ok(): ApiResponse<String> = ApiResponse.success("ok")

    @PostMapping("/api/v1/probe/post-only")
    open fun postOnly(): ApiResponse<String> = ApiResponse.success("ok")

    @GetMapping("/api/v1/probe/business-not-found")
    open fun businessNotFound(): Nothing = throw BusinessException(ErrorCode.NOT_FOUND)

    @GetMapping("/api/v1/probe/business-stock")
    open fun businessStock(): Nothing = throw BusinessException(ErrorCode.INSUFFICIENT_STOCK)

    @GetMapping("/api/v1/probe/typed/{id}")
    open fun typed(@PathVariable id: Long): ApiResponse<Long> = ApiResponse.success(id)

    @PostMapping("/api/v1/probe/validate")
    open fun validate(@Valid @RequestBody body: ProbeBody): ApiResponse<String> = ApiResponse.success(body.name ?: "")

    @GetMapping("/api/v1/probe/boom")
    open fun boom(): Nothing = throw IllegalStateException("internal-secret-detail")
}

// Jackson Kotlin module 이 common 테스트 클래스패스에 없으므로 no-arg + setter 바인딩 형태로 둔다.
private open class ProbeBody {
    @field:NotBlank
    var name: String? = null
}
