package com.kgd.codedictionary.application.techdomain.service

import com.kgd.codedictionary.application.techdomain.dto.TechDomainResultDto
import com.kgd.codedictionary.application.techdomain.port.TechDomainRepositoryPort
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/** /tech 도메인 맵 루트 조회. 순서·활성 필터는 저장소가 끝낸 상태로 온다. */
@Service
@Transactional(readOnly = true)
class TechDomainQueryService(
    private val repository: TechDomainRepositoryPort,
) {
    fun activeDomains(): List<TechDomainResultDto> =
        repository.findAllActiveOrdered().map(TechDomainResultDto::from)
}
