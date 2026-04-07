#!/bin/bash
# 개발용 자체 서명 인증서 생성
# *.kgd.com 서브도메인 와일드카드 지원

openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout self-signed.key \
  -out self-signed.crt \
  -subj "/CN=*.kgd.com" \
  -addext "subjectAltName=DNS:*.kgd.com,DNS:gifticon.kgd.com,DNS:dictionary.kgd.com,DNS:api.kgd.com"

echo "Self-signed cert generated for *.kgd.com"
