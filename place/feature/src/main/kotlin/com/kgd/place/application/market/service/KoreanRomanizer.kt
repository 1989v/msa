package com.kgd.place.application.market.service

/** Revised Romanization for display/search. Non-Hangul characters are copied verbatim. */
object KoreanRomanizer {
    private val initials = listOf("g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h")
    private val vowels = listOf("a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i")
    private val finals = listOf("", "k", "k", "k", "n", "n", "n", "t", "l", "k", "m", "l", "l", "l", "p", "l", "m", "p", "p", "t", "t", "ng", "t", "t", "k", "t", "p", "t")
    private val liaison = mapOf(1 to 0, 2 to 1, 4 to 2, 7 to 3, 8 to 5, 16 to 6, 17 to 7, 19 to 9, 20 to 10, 22 to 12, 23 to 14, 24 to 15, 25 to 16, 26 to 17, 27 to 18)
    private data class Syllable(var initial: Int, val vowel: Int, val final: Int, var coda: String)

    fun romanize(value: String): String = Regex("[가-힣]+").replace(value) { match ->
        // Recognizable shop/market heads are word boundaries, not phonological boundaries.
        val words = match.value.replace(Regex("(?<=.)(빈대떡|시장)$"), " $1")
        words.split(' ').joinToString(" ") { word -> romanizeWord(word).replaceFirstChar { it.uppercaseChar() } }
    }

    private fun romanizeWord(word: String): String {
        val syllables = word.map { char ->
            val code = char.code - 0xAC00
            Syllable(code / 588, code % 588 / 28, code % 28, finals[code % 28])
        }
        for (index in 0 until syllables.lastIndex) {
            val current = syllables[index]
            val next = syllables[index + 1]
            if (current.final == 0) continue
            if (next.initial == 11 && current.final != 21) {
                // Liaison: retain the underlying consonant before a vowel.
                val clusters = mapOf(3 to ("k" to 9), 5 to ("n" to 12), 6 to ("n" to 11),
                    9 to ("l" to 0), 10 to ("l" to 6), 11 to ("l" to 7), 12 to ("l" to 9),
                    13 to ("l" to 16), 14 to ("l" to 17), 15 to ("" to 5), 18 to ("p" to 9))
                val cluster = clusters[current.final]
                val moved = cluster?.second ?: liaison[current.final]
                if (moved != null) {
                    current.coda = cluster?.first ?: ""
                    next.initial = if (next.vowel == 20 && current.final == 7) 12
                        else if (next.vowel == 20 && current.final == 25) 14 else if (current.final == 27) 11 else moved
                }
            } else if (current.final in listOf(7, 25) && next.initial == 18 && next.vowel == 20) {
                // ㄷ/ㅌ + 히: aspiration followed by palatalization (굳히다 → guchida).
                current.coda = ""; next.initial = 14
            } else if (current.final in listOf(6, 15, 27) && next.initial in listOf(0, 3, 12)) {
                current.coda = when (current.final) { 6 -> "n"; 15 -> "l"; else -> "" }
                next.initial = when (next.initial) { 0 -> 15; 3 -> 16; else -> 14 }
            } else if ((current.coda == "n" && next.initial == 5) || (current.coda == "l" && next.initial == 2)) {
                current.coda = "l"; next.initial = 5
            } else {
                if (next.initial == 5 && current.coda in listOf("k", "t", "p", "m", "ng")) next.initial = 2
                if (next.initial in listOf(2, 6)) current.coda = when (current.coda) {
                    "k" -> "ng"; "t" -> "n"; "p" -> "m"; else -> current.coda
                }
            }
        }
        return syllables.mapIndexed { index, syllable ->
            val initial = if (syllable.initial == 5 && index > 0 && syllables[index - 1].coda == "l") "l" else initials[syllable.initial]
            initial + vowels[syllable.vowel] + syllable.coda
        }.joinToString("")
    }
}
