"""Add interval and bar_time columns to ohlcv_bars for intraday support

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-19 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ohlcv_bars",
        sa.Column("interval", sa.String(5), nullable=False, server_default="1d"),
    )
    op.add_column(
        "ohlcv_bars",
        sa.Column("bar_time", sa.Time(), nullable=False, server_default=sa.text("'00:00:00'")),
    )
    op.drop_constraint("ohlcv_bars_symbol_id_trade_date_key", "ohlcv_bars", type_="unique")
    op.create_unique_constraint(
        "uq_ohlcv_bars_symbol_date_interval_time",
        "ohlcv_bars",
        ["symbol_id", "trade_date", "interval", "bar_time"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_ohlcv_bars_symbol_date_interval_time", "ohlcv_bars", type_="unique")
    op.drop_column("ohlcv_bars", "bar_time")
    op.drop_column("ohlcv_bars", "interval")
    op.create_unique_constraint(
        "ohlcv_bars_symbol_id_trade_date_key",
        "ohlcv_bars",
        ["symbol_id", "trade_date"],
    )
