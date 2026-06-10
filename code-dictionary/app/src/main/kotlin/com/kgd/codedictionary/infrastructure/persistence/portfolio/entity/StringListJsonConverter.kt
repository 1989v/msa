package com.kgd.codedictionary.infrastructure.persistence.portfolio.entity

import com.fasterxml.jackson.core.type.TypeReference
import com.fasterxml.jackson.databind.ObjectMapper
import jakarta.persistence.AttributeConverter
import jakarta.persistence.Converter

@Converter
class StringListJsonConverter : AttributeConverter<List<String>, String> {
    override fun convertToDatabaseColumn(attribute: List<String>?): String =
        MAPPER.writeValueAsString(attribute ?: emptyList<String>())

    override fun convertToEntityAttribute(dbData: String?): List<String> {
        if (dbData.isNullOrBlank()) return emptyList()
        return MAPPER.readValue(dbData, LIST_TYPE)
    }

    companion object {
        private val MAPPER = ObjectMapper()
        private val LIST_TYPE = object : TypeReference<List<String>>() {}
    }
}
