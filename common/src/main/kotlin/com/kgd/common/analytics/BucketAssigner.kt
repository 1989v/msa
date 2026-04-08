package com.kgd.common.analytics

import kotlin.math.absoluteValue

object BucketAssigner {
    fun assign(userId: String, experimentId: Long, variantWeights: List<Pair<String, Int>>): String {
        val hash = murmurHash3("${experimentId}:${userId}")
        val bucket = (hash % 10000).absoluteValue

        var cumulative = 0
        for ((name, weight) in variantWeights) {
            cumulative += weight * 100
            if (bucket < cumulative) return name
        }
        return variantWeights.last().first
    }

    private fun murmurHash3(key: String): Int {
        val data = key.toByteArray()
        val len = data.size
        val seed = 0x9747b28c.toInt()
        var h = seed xor len
        var i = 0
        while (i + 4 <= len) {
            var k = (data[i].toInt() and 0xff) or
                    ((data[i + 1].toInt() and 0xff) shl 8) or
                    ((data[i + 2].toInt() and 0xff) shl 16) or
                    ((data[i + 3].toInt() and 0xff) shl 24)
            k = k * 0xcc9e2d51.toInt()
            k = (k shl 15) or (k ushr 17)
            k = k * 0x1b873593
            h = h xor k
            h = (h shl 13) or (h ushr 19)
            h = h * 5 + 0xe6546b64.toInt()
            i += 4
        }
        var remaining = 0
        when (len - i) {
            3 -> {
                remaining = remaining xor ((data[i + 2].toInt() and 0xff) shl 16)
                remaining = remaining xor ((data[i + 1].toInt() and 0xff) shl 8)
                remaining = remaining xor (data[i].toInt() and 0xff)
                remaining = remaining * 0xcc9e2d51.toInt()
                remaining = (remaining shl 15) or (remaining ushr 17)
                remaining = remaining * 0x1b873593
                h = h xor remaining
            }
            2 -> {
                remaining = remaining xor ((data[i + 1].toInt() and 0xff) shl 8)
                remaining = remaining xor (data[i].toInt() and 0xff)
                remaining = remaining * 0xcc9e2d51.toInt()
                remaining = (remaining shl 15) or (remaining ushr 17)
                remaining = remaining * 0x1b873593
                h = h xor remaining
            }
            1 -> {
                remaining = remaining xor (data[i].toInt() and 0xff)
                remaining = remaining * 0xcc9e2d51.toInt()
                remaining = (remaining shl 15) or (remaining ushr 17)
                remaining = remaining * 0x1b873593
                h = h xor remaining
            }
        }
        h = h xor len
        h = h xor (h ushr 16)
        h = h * 0x85ebca6b.toInt()
        h = h xor (h ushr 13)
        h = h * 0xc2b2ae35.toInt()
        h = h xor (h ushr 16)
        return h
    }
}
