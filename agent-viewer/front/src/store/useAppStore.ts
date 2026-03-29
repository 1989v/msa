import { create } from 'zustand'
import type { Agent, Team, Task, ViewMode, Notification, Session, LiveSession, LiveSubagent, LiveTask, Toast, TimelineEvent } from '@/types'
import type { ConnectionStatus } from '@/hooks/useWebSocket'
import { loadAppData } from '@/utils/dataLoader'
import { playNotificationSound } from '@/utils/sound'

interface AppState {
  sessions: Session[]
  agents: Agent[]
  teams: Team[]
  tasks: Task[]
  notifications: Notification[]
  selectedAgentId: string | null
  viewMode: ViewMode
  teamFilters: Set<string>
  taskFilters: Set<string>
  sessionFilters: Set<string>
  showNotificationPanel: boolean
  connectionStatus: ConnectionStatus
  liveSessions: Map<string, LiveSession>
  liveSubagents: Map<string, LiveSubagent>
  liveTasks: Map<string, LiveTask>
  toasts: Toast[]
  timeline: TimelineEvent[]

  // Actions
  selectAgent: (id: string | null) => void
  setViewMode: (mode: ViewMode) => void
  toggleTeamFilter: (teamId: string) => void
  toggleTaskFilter: (taskId: string) => void
  setAllTeamFilters: (enabled: boolean) => void
  setAllTaskFilters: (enabled: boolean) => void
  toggleNotificationPanel: () => void
  markNotificationRead: (id: string) => void
  approveNotification: (id: string) => void
  dismissNotification: (id: string) => void
  setConnectionStatus: (status: ConnectionStatus) => void
  handleWsEvent: (event: WsEvent) => void
  addToast: (message: string, type?: Toast['type']) => void
  dismissToast: (id: string) => void
  refresh: () => void
}

interface WsEvent {
  type: string
  data: Record<string, unknown>
}

function initializeData() {
  const data = loadAppData()
  return {
    sessions: data.sessions,
    agents: data.agents,
    teams: data.teams,
    tasks: data.tasks,
    notifications: data.notifications,
    teamFilters: new Set(data.teams.map((t) => t.id)),
    taskFilters: new Set(data.tasks.map((t) => t.id)),
    sessionFilters: new Set(data.sessions.map((s) => s.id)),
  }
}

