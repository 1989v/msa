"""SQLAlchemy ORM models for the Charting service."""
from datetime import date, datetime, time

from pgvector.sqlalchemy import Vector
from sqlalchemy import (
    BigInteger,
    Boolean,
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Time,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class SymbolOrm(Base):
    __tablename__ = "symbols"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    ticker: Mapped[str] = mapped_column(String(20), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    market: Mapped[str] = mapped_column(String(20), nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    ohlcv_bars: Mapped[list["OhlcvBarOrm"]] = relationship(back_populates="symbol")
    patterns: Mapped[list["PatternOrm"]] = relationship(back_populates="symbol")


class OhlcvBarOrm(Base):
    __tablename__ = "ohlcv_bars"
    __table_args__ = (
        UniqueConstraint("symbol_id", "trade_date", "interval", "bar_time"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    symbol_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("symbols.id"), nullable=False
    )
    trade_date: Mapped[date] = mapped_column(Date, nullable=False)
    open: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    high: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    low: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    close: Mapped[float] = mapped_column(Numeric(18, 6), nullable=False)
    volume: Mapped[int] = mapped_column(BigInteger, nullable=False)
    interval: Mapped[str] = mapped_column(String(5), nullable=False, server_default="1d")
    bar_time: Mapped[time] = mapped_column(Time, nullable=False, server_default=text("'00:00:00'"))

    symbol: Mapped["SymbolOrm"] = relationship(back_populates="ohlcv_bars")


class PatternOrm(Base):
    __tablename__ = "patterns"
    __table_args__ = (UniqueConstraint("symbol_id", "window_start"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    symbol_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("symbols.id"), nullable=False
    )
    window_start: Mapped[date] = mapped_column(Date, nullable=False)
    window_end: Mapped[date] = mapped_column(Date, nullable=False)
    embedding: Mapped[list] = mapped_column(Vector(32), nullable=False)
    return_5d: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    return_20d: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    return_60d: Mapped[float | None] = mapped_column(Numeric(10, 6), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    symbol: Mapped["SymbolOrm"] = relationship(back_populates="patterns")
