package com.kgd.blog.application.profile.port

import com.kgd.blog.domain.model.BlogProfile
import com.kgd.blog.domain.model.ProfileRole
import com.kgd.blog.domain.model.ProfileStatus

interface BlogProfileRepositoryPort {
    fun findById(id: Long): BlogProfile?
    fun findByMemberId(memberId: Long): BlogProfile?
    fun findByHandle(handle: String): BlogProfile?
    fun existsByHandle(handle: String): Boolean
    fun findAllByIdIn(ids: Collection<Long>): List<BlogProfile>
    /** id 내림차순. 둘 다 null 이면 전체 */
    fun findAll(role: ProfileRole?, status: ProfileStatus?): List<BlogProfile>
    /** id 가 있으면 갱신, 없으면 생성 */
    fun save(profile: BlogProfile): BlogProfile
}
