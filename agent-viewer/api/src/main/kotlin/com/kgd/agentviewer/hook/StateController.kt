package com.kgd.agentviewer.hook

import com.kgd.agentviewer.model.AgentSession
import com.kgd.agentviewer.model.StateSnapshot
import com.kgd.agentviewer.scanner.ConversationMessage
import com.kgd.agentviewer.scanner.ConversationService
import com.kgd.agentviewer.scanner.MultiToolScanService
import com.kgd.agentviewer.scanner.ScannedSession
import com.kgd.agentviewer.store.InMemoryStateStore
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api")
class StateController(
    private val stateStore: InMemoryStateStore,
    private val scanService: MultiToolScanService,
    private val conversationService: ConversationService
) {

    @GetMapping("/state")
    fun getState(): StateSnapshot = stateStore.getSnapshot()

    @GetMapping("/sessions")
    fun getSessions(): List<AgentSession> = stateStore.getActiveSessions()

    @GetMapping("/scanned")
    fun getScanned(): List<ScannedSession> = scanService.getLastScan()

    @GetMapping("/conversation")
    fun getConversation(@RequestParam projectPath: String): List<ConversationMessage> =
        conversationService.getConversation(projectPath)
}
