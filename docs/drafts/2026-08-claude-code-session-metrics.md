---
title: Claude Code statusLine 으로 사용량·컨텍스트·시각 상시 표시하기 — showMessageTimestamps 가 안 켜지는 이유
slug: claude-code-session-timestamp-and-usage
category: /tech
summary: 상태줄 하나에 작업 위치 · 컨텍스트 · 5h/7d 사용량 · 마지막 메시지 시각을 담는 스크립트와 그 근거. showMessageTimestamps 는 서버 기능 플래그와 AND 로 묶여 있어 설정만으로는 렌더되지 않는다. Claude Code v2.1.241 · v2.1.250 기준.
---

세션에 시각·소요 시간·남은 사용량·작업 위치를 상시 표시하는 방법과 그 한계. Claude Code **v2.1.241**(1–3절) · **v2.1.250**(4–6절 stdin 계약) 기준.

| 원하는 것 | 방법 | 상태 |
|---|---|---|
| 메시지마다 도착 시각 | `showMessageTimestamps: true` | **기능 플래그로 잠김** |
| 잠긴 동안의 우회 | 훅의 `systemMessage` (토큰 0) | 동작 |
| 답변 끝 `Cooked for Nm Ns` | `showTurnDuration` | 기본 **on** |
| 남은 사용량 상시 표시 | `statusLine` 스크립트 | 설정 키 없음 |
| 작업 디렉토리 · 브랜치 표시 | `statusLine` 스크립트 + `git` | 브랜치는 stdin 에 없음 |
| 마지막 메시지 시각 표시 | `statusLine` 스크립트 + transcript | 시각도 stdin 에 없음 |

## 완성 화면과 설치

```
msa (main) · Opus 5 (1M context) [█░░░░░░░░░] 16% · 5h [░░░░░░░░░░] 1% (4h44m) · 7d [░░░░░░░░░░] 9% (6d1h) · 08/28 18:12:33
```

| 칸 | 뜻 |
|---|---|
| `msa (main)` | 작업 디렉토리 · git 브랜치 |
| `Opus 5 (1M context)` | 모델 표시 이름 |
| `[█░░░░░░░░░] 16%` | 컨텍스트 창 사용률 |
| `5h [░░░░░░░░░░] 1% (4h44m)` | 구독 5시간 창 사용량 · 리셋까지 남은 시간 |
| `7d [░░░░░░░░░░] 9% (6d1h)` | 구독 7일 창 사용량 · 리셋까지 남은 시간 |
| `08/28 18:12:33` | 마지막 메시지 시각 |

게이지 셋은 같은 눈금(10칸)과 같은 색 기준을 쓴다. 60% 미만 초록 · 85% 미만 노랑 · 그 이상 빨강이다.

설치는 두 단계다.

1. 아래 스크립트를 `~/.claude/statusline-command.sh` 에 저장하고 `chmod +x` 한다.
2. `~/.claude/settings.json` 에 `statusLine` 블록을 넣는다.

