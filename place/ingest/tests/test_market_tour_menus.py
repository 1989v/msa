from src import market_stores


def test_tour_menu_refresh_calls_once(monkeypatch):
    calls = []
    def request(*args, **kwargs):
        calls.append((args, kwargs))
        return {"data": {"markets": 2, "matched": 3}}
    monkeypatch.setattr(market_stores.place_client, "_request", request)
    assert market_stores.refresh_tour_menus() == {"markets": 2, "matched": 3}
    assert calls == [(("POST", "/internal/markets/tour-menus", {}), {"timeout": 300})]


def test_tour_menu_refresh_failure_is_warning_only(monkeypatch, capsys):
    def request(*args, **kwargs):
        raise TimeoutError("unavailable")
    monkeypatch.setattr(market_stores.place_client, "_request", request)
    assert market_stores.refresh_tour_menus() is None
    assert "WARNING tour menu refresh failed: TimeoutError" in capsys.readouterr().out
