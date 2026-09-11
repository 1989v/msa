package com.kgd.codedictionary.presentation.techdomain.controller

import com.kgd.codedictionary.application.techdomain.dto.TechDomainResultDto
import com.kgd.codedictionary.application.techdomain.usecase.GetTechDomainsUseCase
import com.kgd.common.response.ApiResponse
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/tech")
class TechDomainController(
    private val getTechDomains: GetTechDomainsUseCase,
) {

    @GetMapping("/domains")
    fun domains(): ApiResponse<List<TechDomainResultDto>> =
        ApiResponse.success(getTechDomains.activeDomains())
}
