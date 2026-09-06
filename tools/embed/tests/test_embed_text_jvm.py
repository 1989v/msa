"""해시 규약이 서버 도메인(`EmbeddingText.hash`)과 같은지. 기준값은 JVM 이 만든 것이다.

    jshell> MessageDigest.getInstance("SHA-256").digest((ref + "\\n" + text).getBytes(UTF_8))
"""
from embed.embed_text import text_hash

REF = "dragonkue/snowflake-arctic-embed-l-v2.0-ko@abc1234#d1024"


def test_hash_matches_jvm_korean():
    assert text_hash(REF, "경복궁 · 역사 · 서울특별시 종로구") == \
        "63699ce10e23b3e0a7a28b4f5524478b5f1c7f811adcf8cbd5b2e322716d5b02"


def test_hash_matches_jvm_mixed_script():
    assert text_hash(REF, "Gyeongbokgung Palace (경복궁) · history") == \
        "2b16400f402f5a4a3b363ac56f5044beff12e453a5dcd7db1724271f68c71077"
