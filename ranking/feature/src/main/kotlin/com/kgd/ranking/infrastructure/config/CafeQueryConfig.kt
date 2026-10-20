package com.kgd.ranking.infrastructure.config

import com.querydsl.jpa.impl.JPAQueryFactory
import jakarta.persistence.EntityManager
import jakarta.persistence.PersistenceContext
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class CafeQueryConfig {
    @PersistenceContext(unitName = "ranking")
    private lateinit var entityManager: EntityManager

    @Bean
    fun rankingQueryFactory() = JPAQueryFactory(entityManager)
}
