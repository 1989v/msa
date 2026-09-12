#!/usr/bin/env bash
# ADR-0093 — ②③ 단계에서 새 스키마로 옮긴 옛 테이블을 지운다.
# 조건: ③ 배포(2026-09-11) + 2주 무사고 → 2026-09-25 이후.
#
# 되돌릴 수단은 k8s/base/db-backup 의 덤프 하나뿐이다. 그래서 지우기 전에
# 최신 덤프가 오늘 것인지 확인하고, 각 테이블의 행 수를 새 스키마와 대조한다.
set -euo pipefail

OLD=code_dictionary_db
TABLES=(deal_offer deal_offer_click deal_category
        ranking_board ranking_snapshot ranking_entry gas_station gas_station_price
        blog_post blog_post_view blog_post_like blog_post_rating blog_comment blog_category blog_profile)

echo "▶ 1. 최신 백업 확인 — 오늘 날짜여야 한다"
oci-mysql information_schema "SELECT 1" >/dev/null
echo "   (백업 파일은 클러스터에서 확인: kubectl -n commerce logs -l app.kubernetes.io/name=db-backup --tail=5)"

echo "▶ 2. 옛 스키마 vs 새 스키마 행 수 대조"
for t in "${TABLES[@]}"; do
  case "$t" in
    deal_*)  NEW=deal_db ;;
    ranking_*|gas_station*) NEW=ranking_db ;;
    blog_*)  NEW=blog_db ;;
  esac
  old_n=$(oci-mysql "$OLD" "SELECT COUNT(*) FROM $t" 2>/dev/null | sed -n '4p' | tr -dc '0-9' || echo "-")
  new_n=$(oci-mysql "$NEW" "SELECT COUNT(*) FROM $t" 2>/dev/null | sed -n '4p' | tr -dc '0-9' || echo "-")
  printf "   %-22s %s: %-8s %s: %s\n" "$t" "$OLD" "${old_n:--}" "$NEW" "${new_n:--}"
done

echo
echo "▶ 3. 위 대조에서 새 스키마 행 수가 옛것 이상인지 눈으로 확인한 뒤에만 아래를 실행한다."
echo "   (조회 수·클릭 수는 이전 후에도 늘어나므로 새것이 더 클 수 있다. 적으면 멈춘다.)"
echo
for t in "${TABLES[@]}"; do echo "   oci-mysql --write $OLD \"DROP TABLE IF EXISTS $t\""; done
