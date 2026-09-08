package com.kgd.place.application.attraction.usecase

interface SyncAttractionCategoryCodesUseCase {
    fun upsert(items: List<Item>): Applied

    fun findAll(lang: String?): List<View>

    data class Item(val lang: String, val code: String, val name: String, val parentCode: String? = null)

    data class Applied(val applied: Int)

    data class View(val lang: String, val code: String, val depth: Int, val parentCode: String?, val name: String)
}
