package com.kgd.ads.application.audit.port

import com.kgd.ads.application.audit.dto.AdminAction

/** 운영자 변경 기록. 호출자의 ads 트랜잭션 안에서 불러 변경과 기록이 한 커밋이 되게 한다. */
interface AdminAuditPort {
    fun record(action: AdminAction)
}
