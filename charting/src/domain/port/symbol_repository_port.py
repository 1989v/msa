"""Port — symbol persistence abstraction. No framework imports."""
from abc import ABC, abstractmethod

from src.domain.model.symbol import Symbol


class SymbolRepositoryPort(ABC):
    @abstractmethod
    def save(self, symbol: Symbol) -> Symbol:
        """Persist a new symbol and return it with a populated id."""

    @abstractmethod
    def find_by_ticker(self, ticker: str) -> Symbol | None:
        """Return the Symbol for the given ticker, or None if not found."""

    @abstractmethod
    def find_all_active(self) -> list[Symbol]:
        """Return all active symbols."""
