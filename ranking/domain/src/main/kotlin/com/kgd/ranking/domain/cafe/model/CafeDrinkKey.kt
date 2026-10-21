package com.kgd.ranking.domain.cafe.model

import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.DataInputStream
import java.io.DataOutputStream
import java.util.Base64

/** Versioned, length-prefixed natural key. Matches the DB's null/empty normalization. */
object CafeDrinkKey {
    fun of(drink: CafeDrink): String {
        val bytes = ByteArrayOutputStream()
        DataOutputStream(bytes).use { out ->
            listOf(drink.brandSlug, drink.menuName, drink.temperature.orEmpty(), drink.sizeLabel.orEmpty(), drink.caffeineStatus.name)
                .forEach(out::writeUTF)
        }
        return "v1_" + Base64.getUrlEncoder().withoutPadding().encodeToString(bytes.toByteArray())
    }

    fun fields(key: String): List<String>? = runCatching {
        require(key.startsWith("v1_") && key.length <= 4096)
        DataInputStream(ByteArrayInputStream(Base64.getUrlDecoder().decode(key.removePrefix("v1_")))).use { input ->
            val fields = List(5) { input.readUTF() }
            require(input.available() == 0)
            CaffeineStatus.valueOf(fields[4])
            fields
        }
    }.getOrNull()
}
