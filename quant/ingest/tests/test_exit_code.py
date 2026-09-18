"""잡 종료 판정 — 하나도 성공 못 했는데 실패가 있으면 잡 실패."""
import pytest

from src import scheduler


def test_all_failed_is_job_failure():
    assert scheduler.exit_code(ok=0, failed=3) == 1


def test_partial_failure_keeps_job_green():
    assert scheduler.exit_code(ok=2, failed=1) == 0


def test_nothing_to_do_is_not_failure():
    assert scheduler.exit_code(ok=0, failed=0) == 0


def test_finish_exits_nonzero_when_all_failed():
    with pytest.raises(SystemExit) as e:
        scheduler._finish("ohlcv", ok=0, failed=2, rows=0)
    assert e.value.code == 1


def test_finish_returns_when_something_succeeded():
    scheduler._finish("ohlcv", ok=1, failed=5, rows=10)
