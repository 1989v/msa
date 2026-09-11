package com.kgd.codedictionary.application.service.port

import com.kgd.codedictionary.domain.service.model.Service

interface ServiceRepositoryPort {
    fun findAllOrdered(includePrivate: Boolean): List<Service>
}
