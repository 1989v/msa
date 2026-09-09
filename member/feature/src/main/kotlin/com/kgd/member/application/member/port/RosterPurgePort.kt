package com.kgd.member.application.member.port

/**
 * 탈퇴 시 다른 서비스가 들고 있는 회원 데이터를 파기하라고 알린다 (ADR-0092).
 *
 * member 는 이메일·실명을 안 받아 자기 스키마에 지울 개인정보가 거의 없지만,
 * **친구 그룹은 game_db 에 있고 그것은 제3자의 이름**이다. 방침 §6 「탈퇴 시 지체 없이
 * 파기」가 그 행에도 걸린다.
 *
 * **실패해도 탈퇴를 막지 않는다.** 파기 호출이 안 됐다고 회원이 탈퇴하지 못하면 그게 더 나쁘고,
 * 놓친 행은 보존 정리 배치가 그물로 잡는다. 두 겹이라야 「지체 없이」와 「빠짐없이」가 함께 선다.
 */
interface RosterPurgePort {
    fun purgeByMember(memberId: Long)
}
