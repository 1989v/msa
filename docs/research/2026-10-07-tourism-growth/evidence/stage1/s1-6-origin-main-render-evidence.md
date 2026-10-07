측정 시각(KST): 2026-10-08T04:18:07.640760+09:00 | 도구: git version 2.50.1 (Apple Git-155) / Python subprocess | 표본: origin/main 8개 파일 | 명령: git show origin/main:<path> (아래 명시한 줄만 발췌)

# origin/main a8d1c97ef498ca8d7f30327abbf0fbeb20be7a24 — 렌더 경로 근거

## search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionSeoText.kt

```text
19:     private val BLOCK_END = Regex("</(p|div|li)>", RegexOption.IGNORE_CASE)
20:     private val TAG = Regex("<[^>]*>")
21:     private val NAMED_ENTITY = Regex("&[a-zA-Z]+;")
22:     private val NUMERIC_ENTITY = Regex("&#(\\d{1,6});")
23:     private val TRAILING_BLANK = Regex("[ \t]+\n")
24:     private val EXTRA_NEWLINES = Regex("\n{3,}")
25:     private val SPACES = Regex("[$JS_SPACE]+")
26:     private val EDGE_SPACES = Regex("^[$JS_SPACE]+|[$JS_SPACE]+$")
27: 
28:     /** 관측된 엔티티만 푼다 — copy.mjs `ENTITIES` 와 같은 표. 모르는 엔티티는 그대로 둔다. */
29:     private val ENTITIES = mapOf(
30:         "&nbsp;" to " ", "&amp;" to "&", "&lt;" to "<", "&gt;" to ">", "&quot;" to "\"", "&apos;" to "'",
31:         "&lsquo;" to "‘", "&rsquo;" to "’", "&ldquo;" to "“", "&rdquo;" to "”",
32:         "&ndash;" to "–", "&mdash;" to "—", "&hellip;" to "…", "&middot;" to "·",
33:         "&deg;" to "°", "&eacute;" to "é", "&times;" to "×",
34:     )
35: 
36:     /** copy.mjs `DESC_MAX` */
37:     const val DESC_MAX = 155
38: 
39:     /**
40:      * 원천(TourAPI) 텍스트 → 평문. **태그 제거 → 엔티티 디코드** 순서다. 출력 직전에 [escapeHtml] 을
41:      * 거쳐야 한다 — 디코드된 `<script>` 는 이 단계에서 글자일 뿐이다.
42:      */
43:     fun sourceText(raw: String?): String {
44:         if (raw.isNullOrEmpty()) return ""
45:         var text = raw.replace(CRLF, "\n")
46:         text = text.replace(BR, "\n")
47:         text = text.replace(BLOCK_END, "\n")
48:         text = text.replace(TAG, "")
49:         text = NAMED_ENTITY.replace(text) { ENTITIES[it.value.lowercase()] ?: it.value }
50:         text = NUMERIC_ENTITY.replace(text) {
51:             val code = it.groupValues[1].toInt()
52:             // 제어문자는 되돌리지 않는다 — 보이지 않으면서 줄만 어그러뜨린다
53:             if (code in 32..0x10FFFF) String(Character.toChars(code)) else ""
54:         }
55:         text = text.replace(TRAILING_BLANK, "\n").replace(EXTRA_NEWLINES, "\n\n")
56:         return jsTrim(text)
57:     }
58: 
59:     fun clampDescription(text: String?, max: Int = DESC_MAX): String {
60:         val flat = jsTrim((text ?: "").replace(SPACES, " "))
61:         if (flat.length <= max) return flat
62:         val cut = flat.substring(0, max - 1)
63:         val lastSpace = cut.lastIndexOf(' ')
64:         return (if (lastSpace > max * 0.6) cut.substring(0, lastSpace) else cut).let(::jsTrim) + "…"
65:     }
66: 
67:     fun escapeHtml(value: String?): String = (value ?: "")
68:         .replace("&", "&amp;")
69:         .replace("<", "&lt;")
70:         .replace(">", "&gt;")
71:         .replace("\"", "&quot;")
72: 
73:     fun jsTrim(value: String): String = value.replace(EDGE_SPACES, "")
74: }

```

## search/app/src/main/kotlin/com/kgd/search/infrastructure/render/AttractionPageRenderer.kt

