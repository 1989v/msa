"""인기 집계 조회의 ClickHouse 계정 — 계정 없이 부르면 default 로 들어가 운영 ClickHouse 가 403 으로 거부한다.

links 잡이 몇 주 동안 매 회차 「조회 거부 HTTP 403 — 인기순 없이 진행한다」 한 줄만 남기고 돌았다.
"""
from __future__ import annotations

import urllib.error

from src import popularity
from tests.crawl_stats_k8s_test import K8S, _one


class _Res:
    def __init__(self, body: bytes):
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, *a):
        return False

    def read(self):
        return self.body


def test_query_sends_account_headers(monkeypatch):
    monkeypatch.setenv("CLICKHOUSE_USER", "analytics")
    monkeypatch.setenv("CLICKHOUSE_PASSWORD", "pw")
    sent = []

    def fake_urlopen(req, timeout):
        sent.append(req)
        return _Res(b"11299\n42\n")

    monkeypatch.setattr(popularity.urllib.request, "urlopen", fake_urlopen)

    assert popularity.top_attraction_ids(5) == [11299, 42]
    assert sent[0].get_header("X-clickhouse-user") == "analytics"
    assert sent[0].get_header("X-clickhouse-key") == "pw"


def test_forbidden_logs_error_and_continues_without_ranking(monkeypatch, capsys):
    calls = []

    def forbidden(req, timeout):
        calls.append(req)
        raise urllib.error.HTTPError(req.full_url, 403, "Forbidden", {}, None)

    monkeypatch.setattr(popularity.urllib.request, "urlopen", forbidden)

    assert popularity.top_attraction_ids(5) == []
    assert len(calls) == 1
    err = capsys.readouterr().err
    assert "[popularity] ERROR 조회 거부 HTTP 403" in err
    assert "CLICKHOUSE_USER/PASSWORD" in err


def test_links_cronjob_carries_clickhouse_account():
    cron = _one(K8S / "base/place-ingest/cronjob-links.yaml", "CronJob", "place-ingest-links")
    container = cron["spec"]["jobTemplate"]["spec"]["template"]["spec"]["containers"][0]
    env = {e["name"]: e.get("value") for e in container["env"]}
    assert env["CLICKHOUSE_USER"] == "analytics"
    assert env["CLICKHOUSE_PASSWORD"] == "analytics"
