package com.kgd.payment.infrastructure.messaging

import com.kgd.common.ops.DltReplayer
import com.kgd.payment.application.opsissue.port.DltReplayPort
import org.springframework.beans.factory.annotation.Qualifier
import org.springframework.stereotype.Component

@Component
class PaymentDltReplayAdapter(
    @Qualifier("paymentDltReplayer") private val replayer: DltReplayer,
) : DltReplayPort {
    override fun replay(issueId: Long) = replayer.replay(issueId)
}