```text
365:         val hub = hubName(lang)
366:         append("<nav><a href=\"${placePath(lang)}\">${escapeHtml(hub)}</a>")
367:         if (!doc.sidoName.isNullOrEmpty()) {
368:             append(" › <a href=\"${escapeHtml(regionPath(lang, doc.ldongRegnCd.orEmpty()))}\">${escapeHtml(doc.sidoName)}</a>")
369:         }
370:         append("</nav>")
371:         append("<h1>${escapeHtml(meta.heading)}</h1>")
372:         val local = jsTrim(doc.titleLocal.orEmpty())
373:         if (local.isNotEmpty() && local != doc.title) append("<p>${escapeHtml(local)}</p>")
374:         append("<p>${escapeHtml(listOfNotNull(categoryLabel(doc.category, lang), doc.address?.takeIf { it.isNotEmpty() }).joinToString(" · "))}</p>")
375:         if (!doc.tel.isNullOrEmpty()) append("<p>${escapeHtml(doc.tel)}</p>")
376:         append("<p>${escapeHtml(sourceText(doc.overview))}</p>")
377:         append(typeSection(lang, doc, today) ?: visitorInfo(lang, doc))
378:         append(campingSection(lang, doc.camping))
379:         append(badges(lang, doc.attributes, doc.uniqueClickers14d))
380:         doc.barrierFree?.let { append(barrierFreeSection(lang, it)) }
381:         doc.wellness?.let { append(wellnessLine(lang, it)) }
382:         doc.region?.let { append(regionSection(lang, doc, it, today)) }
383:         append(similarSection(lang, doc.similarElsewhere?.filterNot { ended(it.eventEndEffective, today) }))
384:         // 함께 간 곳 — 비슷한 곳과 겹쳐도 거르지 않는다(근거가 다른 두 목록이다). 색인에 실린 목록 그대로, 화면과 같은 순서
385:         append(relatedSection(lang, doc.relatedPlaces))
386:         // 출처표시 의무 (data-sources.md §0) — 화면 바닥글과 같은 문구
387:         append("<p data-place-section=\"source\">${escapeHtml(sourceLine(lang, doc))}</p>")
388:     }
389: 
390:     /** 재색인 뒤 끝난 행사 항목 — 유효 종료일이 오늘보다 앞이다(오늘 끝나는 행사는 남긴다) */
391:     private fun ended(eventEnd: LocalDate?, today: LocalDate) = eventEnd != null && eventEnd.isBefore(today)
392: 
393:     /**
394:      * 행사 · 숙박 · 여행코스의 유형별 절. 이 유형들은 일반 「이용 안내」 대신 이것을 그린다 — 일반 절의 파생 값
395:      * (이용시간·요금·주차)이 같은 원문 키에서 와서 두 번 나가기 때문이다. 다른 유형이면 null.
396:      * 원문 키는 허용 목록으로만 고른다 — 숙박의 예약 URL·예약 안내는 목록에 없어서 나가지 않는다.
397:      */
398:     private fun typeSection(lang: String, doc: AttractionDocument, today: LocalDate): String? {
399:         val en = lang == EN
400:         val intro = introValues(doc.introRaw)
401:         return when {
402:             EventSchedule.isEvent(doc.contentTypeId) -> {
403:                 val period = doc.eventPeriod?.let { listOf((if (en) "Dates" else "기간") to "${it.start} ~ ${it.end}") }.orEmpty()
404:                 val status = EventStatusText.of(doc.eventPeriod, today, lang)
405:                     ?.let { "<p data-event-status>${escapeHtml(it)}</p>" }.orEmpty()
406:                 section("event", if (en) "Event info" else "행사 정보", status + definitionList(period + introRows(intro, EVENT_INTRO, en)))
407:             }
408:             doc.contentTypeId in STAY_CONTENT_TYPES ->
409:                 section("stay", if (en) "Stay info" else "숙박 정보", definitionList(introRows(intro, STAY_INTRO, en)))
410:             doc.contentTypeId in COURSE_CONTENT_TYPES ->
411:                 section("course", if (en) "Course" else "코스 구성", definitionList(introRows(intro, COURSE_INTRO, en)) + courseList(lang, doc.courseStops))
412:             else -> null
413:         }
414:     }
415: 
416:     private fun section(name: String, heading: String, inner: String): String =
417:         if (inner.isEmpty()) "" else "<section data-place-section=\"$name\"><h2>${escapeHtml(heading)}</h2>$inner</section>"
418: 
419:     private fun definitionList(rows: List<Pair<String, String>>): String =
420:         if (rows.isEmpty()) "" else "<dl>" + rows.joinToString("") { (label, value) -> "<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>" } + "</dl>"
421: 
422:     /** 허용 목록 순서대로, 원문에 값이 있는 키만 (라벨, 평문) */
423:     private fun introRows(intro: Map<String, String>, allowed: List<IntroKey>, en: Boolean): List<Pair<String, String>> =
424:         allowed.mapNotNull { key -> introText(intro, key.key).takeIf { it.isNotEmpty() }?.let { (if (en) key.en else key.ko) to it } }
425: 
426:     /** 코스 구성 — 받은 순서 그대로. 같은 언어 관광지로 이어진 지점만 상세 링크 */
427:     private fun courseList(lang: String, stops: List<CourseStop>?): String {
428:         if (stops.isNullOrEmpty()) return ""
429:         return "<ol>" + stops.joinToString("") { stop ->
430:             val name = escapeHtml(stop.name)
431:             val item = stop.attractionId?.let { "<a href=\"${escapeHtml(attractionPath(lang, it.toString()))}\">$name</a>" } ?: name
432:             "<li>$item</li>"
433:         } + "</ol>"
434:     }
435: 
436:     /** introRaw(TourAPI 소개 원문 JSON 객체) → 키·값 원문. 없거나 깨졌으면 빈 맵 — copy.mjs `placeIntroText` 와 같은 판정 */
437:     private fun introValues(raw: String?): Map<String, String> {
438:         if (raw.isNullOrBlank()) return emptyMap()
439:         val node = runCatching { objectMapper.readTree(raw) }.getOrNull()?.takeIf { it.isObject } ?: return emptyMap()
440:         return node.properties()
441:             .filter { (_, value) -> value.isValueNode && !value.isNull }
442:             .associate { (key, value) -> key to value.asString() }
443:     }
444: 
445:     private fun introText(intro: Map<String, String>, key: String): String = sourceText(intro[key])
446: 
447:     /** prerender `visitorInfoHtml` — 원천이 안 준 줄은 그리지 않는다 */
448:     private fun visitorInfo(lang: String, doc: AttractionDocument): String {
449:         val labels = if (lang == EN) {
450:             listOf("Hours" to doc.useTime, "Closed" to doc.restDate, "Admission" to doc.useFee, "Parking" to doc.parking)
451:         } else {
452:             listOf("이용시간" to doc.useTime, "쉬는날" to doc.restDate, "이용요금" to doc.useFee, "주차" to doc.parking)
453:         }
454:         val rows = labels
455:             .map { (label, raw) -> label to sourceText(raw) }
456:             .filter { (_, value) -> value.isNotEmpty() }
457:             .joinToString("") { (label, value) -> "<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>" }
458:         if (rows.isEmpty()) return ""
459:         return "<h2>${if (lang == EN) "Visitor info" else "이용 안내"}</h2><dl>$rows</dl>"
460:     }
461: 
462:     /**
463:      * 해석된 값만 배지로. UNKNOWN 은 그리지 않는다 — 「모른다」를 「아니다」로 읽히게 하지 않는다.

691:         val ext = MIME_EXT.find(url.substringBefore('?'))?.groupValues?.get(1)?.lowercase(Locale.ROOT) ?: return null
692:         return when (ext) {
693:             "jpg", "jpeg" -> "image/jpeg"
694:             "png", "webp", "gif" -> "image/$ext"
695:             else -> null
696:         }
697:     }
698: 
699:     private companion object {

```

