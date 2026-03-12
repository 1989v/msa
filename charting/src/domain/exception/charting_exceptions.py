"""Domain exceptions — no framework imports allowed."""


class InsufficientDataError(Exception):
    """Raised when there is not enough OHLCV data to build a 60-day pattern."""

    def __init__(self, ticker: str, available: int, required: int = 60) -> None:
        self.ticker = ticker
        self.available = available
        self.required = required
        super().__init__(
            f"Insufficient data for '{ticker}': {available} bars available, {required} required."
        )


class InvalidSymbolError(Exception):
    """Raised when a ticker symbol is not recognized or not registered."""

    def __init__(self, ticker: str) -> None:
        self.ticker = ticker
        super().__init__(f"Symbol '{ticker}' is not valid or not registered.")