export const useAppStore = create<AppState>((set) => {
  const initial = initializeData()

  return {
    ...initial,
    selectedAgentId: null,
    viewMode: 'session',
    showNotificationPanel: false,
    connectionStatus: 'disconnected' as ConnectionStatus,
    liveSessions: new Map<string, LiveSession>(),
    liveSubagents: new Map<string, LiveSubagent>(),
    liveTasks: new Map<string, LiveTask>(),
    toasts: [],
    timeline: [],

    selectAgent: (id) => set({ selectedAgentId: id }),

    setViewMode: (mode) => set({ viewMode: mode }),

    toggleNotificationPanel: () =>
      set((state) => ({ showNotificationPanel: !state.showNotificationPanel })),

    markNotificationRead: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        ),
      })),

    approveNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.map((n) =>
          n.id === id ? { ...n, read: true, actionRequired: false, title: `[승인됨] ${n.title}` } : n
        ),
      })),

    dismissNotification: (id) =>
      set((state) => ({
        notifications: state.notifications.filter((n) => n.id !== id),
      })),

    toggleTeamFilter: (teamId) =>
      set((state) => {
        const next = new Set(state.teamFilters)
        if (next.has(teamId)) {
          next.delete(teamId)
        } else {
          next.add(teamId)
        }
        return { teamFilters: next }
      }),

    toggleTaskFilter: (taskId) =>
      set((state) => {
        const next = new Set(state.taskFilters)
        if (next.has(taskId)) {
          next.delete(taskId)
        } else {
          next.add(taskId)
        }
        return { taskFilters: next }
      }),

    setAllTeamFilters: (enabled) =>
      set((state) => ({
        teamFilters: enabled
          ? new Set(state.teams.map((t) => t.id))
          : new Set<string>(),
      })),

    setAllTaskFilters: (enabled) =>
      set((state) => ({
        taskFilters: enabled
          ? new Set(state.tasks.map((t) => t.id))
          : new Set<string>(),
      })),

    setConnectionStatus: (status) => set({ connectionStatus: status }),

    addToast: (message, type = 'info') => {
      const toast: Toast = { id: `toast-${Date.now()}`, message, type, timestamp: Date.now() }
      set((state) => ({ toasts: [...state.toasts.slice(-4), toast] }))
      // Auto-dismiss after 4 seconds
      setTimeout(() => {
        useAppStore.setState((state) => ({
          toasts: state.toasts.filter((t) => t.id !== toast.id),
        }))
      }, 4000)
    },

    dismissToast: (id) =>
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

    handleWsEvent: (event) =>
      set((state) => {
        const liveSessions = new Map(state.liveSessions)
        const liveSubagents = new Map(state.liveSubagents)
        const liveTasks = new Map(state.liveTasks)

        // Toast helper (called outside set)
        const addToast = useAppStore.getState().addToast

        switch (event.type) {
          case 'SESSION_START': {
            const sid = event.data.sessionId as string
            const name = event.data.name as string | undefined
            liveSessions.set(sid, {
              sessionId: sid,
              name,
              cwd: event.data.cwd as string | undefined,
              startedAt: event.data.startedAt as string,
              active: true,
              subagentIds: [],
              taskIds: [],
            })
            addToast(`🟢 세션 시작: ${name ?? sid.slice(0, 8)}`, 'info')
            break
          }
          case 'SESSION_END': {
            const sid = event.data.sessionId as string
            const s = liveSessions.get(sid)
            if (s) {
              liveSessions.set(sid, { ...s, active: false })
              addToast(`⚪ 세션 종료: ${s.name ?? sid.slice(0, 8)}`, 'info')
            }
            break
          }
          case 'SUBAGENT_START': {
            const aid = event.data.agentId as string
            const sid = event.data.sessionId as string
            const agentType = event.data.agentType as string
            liveSubagents.set(aid, {
              agentId: aid,
              agentType,
              sessionId: sid,
              active: true,
            })
            const s = liveSessions.get(sid)
            if (s && !s.subagentIds.includes(aid)) {
              liveSessions.set(sid, { ...s, subagentIds: [...s.subagentIds, aid] })
            }
            addToast(`⚡ ${agentType} 에이전트 투입`, 'success')
            playNotificationSound()
            break
          }
          case 'SUBAGENT_STOP': {
            const aid = event.data.agentId as string
            const sub = liveSubagents.get(aid)
            if (sub) {
              liveSubagents.set(aid, { ...sub, active: false, lastMessage: event.data.lastMessage as string | undefined })
              addToast(`✅ ${sub.agentType} 작업 완료`, 'success')
            }
            break
          }
          case 'TASK_CREATED': {
            const tid = event.data.taskId as string
            const sid = event.data.sessionId as string
            liveTasks.set(tid, {
              taskId: tid,
              sessionId: sid,
              subject: event.data.subject as string | undefined,
              completed: false,
            })
            const s = liveSessions.get(sid)
            if (s && !s.taskIds.includes(tid)) {
              liveSessions.set(sid, { ...s, taskIds: [...s.taskIds, tid] })
            }
            break
          }
          case 'TASK_COMPLETED': {
            const tid = event.data.taskId as string
            const t = liveTasks.get(tid)
            if (t) liveTasks.set(tid, { ...t, completed: true })
            break
          }
        }

        // Add timeline event
        const sessionId = (event.data.sessionId as string) ?? ''
        const timelineMsg: Record<string, string> = {
          SESSION_START: `세션 시작`,
          SESSION_END: `세션 종료`,
          SUBAGENT_START: `${event.data.agentType} 에이전트 투입`,
          SUBAGENT_STOP: `${event.data.agentType ?? 'Agent'} 작업 완료`,
          TASK_CREATED: `태스크 생성: ${event.data.subject ?? event.data.taskId}`,
          TASK_COMPLETED: `태스크 완료: ${event.data.taskId}`,
        }
        const tl: TimelineEvent = {
          id: `tl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          sessionId,
          type: event.type,
          message: timelineMsg[event.type] ?? event.type,
          timestamp: Date.now(),
        }
        const timeline = [...state.timeline.slice(-49), tl]

        return { liveSessions, liveSubagents, liveTasks, timeline }
      }),

    refresh: () => {
      const data = initializeData()
      set({
        sessions: data.sessions,
        agents: data.agents,
        teams: data.teams,
        tasks: data.tasks,
        notifications: data.notifications,
      })
    },
  }
})

// Derived selectors
export function getAgentsByTeam(agents: Agent[], teamId: string): Agent[] {
  return agents.filter((a) => a.team === teamId)
}

export function getAgentsByTask(agents: Agent[], taskId: string): Agent[] {
  return agents.filter((a) => a.currentTaskIds.includes(taskId))
}

export function getUnassignedAgents(agents: Agent[]): Agent[] {
  return agents.filter((a) => a.currentTaskIds.length === 0)
}

export function getSelectedAgent(agents: Agent[], id: string | null): Agent | undefined {
  if (!id) return undefined
  return agents.find((a) => a.id === id)
}

export function getTeamById(teams: Team[], id: string): Team | undefined {
  return teams.find((t) => t.id === id)
}

export function getAgentsBySession(agents: Agent[], session: Session): Agent[] {
  return agents.filter((a) => session.agentIds.includes(a.id))
}

export function getUnassignedToSession(agents: Agent[], sessions: Session[]): Agent[] {
  const allAssigned = new Set(sessions.flatMap((s) => s.agentIds))
  return agents.filter((a) => !allAssigned.has(a.id))
}