```bash
#!/usr/bin/env bash
# Status line: dir/branch, model, context-window bar, Claude.ai 5h/7d usage bars
# with time-to-reset, and the last message timestamp.
# rate_limits is absent on non-subscription billing and before the first API response.
input=$(cat)
now=$(date +%s)

j() { printf '%s' "$input" | jq -r "$1"; }

# usage %(5h·7d 중 최댓값)를 캐시 — Stop 훅 payload엔 rate_limits 가 없어서 여기서 넘긴다
u5=$(j '.rate_limits.five_hour.used_percentage // empty')
u7=$(j '.rate_limits.seven_day.used_percentage // empty')
if [ -n "$u5$u7" ]; then
  printf '%.0f\n' "$(printf '%s\n%s\n' "${u5:-0}" "${u7:-0}" | sort -g | tail -1)" \
    > "${TMPDIR:-/tmp}/claude-usage.pct" 2>/dev/null
fi

# green < 60% <= yellow < 85% <= red
color_for() {
  if   (( $1 < 60 )); then printf '\033[32m'
  elif (( $1 < 85 )); then printf '\033[33m'
  else                     printf '\033[31m'
  fi
}

# seconds -> 43m / 2h14m / 2d5h
humanize() {
  local s=$1
  if   (( s < 3600 ));  then printf '%dm' "$(( s / 60 ))"
  elif (( s < 86400 )); then printf '%dh%dm' "$(( s / 3600 ))" "$(( s % 3600 / 60 ))"
  else
    local d=$(( s / 86400 )) h=$(( s % 86400 / 3600 ))
    (( h > 0 )) && printf '%dd%dh' "$d" "$h" || printf '%dd' "$d"
  fi
}

segments=10

# 0-100 -> [████░░░░░░] · 컨텍스트와 사용량이 같은 눈금을 쓴다
gauge() {
  local filled=$(( $1 * segments / 100 )) i bar=""
  (( filled > segments )) && filled=$segments
  (( filled < 0 )) && filled=0
  for ((i = 0;      i < filled;   i++)); do bar="${bar}█"; done
  for ((i = filled; i < segments; i++)); do bar="${bar}░"; done
  printf '%s' "$bar"
}

# 작업 위치 — 잘림에 먼저 먹히지 않도록 맨 앞에 둔다.
# 브랜치는 stdin 계약에 없어서(worktree.branch 는 --worktree 세션 전용) git 에 직접 묻는다.
dir=$(j '.workspace.current_dir // .cwd // empty')
if [ -n "$dir" ]; then
  printf '\033[1m%s\033[0m' "$(basename "$dir")"
  branch=$(git -C "$dir" symbolic-ref --quiet --short HEAD 2>/dev/null) ||
    branch=$(git -C "$dir" rev-parse --short HEAD 2>/dev/null)
  [ -n "$branch" ] && printf ' \033[36m(%s)\033[0m' "$branch"
  printf ' \033[90m·\033[0m '
fi

model=$(j '.model.display_name')
pct=$(j '(.context_window.used_percentage // 0) | floor')

printf '%s %s[%s] %d%%\033[0m' "$model" "$(color_for "$pct")" "$(gauge "$pct")" "$pct"

for window in five_hour:5h seven_day:7d; do
  key=${window%%:*}
  label=${window##*:}

  raw=$(j ".rate_limits.${key}.used_percentage // empty")
  [ -n "$raw" ] || continue
  used=$(printf '%.0f' "$raw")
  printf ' \033[90m·\033[0m %s %s[%s] %d%%\033[0m' \
    "$label" "$(color_for "$used")" "$(gauge "$used")" "$used"

  resets=$(j ".rate_limits.${key}.resets_at // empty")
  resets=${resets%%.*}
  [[ $resets =~ ^[0-9]+$ ]] || continue
  left=$(( resets - now ))
  (( left > 0 )) && printf ' \033[90m(%s)\033[0m' "$(humanize "$left")"
done

# 마지막 메시지 시각 — payload 에 없어서 transcript 마지막 줄에서 읽는다.
# 쓰는 중이라 깨진 줄이 섞일 수 있어 fromjson? 로 흘려보낸다.
tp=$(j '.transcript_path // empty')
if [ -f "$tp" ]; then
  last=$(tail -n 40 "$tp" 2>/dev/null | jq -rRs '
    [splits("\n") | fromjson? | .timestamp // empty] | last // empty
    | sub("\\.[0-9]+";"") | fromdateiso8601 | strflocaltime("%m/%d %H:%M:%S")' 2>/dev/null)
  [ -n "$last" ] && printf ' \033[90m· %s\033[0m' "$last"
fi
```

```json
{
  "statusLine": {
    "type": "command",
    "command": "~/.claude/statusline-command.sh",
    "refreshInterval": 60
  }
}
```

