package com.kgd.game.domain.play.model

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * 게임 하루의 경계.
 *
 * 플레이어가 "오늘"이라고 말할 때 뜻하는 것은 자기 나라의 자정이고, 이 사이트의 플레이어는
 * 한국인이다. UTC 로 자르면 한국 시간 오전 9시에 보드가 갈려 어젯밤 기록이 오늘에 남는다.
 * 데일리 퍼즐(`portal-fe/public/games/lib/daily.js`)도 이미 KST 자정 롤오버를 쓴다 —
 * 한 사이트 안에서 "오늘"의 뜻이 둘이면 안 된다.
 *
 * 서버 JVM 의 기본 타임존에 기대지 않는다. 배포 환경이 바뀌면 하루의 경계가 조용히 움직인다.
 */
object GameDay {
    val ZONE: ZoneId = ZoneId.of("Asia/Seoul")

    /** 그 순간이 속한 게임 하루. 경계 판정을 테스트할 수 있는 유일한 지점이다 */
    fun on(at: Instant): LocalDate = at.atZone(ZONE).toLocalDate()

    fun today(): LocalDate = on(Instant.now())
}
