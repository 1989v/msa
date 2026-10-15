---
title: Claude Code · Codex 주간 남은 한도를 macOS 메뉴바에 띄우기 — tmux 메뉴바 앱 muxbar
slug: claude-code-codex-weekly-limit-menubar-muxbar
category: /harness
summary: muxbar 는 tmux 세션 관리와 잠자기 방지를 macOS 메뉴바에서 하는 앱이다. Claude Code · Codex 의 주간 남은 한도를 커피잔 아이콘 위에 겹쳐 보여 주고, 이번 주 세션별 토큰과 한도 중 그 세션의 몫을 메뉴에서 보여 준다. 로컬 로그만 읽어 토큰을 쓰지 않는다.
---

muxbar 는 tmux 세션 목록 · Keep Awake · 덮개를 닫아도 돌아가는 Closed-lid mode 를 메뉴바 아이콘 하나에 모은 macOS 앱이다. 이 글은 AI 주간 한도 표시를 중심으로 설치와 쓰는 법을 다룬다(muxbar 0.4.2 기준).

| 항목 | 값 |
|---|---|
| 메뉴바 | 커피잔 받침에 주간 남은 한도 `56\|57`, 오른쪽 위 원 안에 tmux 세션 수 |
| AI 한도 | Claude Code · Codex 주간 남은 %, 리셋 시각, 마지막 관측 시각 |
| 세션별 토큰 | 이번 주간 창 동안 AI 세션별 토큰과 주간 한도 중 그 세션의 몫 |
| 읽는 곳 | `~/.claude` · `~/.codex` 아래 로컬 로그. API 호출과 토큰 소모 없음 |
| 안 쓰는 AI | 표시하지 않는다. 둘 다 안 쓰면 아이콘만 남는다 |
| 설치 | `brew install --cask 1989v/tap/muxbar` |
| 요구 사항 | macOS 13 이상, Apple Silicon, tmux |
| 소스 | `github.com/1989v/muxbar` (MIT) |

## 화면

<p align="center"><img src="https://raw.githubusercontent.com/1989v/muxbar/main/docs/assets/screenshots/menubar.png" alt="메뉴바의 muxbar — 커피잔 위 주간 남은 한도, 오른쪽 위 원 안 세션 수" width="200"></p>

<p align="center"><img src="https://raw.githubusercontent.com/1989v/muxbar/main/docs/assets/screenshots/menu.ko.png" alt="muxbar 메뉴 — 세션 목록, Keep Awake, Closed-lid mode, AI 주간 한도" width="344"></p>

아이콘 하나가 상태 넷을 겹쳐 보여 준다. 메뉴바 폭은 아이콘 하나 그대로다.

| 상태 | 아이콘 |
|---|---|
| 기본 | 빈 커피잔. 밝은 · 어두운 메뉴바를 따라 색이 바뀐다 |
| tmux 세션이 있을 때 | 잔 오른쪽 위 작은 원 안에 세션 수 |
| AI 를 쓸 때 | 잔 받침에 걸친 주간 남은 한도. 둘이면 `56\|57`, 하나면 `56` |
| Keep Awake 켜짐 | 주황 잔. 한도가 없을 때는 김이 난다 |
| Closed-lid mode 켜짐 | 빨간 자물쇠. 한도는 겹치고 세션 수 원은 달지 않는다 |

## 설치

```bash
brew install --cask 1989v/tap/muxbar
brew upgrade --cask muxbar
```

소스에서 빌드하면 Xcode 없이 Command Line Tools 만으로 된다. `/Applications/muxbar.app` 하나만 두고 교체한다.

```bash
git clone https://github.com/1989v/muxbar.git
cd muxbar && ./build.sh open
```

> [!NOTE]
> ad-hoc 서명이라 notarize 되지 않는다. dmg 로 설치하면 첫 실행만 우클릭 → 열기로 연다.

## AI 주간 한도 표시

최근 7일 안에 한도가 관측된 AI 만 사용 중으로 친다. 메뉴바에 띄울 AI 와 순서는 Settings 에서 최대 둘까지 고른다.

| AI | 한도를 읽는 곳 | 세션 토큰을 읽는 곳 |
|---|---|---|
| Claude Code | `~/.claude/rate-limits.json` (statusline 이 씀) | `~/.claude/projects/**.jsonl` |
| Codex | `~/.codex/sessions/**/rollout-*.jsonl` 의 `rate_limits` | 같은 rollout 파일 + `session_index.jsonl` |

메뉴의 한도 줄은 남은 %, 리셋 시각, 마지막 관측 시각을 함께 보여 준다. 남은 한도가 40% 이하면 주황, 15% 이하면 빨강이다. 한도는 60초마다 다시 읽는다.

## Claude Code 한도를 보이게 하는 statusline 설정

Claude Code 의 주간 한도는 statusline 입력 JSON 에만 들어 있다. statusline 스크립트에 아래 블록을 넣으면 muxbar 가 읽는 파일이 생긴다.