## portal-fe/src/seo/copy.mjs

```text
844: export function sourceText(raw) {
845:   if (!raw) return '';
846:   let text = raw.replace(/\r\n?/g, '\n');
847:   text = text.replace(/<br\s*\/?>/gi, '\n');
848:   text = text.replace(/<\/(p|div|li)>/gi, '\n');
849:   text = text.replace(/<[^>]*>/g, '');
850:   text = text.replace(/&[a-zA-Z]+;/g, (m) => ENTITIES[m.toLowerCase()] ?? m);
851:   text = text.replace(/&#(\d{1,6});/g, (_, code) => {
852:     const n = Number(code);
853:     // 제어문자는 되돌리지 않는다 — 화면에 보이지 않으면서 줄만 어그러뜨린다
854:     return n >= 32 && n <= 0x10ffff ? String.fromCodePoint(n) : '';
855:   });
856:   // 원천이 <br /><br /><br /> 처럼 겹쳐 보내는 곳이 있다 — 빈 줄은 하나까지만
857:   text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
858:   return text.trim();
859: }
860: 
861: 

```

## portal-fe/src/pages/place/placeView.ts

```text
200:  * 크롤러가 보는 본문에 태그가 글자로 남는다 (2026-09-10 실측: 프리렌더 3/800 에
201:  * `It&rsquo;s` 가 그대로). 빌드 스크립트는 .ts 를 로드하지 못해 .mjs 에 둔다.
202:  */
203: export { sourceText } from '../../seo/copy.mjs';
204: 
205: /** 개요 전용 별칭 — 호출부의 뜻이 드러나게 남긴다. */
206: export { sourceText as overviewText } from '../../seo/copy.mjs';

```

