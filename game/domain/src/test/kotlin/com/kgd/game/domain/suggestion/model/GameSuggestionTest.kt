package com.kgd.game.domain.suggestion.model

import com.kgd.common.exception.BusinessException
import io.kotest.assertions.throwables.shouldThrow
import io.kotest.core.spec.style.BehaviorSpec
import io.kotest.matchers.shouldBe
import io.kotest.matchers.shouldNotBe

class GameSuggestionTest : BehaviorSpec({

    fun suggestion(memberId: Long = 7L, nickname: String = "활잡이") =
        GameSuggestion.restore(
            id = 1L,
            gameId = 100L,
            memberId = memberId,
            nickname = nickname,
            body = "2스테이지 보스가 너무 빠릅니다",
            status = SuggestionStatus.OPEN,
            createdAt = null,
            updatedAt = null,
        )

    given("제안을 등록할 때") {
        `when`("본문과 닉네임이 규격 안이면") {
            then("접수 상태로 만들어지고 앞뒤 공백은 지워진다") {
                val opened = GameSuggestion.open(100L, 7L, "  활잡이 ", "  보스 속도를 낮춰주세요  ")
                opened.status shouldBe SuggestionStatus.OPEN
                opened.nickname shouldBe "활잡이"
                opened.body shouldBe "보스 속도를 낮춰주세요"
            }
        }

        `when`("본문이 규격을 벗어나면") {
            then("거부한다") {
                shouldThrow<BusinessException> { GameSuggestion.open(100L, 7L, "활잡이", "짧음") }
                shouldThrow<BusinessException> {
                    GameSuggestion.open(100L, 7L, "활잡이", "가".repeat(GameSuggestion.MAX_BODY + 1))
                }
            }
        }

        `when`("닉네임이 규격을 벗어나면") {
            then("거부한다") {
                shouldThrow<BusinessException> { GameSuggestion.open(100L, 7L, "가", "보스 속도를 낮춰주세요") }
                shouldThrow<BusinessException> {
                    GameSuggestion.open(100L, 7L, "가".repeat(GameSuggestion.MAX_NICKNAME + 1), "보스 속도를 낮춰주세요")
                }
            }
        }
    }

    given("제안을 수정할 때") {
        `when`("쓴 본인이면") {
            then("본문이 바뀐다") {
                suggestion().editBy(7L, "3스테이지도 같습니다").body shouldBe "3스테이지도 같습니다"
            }
        }

        `when`("다른 회원이면") {
            then("거부한다 — 운영자에게도 예외를 두지 않는다") {
                shouldThrow<BusinessException> { suggestion().editBy(8L, "남의 글 고치기") }
            }
        }

        `when`("비로그인이면") {
            then("거부한다") {
                shouldThrow<BusinessException> { suggestion().editBy(null, "익명 수정") }
            }
        }
    }

    given("처리 상태를 바꿀 때") {
        `when`("반영으로 옮겼다가 되돌리면") {
            then("두 방향 모두 허용한다 — 오조작을 되돌릴 다른 경로가 없다") {
                val applied = suggestion().changeStatus(SuggestionStatus.APPLIED)
                applied.status shouldBe SuggestionStatus.APPLIED
                applied.changeStatus(SuggestionStatus.OPEN).status shouldBe SuggestionStatus.OPEN
            }
        }

        `when`("상태를 바꿔도") {
            then("본문과 작성자는 그대로다") {
                val moved = suggestion().changeStatus(SuggestionStatus.DECLINED)
                moved.body shouldBe suggestion().body
                moved.memberId shouldBe 7L
                moved.nickname shouldBe "활잡이"
            }
        }
    }

    given("답글을 달 때") {
        `when`("운영자가 달면") {
            then("자격은 OPERATOR 이고 이름은 서버가 붙인 것이다") {
                val reply = suggestion().reply(memberId = 99L, isOperator = true, body = "1.2 에서 낮췄습니다")
                reply.authorType shouldBe ReplyAuthorType.OPERATOR
                reply.authorName shouldBe GameSuggestion.OPERATOR_NAME
                reply.suggestionId shouldBe 1L
            }
        }

        `when`("제안을 쓴 본인이 달면") {
            then("자격은 AUTHOR 이고 이름은 제안의 닉네임이다") {
                val reply = suggestion().reply(memberId = 7L, isOperator = false, body = "2-3 진입 직후요")
                reply.authorType shouldBe ReplyAuthorType.AUTHOR
                reply.authorName shouldBe "활잡이"
            }
        }

        `when`("닉네임을 「운영자」로 지은 사람이 달면") {
            then("이름은 같아도 자격은 AUTHOR 라 배지가 갈린다") {
                val reply = suggestion(nickname = GameSuggestion.OPERATOR_NAME)
                    .reply(memberId = 7L, isOperator = false, body = "제가 운영자입니다")
                reply.authorType shouldBe ReplyAuthorType.AUTHOR
                reply.authorType shouldNotBe ReplyAuthorType.OPERATOR
            }
        }

        `when`("제3자가 달면") {
            then("거부한다 — 제안자와 운영자만 쓴다") {
                shouldThrow<BusinessException> {
                    suggestion().reply(memberId = 8L, isOperator = false, body = "저도 그렇게 생각해요")
                }
            }
        }

        `when`("본문이 비었거나 상한을 넘으면") {
            then("거부한다") {
                shouldThrow<BusinessException> { suggestion().reply(7L, false, "   ") }
                shouldThrow<BusinessException> {
                    suggestion().reply(7L, false, "가".repeat(SuggestionReply.MAX_BODY + 1))
                }
            }
        }
    }

    given("처리 상태 문자열을 읽을 때") {
        `when`("비었거나 null 이면") {
            then("필터 없음(null)으로 읽는다") {
                SuggestionStatus.parse(null) shouldBe null
                SuggestionStatus.parse("  ") shouldBe null
            }
        }

        `when`("대소문자가 달라도 알려진 값이면") {
            then("해당 상태로 읽는다") {
                SuggestionStatus.parse("applied") shouldBe SuggestionStatus.APPLIED
            }
        }

        `when`("모르는 값이면") {
            then("조용히 무시하지 않고 거부한다 — 오타가 「전체 조회」로 둔갑하면 안 된다") {
                shouldThrow<BusinessException> { SuggestionStatus.parse("DONE") }
            }
        }
    }
})