값이 없는 칸은 그 칸만 빠지고 나머지는 그대로 그려진다. 각 칸의 데이터 출처는 4–6절에 있다.


## 1. 시각 표시 설정은 있지만 잠겨 있다

두 키 모두 `theme` · `verbose` · `editorMode` 와 같은 user settings 묶음이다. `/config` 토글이 바꾸는 값과 `~/.claude/settings.json` 의 값은 같다.

```json
{ "showMessageTimestamps": true }
```

이 한 줄을 넣어도 화면에는 아무것도 나오지 않는다. 렌더 지점이 설정값 단독이 아니라 **AND 게이트**다.

```js
q = Tt((W) => W.showMessageTimestamps) && nt("tengu_silk_hinge", !1)
```

`nt(flag, default)` 는 GrowthBook 기능 플래그 조회다. 계정 캐시값은 `~/.claude.json` 의 `cachedGrowthBookFeatures` 에 있고, 2026-08-25 기준 `tengu_silk_hinge` 는 `false` 다.

`/config` 의 "Show message timestamps" 행도 같은 플래그로 감싸여 있다. 설정이 실제로 살아 있는지 확인하는 가장 싼 방법이 이거다 — **플래그로 가려진 기능은 토글 행 자체가 없다.**

`showTurnDuration` 은 기본값이 `true` 이고 플래그도 없다. 끌 때만 명시한다.

## 2. 플래그는 로컬에서 켤 수 없다

해석 순서는 다섯 단계다.

1. env override
2. config override
3. 서버 payload
4. 디스크 캐시
5. 기본값

앞의 두 단계는 이 빌드에서 **도달 불가 코드**다.

```js
getEnvironmentOverrides(){
  if(this.environmentOverridesParsed) return this.environmentOverrides;
  return this.environmentOverridesParsed=!0, this.environmentOverrides;  // ← 여기서 리턴
  let e=this.deps.readEnvironmentOverrides();                            // ← 도달 불가
  ...
}
readConfigOverrides(){ return }                                          // ← 빈 함수
```

남는 경로는 디스크 캐시(`cachedGrowthBookFeatures`)를 직접 `true` 로 고치는 것뿐이다. 서버 eval 이 한 번 성공하면 `remoteEvalFeatureValues` 가 우선권을 가져가고 `syncRemoteEvalToDisk()` 가 파일을 다시 쓴다. 그 세션 안에서 잠깐 먹고 되돌아간다.

> [!note] 규칙
> **설정 키가 존재한다 ≠ 그 기능이 내 계정에서 동작한다.** 스키마에 있는 키를 넣고 "적용됐다"고 쓰기 전에, 렌더 지점이 플래그와 AND 로 묶여 있는지 본다.

## 3. 잠긴 동안의 우회는 훅의 systemMessage

훅이 돌려주는 JSON 에는 성격이 정반대인 두 필드가 있다. 시각 표시에 쓸 수 있는 쪽은 하나뿐이다.

| 필드 | 어디로 가나 | 토큰 | 시각 표시에 |
|---|---|---|---|
| `hookSpecificOutput.additionalContext` | 모델 컨텍스트 | 든다 | 부적합 |
| `systemMessage` | 화면 (사용자 알림) | 0 | 적합 |

`systemMessage` 는 이벤트별 필드가 아니라 훅 출력 **공통 스키마**에 있다. 그래서 `UserPromptSubmit` 과 `Stop` 양쪽에서 그대로 쓴다.

```json
{
  "hooks": {
    "UserPromptSubmit": [{ "hooks": [{ "type": "command",
      "command": "date '+{\"systemMessage\":\"질문 %m/%d %H:%M:%S\"}'" }] }],
    "Stop":             [{ "hooks": [{ "type": "command",
      "command": "date '+{\"systemMessage\":\"답변 %m/%d %H:%M:%S\"}'" }] }]
  }
}
```

