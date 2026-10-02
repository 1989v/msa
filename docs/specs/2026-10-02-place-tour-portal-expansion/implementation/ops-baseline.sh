#!/usr/bin/env bash
# 보강 필드 비공백 건수 — 배포 ① 직전·직후에 같은 명령으로 받아 diff 한다(SR-10b · T18).
#
#   implementation/ops-baseline.sh > verifications/ops-before.txt   # 배포 직전
#   implementation/ops-baseline.sh > verifications/ops-after.txt    # 배포 뒤
#   diff verifications/ops-before.txt verifications/ops-after.txt
#
# 키셋(`id > 마지막 id ORDER BY id LIMIT n`)으로 끊어 읽는다. OFFSET 은 건너뛸 행을 전부 다시 읽고,
# 운영 MySQL 버퍼 풀이 128MB 라 한 번에 전 표를 훑으면 서비스 질의의 캐시를 밀어낸다.
# 묶음은 (lang, content_type_id) — 새 유형은 새 줄로 나타나고, 기존 줄의 숫자는 줄면 안 된다.
#
# MYSQL: SQL 한 문장을 마지막 인자로 받아 결과 표를 내는 명령. 기본은 운영 읽기 전용 도구.
#   로컬 확인: MYSQL="docker exec -i tg1-placedb mysql -uroot -proot place_db -B -e"
set -euo pipefail

MYSQL="${MYSQL:-$HOME/.local/bin/oci-mysql place_db}"
CHUNK="${CHUNK:-5000}"

after=0
acc=$(mktemp)
trap 'rm -f "$acc"' EXIT

while :; do
    sql="SELECT lang, IFNULL(content_type_id,'-') ct, MAX(id) last_id, COUNT(*) n,
  SUM(overview IS NOT NULL AND overview <> '') overview,
  SUM(intro_raw IS NOT NULL) intro_raw,
  SUM(info_raw IS NOT NULL) info_raw,
  SUM(images_raw IS NOT NULL) images_raw,
  SUM(pet_raw IS NOT NULL) pet_raw,
  SUM(setting IS NOT NULL) setting,
  SUM(google_place_id IS NOT NULL) google_place_id,
  SUM(ldong_regn_cd IS NOT NULL) ldong_regn_cd,
  SUM(image_url IS NOT NULL AND image_url <> '') image_url
FROM (SELECT id, lang, content_type_id, overview, intro_raw, info_raw, images_raw, pet_raw,
             setting, google_place_id, ldong_regn_cd, image_url
      FROM attractions WHERE id > ${after} ORDER BY id LIMIT ${CHUNK}) c
GROUP BY lang, ct"
    # 표 테두리(--table)와 탭(-B) 출력 둘 다 받아 탭 구분 데이터 행만 남긴다.
    rows=$($MYSQL "$sql" | grep -v '^+' | sed -e 's/^| *//' -e 's/ *|$//' -e 's/ *| */\t/g' \
           | awk -F'\t' 'NF > 3 && $1 != "lang"' || true)
    [[ -z "$rows" ]] && break
    printf '%s\n' "$rows" >> "$acc"
    after=$(printf '%s\n' "$rows" | awk -F'\t' 'BEGIN{m=0} $3+0 > m {m=$3+0} END{print m}')
done

printf 'lang\tct\tn\toverview\tintro_raw\tinfo_raw\timages_raw\tpet_raw\tsetting\tgoogle_place_id\tldong_regn_cd\timage_url\n'
awk -F'\t' -v OFS='\t' '{k=$1 OFS $2; keys[k]=1; for (i=4; i<=13; i++) s[k,i]+=$i}
  END {for (k in keys) {line=k; for (i=4; i<=13; i++) line=line OFS s[k,i]+0; print line}}' "$acc" | sort
