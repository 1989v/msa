package com.kgd.search.infrastructure.render

import com.kgd.search.application.attraction.port.AttractionPageRenderPort
import com.kgd.search.domain.attraction.model.Admission
import com.kgd.search.domain.attraction.model.AttractionAttributes
import com.kgd.search.domain.attraction.model.AttractionClickSignal
import com.kgd.search.domain.attraction.model.AttractionDocument
import com.kgd.search.domain.attraction.model.AttractionRegion
import com.kgd.search.domain.attraction.model.Availability
import com.kgd.search.domain.attraction.model.BarrierFreeInfo
import com.kgd.search.domain.attraction.model.CourseStop
import com.kgd.search.domain.attraction.model.EventSchedule
import com.kgd.search.domain.attraction.model.EventStatusText
import com.kgd.search.domain.attraction.model.PetPolicy
import com.kgd.search.domain.attraction.model.RegularClosure
import com.kgd.search.domain.attraction.model.RelatedPlace
import com.kgd.search.domain.attraction.model.SimilarPlace
import com.kgd.search.domain.attraction.model.WellnessTheme
import com.kgd.search.infrastructure.config.AttractionRenderProperties
import com.kgd.search.domain.attraction.model.AttractionSeoText.attractionPhone
import com.kgd.search.domain.attraction.model.AttractionSeoText.attractionSourceName
import com.kgd.search.domain.attraction.model.AttractionSeoText.clampDescription
import com.kgd.search.domain.attraction.model.AttractionSeoText.escapeHtml
import com.kgd.search.domain.attraction.model.AttractionSeoText.jsTrim
import com.kgd.search.domain.attraction.model.AttractionSeoText.secureImageUrl
import com.kgd.search.domain.attraction.model.AttractionSeoText.sourceText
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.time.DayOfWeek
import java.time.LocalDate
import java.util.Locale

/**
 * 관광지 상세 HTML 을 조립한다 (ADR-0103).
 *
 * 관광지 프리렌더(`portal-fe/scripts/prerender-seo.mjs` `renderAttractionDetail`)·블로그 서버 렌더와
 * **같은 셸 계약**이다 — `<!--seo:start-->…<!--seo:end-->` 를 메타로 갈고 `#root` 에 크롤러용 본문을 넣는다.
 * 메타·JSON-LD 는 화면(`AttractionPage` + `useSeo`)이 하이드레이션 때 같은 규칙으로 다시 만들므로,
 * 규칙의 원본은 `portal-fe/src/seo/copy.mjs` 다(`attractionMeta`·`touristAttractionJsonLd`·
 * `attractionBreadcrumbJsonLd`·`attractionJsonLd`). JSON-LD 가 같은지는 `AttractionJsonLdParityTest` 가 본다.
 *
 * 행사 상태·색인 만료·끝난 항목 거름은 호출자가 넘긴 KST 오늘로 판정한다 — 이 객체는 시계를 읽지 않는다.
 *
 * 원문은 모두 [sourceText](태그 제거 → 디코드) 뒤 [escapeHtml] 을 거쳐 나간다. 예외는 색인 `feeText` 하나다 —
 * 이미 정규화된 평문이라 [escapeHtml] 만 건다(다시 [sourceText] 하면 디코드된 「<어린이>」가 태그로 지워진다).
 * 링크는 내부 경로와 문의 전화(`tel:`)만 만든다.
 */
