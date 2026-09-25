package com.kgd.commerce.web

import com.kgd.common.exception.BusinessException
import com.kgd.common.exception.ErrorCode
import com.kgd.common.exception.GlobalExceptionHandler
import com.kgd.inventory.application.inventory.usecase.ConfirmStockUseCase
import com.kgd.inventory.application.inventory.usecase.GetInventoryUseCase
import com.kgd.inventory.application.inventory.usecase.ReceiveStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReleaseStockUseCase
import com.kgd.inventory.application.inventory.usecase.ReserveStockUseCase
import com.kgd.inventory.application.ownership.usecase.AuthorizeInventoryAccessUseCase
import com.kgd.inventory.presentation.inventory.controller.InventoryController
import com.kgd.order.presentation.order.controller.OrderController
import com.kgd.order.presentation.order.controller.OrderExceptionHandler
import com.kgd.payment.presentation.webhook.controller.TossWebhookController
import com.kgd.product.presentation.product.controller.ProductController
import com.kgd.product.presentation.product.controller.ProductExceptionHandler
import com.kgd.seller.presentation.seller.controller.SellerController
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.runs
import org.springframework.context.support.GenericApplicationContext
import org.springframework.http.MediaType
import org.springframework.http.converter.json.JacksonJsonHttpMessageConverter
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.method.ControllerAdviceBean
import tools.jackson.module.kotlin.jacksonMapperBuilder

/**
 * commerce 호스트의 도메인 전용 예외 처리기(Product·OrderExceptionHandler)는 자기 도메인 컨트롤러에만 적용된다.
 * 범위 없이 HIGHEST_PRECEDENCE 로 두면 다른 도메인의 BusinessException 을 가로채 상태코드를 덮는다.
 * 판정 근거는 Spring 이 advice 적용 여부를 정하는 [ControllerAdviceBean.isApplicableToBeanType] 과 실제 응답 코드다.
 */
class ExceptionHandlerScopeTest : BehaviorSpec({
    /** Spring 이 advice 빈을 찾는 방식 그대로 — 애너테이션 속성(basePackages)이 predicate 가 된다 */
    fun adviceOf(type: Class<*>): ControllerAdviceBean {
        val context = GenericApplicationContext()
        context.registerBeanDefinition(type.simpleName, org.springframework.beans.factory.support.RootBeanDefinition(type))
        context.refresh()
        return ControllerAdviceBean.findAnnotatedBeans(context).single()
    }

    given("상품 예외 처리기") {
        val advice = adviceOf(ProductExceptionHandler::class.java)
        then("상품 컨트롤러에는 적용되고, 판매자·결제·주문 컨트롤러에는 적용되지 않는다") {
            advice.isApplicableToBeanType(ProductController::class.java) shouldBe true
            advice.isApplicableToBeanType(SellerController::class.java) shouldBe false
            advice.isApplicableToBeanType(TossWebhookController::class.java) shouldBe false
            advice.isApplicableToBeanType(OrderController::class.java) shouldBe false
        }
    }

    given("주문 예외 처리기") {
        val advice = adviceOf(OrderExceptionHandler::class.java)
        then("주문 컨트롤러에만 적용된다") {
            advice.isApplicableToBeanType(OrderController::class.java) shouldBe true
            advice.isApplicableToBeanType(SellerController::class.java) shouldBe false
            advice.isApplicableToBeanType(ProductController::class.java) shouldBe false
        }
    }

    given("로컬 핸들러가 없는 다른 도메인 컨트롤러(재고)가 재고 부족 BusinessException 을 던지면") {
        val receive = mockk<ReceiveStockUseCase>()
        val authorizer = mockk<AuthorizeInventoryAccessUseCase>()
        every { authorizer.requireProductAccess(any(), any()) } just runs
        every { receive.execute(any()) } throws BusinessException(ErrorCode.INSUFFICIENT_STOCK)
        val controller = InventoryController(
            mockk<ReserveStockUseCase>(), mockk<ReleaseStockUseCase>(), mockk<ConfirmStockUseCase>(),
            receive, mockk<GetInventoryUseCase>(), authorizer,
        )
        // 운영 호스트와 같은 세 advice 를 함께 건다
        val mockMvc = MockMvcBuilders.standaloneSetup(controller)
            .setControllerAdvice(ProductExceptionHandler(), OrderExceptionHandler(), GlobalExceptionHandler())
            .setMessageConverters(JacksonJsonHttpMessageConverter(jacksonMapperBuilder().build()))
            .build()

        then("상품 처리기의 409 도, 주문 처리기의 500 도 아닌 공통 처리기의 400 이다") {
            mockMvc.perform(
                MockMvcRequestBuilders.post("/api/inventories/receive")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"productId":1,"warehouseId":1,"qty":1}""")
                    .header("X-User-Id", "1").header("X-User-Roles", "ROLE_ADMIN"),
            ).andReturn().response.status shouldBe 400
        }
    }
})
