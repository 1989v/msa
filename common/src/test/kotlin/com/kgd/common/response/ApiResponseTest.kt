package com.kgd.common.response

import com.kgd.common.exception.ErrorCode
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.nulls.shouldBeNull
import io.kotest.matchers.nulls.shouldNotBeNull
import io.kotest.matchers.shouldBe

class ApiResponseTest : BehaviorSpec({

    given("성공 응답 생성 시") {
        `when`("데이터가 있으면") {
            then("success=true, data에 값이 담겨야 한다") {
                val response = ApiResponse.success("hello")
                response.success shouldBe true
                response.data shouldBe "hello"
                response.error.shouldBeNull()
            }
        }
        `when`("데이터 없이 생성하면") {
            then("success=true, data=null이어야 한다") {
                val response = ApiResponse.success<Nothing>()
                response.success shouldBe true
                response.data.shouldBeNull()
            }
        }
    }

    given("에러 응답 생성 시") {
        `when`("ErrorCode로 생성하면") {
            then("success=false, error에 코드와 메시지가 담겨야 한다") {
                val response = ApiResponse.error<Nothing>(ErrorCode.NOT_FOUND)
                response.success shouldBe false
                response.data.shouldBeNull()
                response.error.shouldNotBeNull()
                response.error!!.code shouldBe "NOT_FOUND"
                response.error!!.message shouldBe "리소스를 찾을 수 없습니다"
            }
        }
        `when`("커스텀 코드와 메시지로 생성하면") {
            then("success=false, error에 커스텀 정보가 담겨야 한다") {
                val response = ApiResponse.error<Nothing>("CUSTOM_ERROR", "커스텀 메시지")
                response.success shouldBe false
                response.error!!.code shouldBe "CUSTOM_ERROR"
                response.error!!.message shouldBe "커스텀 메시지"
            }
        }
    }
})
