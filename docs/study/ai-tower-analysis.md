# AI Tower - AI Coding Assistant Control Tower Analysis

> Source: https://github.com/byeolkim-wq/ai-tower
> Language: Python 3 (single-file script, ~900 lines)
> Platform: macOS only
> Analyzed: 2026-03-31

---

## 1. Supported AI Agents

AI Tower monitors four terminal-based AI coding assistants:

| AI Tool | Status Detection | Conversation Display | Git Branch |
|---------|-----------------|---------------------|------------|
| **Claude Code** | Process + session file analysis | Last 2 messages from JSONL | Yes |
| **Codex** (OpenAI) | Process + session/history file | Last 2 messages from JSONL | Yes |
| **OpenCode** | Process + storage directory | Most recent session messages | Yes |
| **Gemini** (Google) | Process + hashed session dir | Last 2 messages from JSON | Yes |

Each tool has a dedicated color in the dashboard:
- Claude: Orange
- Codex: Magenta
- OpenCode: Cyan
- Gemini: Green

---

## 2. Activity Tracking Mechanism

AI Tower uses a **dual-layer detection strategy**: process monitoring + session file reading. No hooks or file watchers are used -- it polls on a fixed interval.

### 2.1 Process Detection (`get_process_cwds`)

The core detection function runs `ps -eo pid,%cpu,tty,command` and filters by regex patterns:

| Tool | Process Pattern |
|------|----------------|
| Claude | `\bclaude(\s+--\S+)*\s*$` |
| Codex | `\bcodex\b` |
| OpenCode | `\bopencode\b` |
| Gemini | `\bgemini\b` |

Key behaviors:
- Filters out processes with no terminal (`tty == '??'`) to exclude orphaned/background processes
- Uses `lsof -a -p {pid} -d cwd -Fn` to resolve each process's working directory
- Groups by CWD, tracking max CPU and process count per directory
- CPU usage is a critical signal for status determination

### 2.2 Session File Reading (per tool)

**Claude Code:**
- Reads `~/.claude/projects/{safe_path}/*.jsonl` (path-to-dashes convention)
- Filters files modified within the last 2 hours
- Supports fuzzy matching for non-ASCII paths
- Parses JSONL entries for `type: "user"` and `type: "assistant"` messages
- Multiple Claude processes on the same CWD are matched to distinct session files

**Codex:**
- Primary: `~/.codex/sessions/**/*.jsonl` -- matches session by CWD from `session_meta` entry
- Fallback: `~/.codex/history.jsonl`
- Parses `response_item` payload with role-based content extraction

**OpenCode:**
- Storage at `~/.local/share/opencode/storage/`
- Session metadata in `storage/session/global/*.json`
- Messages in `storage/message/{session_id}/*.json`
- Text content in `storage/part/{message_id}/*.json`
- Finds active session by most recent message file mtime

**Gemini:**
- Session at `~/.gemini/tmp/{sha256(cwd)}/chats/session-*.json`
- CWD is hashed with SHA-256 to locate the correct session directory
- Messages stored inline in JSON with `type: "user"` / `type: "gemini"`

### 2.3 Status Determination

Three-state model applied consistently across all tools:

| Status | Indicator | Condition |
|--------|-----------|-----------|
| In Progress | Blue circle | CPU > 5% AND recent file update (within 3-30s depending on tool) |
| Waiting for Input | Yellow circle | Last message was from user, but CPU is low |
| Completed | Green circle | Last message was from assistant AND CPU is low |

The CPU threshold of 5% is the primary differentiator between "actively processing" and "idle."

---

## 3. Architecture

### 3.1 Structure

The entire project is a **single Python 3 script** (`ai-tower`, ~900 lines) with no external dependencies. It uses only Python standard library modules:

```
os, sys, json, subprocess, re, time, unicodedata, hashlib, pathlib
select, tty, termios, shutil  (for TUI)
```

### 3.2 Module Organization (within the single file)

```
Visual Width Calculation   -- CJK/emoji-aware string width utilities
Tool Detection             -- Process discovery via ps + lsof
Claude Section             -- Session finding, status, message parsing
Codex Section              -- Session finding, status, message parsing
OpenCode Section           -- Session finding, status, message parsing
Gemini Section             -- Session finding, status, message parsing
Git Section                -- Branch detection via git rev-parse
Dashboard UI               -- ANSI TUI with box-drawing, scrolling, keyboard input
Main                       -- Entry point, -1 flag for one-shot mode
```

