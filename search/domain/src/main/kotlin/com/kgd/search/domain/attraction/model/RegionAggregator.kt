package com.kgd.search.domain.attraction.model

import java.time.LocalDate
import kotlin.math.asin
import kotlin.math.cos
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/**
 * 재색인 1차 훑기에서 모으는 가벼운 투영. 지역 안 위치를 계산하는 데 필요한 것만 담는다.
 * [contentId] 는 코스 구성 지점을 같은 언어 관광지 id 로 잇는 지도의 키, [eventPeriod] 는 행사의 유효 기간이다 —
 * 재색인일 기준으로 끝난 행사를 가까운 곳·비슷한 곳 후보와 지역 건수에서 거르는 근거다.
 */
data class RegionProjection(
    val id: String,
    val contentId: String,
    val lang: String,
    val ldongRegnCd: String?,
    val ldongSignguCd: String?,
    val contentTypeId: String?,
    val lclsSystm3: String?,
    val latitude: Double,
    val longitude: Double,
    val title: String,
    val eventPeriod: EventPeriod?,
)

/**
 * 한 문서의 지역 안 위치.
 * [typeCount] 는 같은 시군구·같은 유형 수(자기 포함), [categoryCount] 는 거기에 같은 lclsSystm3 까지 같은 수다.
 * 분류가 없는 문서는 [categoryCount] 가 null 이고 [nearest] 가 비어 있다.
 */
data class RegionPlacement(
    val typeCount: Int,
    val categoryCount: Int?,
    val nearest: List<NearbyPlace>,
)

/** [eventEndEffective] 는 항목이 행사일 때의 유효 종료일 — 렌더·화면이 그 뒤 끝난 항목을 오늘 기준으로 한 번 더 거른다. */
data class NearbyPlace(val id: String, val title: String, val distanceMeters: Int, val eventEndEffective: LocalDate?)

/**
 * 같은 시군구 안에서의 수와 가까운 곳을 센다.
 *
 * 시군구 축은 시도 코드 + 시군구 코드다. 법정동 시군구 코드는 시도 안에서만 유일해서
 * 시군구 코드만 쓰면 서울 종로구와 부산 중구가 한 곳으로 합쳐진다.
 * 둘 중 하나라도 없는 문서는 결과에서 빠지고 남의 수에도 들어가지 않는다.
 */
object RegionAggregator {

    const val NEAREST_LIMIT = 5

    private data class RegionKey(val lang: String, val regn: String, val signgu: String, val type: String)

    /**
     * 문서 id → 지역 안 위치. id 는 언어별 문서마다 다르다.
     *
     * 수와 가까운 곳은 [candidates] 로만 센다. 결과는 [targets] 마다 붙인다 — 후보에서 뺀 문서(끝난 행사 등)도
     * 자기 지역 안 위치는 갖되, 그 수에는 자기가 들지 않는다(후보가 아니므로). 같은 묶음에 후보가 하나도 없으면
     * 수는 0 이다.
     */
    fun aggregate(
        candidates: List<RegionProjection>,
        targets: List<RegionProjection> = candidates,
    ): Map<String, RegionPlacement> {
        val groups = candidates.groupBy { keyOf(it) }
        val categoryGroups = HashMap<RegionKey, Map<String, List<RegionProjection>>>(groups.size * 2)
        val result = HashMap<String, RegionPlacement>(targets.size * 2)
        for (doc in targets) {
            val key = keyOf(doc) ?: continue
            val typeGroup = groups[key].orEmpty()
            val byCategory = categoryGroups.getOrPut(key) {
                typeGroup.filter { !it.lclsSystm3.isNullOrBlank() }.groupBy { it.lclsSystm3!! }
            }
            val sameCategory = doc.lclsSystm3?.takeIf { it.isNotBlank() }?.let { byCategory[it].orEmpty() }
            result[doc.id] = RegionPlacement(
                typeCount = typeGroup.size,
                categoryCount = sameCategory?.size,
                nearest = sameCategory?.let { nearest(doc, it) }.orEmpty(),
            )
        }
        return result
    }

    private fun keyOf(p: RegionProjection): RegionKey? {
        val regn = p.ldongRegnCd?.trim().takeUnless { it.isNullOrEmpty() } ?: return null
        val signgu = p.ldongSignguCd?.trim().takeUnless { it.isNullOrEmpty() } ?: return null
        val type = p.contentTypeId?.trim().takeUnless { it.isNullOrEmpty() } ?: return null
        return RegionKey(p.lang, regn, signgu, type)
    }

    // 한 묶음은 시군구·유형·분류가 모두 같은 문서라 수십~수백 건이다. 전부 재고 정렬해도 충분하다.
    private fun nearest(self: RegionProjection, group: List<RegionProjection>): List<NearbyPlace> =
        group.asSequence()
            .filter { it.id != self.id }
            .map { NearbyPlace(it.id, it.title, distanceMeters(self, it), it.eventPeriod?.end) }
            .sortedWith(compareBy<NearbyPlace> { it.distanceMeters }.thenBy { it.id })
            .take(NEAREST_LIMIT)
            .toList()

    private const val EARTH_RADIUS_M = 6_371_000.0

    private fun distanceMeters(a: RegionProjection, b: RegionProjection): Int {
        val lat1 = Math.toRadians(a.latitude)
        val lat2 = Math.toRadians(b.latitude)
        val dLat = lat2 - lat1
        val dLon = Math.toRadians(b.longitude - a.longitude)
        val h = sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return (2 * EARTH_RADIUS_M * asin(sqrt(h))).roundToInt()
    }
}
