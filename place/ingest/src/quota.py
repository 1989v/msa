"""외부 API 쿼터 장부 — JVM 과 **같은 Redis 키**를 증가시킨다 (ADR-0082).

이 파일이 존재하는 이유는 하나다. 쿼터는 API 키(제공자 계정)에 붙는데 호출하는 주체는
JVM(quant·deal)과 Python(여기)으로 나뉘어 있다. 각자 세면 합쳐서 넘겨도 아무도 모른다.

**키 포맷이 언어 간 계약이다.** `RedisExternalApiQuotaLedger.keyOf` 와 한 글자도 달라선 안 된다:

    external-api-quota:{provider}:{yyyy-MM-dd}      (날짜는 KST 고정)

포맷이 어긋나면 합산이 **조용히** 깨진다 — 양쪽 다 자기 키만 보며 정상 동작한다.
그래서 양쪽에 같은 값을 검사하는 테스트를 둔다.

서드파티 의존을 쓰지 않는다(RESP 를 직접 말한다) — 이 이미지는 표준 라이브러리만 쓰는 것이
의도이고(Dockerfile 참조), 카운터 하나 때문에 그 성질을 깨지 않는다.
"""
from __future__ import annotations

import datetime as _dt
import os
import socket
import sys
from typing import Optional

# ── provider — common 의 ExternalApiProvider.key 와 같은 문자열이어야 한다 ──
NAVER_SEARCH = "naver-search"
YOUTUBE_DATA = "youtube-data"
GOOGLE_PLACES = "google-places"
DATA_GO_KR = "data-go-kr"

#: provider → 일일 한도. None 이면 막지 않고 세기만 한다.
#: **한도는 제공자가 정한 값이지 조절 손잡이가 아니다.**
DAILY_LIMIT = {
    NAVER_SEARCH: 25_000,     # 제공자 공표
    YOUTUBE_DATA: 10_000,     # 제공자 공표 (units — search.list 는 건당 100)
    GOOGLE_PLACES: 1_000,     # 자체 상한 (무과금이지만 상한 없이 돌리지 않는다)
    DATA_GO_KR: None,         # 제공자가 공개하지 않음 → 관측만
}

KST = _dt.timezone(_dt.timedelta(hours=9))


def key_of(provider: str, day: Optional[_dt.date] = None) -> str:
    """언어 간 계약. JVM 의 keyOf 와 같은 문자열을 만든다."""
    d = day or _dt.datetime.now(KST).date()
    return f"external-api-quota:{provider}:{d.isoformat()}"


class _Resp:
    """INCRBY / EXPIRE / GET 만 쓰는 최소 RESP 클라이언트."""

    def __init__(self, host: str, port: int, timeout: float = 2.0) -> None:
        self._sock = socket.create_connection((host, port), timeout=timeout)
        self._buf = self._sock.makefile("rb")

    def command(self, *args: str) -> object:
        out = [f"*{len(args)}\r\n".encode()]
        for a in args:
            b = str(a).encode()
            out.append(b"$%d\r\n%s\r\n" % (len(b), b))
        self._sock.sendall(b"".join(out))
        return self._read()

    def _read(self) -> object:
        line = self._buf.readline()
        if not line:
            raise ConnectionError("redis 연결이 끊겼다")
        tag, body = line[:1], line[1:].strip()
        if tag == b":":
            return int(body)
        if tag == b"+":
            return body.decode()
        if tag == b"-":
            raise RuntimeError(f"redis 오류: {body.decode()}")
        if tag == b"$":
            n = int(body)
            if n == -1:
                return None
            data = self._buf.read(n + 2)[:n]
            return data.decode()
        raise RuntimeError(f"해석할 수 없는 응답: {line!r}")

    def close(self) -> None:
        try:
            self._sock.close()
        except OSError:
            pass


class QuotaLedger:
    """`REDIS_HOST`/`REDIS_PORT` 로 붙는다. 미설정이면 **비활성**(항상 통과 + 경고 1회)."""

    def __init__(self, host: Optional[str] = None, port: Optional[int] = None) -> None:
        self.host = host or os.environ.get("REDIS_HOST")
        self.port = int(port or os.environ.get("REDIS_PORT", "6379"))
        self._warned = False

    def _connect(self) -> Optional[_Resp]:
        if not self.host:
            if not self._warned:
                print("[quota] REDIS_HOST 미설정 — 쿼터 장부 비활성(호출을 세지 않는다)", file=sys.stderr)
                self._warned = True
            return None
        return _Resp(self.host, self.port)

    def try_acquire(self, provider: str, cost: int = 1) -> bool:
        """호출 **직전에** 부른다. 성공·빈결과·실패 전부 1콜로 센다 — 되돌리지 않는다."""
        if cost < 1:
            raise ValueError(f"cost 는 1 이상: {cost}")
        conn = None
        try:
            conn = self._connect()
            if conn is None:
                return True
            key = key_of(provider)
            after = conn.command("INCRBY", key, cost)
            if after == cost:  # 첫 증가일 때만 만료를 건다
                conn.command("EXPIRE", key, _seconds_until_midnight())
        except Exception as exc:  # noqa: BLE001
            # fail-open: 쿼터 초과는 다음 날 회복되지만 수집 중단은 회복되지 않는다.
            print(f"[quota] 장부 접근 실패 — 통과시킨다(fail-open): {exc}", file=sys.stderr)
            return True
        finally:
            if conn is not None:
                conn.close()

        limit = DAILY_LIMIT.get(provider)
        if limit is None or after <= limit:
            return True
        print(f"[quota] 일일 한도 초과로 차단 — {provider} used={after} limit={limit}", file=sys.stderr)
        return False

    def used(self, provider: str) -> int:
        conn = None
        try:
            conn = self._connect()
            if conn is None:
                return 0
            return int(conn.command("GET", key_of(provider)) or 0)
        except Exception as exc:  # noqa: BLE001
            print(f"[quota] 사용량 조회 실패 — 0 으로 본다: {exc}", file=sys.stderr)
            return 0
        finally:
            if conn is not None:
                conn.close()


def _seconds_until_midnight() -> int:
    now = _dt.datetime.now(KST)
    tomorrow = (now + _dt.timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    return max(1, int((tomorrow - now).total_seconds()))
