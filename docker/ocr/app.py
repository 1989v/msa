import io
import re
from datetime import datetime

import pytesseract
from fastapi import FastAPI, File, UploadFile
from PIL import Image
from pydantic import BaseModel

app = FastAPI(title="OCR Service", version="1.0.0")


class OcrResult(BaseModel):
    raw_text: str
    brand: str | None = None
    product_name: str | None = None
    barcode_number: str | None = None
    expiry_date: str | None = None


# 한국 기프티콘에서 흔히 등장하는 브랜드
KNOWN_BRANDS = [
    "스타벅스", "투썸플레이스", "이디야", "빽다방", "메가커피",
    "파리바게뜨", "뚜레쥬르", "던킨", "배스킨라빈스", "할리스",
    "GS25", "CU", "세븐일레븐", "이마트24", "미니스톱",
    "맥도날드", "버거킹", "롯데리아", "KFC", "BBQ",
    "BHC", "교촌치킨", "네네치킨", "굽네치킨",
    "올리브영", "CGV", "롯데시네마", "메가박스",
    "카카오", "네이버", "배달의민족", "요기요",
]


def extract_expiry_date(text: str) -> str | None:
    """기프티콘 텍스트에서 만료일을 추출한다."""
    patterns = [
        # 유효기간: 2025년 12월 31일
        r"(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일",
        # 유효기간: 2025.12.31 또는 2025-12-31
        r"(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})",
        # ~2025.12.31 (만료일 앞에 물결표)
        r"~\s*(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text)
        if match:
            year, month, day = match.group(1), match.group(2), match.group(3)
            try:
                date = datetime(int(year), int(month), int(day))
                return date.strftime("%Y-%m-%d")
            except ValueError:
                continue

    return None


def extract_barcode(text: str) -> str | None:
    """바코드 번호(12~16자리 숫자)를 추출한다."""
    # 공백이나 하이픈으로 구분된 숫자 그룹도 매칭
    cleaned = re.sub(r"[\s\-]", "", text)
    match = re.search(r"\d{12,16}", cleaned)
    return match.group(0) if match else None


def extract_brand(text: str) -> str | None:
    """알려진 브랜드명을 매칭한다."""
    for brand in KNOWN_BRANDS:
        if brand.lower() in text.lower():
            return brand
    return None


@app.post("/api/ocr/extract", response_model=OcrResult)
async def extract_text(image: UploadFile = File(...)):
    """이미지에서 텍스트를 추출하고 기프티콘 정보를 파싱한다."""
    contents = await image.read()
    img = Image.open(io.BytesIO(contents))

    # OCR 수행 (한국어 + 영어)
    raw_text = pytesseract.image_to_string(img, lang="kor+eng")

    return OcrResult(
        raw_text=raw_text,
        brand=extract_brand(raw_text),
        product_name=None,  # 상품명은 구조가 다양해서 사용자 입력에 의존
        barcode_number=extract_barcode(raw_text),
        expiry_date=extract_expiry_date(raw_text),
    )


@app.get("/health")
async def health():
    return {"status": "ok"}
