package com.kgd.common.persistence

import org.flywaydb.core.Flyway
import org.springframework.beans.factory.InitializingBean
import javax.sql.DataSource

/**
 * 특정 datasource 하나에만 마이그레이션을 적용하는 실행기.
 *
 * 폴드된 앱(ADR-0058)은 여러 도메인 feature 가 한 클래스패스를 공유한다. Boot 의 Flyway
 * 자동설정은 **primary datasource 하나에 `classpath:db/migration` 전부**를 적용하므로,
 * 도메인마다 `V1__…` 을 둔 이 구조에서는 버전이 충돌하고 남의 스키마에 남의 DDL 이 실행된다.
 * 그래서 도메인별로 전용 location 과 datasource 를 묶어 직접 돌린다.
 *
 * 빈으로 등록해 두면 그 존재 자체가 EMF 의 선행 조건이 된다 — EMF 쪽에 `@DependsOn` 을 걸어
 * 스키마 검증보다 마이그레이션이 먼저 끝나게 한다(자동설정이 해주던 순서를 손으로 세운다).
 *
 * @param baselineVersion 기존 스키마에 이력 테이블이 없을 때 기준선으로 삼을 버전.
 *   운영 스키마가 Hibernate 로 만들어진 뒤 뒤늦게 Flyway 를 붙이는 경우에 필요하다.
 *   **이력 테이블이 생긴 뒤에는 무시**되므로 새 마이그레이션을 추가해도 갱신할 필요가 없다.
 *   null 이면 baseline 을 쓰지 않는다(빈 스키마에서 처음부터 적용하는 정상 경로).
 */
class ScopedFlywayMigrator(
    private val dataSource: DataSource,
    private val location: String,
    private val enabled: Boolean = true,
    private val baselineVersion: String? = null,
) : InitializingBean {

    override fun afterPropertiesSet() {
        if (!enabled) return
        Flyway.configure()
            .dataSource(dataSource)
            .locations(location)
            .baselineOnMigrate(baselineVersion != null)
            .apply { baselineVersion?.let { baselineVersion(it) } }
            .load()
            .migrate()
    }
}