## portal-fe/src/pages/place/AttractionPage.tsx

```text
400:             <div className="place-detail-read">
401:               {/* 원천 개요는 평문이 아니다 — <br>·HTML 엔티티가 섞여 오고 국문은 \n 이 온다.
402:                   overviewText 가 태그·엔티티를 풀고 줄바꿈만 남기며, CSS 가 그것을 살린다. */}
403:               {overviewText(attraction.overview) && (
404:                 <div className="place-detail-overview-box">
405:                   <p
406:                     ref={overviewRef}
407:                     className="place-detail-overview"
408:                     data-clamped={!overviewOpen || undefined}
409:                     data-overflow={overviewClipped || undefined}
410:                   >
411:                     {overviewText(attraction.overview)}

428:               {!kind && (() => {
429:                 // 파생 6개(유형별 키를 서버가 모은 것) → 그 다음 원문에만 있는 나머지.
430:                 // 원천이 준 것을 다 보여준다 — 상세는 이 관광지에 대해 아는 전부를 내는 자리다.
431:                 const derived: IntroRow[] = [
432:                   { key: 'useTime', label: L.useTime, value: attraction.useTime ?? '' },
433:                   { key: 'restDate', label: L.restDate, value: attraction.restDate ?? '' },
434:                   { key: 'useFee', label: L.useFee, value: attraction.useFee ?? '' },
435:                   { key: 'parking', label: L.parking, value: attraction.parking ?? '' },
436:                   { key: 'parkingFee', label: L.parkingFee, value: attraction.parkingFee ?? '' },
437:                   { key: 'infoCenter', label: L.infoCenter, value: attraction.infoCenter ?? '' },
438:                 ];
439:                 // 이용정보에도 <br>·엔티티가 섞여 온다 — 개요와 같은 정리를 거친다
440:                 // 반복정보(detailInfo2)는 라벨을 원천이 준다 — 예약안내·코스안내 등
441:                 const rows = [
442:                   ...derived,
443:                   ...introRows(attraction.introRaw, lang),
444:                   ...repeatInfoRows(attraction.infoRaw),
445:                 ]
446:                   .map((r) => ({ ...r, value: sourceText(r.value) }))
447:                   .filter((r) => r.value.trim().length > 0);

```

## portal-fe/src/pages/place/PlacePage.tsx

