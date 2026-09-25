package com.kgd.order.application.order.port

/**
 * 결제 대기 상한의 직렬화 지점 — 회원당 행 하나(`member_order_guard`)를 잠가, 같은 회원의 동시 접수가
 * "대기 건수 세기 → 주문 저장"을 한 번에 하나씩만 하게 한다. 잠금 없이 세면 동시 요청이 모두 상한 아래로 읽는다.
 */
interface PendingOrderGuardPort {
    /** 회원 행이 없으면 만든다. 호출자가 **따로 커밋**한다 — 잠그는 트랜잭션 안에서 만들면 공유 잠금 승격으로 교착이 난다 */
    fun ensure(userId: String)

    /** 회원 행을 SELECT … FOR UPDATE 로 잠근다. 호출자의 order 트랜잭션이 끝날 때 풀린다 */
    fun lock(userId: String)
}
