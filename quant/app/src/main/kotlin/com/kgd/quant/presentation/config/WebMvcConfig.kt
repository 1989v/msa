package com.kgd.quant.presentation.config

import com.kgd.quant.presentation.resolver.RolesHeaderArgumentResolver
import com.kgd.quant.presentation.resolver.TenantIdHeaderArgumentResolver
import org.springframework.context.annotation.Configuration
import org.springframework.web.method.support.HandlerMethodArgumentResolver
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer

/**
 * WebMvcConfig — quant 전용 Spring MVC 설정.
 *
 * - [TenantIdHeaderArgumentResolver] 를 컨트롤러 argument resolver 체인에 추가한다.
 * - 클래스 레벨 `@Transactional` 금지 (ADR-0020). Config 는 영속성 경계와 무관.
 */
@Configuration
class WebMvcConfig : WebMvcConfigurer {

    override fun addArgumentResolvers(resolvers: MutableList<HandlerMethodArgumentResolver>) {
        resolvers.add(TenantIdHeaderArgumentResolver())
        resolvers.add(RolesHeaderArgumentResolver())
    }
}
