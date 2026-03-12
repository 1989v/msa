"""RegisterSymbolUseCase — registers a new tracked symbol."""
import structlog

from src.domain.exception.charting_exceptions import InvalidSymbolError
from src.domain.model.symbol import Symbol
from src.domain.port.symbol_repository_port import SymbolRepositoryPort

logger = structlog.get_logger(__name__)


class RegisterSymbolUseCase:
    def __init__(self, symbol_repo: SymbolRepositoryPort) -> None:
        self._symbol_repo = symbol_repo

    def execute(self, ticker: str, name: str, market: str) -> Symbol:
        existing = self._symbol_repo.find_by_ticker(ticker)
        if existing:
            logger.info("Symbol already registered", ticker=ticker)
            return existing

        symbol = Symbol(ticker=ticker.upper(), name=name, market=market)
        saved = self._symbol_repo.save(symbol)
        logger.info("Symbol registered", ticker=ticker, id=saved.id)
        return saved
