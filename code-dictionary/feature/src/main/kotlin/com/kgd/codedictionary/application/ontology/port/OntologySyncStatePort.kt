package com.kgd.codedictionary.application.ontology.port

import com.kgd.codedictionary.application.ontology.dto.OntologyState

/**
 * 파생물(검색 색인) 갱신의 파드 간 조정. 같은 상태 행의 리스 칼럼을 쓴다 — DB 적용 잠금과는 별개다.
 */
interface OntologySyncStatePort {
    fun readState(): OntologyState

    /**
     * 리스를 잡으면 그 순간의 `content_hash` 를 대상으로 고정해 돌려준다(`null` 해시는 빈 문자열).
     * 다른 소유자가 살아 있는 리스를 쥐고 있으면 null. 만료된 리스는 빼앗는다.
     */
    fun tryAcquireLease(owner: String, leaseSeconds: Long): String?

    /** 대상 해시를 새로 고정한다 — 교체 직전 재확인에서 내용이 바뀌었을 때 */
    fun retarget(owner: String, targetHash: String)

    /** 성공한 sync 가 고정했던 해시만 적는다 */
    fun recordDerived(owner: String, targetHash: String)

    fun releaseLease(owner: String)
}