`date` 의 포맷 문자열이 곧 JSON 이다. jq 도 중간 셸 이스케이프 단계도 거치지 않는다. 설정에 넣기 전에 파이프로 먼저 확인한다.

```bash
echo '{}' | sh -c "date '+{\"systemMessage\":\"답변 %m/%d %H:%M:%S\"}'" | jq -e .systemMessage
```

한계는 셋이다.

- 메시지에 붙지 않고 **별도 알림 줄**로 뜬다 (스키마상 `systemMessage` = "Display a message to the user").
- `Stop` 은 `/clear` · `/compact` · resume 에서도 걸려 그때도 한 줄 남는다.
- **소급되지 않는다.** 훅을 넣은 시점부터 찍히고 스크롤백의 과거 메시지는 그대로다.

날짜는 세션이 자정을 넘기는 경우 때문에 질문·답변 양쪽에 `%m/%d` 를 붙인다. 답변 쪽에만 붙이면 자정을 넘긴 뒤의 질문 줄이 어느 날짜인지 확인되지 않는다.

## 4. 남은 사용량은 statusLine 이 유일한 경로

상시 표시용 설정 키는 없다. `/usage` 는 단발 조회고, 계속 보이게 하려면 상태줄을 직접 그린다.

`refreshInterval` 은 **초** 단위이며 내부적으로 `max(1, t) * 1000` ms 로 환산된다. 1초 미만은 없다.

### stdin 계약

스크립트는 stdin 으로 JSON 한 덩어리를 받는다. 상태줄에 쓰는 필드는 다섯이다.

| 경로 | 형 | 주의 |
|---|---|---|
| `.model.display_name` | string | `Opus 5` 등 |
| `.workspace.current_dir` | string | 세션의 프로젝트 cwd |
| `.transcript_path` | string | 대화 JSONL 경로 |
| `.context_window.used_percentage` | number | 0–100 |
| `.rate_limits.five_hour` / `.seven_day` | object | `{ used_percentage, resets_at }` |

- `used_percentage` 는 내부 `utilization`(0–1 분수)에 100을 곱한 값이라 소수가 섞인다 (`31.4`).
- `resets_at` 은 **epoch 초(number)** 다. ISO 8601 문자열이 아니다.
- 번들 안에 `resets_at` 을 ISO 문자열로 기술한 스키마가 따로 있다. 상태줄로 오는 객체는 그쪽이 아니다.
- 창은 `five_hour` · `seven_day` 둘뿐이다. 내부의 `seven_day_opus` · `seven_day_sonnet` 은 오지 않는다.
- **git 브랜치는 계약에 없다.** `.workspace.git_worktree` 는 링크 워크트리의 *이름*이다.
- 브랜치를 담은 `.worktree.branch` 는 `--worktree` 세션에만 실린다. 일반 세션에서는 `git` 에 직접 물어야 한다.
- **마지막 메시지 시각도 계약에 없다.** `.transcript_path` 가 가리키는 JSONL 의 마지막 줄에서 `timestamp` 를 읽는다.
- 그 파일은 **지금 쓰이는 중**이라 마지막 줄이 잘려 있을 수 있다. 줄 단위로 `fromjson?` 을 걸어 흘려보낸다.

> [!warning] `rate_limits` 는 조건부 키다
> 조립부가 `...(A.five_hour || A.seven_day) && { rate_limits: A }` 형태다. **두 창이 다 없으면 키 자체가 안 실린다.**
> 구독이 아닌 과금 경로(API 키 · Bedrock · Vertex)와 첫 API 응답 전이 그 조건이다.
> `.rate_limits.five_hour.used_percentage` 를 무조건 읽는 스크립트는 여기서 죽고, 상태줄은 에러가 아니라 **빈 줄**로 사라진다.

## 5. 스크립트가 지키는 것

스크립트 전문은 맨 위에 있다. 아래는 그렇게 짠 이유다.

