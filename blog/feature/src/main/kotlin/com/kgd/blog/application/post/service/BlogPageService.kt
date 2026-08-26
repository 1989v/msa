package com.kgd.blog.application.post.service

import com.kgd.blog.application.interaction.usecase.RecordBlogViewUseCase
import com.kgd.blog.application.post.port.BlogPageRenderPort
import com.kgd.blog.application.post.port.BlogShellPort
import com.kgd.blog.application.post.usecase.GetBlogAuthorSpaceUseCase
import com.kgd.blog.application.post.usecase.GetBlogPostUseCase
import com.kgd.blog.application.post.usecase.RenderBlogPageUseCase
import com.kgd.common.exception.BusinessException
import org.springframework.stereotype.Service

@Service
class BlogPageService(
    private val getPost: GetBlogPostUseCase,
    private val getAuthorSpace: GetBlogAuthorSpaceUseCase,
    private val recordView: RecordBlogViewUseCase,
    private val shellPort: BlogShellPort,
    private val renderPort: BlogPageRenderPort,
) : RenderBlogPageUseCase {

    override fun postPage(command: RenderBlogPageUseCase.PostCommand): RenderBlogPageUseCase.Page {
        val shell = shellPort.shell()
        val detail = try {
            getPost.execute(GetBlogPostUseCase.Query(command.slug, command.identity))
        } catch (e: BusinessException) {
            return RenderBlogPageUseCase.Page.NotFound(renderPort.notFoundPage(shell))
        }
        // 봇이 아닌 직접 방문도 여기서 한 번 센다. 뒤이어 SPA 가 API 를 부르지만
        // 원장의 유니크 제약이 같은 방문자를 하루 1표로 접는다
        recordView.execute(
            RecordBlogViewUseCase.Command(detail.post.id, command.identity.visitorId, command.userAgent),
        )
        return RenderBlogPageUseCase.Page.Found(renderPort.postPage(shell, detail))
    }

    override fun authorPage(handle: String): RenderBlogPageUseCase.Page {
        val shell = shellPort.shell()
        val space = try {
            getAuthorSpace.execute(GetBlogAuthorSpaceUseCase.Query(handle, page = 0, size = AUTHOR_PAGE_SIZE))
        } catch (e: BusinessException) {
            return RenderBlogPageUseCase.Page.NotFound(renderPort.notFoundPage(shell))
        }
        return RenderBlogPageUseCase.Page.Found(renderPort.authorPage(shell, space))
    }

    private companion object {
        const val AUTHOR_PAGE_SIZE = 20
    }
}
