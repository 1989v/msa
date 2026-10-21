package com.kgd.ranking.domain.cafe.model

import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import java.math.BigDecimal
import java.time.LocalDate

class DrinkGroupsTest : BehaviorSpec({
    Given("공식 메뉴의 다양한 표기") {
        listOf(
            "아이스 카페 아메리카노" to "아메리카노", "카페 라떼" to "라떼",
            "바닐라 라떼" to "바닐라라떼", "카페 모카" to "카페모카",
            "카라멜 마끼아또" to "카라멜마끼아또", "바닐라 콜드브루" to "콜드브루",
            "에스프레소" to "에스프레소", "고구마 라떼" to "고구마라떼",
            "말차 라떼" to "말차·녹차라떼", "녹차라떼" to "말차·녹차라떼",
            "얼그레이 밀크 티" to "밀크티", "초코 라떼" to "초코",
            "레몬 에이드" to "에이드", "딸기 스무디" to "스무디·프라페",
            "말차 프라푸치노" to "스무디·프라페", "레몬 티" to "티", "우유" to "우유·요거트",
        ).forEach { (name, expected) ->
            Then("$name → $expected") { DrinkGroups.classify(name) shouldBe expected }
        }
    }
    Given("메뉴명에 드러난 음료 유형과 별칭") {
        listOf(
            "H-카푸치노" to "카푸치노", "디카페인 카푸치노 (R)" to "카푸치노",
            "아이스 카라멜 마키아또" to "카라멜마끼아또",
            "블루베리바나나주스" to "주스", "오렌지 쥬스" to "주스",
            "스팀 우유" to "우유·요거트", "쏘유두유플레인" to "우유·요거트",
            "블루베리 요거트 드링크" to "우유·요거트",
            "멜론 소다" to "탄산음료", "트로피칼 스파클링" to "탄산음료",
            "체리콜라" to "탄산음료", "체리콕콕(ICED)" to "탄산음료",
            "쿨 라임 피지오" to "탄산음료",
            "제로슈거 레모네이드" to "에이드", "라임모히또" to "에이드",
            "플레인 요거트 쿨라타" to "스무디·프라페", "비타슬러시 레몬" to "스무디·프라페",
            "멜론 크러시" to "스무디·프라페", "딸기퐁크러쉬" to "스무디·프라페",
            "퐁당치노(바닐라)" to "스무디·프라페",
            "알찬 옥수수 치즈팝콘 쉐이키" to "스무디·프라페",
            "캐모마일" to "티", "카모마일" to "티", "페퍼민트" to "티",
            "히비스커스" to "티", "루이보스" to "티", "자스민" to "티",
            "레몬머틀" to "티", "블랙퍼스트" to "티", "그나와 민트" to "티",
            "트리플민트" to "티", "얼그레이" to "티", "얼 그레이" to "티",
            "(L) 아샷추 복숭아" to "티", "제로슈거 납작복숭아 아.샷.추" to "티",
            "빽사이즈 아망추" to "티", "나이트로 레몬 티" to "티",
            "아이스 롱블랙" to "아메리카노", "플랫 화이트" to "라떼",
            "코르타도" to "라떼", "라벤더 카페 브레베" to "라떼",
        ).forEach { (name, expected) ->
            Then("$name → $expected") { DrinkGroups.classify(name) shouldBe expected }
        }
    }
    Given("재료명보다 구체적인 제조 유형이 우선인 메뉴") {
        listOf(
            "얼그레이 케이크 라떼" to "라떼", "쿠키 쉐이크" to "스무디·프라페",
            "얼그레이 케이크 티" to "티", "우유 쿠키 드링크" to "우유·요거트",
            "말차 폭포 유자 블렌디드" to "스무디·프라페",
            "스타벅스 클래식 밀크티 블렌디드" to "스무디·프라페",
            "로우슈거 초코 쿨라타" to "스무디·프라페",
            "초코허니퐁크러쉬" to "스무디·프라페",
            "퐁당치노(원조커피)" to "스무디·프라페",
            "리치캐모마일 스파클링" to "탄산음료",
            "ARIH 듀얼바이오틱 소다 포지티브 오렌지" to "탄산음료",
            "에스프레소 마키아또" to "에스프레소",
            "카페 아다지오 딥쇼콜라라떼" to "라떼",
            "얼그레이 밀크 티" to "밀크티", "우유 밀크티" to "밀크티",
            "우유 말차 라떼" to "말차·녹차라떼", "초코 우유" to "초코",
        ).forEach { (name, expected) ->
            Then("$name → $expected") { DrinkGroups.classify(name) shouldBe expected }
        }
    }
    Given("메뉴명만으로 유형을 확정할 수 없는 메뉴") {
        listOf(
            "얼그레이 쿠키", "얼그레이 마카롱",
            "얼그레이 케이크", "얼그레이 스콘", "블랙퍼스트 샌드위치", "우유크림빵",
            "커피엔 역시 커피빵", "인절미 컵빙수", "아이스크림 츄러스", "헨젤과 프레첼",
            "바닐라", "딸기", "청포도맛(PET)", "이디야 워터", "왕메가헛개리카노",
            "크림 카라멜", "바닐라 마키아또", "아이스 우베 코코넛 마키아또", "던카치노 오리지널", "레몬 커피", "미숫가루",
        ).forEach { name ->
            Then("$name 은 추정하지 않는다") { DrinkGroups.classify(name) shouldBe "기타" }
        }
    }
    Given("공개 용량과 영양 수치") {
        val drink = CafeDrink(brandSlug = "sample", brandName = "샘플", menuName = "음료", volumeMl = BigDecimal("400"),
            sugarG = BigDecimal("12"), caffeineMg = BigDecimal("80"), caffeineStatus = CaffeineStatus.DISCLOSED,
            rawNutrition = emptyMap(), sourceUrl = "https://example.com", checkedAt = LocalDate.of(2026, 10, 20))
        Then("원천 카테고리로 메뉴명에 없는 유형을 추정하지 않는다") {
            drink.copy(sourceCategory = "카푸치노").drinkGroup shouldBe "기타"
            drink.copy(menuName = "얼그레이", sourceCategory = "커피").drinkGroup shouldBe "티"
        }
        Then("100ml당 값을 계산하되 용량 미공개·0 또는 영양 미공개는 추정하지 않는다") {
            drink.sugarPer100ml shouldBe BigDecimal("3.0000")
            drink.caffeinePer100ml shouldBe BigDecimal("20.0000")
            drink.copy(volumeMl = null).sugarPer100ml shouldBe null
            drink.copy(volumeMl = BigDecimal.ZERO).caffeinePer100ml shouldBe null
            drink.copy(sugarG = null).sugarPer100ml shouldBe null
        }
    }
})