게이지는 함수 하나(`gauge`)로 뽑아 컨텍스트와 사용량이 같은 눈금을 쓰게 한다. 작업 위치는 맨 앞에 둔다.

Claude Code 는 상태줄을 `wrap: "truncate"` 로 그린다. 터미널이 좁으면 **뒤가 잘리므로**, 자주 보는 값일수록 앞에 온다.

`claude-usage.pct` 캐시는 `Stop` 훅을 위한 것이다. 훅 payload 에는 `rate_limits` 가 없어서, 사용량을 아는 유일한 지점인 상태줄이 파일로 넘긴다.

방어 지점은 여섯이다.

| 코드 | 막는 것 |
|---|---|
| `// empty` + `continue` | 키가 없을 때 스크립트 종료 |
| `left > 0` 검사 | 리셋 직전 구간의 음수 카운트다운 `(-3m)` |
| `color_for` · `gauge` 공용 | 컨텍스트 바와 사용량 바의 눈금 · 임계값 불일치 (10칸, 60/85 공유) |
| `symbolic-ref` 실패 시 `rev-parse` | detached HEAD 에서 브랜치 칸이 통째로 사라짐 |
| `[ -n "$dir" ]` 가드 | `workspace` 가 없는 payload 에서 `basename` 이 빈 인자로 호출됨 |
| `fromjson?` 줄 단위 파싱 | 쓰이는 중인 transcript 의 잘린 마지막 줄이 시각 칸을 통째로 날림 |

## 6. 검증

상태줄은 실패해도 조용하다. 화면을 기다리는 대신 stdin 을 직접 만들어 먹인다.

```bash
now=$(date +%s)
printf '{"model":{"display_name":"Opus 5"},"workspace":{"current_dir":"'"$PWD"'"},
"context_window":{"used_percentage":42},
"rate_limits":{"five_hour":{"used_percentage":31.4,"resets_at":'$((now+8040))'},
"seven_day":{"used_percentage":89,"resets_at":'$((now+190800))'}}}' \
  | ~/.claude/statusline-command.sh
```

2026-08-28 실측 (색 코드 제거). 앞의 다섯은 `msa` 저장소의 `main` 에서 잰 값이다.

| 입력 | 출력 |
|---|---|
| 5h · 7d 정상 | `msa (main) · Opus 5 [████░░░░░░] 42% · 5h [███░░░░░░░] 31% (2h14m) · 7d [████████░░] 89% (2d5h)` |
| `transcript_path` 붙음 | `msa (main) · Opus 5 [████░░░░░░] 42% · 5h [███░░░░░░░] 31% (2h14m) · 08/28 18:16:34` |
| `resets_at` 이 이미 지남 | `msa (main) · Opus 5 [████░░░░░░] 42% · 7d [█░░░░░░░░░] 12%` |
| `resets_at` 없음 | `msa (main) · Opus 5 [████░░░░░░] 42% · 5h [░░░░░░░░░░] 5%` |
| `rate_limits` 키 없음 | `msa (main) · Opus 5 [████░░░░░░] 42%` |
| transcript 마지막 줄이 잘림 | `msa (main) · Opus 5 [████░░░░░░] 42% · 08/28 10:02:03` — 직전 줄의 시각 |
| transcript 가 빈 파일 · 경로 없음 | `msa (main) · Opus 5 [████░░░░░░] 42%` — 시각 칸만 생략 |
| detached HEAD | `gt (d8274ac) · Opus 5 [░░░░░░░░░░] 7%` |
| git 저장소 밖 | `tmp · Opus 5 [██████████] 100%` |
| `workspace` 키 없음 | `Opus 5 [████░░░░░░] 42%` |

통과 기준은 하나다. 열 경우 전부 바(bar)가 살아 있을 것 — 값 하나를 못 그리는 것보다 상태줄이 통째로 사라지는 쪽이 훨씬 나쁘다.