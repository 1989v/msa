"""ADR-0041 — DART OpenDART corpCode.xml ingest.

https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key={KEY} (zip 응답).
주 1회 또는 월 1회 갱신. 환경변수 DART_API_KEY 필수, 미설정 시 skip.
"""
from __future__ import annotations

import io
import logging
import os
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Iterable
from xml.etree import ElementTree as ET

import requests

log = logging.getLogger(__name__)


@dataclass
class DartCorpCodeRow:
    corp_code: str
    corp_name: str
    stock_code: str
    modify_date: datetime


def fetch_dart_corp_codes() -> Iterable[DartCorpCodeRow]:
    """DART corpCode.xml zip 다운로드 + 파싱.

    Returns: stock_code 가 비어있지 않은 row 만 (KR 거래소 상장 종목).
    """
    api_key = os.environ.get("DART_API_KEY", "").strip()
    if not api_key:
        log.warning("DART_API_KEY not set — skip dart-corp-codes ingest")
        return []

    url = "https://opendart.fss.or.kr/api/corpCode.xml"
    res = requests.get(url, params={"crtfc_key": api_key}, timeout=60)
    res.raise_for_status()

    # zip 응답 (CORPCODE.xml 한 개 파일).
    rows: list[DartCorpCodeRow] = []
    with zipfile.ZipFile(io.BytesIO(res.content)) as zf:
        for name in zf.namelist():
            if not name.lower().endswith(".xml"):
                continue
            with zf.open(name) as f:
                tree = ET.parse(f)
                root = tree.getroot()
                # XML schema: <result><list><corp_code>..</corp_code><corp_name>..</corp_name>
                #             <stock_code>..</stock_code><modify_date>YYYYMMDD</modify_date></list>...</result>
                for item in root.findall("list"):
                    corp_code = (item.findtext("corp_code") or "").strip()
                    corp_name = (item.findtext("corp_name") or "").strip()
                    stock_code = (item.findtext("stock_code") or "").strip()
                    modify_str = (item.findtext("modify_date") or "").strip()
                    if not corp_code or not stock_code:
                        continue  # 비상장/non-equity 는 skip (stock_code 없음)
                    try:
                        modify_date = datetime.strptime(modify_str, "%Y%m%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        modify_date = datetime.now(timezone.utc)
                    rows.append(
                        DartCorpCodeRow(
                            corp_code=corp_code,
                            corp_name=corp_name,
                            stock_code=stock_code,
                            modify_date=modify_date,
                        )
                    )
    log.info("DART corpCode parsed rows=%d", len(rows))
    return rows
