package com.kgd.order.infrastructure.persistence.readmodel.repository

import com.kgd.order.infrastructure.persistence.readmodel.entity.CouponDefinitionViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.PointBalanceViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.ProductViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.SellerViewJpaEntity
import com.kgd.order.infrastructure.persistence.readmodel.entity.UserCouponViewJpaEntity
import org.springframework.data.jpa.repository.JpaRepository

interface ProductViewJpaRepository : JpaRepository<ProductViewJpaEntity, Long>
interface SellerViewJpaRepository : JpaRepository<SellerViewJpaEntity, Long>
interface CouponDefinitionViewJpaRepository : JpaRepository<CouponDefinitionViewJpaEntity, Long>
interface UserCouponViewJpaRepository : JpaRepository<UserCouponViewJpaEntity, Long>
interface PointBalanceViewJpaRepository : JpaRepository<PointBalanceViewJpaEntity, String>
