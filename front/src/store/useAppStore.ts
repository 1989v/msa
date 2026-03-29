import { create } from 'zustand'
import type { Agent, Team, Task, ViewMode, Notification, Session } from '@/types'
import { loadAppData } from '@/utils/dataLoader'

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
  refresh: () => void
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
