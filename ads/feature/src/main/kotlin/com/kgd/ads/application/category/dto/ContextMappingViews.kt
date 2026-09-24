package com.kgd.ads.application.category.dto

import java.time.LocalDateTime

/** 문맥 키 → 카테고리 매핑 한 줄. [updatedBy] 는 마지막으로 바꾼 운영자(시드는 null). */
data class ContextMappingView(val contextKey: String, val categoryCode: String, val updatedBy: Long?, val updatedAt: LocalDateTime)

/** 호스트 기본 카테고리 — 매핑이 없는 문맥 키가 가는 곳. */
data class HostCategoryView(val host: String, val categoryCode: String, val updatedBy: Long?, val updatedAt: LocalDateTime)
