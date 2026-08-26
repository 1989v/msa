package com.kgd.warehouse.application.warehouse.service

import com.kgd.warehouse.application.warehouse.port.WarehouseRepositoryPort
import com.kgd.warehouse.application.warehouse.usecase.CreateWarehouseUseCase
import com.kgd.warehouse.domain.warehouse.exception.NoActiveWarehouseException
import com.kgd.warehouse.domain.warehouse.exception.WarehouseNotFoundException
import com.kgd.warehouse.domain.warehouse.model.Warehouse
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.mockk.clearMocks
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import java.time.LocalDateTime

class WarehouseServiceTest : BehaviorSpec({
    val warehouseRepository = mockk<WarehouseRepositoryPort>()
    val service = WarehouseService(warehouseRepository)

    fun stored(id: Long, name: String = "서울 1창고", active: Boolean = true) =
        Warehouse.restore(id, name, "서울시 강남구", 37.5, 127.0, active, LocalDateTime.of(2026, 1, 1, 0, 0))

    beforeEach { clearMocks(warehouseRepository) }

    given("창고 생성 시") {
        `when`("이름과 주소·좌표가 주어지면") {
            then("활성 상태로 저장되고 저장된 id 를 돌려준다") {
                val captured = slot<Warehouse>()
                every { warehouseRepository.save(capture(captured)) } returns stored(3L)

                val result = service.execute(CreateWarehouseUseCase.Command("서울 1창고", "서울시 강남구", 37.5, 127.0))

                result.id shouldBe 3L
                result.active shouldBe true
                captured.captured.active shouldBe true
                captured.captured.name shouldBe "서울 1창고"
            }
        }
        `when`("이름이 비어 있으면") {
            then("도메인 불변식이 막고 저장하지 않는다") {
                shouldThrow<IllegalArgumentException> {
                    service.execute(CreateWarehouseUseCase.Command("  ", "서울시 강남구", 37.5, 127.0))
                }
                verify(exactly = 0) { warehouseRepository.save(any()) }
            }
        }
    }

    given("창고 조회 시") {
        `when`("id 에 해당하는 창고가 없으면") {
            then("WarehouseNotFoundException 이 발생한다") {
                every { warehouseRepository.findById(99L) } returns null
                shouldThrow<WarehouseNotFoundException> { service.findById(99L) }
            }
        }
        `when`("전체 목록을 요청하면") {
            then("저장된 창고를 결과 모델로 옮겨 돌려준다") {
                every { warehouseRepository.findAll() } returns listOf(stored(1L), stored(2L, "부산 1창고", active = false))

                val result = service.findAll()

                result.map { it.id } shouldBe listOf(1L, 2L)
                result[1].active shouldBe false
                result[0].latitude shouldBe 37.5
            }
        }
    }

    given("기본 창고 조회 시") {
        `when`("활성 창고가 하나도 없으면") {
            then("NoActiveWarehouseException 이 발생한다") {
                every { warehouseRepository.findFirstActiveWarehouse() } returns null
                shouldThrow<NoActiveWarehouseException> { service.findDefaultWarehouse() }
            }
        }
        `when`("활성 창고가 있으면") {
            then("첫 활성 창고를 돌려준다") {
                every { warehouseRepository.findFirstActiveWarehouse() } returns stored(5L)
                service.findDefaultWarehouse().id shouldBe 5L
            }
        }
    }
})
