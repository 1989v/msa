package com.kgd.codedictionary.domain.service.model

class Service private constructor(
    val id: Long? = null,
    val code: String,
    var name: String,
    var description: String,
    var port: Int?,
    var isPrivate: Boolean,
    var displayOrder: Int,
    var conceptIds: List<String>
) {
    companion object {
        fun create(
            code: String,
            name: String,
            description: String,
            port: Int?,
            isPrivate: Boolean,
            displayOrder: Int,
            conceptIds: List<String> = emptyList()
        ): Service {
            require(code.isNotBlank()) { "code는 비어있을 수 없습니다" }
            require(name.isNotBlank()) { "name은 비어있을 수 없습니다" }
            return Service(
                code = code,
                name = name,
                description = description,
                port = port,
                isPrivate = isPrivate,
                displayOrder = displayOrder,
                conceptIds = conceptIds
            )
        }

        fun restore(
            id: Long?,
            code: String,
            name: String,
            description: String,
            port: Int?,
            isPrivate: Boolean,
            displayOrder: Int,
            conceptIds: List<String>
        ): Service = Service(
            id = id,
            code = code,
            name = name,
            description = description,
            port = port,
            isPrivate = isPrivate,
            displayOrder = displayOrder,
            conceptIds = conceptIds
        )
    }
}
