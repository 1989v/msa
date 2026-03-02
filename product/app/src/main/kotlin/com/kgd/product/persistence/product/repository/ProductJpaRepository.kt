package com.kgd.product.infrastructure.persistence.product.repository

import com.kgd.product.infrastructure.persistence.product.entity.ProductJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ProductJpaRepository : JpaRepository<ProductJpaEntity, Long>
