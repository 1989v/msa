export type AgentStatus = 'idle' | 'working' | 'thinking'
export type TaskStatus = 'pending' | 'in-progress' | 'completed'
export type ViewMode = 'session' | 'team' | 'task'
export type SessionStatus = 'active' | 'paused' | 'completed'

export interface Session {
  id: string
  name: string
  description: string
  status: SessionStatus
  color: string
  agentIds: string[]
  taskIds: string[]
  startedAt: number
}

export interface Agent {
  id: string
  name: string
  team: string
  role: string
  tools: string[]
  status: AgentStatus
  spriteType: string
  currentTaskIds: string[]
  speechBubble?: string
}

export interface Team {
  id: string
  name: string
  color: string
  agents: string[]
  areaPosition: { x: number; y: number; w: number; h: number }
}

export interface Task {
  id: string
  name: string
  status: TaskStatus
  assignedAgentIds: string[]
  progress?: number
  description?: string
}

export type NotificationType = 'approval' | 'completed' | 'blocked' | 'report'

export interface Notification {
  id: string
  agentId: string
  type: NotificationType
  title: string
  message: string
  timestamp: number
  read: boolean
  actionRequired: boolean
}

// Real-time live models (from WebSocket)
export interface LiveSession {
  sessionId: string
  startedAt: string
  active: boolean
  subagentIds: string[]
  taskIds: string[]
}

export interface LiveSubagent {
  agentId: string
  agentType: string
  sessionId: string
  active: boolean
  lastMessage?: string
}

export interface LiveTask {
  taskId: string
  sessionId: string
  subject?: string
  completed: boolean
}

export interface AppData {
  sessions: Session[]
  teams: Team[]
  agents: Agent[]
  tasks: Task[]
  notifications: Notification[]
}
