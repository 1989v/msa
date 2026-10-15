package com.kgd.place.infrastructure.config

import com.querydsl.jpa.impl.JPAQueryFactory
import jakarta.persistence.EntityManagerFactory
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.orm.jpa.SharedEntityManagerCreator

@Configuration
class PlaceQuerydslConfig {
    @Bean
    fun placeJpaQueryFactory(@Qualifier("placeEntityManagerFactory") factory: EntityManagerFactory): JPAQueryFactory =
        JPAQueryFactory(SharedEntityManagerCreator.createSharedEntityManager(factory))
}