@Component
class AttractionPageRenderer(
    properties: AttractionRenderProperties,
    private val objectMapper: ObjectMapper,
) : AttractionPageRenderPort {
    private val origin = properties.origin.trimEnd('/')

    override fun attractionPage(shell: String?, doc: AttractionDocument, today: LocalDate): String {
        val lang = if (doc.lang == EN) EN else KO
        val meta = attractionMeta(lang, doc)
        val canonical = attractionUrl(lang, doc.id)
        val image = secureImageUrl(doc.imageUrl)?.takeIf { PHOTO.containsMatchIn(it) } ?: "$origin/og/place.png"
        // 개요가 없으면 제목·주소·좌표뿐인 얇은 문서다. 끝난 지 31일이 지난 행사도 색인에서 뺀다(30일까지는 대상).
        val noindex = doc.overview.isNullOrEmpty() ||
            (EventSchedule.isEvent(doc.contentTypeId) && EventSchedule.indexExpired(doc.eventPeriod, today))
        val head = metaTags(
            lang = lang,
            title = meta.title,
            description = meta.description,
            canonical = canonical,
            image = image,
            imageAlt = meta.heading,
            noindex = noindex,
            // 언어 대체 짝이고 짝 스위치(`search.alternate-pairs.enabled`, 기본 꺼짐)가 켜졌을 때만 hreflang (ADR-0062 §8 개정).
            // 스위치가 꺼져 있으면 색인 `alternateId` 가 늘 null 이다. noindex 문서는 대체 주소를 선언하지 않는다
            alternates = doc.alternateId?.takeUnless { noindex }?.let { attractionHreflangAlternates(lang, doc.id, it) }.orEmpty(),
            feed = AttractionFeedRenderer.feedTitle(lang) to origin + AttractionFeedRenderer.feedPath(lang),
            jsonLd = listOf(primaryJsonLd(lang, doc, meta), breadcrumbJsonLd(lang, doc)),
        )
        return compose(shell, lang, head, shellBody(attractionBody(lang, doc, meta, today)))
    }

    /** 요청 id 를 쓰지 않는다 — 경로에서 온 값을 페이지에 되돌리지 않는다. */
    override fun notFoundPage(shell: String?, lang: String): String {
        val l = if (lang == EN) EN else KO
        val hub = placeUrl(l)
        val title = if (l == EN) "Attraction not found | ${brand(l)}" else "찾을 수 없는 관광지 | ${brand(l)}"
        val head = metaTags(
            lang = l,
            title = title,
            description = if (l == EN) "The attraction you requested could not be found." else "요청한 관광지를 찾을 수 없습니다.",
            canonical = hub,
            image = null,
            imageAlt = null,
            noindex = true,
            jsonLd = emptyList(),
        )
        val heading = if (l == EN) "Attraction not found" else "찾을 수 없는 관광지"
        val back = if (l == EN) "Explore Korea" else "한국 관광지 탐색으로"
        return compose(shell, l, head, shellBody("<h1>$heading</h1><p><a href=\"${placePath(l)}\">$back</a></p>"))
    }

    override fun fallbackPage(shell: String?): String = shell ?: MINIMAL_SHELL

    // ─── 조립 ──────────────────────────────────────────────────────────────

    private fun compose(shell: String?, lang: String, head: String, body: String): String {
        if (shell == null) return minimalHtml(lang, head, body)
        // 치환 문자열을 해석하지 않는 방식만 쓴다 — 원문의 `$1` 이 그룹 참조가 되면 예외나 내용 변형이 난다
        val withMeta = SEO_BLOCK.replace(shell) { "<!--seo:server-->\n    $head" }
        return withMeta
            .replaceFirst(HTML_KO, "<html lang=\"$lang\">")
            .replaceFirst(ROOT_DIV, "<div id=\"root\">$body</div>")
    }

    /** 셸을 한 번도 받지 못했을 때(콜드 스타트 + portal-fe 미기동). SPA 는 없지만 본문은 읽힌다. */
    private fun minimalHtml(lang: String, head: String, body: String) = """
        <!doctype html>
        <html lang="$lang">
          <head>
            <meta charset="UTF-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            $head
          </head>
          <body><div id="root">$body</div></body>
        </html>
    """.trimIndent()

    /**
     * prerender-seo.mjs `metaTags` 와 같은 줄·순서. hreflang 은 언어 대체 짝이고 짝 스위치
     * (`search.alternate-pairs.enabled`, 기본 꺼짐)가 켜졌을 때만 (ADR-0062 §8 개정). 속성값도 모두 이스케이프한다.
     */
    private fun metaTags(
        lang: String,
        title: String,
        description: String,
        canonical: String,
        image: String?,
        imageAlt: String?,
        noindex: Boolean,
        jsonLd: List<Map<String, Any?>>,
        alternates: List<Pair<String, String>> = emptyList(),
        feed: Pair<String, String>? = null,
    ): String {
        val lines = mutableListOf(
            "<title>${escapeHtml(title)}</title>",
            """<meta name="description" content="${escapeHtml(description)}" />""",
            """<link rel="canonical" href="${escapeHtml(canonical)}" />""",
            """<meta property="og:type" content="website" />""",
            """<meta property="og:site_name" content="${escapeHtml(brand(lang))}" />""",
            """<meta property="og:title" content="${escapeHtml(title)}" />""",
            """<meta property="og:description" content="${escapeHtml(description)}" />""",
            """<meta property="og:url" content="${escapeHtml(canonical)}" />""",
            """<meta property="og:locale" content="${if (lang == EN) "en_US" else "ko_KR"}" />""",
            """<meta name="twitter:card" content="${if (image != null) "summary_large_image" else "summary"}" />""",
            """<meta name="twitter:title" content="${escapeHtml(title)}" />""",
            """<meta name="twitter:description" content="${escapeHtml(description)}" />""",
        )
        if (noindex) lines += """<meta name="robots" content="noindex, follow" />"""
        if (image != null) {
            val src = escapeHtml(image)
            lines += """<meta property="og:image" content="$src" />"""
            lines += """<meta property="og:image:secure_url" content="$src" />"""
            imageMimeType(image)?.let { lines += """<meta property="og:image:type" content="$it" />""" }
            lines += """<meta property="og:image:width" content="$OG_IMAGE_W" />"""
            lines += """<meta property="og:image:height" content="$OG_IMAGE_H" />"""
            imageAlt?.let { lines += """<meta property="og:image:alt" content="${escapeHtml(it)}" />""" }
            lines += """<meta name="twitter:image" content="$src" />"""
            imageAlt?.let { lines += """<meta name="twitter:image:alt" content="${escapeHtml(it)}" />""" }
        }
        // 하이드레이션(useSeo)이 지우고 다시 달 수 있게 JSON-LD 와 같은 표시를 단다
        alternates.forEach { (hreflang, href) ->
            lines += """<link rel="alternate" hreflang="${escapeHtml(hreflang)}" href="${escapeHtml(href)}" $SEO_MULTI />"""
        }
        // 최근 갱신 피드(copy.mjs `placeFeed`) — (제목, 주소). 화면 useSeo `feeds` 가 같은 표시로 다시 단다
        feed?.let { (title, href) ->
            lines += """<link rel="alternate" type="application/rss+xml" title="${escapeHtml(title)}" href="${escapeHtml(href)}" $SEO_MULTI />"""
        }
        jsonLd.forEach {
            // </script> 가 JSON 문자열에 섞이면 파서가 조기 종료된다
            val json = objectMapper.writeValueAsString(it).replace("<", "\\u003c")
            // useSeo 가 「내가 관리하는 태그」를 고르는 표시 — 없으면 하이드레이션이 같은 블록을 한 벌 더 붙인다
            lines += """<script type="application/ld+json" $SEO_MULTI>$json</script>"""
        }
        return lines.joinToString("\n    ")
    }

    // ─── 메타 · 구조화 데이터 (copy.mjs 규칙) ─────────────────────────────

    private data class Meta(val title: String, val description: String, val heading: String)

    /** copy.mjs `attractionMeta` */
    private fun attractionMeta(lang: String, doc: AttractionDocument): Meta {
        val name = doc.title
        val where = doc.address.orEmpty()
        val overview = sourceText(doc.overview)
        val (title, fallback) = attractionMetaCopy(lang, doc, name, where)
        return Meta(
            title = title,
            description = clampDescription(if (overview.length >= 60) overview else fallback),
            heading = name,
        )
    }

    /** copy.mjs `attractionMetaCopy` — 유형별 (제목, 개요가 짧을 때의 설명). 유형은 원천 유형 코드로 고른다. */
    private fun attractionMetaCopy(lang: String, doc: AttractionDocument, name: String, where: String): Pair<String, String> {
        val en = lang == EN
        val at = if (where.isNotEmpty()) " at $where" else " in South Korea"
        val dash = if (where.isNotEmpty()) " — $where" else ""
        return when {
            EventSchedule.isEvent(doc.contentTypeId) -> if (en) {
                "$name — Dates, Venue & Things to Do Nearby | $BRAND_EN" to
                    "$name is a festival or event$at. See the dates, venue, map and things to do nearby."
            } else {
                "$name 행사 정보 — 일정 · 장소 · 주변 가볼 만한 곳 | $BRAND_KO" to
                    "$name${dash}에서 열리는 축제·행사입니다. 일정·장소와 지도, 주변 가볼 만한 곳을 함께 확인하세요."
            }
            doc.contentTypeId in STAY_CONTENT_TYPES -> if (en) {
                "$name — Stay Info, Check-in & Things to Do Nearby | $BRAND_EN" to
                    "$name is a place to stay$at. See check-in times, the map and things to do nearby."
            } else {
                "$name 숙박 정보 — 입실·퇴실 · 주변 가볼 만한 곳 | $BRAND_KO" to
                    "$name${dash}에 있는 숙소입니다. 입실·퇴실 시간과 지도, 주변 가볼 만한 곳을 함께 확인하세요."
            }
            doc.contentTypeId in COURSE_CONTENT_TYPES -> if (en) {
                "$name — Travel Course, Stops & Time Needed | $BRAND_EN" to
                    "$name is a travel course in South Korea. See the stops in order, total distance and time needed."
            } else {
                // 원천 코스 이름은 「… 코스」로 끝나는 것이 많다 — 그때 「여행코스」를 또 붙이면 「… 코스 여행코스」가 된다
                val course = if (name.trimEnd().endsWith("코스")) name else "$name 여행코스"
                "$course — 코스 구성 · 거리 · 소요 시간 | $BRAND_KO" to
                    "${course}입니다. 코스를 이루는 관광지를 순서대로 보고 총 거리와 소요 시간을 확인하세요."
            }
            else -> {
                val label = categoryLabel(doc.category, lang)
                if (en) {
                    "Visit $name — Map, Photos & Things to Do Nearby | $BRAND_EN" to
                        "$name is a ${label.lowercase(Locale.ROOT)} attraction$at. See the map, photos, directions and things to do nearby."
                } else {
                    "$name 관광 정보 — 가는 길 · 주변 가볼 만한 곳 | $BRAND_KO" to
                        "$name${dash}에 있는 $label 관광지입니다. 주소·지도·사진과 가는 길, 주변 가볼 만한 곳을 함께 확인하세요."
                }
            }
        }
    }

    /** copy.mjs `attractionJsonLd` — 유형별 주 구조화 데이터 */
    private fun primaryJsonLd(lang: String, doc: AttractionDocument, meta: Meta): Map<String, Any?> = when {
        EventSchedule.isEvent(doc.contentTypeId) -> eventJsonLd(lang, doc, meta)
        doc.contentTypeId in STAY_CONTENT_TYPES -> lodgingJsonLd(lang, doc, meta)
        doc.contentTypeId in COURSE_CONTENT_TYPES -> touristTripJsonLd(lang, doc, meta)
        else -> touristAttractionJsonLd(lang, doc, meta)
    }

    /** copy.mjs `placeJsonLdBase` — 키 순서까지 같게 둔다 */
    private fun MutableMap<String, Any?>.putBase(lang: String, doc: AttractionDocument, meta: Meta, type: String) {
        put("@context", "https://schema.org")
        put("@type", type)
        put("name", doc.title)
        put("description", clampDescription(sourceText(doc.overview).ifEmpty { meta.description }, 300))
        put("url", attractionUrl(lang, doc.id))
        put("inLanguage", lang)
        put("isPartOf", mapOf("@type" to "WebSite", "name" to brand(lang), "url" to origin))
        val local = jsTrim(doc.titleLocal.orEmpty())
        if (local.isNotEmpty() && local != doc.title) put("alternateName", local)
        if (!doc.imageUrl.isNullOrEmpty()) put("image", secureImageUrl(doc.imageUrl))
    }

    private fun postalAddress(doc: AttractionDocument) =
        mapOf("@type" to "PostalAddress", "streetAddress" to doc.address, "addressCountry" to "KR")

    private fun geo(doc: AttractionDocument) =
        mapOf("@type" to "GeoCoordinates", "latitude" to doc.latitude, "longitude" to doc.longitude)

    /** copy.mjs `addContactAndPlace` */
    private fun MutableMap<String, Any?>.putContactAndPlace(doc: AttractionDocument) {
        if (!doc.tel.isNullOrEmpty()) put("telephone", doc.tel)
        if (!doc.address.isNullOrEmpty()) put("address", postalAddress(doc))
        if (isTruthy(doc.latitude) && isTruthy(doc.longitude)) put("geo", geo(doc))
    }

    /** copy.mjs `touristAttractionJsonLd` */
    private fun touristAttractionJsonLd(lang: String, doc: AttractionDocument, meta: Meta): Map<String, Any?> = buildMap {
        putBase(lang, doc, meta, "TouristAttraction")
        if (!doc.imageUrl.isNullOrEmpty()) put("image", imageObject(doc))
        putContactAndPlace(doc)
        containedInPlace(doc)?.let { put("containedInPlace", it) }
        // 해석된 속성만 — 모르는 값을 「매일 연다」「유료」로 바꾸지 않는다
        openDays(doc.attributes)?.let { days ->
            put(
                "openingHoursSpecification",
                mapOf(
                    "@type" to "OpeningHoursSpecification",
                    "dayOfWeek" to days.map { "https://schema.org/${schemaDayName(it)}" },
                ),
            )
        }
        when (doc.attributes?.freeAdmission) {
            Admission.FREE -> put("isAccessibleForFree", true)
            Admission.PAID -> put("isAccessibleForFree", false)
            Admission.UNKNOWN, null -> Unit
        }
    }

    /**
     * copy.mjs `attractionImageObject` — 대표 사진. 공공누리 유형은 허용 목록([KOGL_LICENSE])의 키로만 쓰고
     * 주소로 흘려보내지 않는다. 제1·3유형이 아니면(상업 이용 금지 · 모름) license 를 싣지 않는다.
     */
    private fun imageObject(doc: AttractionDocument): Map<String, Any?> = buildMap {
        put("@type", "ImageObject")
        put("contentUrl", secureImageUrl(doc.imageUrl))
        KOGL_LICENSE[doc.copyrightDivCd]?.let { put("license", it) }
        put("creditText", PHOTO_CREDIT)
    }

    /** copy.mjs `attractionSigunguName` — 지역 안 위치에 실려 온 원문이라 평문화한다. 모르면 빈 문자열 */
    private fun sigunguName(doc: AttractionDocument): String = sourceText(doc.region?.sigunguName)

    /** copy.mjs `attractionContainedInPlace` — 시군구 › 시도, 이름만. 아는 단계만, 하나도 모르면 null */
    private fun containedInPlace(doc: AttractionDocument): Map<String, Any?>? {
        val sido = doc.sidoName?.takeIf { it.isNotEmpty() }?.let { mapOf("@type" to "AdministrativeArea", "name" to it) }
        val sigungu = sigunguName(doc)
        if (sigungu.isEmpty()) return sido
        return buildMap {
            put("@type", "AdministrativeArea")
            put("name", sigungu)
            sido?.let { put("containedInPlace", it) }
        }
    }

    /**
     * copy.mjs `attractionBreadcrumbJsonLd` 의 시군구 단계 — (이름, 지역 코드). 시도 단계가 있고 시도·시군구 코드와
     * 시군구 이름을 모두 알 때만(지역 페이지 주소가 두 코드를 잇는다). 화면 브레드크럼과 BreadcrumbList 가 같이 쓴다.
     */
    private fun sigunguCrumb(doc: AttractionDocument): Pair<String, String>? {
        if (doc.sidoName.isNullOrEmpty()) return null
        val regn = jsTrim(doc.ldongRegnCd.orEmpty())
        val signgu = jsTrim(doc.ldongSignguCd.orEmpty())
        val name = sigunguName(doc)
        // 시군구 코드는 화면에서 지역 안 위치(region)에 실려 온다 — region 이 없으면 화면도 모른다
        if (doc.region == null || regn.isEmpty() || signgu.isEmpty() || name.isEmpty()) return null
        return name to regn + signgu
    }

    /** copy.mjs `eventJsonLd` — 기간(날짜 없으면 생략)과 장소. 오늘에 따라 바뀌는 값은 싣지 않는다 */
    private fun eventJsonLd(lang: String, doc: AttractionDocument, meta: Meta): Map<String, Any?> = buildMap {
        putBase(lang, doc, meta, "Event")
        doc.eventPeriod?.let {
            put("startDate", it.start.toString())
            put("endDate", it.end.toString())
        }
        val place = introText(introValues(doc.introRaw), "eventplace").ifEmpty { doc.title }
        put(
            "location",
            buildMap {
                put("@type", "Place")
                put("name", place)
                if (!doc.address.isNullOrEmpty()) put("address", postalAddress(doc))
                if (isTruthy(doc.latitude) && isTruthy(doc.longitude)) put("geo", geo(doc))
            },
        )
    }

    /** copy.mjs `lodgingJsonLd` — 예약 원문은 싣지 않는다 */
    private fun lodgingJsonLd(lang: String, doc: AttractionDocument, meta: Meta): Map<String, Any?> = buildMap {
        putBase(lang, doc, meta, "LodgingBusiness")
        putContactAndPlace(doc)
    }

    /** copy.mjs `touristTripJsonLd` — 구성 지점을 받은 순서 그대로 */
    private fun touristTripJsonLd(lang: String, doc: AttractionDocument, meta: Meta): Map<String, Any?> = buildMap {
        putBase(lang, doc, meta, "TouristTrip")
        val stops = doc.courseStops.orEmpty()
        if (stops.isNotEmpty()) {
            put(
                "itinerary",
                mapOf(
                    "@type" to "ItemList",
                    "numberOfItems" to stops.size,
                    "itemListElement" to stops.mapIndexed { index, stop ->
                        mapOf(
                            "@type" to "ListItem",
                            "position" to index + 1,
                            "item" to buildMap {
                                put("@type", "TouristAttraction")
                                put("name", stop.name)
                                stop.attractionId?.let { put("url", attractionUrl(lang, it.toString())) }
                            },
                        )
                    },
                ),
            )
        }
    }

    /** copy.mjs `attractionBreadcrumbJsonLd` — 허브 › 시도 › 시군구 › 관광지 */
    private fun breadcrumbJsonLd(lang: String, doc: AttractionDocument): Map<String, Any?> {
        val trail = buildList {
            add(hubName(lang) to placeUrl(lang))
            if (!doc.sidoName.isNullOrEmpty()) add(doc.sidoName to regionUrl(lang, doc.ldongRegnCd.orEmpty()))
            sigunguCrumb(doc)?.let { (name, code) -> add(name to regionUrl(lang, code)) }
            add(doc.title to attractionUrl(lang, doc.id))
        }
        return mapOf(
            "@context" to "https://schema.org",
            "@type" to "BreadcrumbList",
            "itemListElement" to trail.mapIndexed { index, (name, url) ->
                mapOf("@type" to "ListItem", "position" to index + 1, "name" to name, "item" to url)
            },
        )
    }

    /**
     * 여는 요일(월→일). 시각은 해석하지 않으므로 요일만 알린다. 매주 쉬는 요일이 없는 곳
     * (연중무휴 · 명절만 휴무)은 7일 전부, 모르면 null.
     */
    private fun openDays(attributes: AttractionAttributes?): List<DayOfWeek>? =
        when (val closure = attributes?.regularClosure) {
            RegularClosure.AlwaysOpen -> DayOfWeek.entries
            is RegularClosure.Weekly -> DayOfWeek.entries.filterNot { it in closure.closedDays }.ifEmpty { null }
            RegularClosure.Unknown, null -> null
        }

    // ─── 크롤러용 본문 ──────────────────────────────────────────────────────

    /**
     * 화면(AttractionPage)과 같은 순서로 절을 낸다: 브레드크럼(시군구까지) → 제목 → 방문 요약 → 배지 줄 → 행동 줄 →
     * 개요 → 대표 사진 → 유형별 절(행사·숙박·코스) → 지역 안 위치 → 같은 분류 가까운 곳 → 비슷한 곳(다른 시도) →
     * 함께 간 곳 → 출처. 방문 요약·배지 줄은 유형별 절이 없는 유형에만 붙고, 그 유형에서는 「이용 안내」·배지 절이
     * 겹치므로 내지 않는다. 반경 주변 관광지·편의시설·근처 행사·숙소는 조회가 더 필요해 SPA 가 그린다
     * (관광지당 색인 조회는 한 번).
     */
    private fun attractionBody(lang: String, doc: AttractionDocument, meta: Meta, today: LocalDate): String = buildString {
        val hub = hubName(lang)
        append("<nav><a href=\"${placePath(lang)}\">${escapeHtml(hub)}</a>")
        if (!doc.sidoName.isNullOrEmpty()) {
            append(" › <a href=\"${escapeHtml(regionPath(lang, doc.ldongRegnCd.orEmpty()))}\">${escapeHtml(doc.sidoName)}</a>")
        }
        sigunguCrumb(doc)?.let { (name, code) -> append(" › <a href=\"${escapeHtml(regionPath(lang, code))}\">${escapeHtml(name)}</a>") }
        append("</nav>")
        append("<h1>${escapeHtml(meta.heading)}</h1>")
        val local = jsTrim(doc.titleLocal.orEmpty())
        if (local.isNotEmpty() && local != doc.title) append("<p>${escapeHtml(local)}</p>")
        append("<p>${escapeHtml(listOfNotNull(categoryLabel(doc.category, lang), doc.address?.takeIf { it.isNotEmpty() }).joinToString(" · "))}</p>")
        // 문의(infoCenter)가 비면 행동 줄이 tel 을 보여 주므로 여기서는 빼서 두 번 나가지 않게 한다
        val infoCenter = sourceText(doc.infoCenter)
        if (!doc.tel.isNullOrEmpty() && infoCenter.isNotEmpty()) append("<p>${escapeHtml(doc.tel)}</p>")
        val typed = typeSection(lang, doc, today)
        if (typed == null) {
            append(visitSummary(lang, doc))
            append(visitBadges(lang, doc.attributes, doc.uniqueClickers14d))
        }
        append(actions(if (infoCenter.isNotEmpty()) doc.infoCenter else doc.tel))
        append("<p>${escapeHtml(sourceText(doc.overview))}</p>")
        append(photo(doc))
        typed?.let(::append)
        append(campingSection(lang, doc.camping))
        if (typed != null) append(badges(lang, doc.attributes, doc.uniqueClickers14d))
        doc.barrierFree?.let { append(barrierFreeSection(lang, it)) }
        doc.wellness?.let { append(wellnessLine(lang, it)) }
        doc.region?.let {
            append(regionSection(lang, doc, it))
            append(sameCategoryNearby(lang, it, today))
        }
        append(similarSection(lang, doc.similarElsewhere?.filterNot { ended(it.eventEndEffective, today) }))
        // 함께 간 곳 — 비슷한 곳과 겹쳐도 거르지 않는다(근거가 다른 두 목록이다). 색인에 실린 목록 그대로, 화면과 같은 순서
        append(relatedSection(lang, doc.relatedPlaces))
        // 출처표시 의무 (data-sources.md §0) — 화면 바닥글과 같은 문구
        append("<p data-place-section=\"source\">${escapeHtml(sourceLine(lang, doc))}</p>")
    }

    /** 재색인 뒤 끝난 행사 항목 — 유효 종료일이 오늘보다 앞이다(오늘 끝나는 행사는 남긴다) */
    private fun ended(eventEnd: LocalDate?, today: LocalDate) = eventEnd != null && eventEnd.isBefore(today)

    /**
     * 행사 · 숙박 · 여행코스의 유형별 절. 이 유형들은 일반 「이용 안내」 대신 이것을 그린다 — 일반 절의 파생 값
     * (이용시간·요금·주차)이 같은 원문 키에서 와서 두 번 나가기 때문이다. 다른 유형이면 null.
     * 원문 키는 허용 목록으로만 고른다 — 숙박의 예약 URL·예약 안내는 목록에 없어서 나가지 않는다.
     */
    private fun typeSection(lang: String, doc: AttractionDocument, today: LocalDate): String? {
        val en = lang == EN
        val intro = introValues(doc.introRaw)
        return when {
            EventSchedule.isEvent(doc.contentTypeId) -> {
                val period = doc.eventPeriod?.let { listOf((if (en) "Dates" else "기간") to "${it.start} ~ ${it.end}") }.orEmpty()
                val status = EventStatusText.of(doc.eventPeriod, today, lang)
                    ?.let { "<p data-event-status>${escapeHtml(it)}</p>" }.orEmpty()
                section("event", if (en) "Event info" else "행사 정보", status + definitionList(period + introRows(intro, EVENT_INTRO, en)))
            }
            doc.contentTypeId in STAY_CONTENT_TYPES ->
                section("stay", if (en) "Stay info" else "숙박 정보", definitionList(introRows(intro, STAY_INTRO, en)))
            doc.contentTypeId in COURSE_CONTENT_TYPES ->
                section("course", if (en) "Course" else "코스 구성", definitionList(introRows(intro, COURSE_INTRO, en)) + courseList(lang, doc.courseStops))
            else -> null
        }
    }

    private fun section(name: String, heading: String, inner: String): String =
        if (inner.isEmpty()) "" else "<section data-place-section=\"$name\"><h2>${escapeHtml(heading)}</h2>$inner</section>"

    private fun definitionList(rows: List<Pair<String, String>>): String =
        if (rows.isEmpty()) "" else "<dl>" + rows.joinToString("") { (label, value) -> "<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>" } + "</dl>"

    /** 허용 목록 순서대로, 원문에 값이 있는 키만 (라벨, 평문) */
    private fun introRows(intro: Map<String, String>, allowed: List<IntroKey>, en: Boolean): List<Pair<String, String>> =
        allowed.mapNotNull { key -> introText(intro, key.key).takeIf { it.isNotEmpty() }?.let { (if (en) key.en else key.ko) to it } }

    /** 코스 구성 — 받은 순서 그대로. 같은 언어 관광지로 이어진 지점만 상세 링크 */
    private fun courseList(lang: String, stops: List<CourseStop>?): String {
        if (stops.isNullOrEmpty()) return ""
        return "<ol>" + stops.joinToString("") { stop ->
            val name = escapeHtml(stop.name)
            val item = stop.attractionId?.let { "<a href=\"${escapeHtml(attractionPath(lang, it.toString()))}\">$name</a>" } ?: name
            "<li>$item</li>"
        } + "</ol>"
    }

    /** introRaw(TourAPI 소개 원문 JSON 객체) → 키·값 원문. 없거나 깨졌으면 빈 맵 — copy.mjs `placeIntroText` 와 같은 판정 */
    private fun introValues(raw: String?): Map<String, String> {
        if (raw.isNullOrBlank()) return emptyMap()
        val node = runCatching { objectMapper.readTree(raw) }.getOrNull()?.takeIf { it.isObject } ?: return emptyMap()
        return node.properties()
            .filter { (_, value) -> value.isValueNode && !value.isNull }
            .associate { (key, value) -> key to value.asString() }
    }

    private fun introText(intro: Map<String, String>, key: String): String = sourceText(intro[key])

    /**
     * 방문 요약 — 화면 `visitSummary`(placeAttributes.ts)와 같은 일곱 칸·같은 문구. `VisitSummaryParityTest` 가 화면 출력 골든과 비교한다.
     * 값이 없는 칸은 「정보 없음」으로 남긴다(「불가」로 바꾸지 않는다). 두 줄 값(해석 줄 + 원문 줄)은 `\n` 으로 잇는다.
     */
    private fun visitSummary(lang: String, doc: AttractionDocument): String {
        val en = lang == EN
        val na = if (en) NOT_PROVIDED_EN else NOT_PROVIDED_KO
        val attributes = doc.attributes
        fun lines(vararg values: String?) = values.filterNot { it.isNullOrEmpty() }.joinToString("\n")
        val closure = when (val c = attributes?.regularClosure) {
            RegularClosure.AlwaysOpen -> if (en) "Open every day" else "연중무휴"
            is RegularClosure.Weekly -> weeklyClosureLabel(en, c.closedDays)
            RegularClosure.Unknown, null -> null
        }
        val parking = attributes?.let {
            availability(it.parking, if (en) "Parking available" else "주차 가능", if (en) "No parking" else "주차 불가")
        }
        val pet = when (attributes?.petPolicy) {
            PetPolicy.ALLOWED -> if (en) "Pets allowed" else "반려동물 동반 가능"
            PetPolicy.PARTIAL -> if (en) "Pets allowed in some areas" else "반려동물 일부 구역 동반 가능"
            PetPolicy.UNKNOWN, null -> sourceText(doc.petAcmpyType)
        }
        val accessibility = doc.barrierFree?.let { info ->
            BarrierFreeInfo.ICONS.filter { (code, _) -> code in info.flags }.joinToString(" · ") { (_, label) -> if (en) label.second else label.first }
        }
        val source = attractionSourceName(doc.source, lang) ?: na
        val updated = doc.modifiedAt?.toLocalDate()?.toString() ?: na
        val status = if (en) {
            "Source: $source · Source updated: $updated · Collected: $na"
        } else {
            "출처: $source · 원천 갱신일: $updated · 수집일: $na"
        }
        val rows = listOf(
            (if (en) "Admission" else "요금") to (doc.feeText ?: sourceText(doc.useFee)),
            (if (en) "Hours" else "이용시간") to sourceText(doc.useTime),
            (if (en) "Closed" else "쉬는 날") to lines(closure, sourceText(doc.restDate)),
            (if (en) "Parking" else "주차") to lines(parking, sourceText(doc.parking)),
            (if (en) "Pets" else "반려동물") to pet,
            (if (en) "Accessibility" else "무장애") to accessibility,
            (if (en) "Data status" else "확인 상태") to status,
        )
        // feeText 도 escapeHtml 만 — 원문 값은 위에서 이미 sourceText 를 거쳤다
        return "<dl data-place-section=\"visit-summary\">" +
            rows.joinToString("") { (label, value) -> "<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value?.ifEmpty { null } ?: na)}</dd>" } +
            "</dl>"
    }

    /**
     * 배지 줄 — 방문 요약에 칸이 없는 것(신용카드 · 유모차 대여 · 많이 클릭한 곳)만, 이 순서로 「 · 」로 잇는다.
     * UNKNOWN 은 넣지 않고, 항목이 없으면 줄을 내지 않는다.
     */
    private fun visitBadges(lang: String, attributes: AttractionAttributes?, uniqueClickers14d: Int?): String {
        val en = lang == EN
        val items = listOfNotNull(
            attributes?.let { availability(it.creditCard, if (en) "Credit cards accepted" else "신용카드 가능", if (en) "Credit cards not accepted" else "신용카드 불가") },
            attributes?.let { availability(it.strollerRental, if (en) "Stroller rental" else "유모차 대여", if (en) "No stroller rental" else "유모차 대여 없음") },
            (if (en) "Frequently clicked" else "많이 클릭한 곳").takeIf { AttractionClickSignal.isFrequentlyClicked(uniqueClickers14d) },
        )
        if (items.isEmpty()) return ""
        return "<p data-place-section=\"visit-badges\">${escapeHtml(items.joinToString(" · "))}</p>"
    }

    /**
     * 행동 줄 — 문의 전화 하나([attractionPhone]: 원문은 보이는 글, 첫 번호만 `tel:` 링크). 원문이 비면 내지 않는다.
     * 길찾기 링크는 화면 전용이다 — 서버에 지도 주소 규칙의 사본을 두지 않는다.
     */
    private fun actions(raw: String?): String {
        val phone = attractionPhone(raw) ?: return ""
        val text = escapeHtml(phone.text)
        val item = phone.href?.let { "<a href=\"${escapeHtml(it)}\">$text</a>" } ?: text
        return "<p data-place-section=\"actions\">$item</p>"
    }

    /**
     * 대표 사진 한 장. https 는 그대로, 원천 사진 호스트의 http 는 https 로 바꿔 내고([secureImageUrl]) 그 밖의 http 는
     * 혼합 콘텐츠라 내지 않는다. 원천에 크기가 없어 width·height 는 넣지 않는다. alt 는 제목(h1 과 같은 표시명)이다.
     */
    private fun photo(doc: AttractionDocument): String {
        val src = secureImageUrl(doc.imageUrl)?.takeIf { it.startsWith("https://") } ?: return ""
        return "<img src=\"${escapeHtml(src)}\" alt=\"${escapeHtml(doc.title)}\">"
    }

    /**
     * 행사·숙박·코스의 배지 절 — 해석된 값만 배지로. UNKNOWN 은 그리지 않는다 — 「모른다」를 「아니다」로 읽히게 하지 않는다.
     * 「많이 클릭한 곳」은 속성과 별개라 맨 끝에, 최소 표본 이상일 때만 붙는다(화면 `visitorBadges` 와 같은 순서).
     */
    private fun badges(lang: String, attributes: AttractionAttributes?, uniqueClickers14d: Int?): String {
        val en = lang == EN
        val items = buildList {
            if (attributes != null) addAll(attributeBadges(en, attributes))
            if (AttractionClickSignal.isFrequentlyClicked(uniqueClickers14d)) add(if (en) "Frequently clicked" else "많이 클릭한 곳")
        }
        if (items.isEmpty()) return ""
        val list = items.joinToString("") { "<li>${escapeHtml(it)}</li>" }
        return "<h2>${if (en) "At a glance" else "방문 정보 요약"}</h2><ul>$list</ul>"
    }

    private fun attributeBadges(en: Boolean, attributes: AttractionAttributes): List<String> =
        buildList {
            when (val closure = attributes.regularClosure) {
                RegularClosure.AlwaysOpen -> add(if (en) "Open every day" else "연중무휴")
                is RegularClosure.Weekly -> add(weeklyClosureLabel(en, closure.closedDays))
                RegularClosure.Unknown -> Unit
            }
            availability(attributes.parking, if (en) "Parking available" else "주차 가능", if (en) "No parking" else "주차 불가")
                ?.let(::add)
            when (attributes.petPolicy) {
                PetPolicy.ALLOWED -> add(if (en) "Pets allowed" else "반려동물 동반 가능")
                PetPolicy.PARTIAL -> add(if (en) "Pets allowed in some areas" else "반려동물 일부 구역 동반 가능")
                PetPolicy.UNKNOWN -> Unit
            }
            availability(
                attributes.creditCard,
                if (en) "Credit cards accepted" else "신용카드 가능",
                if (en) "Credit cards not accepted" else "신용카드 불가",
            )?.let(::add)
            availability(
                attributes.strollerRental,
                if (en) "Stroller rental" else "유모차 대여",
                if (en) "No stroller rental" else "유모차 대여 없음",
            )?.let(::add)
            when (attributes.freeAdmission) {
                Admission.FREE -> add(if (en) "Free admission" else "입장 무료")
                Admission.PAID -> add(if (en) "Paid admission" else "입장 유료")
                Admission.UNKNOWN -> Unit
            }
        }

    private fun availability(value: Availability, yes: String, no: String): String? = when (value) {
        Availability.YES -> yes
        Availability.NO -> no
        Availability.UNKNOWN -> null
    }

    private fun weeklyClosureLabel(en: Boolean, days: Set<DayOfWeek>): String {
        if (days.isEmpty()) return if (en) "No weekly closing day" else "매주 쉬는 요일 없음"
        val sorted = days.sorted()
        return if (en) {
            "Closed on " + sorted.joinToString(", ") { schemaDayName(it) + "s" }
        } else {
            "매주 " + sorted.joinToString("·") { KO_DAY.getValue(it) } + "요일 휴무"
        }
    }

    /**
     * 지역 안 위치 — 「{시군구} {유형} N곳 중 {분류} M곳」 / 「{분류} {M} of {N} {유형} in {시군구}」 + 시군구 허브 링크.
     */
    private fun regionSection(lang: String, doc: AttractionDocument, region: AttractionRegion): String = buildString {
        val en = lang == EN
        val place = region.sigunguName?.takeIf { it.isNotBlank() } ?: if (en) "this district" else "이 지역"
        val type = contentTypeLabel(doc.contentTypeId, lang)
        val category = region.categoryName?.takeIf { it.isNotBlank() }
        // 끝난 행사 자기 문서는 후보에서 빠져 건수가 0 일 수 있다 — 「0곳」은 그리지 않는다
        val categoryCount = region.categoryCount?.takeIf { it > 0 }
        val phrase = when {
            region.typeCount <= 0 -> null
            category != null && categoryCount != null && en ->
                "$category $categoryCount of ${region.typeCount} $type in $place"
            category != null && categoryCount != null ->
                "$place $type ${region.typeCount}곳 중 $category ${categoryCount}곳"
            en -> "${region.typeCount} $type in $place"
            else -> "$place $type ${region.typeCount}곳"
        }
        append("<h2>${if (en) "In the area" else "지역 안 위치"}</h2>")
        phrase?.let { append("<p>${escapeHtml(it)}</p>") }
        val regn = doc.ldongRegnCd?.takeIf { it.isNotBlank() }
        val signgu = doc.ldongSignguCd?.takeIf { it.isNotBlank() }
        if (regn != null && signgu != null) {
            val label = if (en) "Explore $place" else "$place 둘러보기"
            append("<p><a href=\"${escapeHtml(regionPath(lang, regn + signgu))}\">${escapeHtml(label)}</a></p>")
        }
    }

    /** 같은 분류 가까운 곳 — 거리순 이웃 링크(서버 렌더 전용 절). 끝난 행사를 거른 뒤 하나도 없으면 내지 않는다. */
    private fun sameCategoryNearby(lang: String, region: AttractionRegion, today: LocalDate): String {
        val nearby = region.sameCategoryNearby.filterNot { ended(it.eventEndEffective, today) }
        if (nearby.isEmpty()) return ""
        val items = nearby.joinToString("") { near ->
            "<li><a href=\"${escapeHtml(attractionPath(lang, near.id))}\">${escapeHtml(near.title)}</a> · ${distance(near.distanceMeters)}</li>"
        }
        return section("same-category-nearby", if (lang == EN) "Similar places nearby" else "같은 분류 가까운 곳", "<ul>$items</ul>")
    }

    /**
     * 접근성 정보(원천: 무장애 여행) — 긍정 아이콘 줄(휠체어 · 엘리베이터 · 장애인 화장실 · 주차 · 유모차 · 수유실) 다음에 원천 문장을
     * 원천 키 순서대로. 문장은 고치지 않는다(화면 `barrierFreeRows` 와 같은 표 · 같은 순서).
     */
    private fun barrierFreeSection(lang: String, info: BarrierFreeInfo): String {
        val en = lang == EN
        val icons = BarrierFreeInfo.ICONS.filter { (code, _) -> code in info.flags }
            .joinToString("") { (_, label) -> "<li>${escapeHtml(if (en) label.second else label.first)}</li>" }
        val rows = BarrierFreeInfo.KEYS.mapNotNull { key -> info.detail[key.key]?.let { (if (en) key.en else key.ko) to sourceText(it) } }
            .filter { (_, value) -> value.isNotEmpty() }
        return section(
            "barrier-free",
            if (en) "Accessibility" else "접근성 정보",
            (if (icons.isEmpty()) "" else "<ul>$icons</ul>") + definitionList(rows),
        )
    }

    /**
     * 「캠핑장 정보」 — 고캠핑 원문 중 place 가 고른 키만(예약 URL 은 애초에 오지 않는다). 화면 `CampingInfo` 와 같은 줄·순서·문구.
     * 사이트 수는 0 인 종류를 뺀다. 원문을 못 읽거나 줄이 없으면 절을 내지 않는다.
     */
    private fun campingSection(lang: String, raw: String?): String {
        val node = raw?.let { runCatching { objectMapper.readTree(it) }.getOrNull() }?.takeIf { it.isObject } ?: return ""
        val en = lang == EN
        fun v(key: String) = node.get(key)?.asString()?.trim()?.takeIf { it.isNotEmpty() }
        val sites = CAMPING_SITES.mapNotNull { (key, ko, enLabel) ->
            v(key)?.toIntOrNull()?.takeIf { it > 0 }?.let { "${if (en) enLabel else ko} $it" }
        }.joinToString(" · ")
        val rows = listOfNotNull(
            v("induty")?.let { (if (en) "Type" else "업종") to it.replace(",", ", ") },
            sites.takeIf { it.isNotEmpty() }?.let { (if (en) "Sites" else "사이트") to it },
            v("sbrsCl")?.let { (if (en) "Facilities" else "부대시설") to it.replace(",", ", ") },
            v("animalCmgCl")?.let { (if (en) "Pets" else "반려동물 동반") to it },
            v("operPdCl")?.let { (if (en) "Season" else "운영 기간") to it.replace(",", ", ") },
            v("operDeCl")?.let { (if (en) "Days" else "운영일") to it },
            v("manageSttus")?.let { (if (en) "Status" else "운영 상태") to it },
        )
        if (rows.isEmpty()) return ""
        return section("camping", if (en) "Campsite" else "캠핑장 정보", definitionList(rows))
    }

    /** 웰니스관광 테마 한 줄 — 「웰니스 관광 · {테마 이름}」. 이름이 없으면 앞말만. */
    private fun wellnessLine(lang: String, theme: WellnessTheme): String {
        val head = if (lang == EN) "Wellness tourism" else "웰니스 관광"
        val text = theme.name?.takeIf { it.isNotBlank() }?.let { "$head · $it" } ?: head
        return "<p data-place-section=\"wellness\">${escapeHtml(text)}</p>"
    }

    /**
     * 출처 — TourAPI 에 이 문서가 실제로 쓴 관광공사 원천 이름을 잇는다(화면 `placeSourceLine` 과 같은 문구).
     * 출처표시 의무 문구라 원천(`source`)을 몰라도 비우지 않는다 — 첫 항목은 고캠핑 원천일 때만 고캠핑이고 그 밖은 고정 문구다.
     * 첫 항목이 고캠핑이면 덧붙는 「고캠핑」은 빼서 한 번만 낸다.
     */
    private fun sourceLine(lang: String, doc: AttractionDocument): String {
        val en = lang == EN
        val fromGoCamping = doc.source == GOCAMPING
        val first = if (fromGoCamping) "${if (en) "Source" else "출처"}: ${attractionSourceName(GOCAMPING, lang)}" else if (en) SOURCE_EN else SOURCE_KO
        val extra = listOfNotNull(
            doc.barrierFree?.let { if (en) "Barrier-free travel" else "무장애 여행 정보" },
            doc.wellness?.let { if (en) "Wellness tourism" else "웰니스관광 정보" },
            doc.camping?.takeIf { !fromGoCamping }?.let { if (en) "GoCamping" else "고캠핑" },
            doc.relatedPlaces?.takeIf { it.isNotEmpty() }?.let { if (en) "Big Data (related attractions)" else "빅데이터 서비스(연관 관광지)" },
        )
        return (listOf(first) + extra).joinToString(" · ")
    }

    /** 다른 시도의 비슷한 곳 — 「{제목} · {시도}」. 시도 이름이 없으면 제목만. */
    private fun similarSection(lang: String, similar: List<SimilarPlace>?): String {
        if (similar.isNullOrEmpty()) return ""
        val items = similar.joinToString("") { s ->
            val sido = s.sidoName?.takeIf { it.isNotBlank() }?.let { " · ${escapeHtml(it)}" }.orEmpty()
            "<li><a href=\"${escapeHtml(attractionPath(lang, s.id))}\">${escapeHtml(s.title)}</a>$sido</li>"
        }
        return "<h2>${if (lang == EN) "Similar places in other regions" else "다른 지역의 비슷한 곳"}</h2><ul>$items</ul>"
    }

    /**
     * 여기 온 사람들이 함께 간 곳 — 「{제목} · {원천 소분류}」, 원천 순위 순. 링크는 우리 관광지 상세뿐이다
     * (원천이 준 대상 중 우리 관광지로 이어진 것만 색인에 실린다).
     */
    private fun relatedSection(lang: String, related: List<RelatedPlace>?): String {
        if (related.isNullOrEmpty()) return ""
        val items = related.joinToString("") { r ->
            val category = r.category?.takeIf { it.isNotBlank() }?.let { " · ${escapeHtml(it)}" }.orEmpty()
            "<li><a href=\"${escapeHtml(attractionPath(lang, r.id))}\">${escapeHtml(r.title)}</a>$category</li>"
        }
        return section("related", if (lang == EN) "Where visitors also went" else "여기 온 사람들이 함께 간 곳", "<ul>$items</ul>")
    }

    private fun distance(meters: Int): String =
        if (meters < 1_000) "${meters}m" else String.format(Locale.ROOT, "%.1fkm", meters / 1_000.0)

    /**
     * prerender `shellBody` — SPA 가 마운트되면 통째로 교체되는 임시 본문. 바닥글은 호스트 사이를 잇는다.
     * 프리렌더와 다른 점: main — 본문을 `<main>` 으로 감싼다(바닥글은 밖). 화면(AttractionPage)의 랜드마크와 같다.
     */
    private fun shellBody(inner: String): String {
        val footer = (siteLinks() + trustLinks())
            .joinToString(" · ") { (href, label) -> "<a href=\"$href\">${escapeHtml(label)}</a>" }
        return "<div style=\"max-width:1080px;margin:0 auto;padding:32px 20px;color:#dce4f5;" +
            "font-family:system-ui,-apple-system,'Apple SD Gothic Neo',sans-serif\">" +
            "<main>$inner</main><footer><nav>$footer</nav></footer></div>"
    }

    /** prerender `SITE_LINKS` */
    private fun siteLinks() = listOf(
        "https://1989v.com" to "1989v",
        "https://game.1989v.com" to "무료 웹게임",
        origin to "한국 관광지 검색",
        "https://blog.1989v.com" to "블로그",
        "https://rank.1989v.com" to "랭킹 리더보드",
        "https://deal.1989v.com" to "혜택 링크 허브",
    )

    /** copy.mjs `TRUST_LINKS` — apex 문서라 place 에서도 apex 절대 주소로 건다. 영문 상세도 국문 라벨이다 */
    private fun trustLinks() = listOf(
        "https://1989v.com/privacy" to "개인정보처리방침",
        "https://1989v.com/about" to "사이트 소개",
        "https://1989v.com/contact" to "연락처",
        "https://1989v.com/data-sources" to "데이터 출처",
    )

    // ─── 주소 (copy.mjs placePath·attractionPath·regionPath) ────────────────

    private fun placePath(lang: String, sub: String = ""): String = "${if (lang == EN) "/en" else ""}$sub".ifEmpty { "/" }
    private fun placeUrl(lang: String) = origin + placePath(lang)
    private fun attractionPath(lang: String, id: String) = placePath(lang, "/attractions/$id")
    private fun attractionUrl(lang: String, id: String) = origin + attractionPath(lang, id)

    /** copy.mjs `attractionHreflangAlternates` — (hreflang, href). 어느 쪽이 국문인지는 문서 언어로 정한다 */
    private fun attractionHreflangAlternates(docLang: String, id: String, alternateId: String): List<Pair<String, String>> {
        val koId = if (docLang == EN) alternateId else id
        val enId = if (docLang == EN) id else alternateId
        return listOf(
            KO to attractionUrl(KO, koId),
            EN to attractionUrl(EN, enId),
            "x-default" to attractionUrl(EN, enId),
        )
    }
    private fun regionPath(lang: String, code: String) = placePath(lang, "/regions/$code")
    private fun regionUrl(lang: String, code: String) = origin + regionPath(lang, code)

    private fun brand(lang: String) = if (lang == EN) BRAND_EN else BRAND_KO
    private fun hubName(lang: String) = if (lang == EN) "Explore Korea" else "한국 관광지 탐색"

    /** copy.mjs `placeCategoryLabel` */
    private fun categoryLabel(category: String?, lang: String): String =
        (if (lang == EN) CATEGORY_EN else CATEGORY_KO)[category] ?: if (lang == EN) "Attraction" else "관광지"

    private fun contentTypeLabel(contentTypeId: String?, lang: String): String =
        (if (lang == EN) CONTENT_TYPE_EN else CONTENT_TYPE_KO)[contentTypeId] ?: if (lang == EN) "places" else "관광지"

    private fun schemaDayName(day: DayOfWeek) = day.getDisplayName(java.time.format.TextStyle.FULL, Locale.ENGLISH)

    /** JS 의 `x && …` 판정 — 0 과 NaN 은 거짓 */
    private fun isTruthy(value: Double) = value != 0.0 && !value.isNaN()

    /** prerender `imageMimeType` — 확장자에서 읽는다 */
    private fun imageMimeType(url: String): String? {
        val ext = MIME_EXT.find(url.substringBefore('?'))?.groupValues?.get(1)?.lowercase(Locale.ROOT) ?: return null
        return when (ext) {
            "jpg", "jpeg" -> "image/jpeg"
            "png", "webp", "gif" -> "image/$ext"
            else -> null
        }
    }

    private companion object {
        /** 고캠핑 사이트 수 키 — (원문 키, 국문, 영문). 화면 `CampingInfo` 와 같은 순서 */
        private val CAMPING_SITES = listOf(
            Triple("gnrlSiteCo", "일반", "Tent"),
            Triple("autoSiteCo", "자동차", "Auto"),
            Triple("glampSiteCo", "글램핑", "Glamping"),
            Triple("caravSiteCo", "카라반", "Caravan"),
            Triple("indvdlCaravSiteCo", "개인 카라반", "Own caravan"),
        )

        const val KO = "ko"
        const val EN = "en"
        const val BRAND_KO = "K-관광"
        const val BRAND_EN = "K-Tour"

        /** portal-fe `copy.mjs` 의 SEO_MULTI_ATTR 과 같은 값이어야 한다 */
        const val SEO_MULTI = "data-seo-multi"
        const val OG_IMAGE_W = 1200
        const val OG_IMAGE_H = 630

        val SEO_BLOCK = Regex("<!--seo:start-->[\\s\\S]*?<!--seo:end-->")
        const val HTML_KO = "<html lang=\"ko\">"
        const val ROOT_DIV = "<div id=\"root\"></div>"
        val PHOTO = Regex("\\.(png|jpe?g|webp)$", RegexOption.IGNORE_CASE)
        val MIME_EXT = Regex("\\.([a-z0-9]+)$", RegexOption.IGNORE_CASE)

        /** 원천 관광 유형 — copy.mjs `PLACE_STAY_TYPES`·`PLACE_COURSE_TYPES`. 행사는 [EventSchedule.isEvent] */
        val STAY_CONTENT_TYPES = setOf("32", "80")
        val COURSE_CONTENT_TYPES = setOf("25")

        /** 화면 바닥글의 출처 문구와 같다 */
        const val SOURCE_KO = "출처: 한국관광공사 TourAPI"
        const val SOURCE_EN = "Source: Korea Tourism Organization TourAPI"
        const val GOCAMPING = "GOCAMPING"

        /** 화면 `NOT_PROVIDED` — 값이 없는 방문 요약 칸 */
        const val NOT_PROVIDED_KO = "정보 없음"
        const val NOT_PROVIDED_EN = "Not provided"

        /** copy.mjs `KOGL_LICENSE` — 사진을 쓰는 조건이 출처표시(제1유형) · 출처표시+변경금지(제3유형)인 것만 */
        val KOGL_LICENSE = mapOf(
            "Type1" to "https://www.kogl.or.kr/info/licenseType1.do",
            "Type3" to "https://www.kogl.or.kr/info/licenseType3.do",
        )
        const val PHOTO_CREDIT = "한국관광공사"

        /** 유형별 절에 그리는 소개 원문 키 — 허용 목록. 여기에 없는 키(예약 URL·예약 안내 등)는 나가지 않는다 */
        data class IntroKey(val key: String, val ko: String, val en: String)

        val EVENT_INTRO = listOf(
            IntroKey("eventplace", "행사 장소", "Venue"),
            IntroKey("playtime", "공연 시간", "Hours"),
            IntroKey("usetimefestival", "이용 요금", "Admission"),
            IntroKey("sponsor1", "주최", "Organizer"),
        )
        val STAY_INTRO = listOf(
            IntroKey("checkintime", "입실", "Check-in"),
            IntroKey("checkouttime", "퇴실", "Check-out"),
            IntroKey("roomcount", "객실 수", "Rooms"),
            IntroKey("roomtype", "객실 유형", "Room types"),
            IntroKey("parkinglodging", "주차", "Parking"),
            IntroKey("subfacility", "부대시설", "Facilities"),
        )
        val COURSE_INTRO = listOf(
            IntroKey("distance", "총 거리", "Total distance"),
            IntroKey("taketime", "소요 시간", "Time needed"),
        )

        const val MINIMAL_SHELL =
            "<!doctype html>\n<html lang=\"ko\"><head><meta charset=\"UTF-8\" /><title>1989v</title></head>" +
                "<body><div id=\"root\"></div></body></html>"

        /** copy.mjs `PLACE_CATEGORY_KO` · `PLACE_CATEGORY_EN` */
        val CATEGORY_KO = mapOf(
            "nature" to "자연", "history" to "역사", "culture" to "문화", "leisure" to "레포츠",
            "shopping" to "쇼핑", "food" to "음식", "stay" to "숙박", "etc" to "기타",
            "festival" to "행사", "course" to "여행코스",
        )
        val CATEGORY_EN = mapOf(
            "nature" to "Nature", "history" to "History", "culture" to "Culture", "leisure" to "Leisure",
            "shopping" to "Shopping", "food" to "Food", "stay" to "Stay", "etc" to "Etc",
            "festival" to "Events", "course" to "Courses",
        )

        /**
         * 원천 관광 유형(contentTypeId) 이름 — 지역 안 위치 문구의 「{유형}」.
         * 코드는 TourAPI 가 고정한 값이고 국문·영문 서비스의 체계가 다르다
         * (`place/ingest/src/sync_tour.py` 의 CONTENT_TYPES: 관광지 12/76 · 문화시설 14/78 · 레포츠 28/75 ·
         * 쇼핑 38/79 · 음식 39/82). 화면(portal-fe)에는 아직 같은 표가 없다.
         */
        val CONTENT_TYPE_KO = mapOf(
            "12" to "관광지", "14" to "문화시설", "15" to "축제·행사", "25" to "여행코스",
            "28" to "레포츠", "32" to "숙박", "38" to "쇼핑", "39" to "음식점",
        )
        val CONTENT_TYPE_EN = mapOf(
            "76" to "attractions", "78" to "cultural sites", "85" to "festivals", "75" to "leisure spots",
            "80" to "places to stay", "79" to "shopping spots", "82" to "restaurants", "77" to "transport hubs",
        )

        val KO_DAY = mapOf(
            DayOfWeek.MONDAY to "월", DayOfWeek.TUESDAY to "화", DayOfWeek.WEDNESDAY to "수",
            DayOfWeek.THURSDAY to "목", DayOfWeek.FRIDAY to "금", DayOfWeek.SATURDAY to "토", DayOfWeek.SUNDAY to "일",
        )
    }
}