### 3.3 Design Decisions

- **No daemon / no hooks**: Pure polling approach. Runs `ps` and reads session files every cycle.
- **No config file**: Zero configuration. Auto-detects everything from process list and well-known paths.
- **Alternate screen buffer**: Uses terminal escape sequences (`\033[?1049h`) for clean TUI that doesn't pollute scroll history.
- **State diffing**: Only redraws when `get_state()` returns a different result from the previous poll, reducing flicker.
- **CJK-aware rendering**: Dedicated `visual_width`, `pad_to_width`, `truncate_to_width` functions handle double-width characters correctly.

### 3.4 Execution Modes

```bash
ai-tower        # Real-time dashboard (continuous polling with 'q' to quit)
ai-tower -1     # One-shot mode (print current state and exit)
```

---

## 4. Visualization

The dashboard renders a **card-based TUI** in the terminal using ANSI escape sequences and Unicode box-drawing characters.

### Card Layout (per session)

```
  ╭────────────────────────────────────────────────╮
  │ [Cl] my-project                    작업 완료 🟢 │
  │   Branch: feature/new-api                       │
  │   User: implement the login feature             │
  │   Bot:  I'll create the authentication...       │
  ╰────────────────────────────────────────────────╯
```

Each card displays:
1. **Tool badge** -- 2-letter abbreviation (`Cl`, `Co`, `Op`, `Ge`) in tool-specific color
2. **Project name** -- derived from CWD basename
3. **Status** -- text + colored emoji indicator (right-aligned)
4. **Git branch** -- current branch of the working directory
5. **Last 2 messages** -- User/Bot conversation snippets (truncated to fit)

### Dashboard Features
- Sessions sorted by most recent activity
- Session count summary with per-tool breakdown
- Scrollable when content exceeds terminal height (j/k or arrow keys)
- Keyboard input via `tty.setcbreak` (non-blocking with `select`)
- Auto-refresh on state change detection

---

## 5. Integration with AI Coding Tools

AI Tower does **not** integrate with the AI tools via APIs or plugins. It is a purely **passive, read-only observer** that relies on:

1. **OS-level process inspection** (`ps`, `lsof`) -- to discover running AI tool processes and their working directories
2. **File system convention knowledge** -- hardcoded paths where each tool stores its session data:

| Tool | Session Data Location |
|------|----------------------|
| Claude Code | `~/.claude/projects/{path-as-dashes}/*.jsonl` |
| Codex | `~/.codex/sessions/**/*.jsonl` or `~/.codex/history.jsonl` |
| OpenCode | `~/.local/share/opencode/storage/{session,message,part}/` |
| Gemini | `~/.gemini/tmp/{sha256(cwd)}/chats/session-*.json` |

This means:
- **No API keys or authentication required**
- **No modification to AI tool configuration needed**
- **Breaks if any tool changes its local storage format** (tight coupling to file formats)
- **macOS only** due to reliance on `lsof` flags, `tty`/`termios`, and macOS-specific process table behavior

---

## 6. Key Takeaways

### Strengths
- **Zero-config, zero-dependency**: Just download and run. No pip install, no setup.
- **Multi-tool monitoring**: Unified view across 4 different AI coding assistants.
- **Lightweight**: Single file, standard library only, minimal resource usage.
- **Good UX details**: CJK-aware text rendering, state-diffing to avoid flicker, alternate screen buffer.

### Limitations
- **macOS only**: Uses `lsof`, `termios`, `tty` in macOS-specific ways.
- **Brittle session parsing**: Hardcoded file paths and formats; any tool update could break detection.
- **No historical data**: Shows only current state, no session history or analytics.
- **No remote monitoring**: Terminal-local only.
- **Polling-based**: Continuously runs `ps` and `lsof` commands rather than using file watchers (e.g., `fsevents`).
- **No extensibility**: Adding a new AI tool requires modifying the script directly.

### Potential Improvements
- Plugin architecture for adding new AI tools
- Cross-platform support (Linux `procfs` instead of `lsof`)
- File system watchers (`watchdog` or `fsevents`) instead of polling
- Session history and analytics dashboard
- Web-based UI for remote monitoring
