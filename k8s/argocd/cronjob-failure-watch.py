"""예약 잡 실패 감시 — 실패 중인 CronJob 을 찾아 텔레그램으로 알린다.

판정 근거는 쿠버네티스가 기록한 값뿐이다: CronJob 의 `status.lastSuccessfulTime` 과,
그 CronJob 이 만든 Job 의 `Failed` 조건 시각. 마지막 성공보다 뒤에 실패로 끝난 Job 이 있으면 실패 중이다.

알리는 때는 셋이다.
  - 직전 실행 이후 새로 실패한 것이 있을 때
  - 하루 한 번(요약 시각), 실패 중인 것이 남아 있을 때
  - 주 한 번(요약 시각), 실패가 없어도 — 감시 자체가 살아 있다는 신호
"""
from __future__ import annotations

import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

API = "https://kubernetes.default.svc"
SA = "/var/run/secrets/kubernetes.io/serviceaccount"
KST = timezone(timedelta(hours=9))
INTERVAL = timedelta(hours=1)                                # CronJob 주기와 같아야 한다 — 다르면 새 실패를 놓치거나 두 번 알린다
RUN_MINUTE = int(os.environ.get("RUN_MINUTE", "7"))          # CronJob schedule 의 분
DIGEST_HOUR_KST = int(os.environ.get("DIGEST_HOUR_KST", "9"))
HEARTBEAT_WEEKDAY = int(os.environ.get("HEARTBEAT_WEEKDAY", "0"))   # 0 = 월요일(KST)
LABEL = os.environ.get("ALERT_LABEL", "1989v")


def parse(ts: str | None) -> datetime | None:
    return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc) if ts else None


def failing(cronjobs: list[dict], jobs: list[dict]) -> list[dict]:
    """실패 중인 CronJob. 정지(suspend)된 것은 뺀다 — 안 도는 것은 실패가 아니다."""
    by_owner: dict[str, list[dict]] = {}
    for job in jobs:
        for owner in job["metadata"].get("ownerReferences") or []:
            if owner.get("kind") == "CronJob":
                by_owner.setdefault(owner["uid"], []).append(job)
    out = []
    for cj in cronjobs:
        if cj["spec"].get("suspend"):
            continue
        ok = parse((cj.get("status") or {}).get("lastSuccessfulTime"))
        fails = []
        for job in by_owner.get(cj["metadata"]["uid"], []):
            for cond in (job.get("status") or {}).get("conditions") or []:
                if cond.get("type") == "Failed" and cond.get("status") == "True":
                    at = parse(cond.get("lastTransitionTime"))
                    if at and (ok is None or at > ok):
                        fails.append((at, cond.get("reason") or "?"))
        if fails:
            fails.sort()
            out.append({"ns": cj["metadata"]["namespace"], "name": cj["metadata"]["name"],
                        "last": fails[-1][0], "reason": fails[-1][1], "count": len(fails), "ok": ok})
    return sorted(out, key=lambda f: (f["ns"], f["name"]))


def scheduled_tick(now: datetime) -> datetime:
    """이번 실행의 예약 시각. 실제 시작은 몇 초 늦으므로 시계가 아니라 예약 시각으로 구간을 끊는다."""
    tick = now.replace(minute=RUN_MINUTE, second=0, microsecond=0)
    return tick if tick <= now else tick - INTERVAL


def _when(t: datetime | None) -> str:
    return t.astimezone(KST).strftime("%m-%d %H:%M") if t else "없음"


def _line(f: dict) -> str:
    return (f"• {f['ns']}/{f['name']} — {_when(f['last'])} 실패({f['reason']}, 남은 실패 기록 {f['count']}건)"
            f" · 마지막 성공 {_when(f['ok'])}")


def message(fails: list[dict], watched: int, now: datetime) -> str | None:
    """보낼 글. 보낼 것이 없으면 None."""
    tick = scheduled_tick(now)
    local = tick.astimezone(KST)
    if local.hour == DIGEST_HOUR_KST:
        if fails:
            return "\n".join([f"[{LABEL}] 실패 중인 예약 잡 {len(fails)}건 (하루 한 번 요약, 시각은 KST)"] + [_line(f) for f in fails])
        if local.weekday() == HEARTBEAT_WEEKDAY:
            return f"[{LABEL}] 예약 잡 감시 정상 — 실패 0건 / 감시 대상 {watched}개 (주 한 번 생존 신호)"
        return None
    fresh = [f for f in fails if tick - INTERVAL < f["last"] <= tick]
    if fresh:
        return "\n".join([f"[{LABEL}] 예약 잡 실패 {len(fresh)}건 (시각은 KST)"] + [_line(f) for f in fresh])
    return None


def _k8s(path: str) -> dict:
    token = open(f"{SA}/token").read()
    ctx = ssl.create_default_context(cafile=f"{SA}/ca.crt")
    req = urllib.request.Request(API + path, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(req, timeout=30, context=ctx) as resp:
        return json.load(resp)


def _send(token: str, chat_id: str, text: str) -> None:
    data = urllib.parse.urlencode({"chat_id": chat_id, "text": text, "disable_web_page_preview": "true"}).encode()
    req = urllib.request.Request(f"https://api.telegram.org/bot{token}/sendMessage", data=data)
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.load(resp)
    except urllib.error.HTTPError as e:
        # 주소에 토큰이 들어 있다 — 예외를 그대로 찍지 않고 상태 코드만 남긴다
        raise SystemExit(f"[watch] 텔레그램 전송 실패: HTTP {e.code}") from None
    except urllib.error.URLError as e:
        raise SystemExit(f"[watch] 텔레그램 전송 실패: {e.reason}") from None
    if not body.get("ok"):
        raise SystemExit(f"[watch] 텔레그램이 거부했다: {body.get('description')}")


def main() -> int:
    now = datetime.now(timezone.utc)
    cronjobs = _k8s("/apis/batch/v1/cronjobs")["items"]
    jobs = _k8s("/apis/batch/v1/jobs")["items"]
    watched = sum(1 for cj in cronjobs if not cj["spec"].get("suspend"))
    fails = failing(cronjobs, jobs)
    text = message(fails, watched, now)
    print(f"[watch] 감시 대상 {watched} · 실패 중 {len(fails)} · 이번에 알림 {'있음' if text else '없음'}")
    for f in fails:
        print("[watch] " + _line(f))
    dry = os.environ.get("DRY_RUN") == "1"
    token, chat_id = os.environ.get("TELEGRAM_BOT_TOKEN"), os.environ.get("TELEGRAM_CHAT_ID")
    if not dry and not (token and chat_id):
        # 알릴 길이 없는 감시는 켜져 있다고 믿게만 만든다 — 실패가 없어도 잡을 실패시켜 드러낸다
        print("[watch] 텔레그램 시크릿(job-alert-telegram 의 token · chat-id)이 없다 — 알릴 수 없다")
        return 1
    if text is None:
        return 0
    if dry:
        print("[watch] DRY_RUN — 보내지 않는다:\n" + text)
        return 0
    _send(token, chat_id, text)
    print("[watch] 텔레그램 전송 완료")
    return 0


if __name__ == "__main__":
    sys.exit(main())