```text
1114:         {category !== EVENT_CATEGORY && (
1115:           <div className="place-attr-group" role="group" aria-label={lang === 'en' ? 'Visitor info filters' : '방문 정보 필터'}>
1116:             <div className="place-attr-chips">
1117:               {attributeChips(lang).map((chip) => {
1118:                 const selected = attributes.has(chip.id);
1119:                 const count = chipCount(facets, chip.id);
1120:                 const empty = !selected && count === 0;
1121:                 return (
1122:                   <button
1123:                     key={chip.id}
1124:                     type="button"
1125:                     className={['place-chip', 'place-attr-chip', selected ? 'active' : '', empty ? 'is-empty' : '']
1126:                       .filter(Boolean)
1127:                       .join(' ')}
1128:                     aria-pressed={selected}
1129:                     data-attr={chip.id}
1130:                     onClick={() => toggleAttribute(chip.id)}
1131:                   >
1132:                     {chip[lang]}
1133:                     {count != null && (
1134:                       <span className="place-attr-count">{count.toLocaleString(lang === 'en' ? 'en' : 'ko')}</span>
1135:                     )}
1136:                   </button>
1137:                 );
1138:               })}
1139:             </div>
1140:             <p className="place-attr-caption">{ATTRIBUTE_CAPTION[lang]}</p>

1305:       </div>
1306:       {secondary && <p className="place-detail-local">{secondary}</p>}
1307:       {attraction.category && (
1308:         <span className="place-chip active">{L.categories[attraction.category] ?? attraction.category}</span>
1309:       )}
1310:       <EventLine attraction={attraction} lang={lang} />
1311:       {attraction.address && <p className="place-detail-addr">{attraction.address}</p>}
1312:       {attraction.tel && <p className="place-detail-tel">{attraction.tel}</p>}
1313:       {attraction.overview && <p className="place-detail-overview">{attraction.overview}</p>}
1314:       <a className="place-btn" href={attractionPath(lang, attraction.id)}>
1315:         {lang === 'en' ? 'Open detail page' : '상세 페이지 열기'}

1370:       <div className="place-card-body">
1371:         <h3 className="place-card-title">{primary}</h3>
1372:         {secondary && <p className="place-card-local">{secondary}</p>}
1373:         <p className="place-card-meta">
1374:           {attraction.category && <span>{L.categories[attraction.category] ?? attraction.category}</span>}
1375:           {attraction.distanceKm != null && <span>{attraction.distanceKm.toFixed(1)}km</span>}
1376:         </p>
1377:         <EventLine attraction={attraction} lang={lang} />
1378:         {attraction.address && <p className="place-card-addr">{attraction.address}</p>}
1379:         {attraction.overview && <p className="place-card-overview">{attraction.overview}</p>}
1380:       </div>
1381:     </a>
1382:   );
1383: }

```

## portal-fe/src/pages/place/placeAttributes.ts

```text
37: 
38: /** `only` 가 있으면 그 언어 목록에만 칩을 둔다 — 무장애 원천은 국문뿐이라 영문에서는 늘 0 이다. */
39: export const ATTRIBUTE_CHIPS: ReadonlyArray<{ id: AttributeChipId; ko: string; en: string; only?: PlaceLang }> = [
40:   { id: 'openToday', ko: '오늘 정기휴무 아님', en: 'Not closed today' },
41:   { id: 'parking', ko: '주차 가능', en: 'Parking' },
42:   { id: 'creditCard', ko: '신용카드', en: 'Credit cards' },
43:   { id: 'strollerRental', ko: '유모차 대여', en: 'Stroller rental' },
44:   { id: 'petAllowed', ko: '반려동물 동반', en: 'Pets allowed' },
45:   { id: 'petPartial', ko: '반려동물 일부 구역', en: 'Pets in some areas' },
46:   { id: 'admissionFree', ko: '입장 무료', en: 'Free admission' },
47:   { id: 'bfWheelchair', ko: '휠체어', en: 'Wheelchairs', only: 'ko' },
48:   { id: 'bfElevator', ko: '엘리베이터', en: 'Elevator', only: 'ko' },
49:   { id: 'bfRestroom', ko: '장애인 화장실', en: 'Accessible restroom', only: 'ko' },
50:   { id: 'wellness', ko: '웰니스 관광', en: 'Wellness tourism' },
51: ];
52: 
53: export function attributeChips(lang: PlaceLang) {
54:   return ATTRIBUTE_CHIPS.filter((chip) => chip.only == null || chip.only === lang);
55: }
56: 
57: export const ATTRIBUTE_CAPTION: Record<PlaceLang, string> = {
58:   ko: '정보가 있는 곳만 거릅니다',
59:   en: 'Filters only places that list this information',

70:   if (selected.has('petPartial')) pet.push('PARTIAL');
71:   return {
72:     openToday: selected.has('openToday') || undefined,
73:     parking: selected.has('parking') ? 'YES' : undefined,
74:     creditCard: selected.has('creditCard') ? 'YES' : undefined,

```

## portal-fe/src/api/placeApi.ts

```text
430:   return res.data.data;
431: };
432: 
433: export const fetchAttraction = async (id: string): Promise<Attraction> => {
434:   const res = await api.get<ApiResponse<Attraction>>(`/api/search/attractions/${id}`);
435:   return res.data.data;
436: };
437: 
438: /** 관광지 상세 「주변 탐색」의 네 묶음 — 서버가 문서 좌표로 한 번에 찾는다. 자기 자신은 섞여 올 수 있다(화면이 뺀다). */
439: export interface AttractionNearby {
440:   sights: NearbyPlace[];

```