```bash
# statusline 스크립트 안, 입력 JSON 을 $input 에 읽어 둔 뒤
rl="$HOME/.claude/rate-limits.json"
old=$(jq -c . "$rl" 2>/dev/null | head -n1)
if printf '%s' "$input" | jq -e --argjson old "${old:-null}" '
    (.rate_limits.seven_day // {}) as $n | ($old.rate_limits.seven_day // {}) as $o
    | ($o.resets_at == null) or (($n.resets_at // 0) > $o.resets_at)
      or (($n.resets_at // 0) == $o.resets_at and ($n.used_percentage // 0) >= ($o.used_percentage // 0))
  ' >/dev/null 2>&1; then
  tmp=$(mktemp "$rl.XXXXXX") \
    && printf '%s' "$input" | jq -c --argjson now "$(date +%s)" '{observed_at: $now, rate_limits}' > "$tmp" \
    && mv -f "$tmp" "$rl" || rm -f "$tmp"
fi
```

| 줄 | 하는 일 |
|---|---|
| `jq -e` 조건 | 같은 주간 창에서 사용률이 줄어드는 값은 버린다. 쉬던 세션이 옛 값으로 덮어쓰는 것을 막는다 |
| `mktemp` | 세션마다 임시 파일을 따로 써서 동시에 써도 JSON 이 깨지지 않는다 |
| `observed_at` | 메뉴에 「N분 전 관측」으로 나간다 |

> [!IMPORTANT]
> statusline 은 Claude Code 가 화면을 그릴 때만 돈다. 한 시간 동안 Claude Code 를 안 쓰면 관측 시각도 한 시간 전에 머문다.

## 이번 주 세션별 토큰

메뉴의 `이번 주 세션별 토큰` 은 Settings 처럼 옆으로 펼치는 메뉴다. 이번 주간 창(리셋 시각 − 7일) 동안 쓴 토큰을 AI 세션 단위로 많이 쓴 순서대로 보여 준다.

```text
Claude · 주간 한도 44.0% 사용 · 36.9M · 세션 4개
  25.5%   21.4M   Retry queue for failed payments · shop-api
  11.7%    9.8M   Checkout page skeleton loading · web
Codex · 주간 한도 43.0% 사용 · 53.7M · 세션 3개
  30.4%   38.0M   Refactor inventory reservation · shop-api
```

| 규칙 | 값 |
|---|---|
| 줄의 % | 주간 한도 100% 중 그 세션이 쓴 몫. 구역 안 합이 구역 제목의 사용률과 같다 |
| 한도를 모르는 AI | 구역 안 토큰 비율 |
| 하위 에이전트 | 부모 세션에 합친다 |
| 줄 수 | AI 구역마다 10줄, 나머지는 `외 N개` |
| 줄 클릭 | 세션 id 복사. `claude --resume <id>` 에 붙여 넣는다 |
| 갱신 | 앱 시작 때 한 번, 메뉴를 열 때마다. 첫 집계 뒤에는 늘어난 로그만 읽는다 |

> [!WARNING]
> 세션 몫은 토큰 수 비율로 나눈 근사치다. 캐시 읽기와 출력 토큰이 한도에서 깎이는 무게가 달라도 같은 1토큰으로 센다.

## Keep Awake 와 Closed-lid mode

둘 다 잠자기를 막지만 막는 범위가 다르다. Keep Awake 는 덮개를 닫으면 잠든다.

| | Keep Awake | Closed-lid mode |
|---|---|---|
| 실행 | `caffeinate -dimsu` 를 tmux 세션 `_muxbar-awake` 로 | `pmset -a disablesleep 1` + `caffeinate -is` |
| 막는 것 | 화면 꺼짐 · 화면보호기 · 유휴 잠자기 | 덮개를 닫았을 때의 잠자기까지 |
| 권한 | 없음 | 관리자 비밀번호 또는 Touch ID |
| 켜는 시간 | 끌 때까지 | 30분 · 1시간 · 4시간 · 8시간 · 무제한 |
| 자동 해제 | 없음 | 타이머 만료 · 전원 분리 · 덮개 열림 · 앱 종료 |
| 단축키 | `⌘⇧A` | 없음 |

Keep Awake 를 끄면 다른 프로그램이 띄운 `caffeinate` 도 함께 끈다. Closed-lid mode 의 `caffeinate` 는 세지도 끄지도 않는다.

> [!NOTE]
> Closed-lid mode 는 전원을 뽑으면 풀린다. 충전기를 꽂은 채로 덮개를 닫아야 계속 돈다.

## tmux 세션 관리

| 기능 | 동작 |
|---|---|
| 세션 목록 | attached 먼저, 그 안에서 최근 생성 순. 작업 폴더를 함께 표시 |
| Attach | Terminal · iTerm2 · Warp · Alacritty · kitty 중 고른 터미널에서 연다 |
| 미리보기 | 세션 이름을 누르면 최근 출력을 ANSI 색 그대로 보여 준다 |
| 새 세션 | 내장 템플릿과 사용자 YAML 템플릿. 오래 도는 스크립트를 한 번에 띄운다 |
| 단축키 | `⌘⇧1` ~ `⌘⇧9` 로 위에서 N번째 세션 attach |
| 언어 | English · 한국어 |
