package com.kgd.search.application.attraction.service

import com.kgd.search.application.attraction.usecase.NearbyAttractionsUseCase
import com.kgd.search.application.attraction.usecase.SearchAttractionUseCase
import org.springframework.stereotype.Service

/**
 * 주변 검색 네 가지를 서버에서 한 번에 돈다. 조건은 상세 화면이 따로 부르던 때와 같다 — 화면은 받은 목록에서
 * 자기 자신을 빼고 개수를 자른다(같은 분류 표시 · 편의시설 유형별 몫도 화면 몫이다).
 */
@Service
class NearbyAttractionsService(
    private val search: SearchAttractionUseCase,
) : NearbyAttractionsUseCase {

    override fun nearby(id: String): NearbyAttractionsUseCase.Nearby? {
        val self = search.findById(id) ?: return null
        fun around(category: String, radiusKm: Double, size: Int, sort: String = "distance", eventStatus: String? = null) =
            search.execute(
                SearchAttractionUseCase.Query(
                    lang = self.lang,
                    lat = self.latitude,
                    lng = self.longitude,
                    radiusKm = radiusKm,
                    sort = sort,
                    category = category,
                    size = size,
                    eventStatus = eventStatus,
                ),
            ).attractions.map(NearbyAttractionsUseCase.NearbyPlace::of)
        return NearbyAttractionsUseCase.Nearby(
            // 관광 분류만 — 거리순 상위를 그대로 쓰면 상점가에서는 전부 상점이 된다
            sights = around(SIGHT_CATEGORIES, NEARBY_RADIUS_KM, SIGHTS_SIZE),
            stays = around(STAY_CATEGORY, NEARBY_RADIUS_KM, KIND_SIZE),
            // 행사는 하루 나들이 거리까지 · 끝나지 않은 것만 · 가까운 순. 시작일 순이면 1년 내내 하는 상설 행사가
            // 거리와 무관하게 늘 맨 위라, 청계산 상세의 「주변 행사」가 15km 밖 도심 행사로 채워졌다.
            events = around(EVENT_CATEGORY, EVENTS_RADIUS_KM, KIND_SIZE, eventStatus = "NOT_ENDED"),
            // 편의시설은 넉넉히 받아 화면이 유형마다 몫을 자른다
            amenities = around(AMENITY_CATEGORIES, NEARBY_RADIUS_KM, AMENITY_SIZE),
        )
    }

    companion object {
        const val SIGHT_CATEGORIES = "nature,history,culture,leisure"
        const val AMENITY_CATEGORIES = "shopping,food"
        const val STAY_CATEGORY = "stay"
        const val EVENT_CATEGORY = "festival"
        const val NEARBY_RADIUS_KM = 5.0
        const val EVENTS_RADIUS_KM = 20.0
        /** 화면이 8곳을 보인다 — 자기 자신이 섞여 와도 남는 크기 */
        const val SIGHTS_SIZE = 9
        /** 숙소·행사 6건 + 자기 자신 + 같은 분류에 이미 든 곳의 여유 */
        const val KIND_SIZE = 12
        const val AMENITY_SIZE = 60
    }
}
