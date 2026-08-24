package com.kgd.game.domain.catalog.model

/**
 * 게임이 나눠 놓은 랭킹 보드 한 칸 — 키와 표시 이름 (V59).
 *
 * 키가 무엇을 뜻하는지는 게임의 규칙이라 서버가 알 수 없다. 그런데도 **카탈로그가 이름을 드는**
 * 이유는 게임 **밖** 상세 페이지(1989v.com)가 보드 탭을 그려야 하는데, 게임 안 선언은
 * 샌드박스 iframe 안 스크립트라 바깥에서 읽을 수 없기 때문이다.
 * (게임 **안** 랭킹 위젯은 `lib/rank.js` 가 게임의 선언을 그대로 쓴다 — 서버를 거치지 않는다.)
 *
 * 어드민 CRUD 에는 없다. 보드는 게임 코드가 정하는 것이라 게임과 같은 시드 마이그레이션에서
 * 함께 들어온다 — 화면에서 고칠 수 있게 하면 게임이 보내는 키와 어긋날 수 있다.
 */
data class ScoreBoardDef(
    val key: String,
    val name: String,
    val nameEn: String? = null,
)
