# 생성물 — 손으로 고치지 않는다. ./gradlew generateTopology 가 만든다.
# 원본은 settings.gradle.kts 의 :{x}:app 과 호스트 앱의 scanBasePackages 다.

TOPOLOGY_ALL_JVM="account analytics atlas auth commerce content engagement search sideapp"

# 변경 경로 → 재빌드할 파드
topology_pod_for_path() {
  case "$1" in
    account/*|member/*|wishlist/*) echo "account" ;;
    analytics/*) echo "analytics" ;;
    atlas/*|code-dictionary/*) echo "atlas" ;;
    auth/*) echo "auth" ;;
    commerce/*|deal/*|fulfillment/*|inventory/*|order/*|product/*|warehouse/*) echo "commerce" ;;
    blog/*|content/*|game/*|place/*|ranking/*) echo "content" ;;
    engagement/*|experiment/*|recommendation/*) echo "engagement" ;;
    search/*) echo "search" ;;
    chatbot/*|gifticon/*|quant/*|sideapp/*) echo "sideapp" ;;
  esac
}

# 파드 → 돌려야 할 테스트 태스크
topology_test_tasks() {
  case "$1" in
    account) echo ":account:app:test :member:domain:test :member:feature:test :wishlist:domain:test :wishlist:feature:test" ;;
    analytics) echo ":analytics:app:test" ;;
    atlas) echo ":atlas:app:test :code-dictionary:domain:test :code-dictionary:feature:test" ;;
    auth) echo ":auth:app:test" ;;
    commerce) echo ":commerce:app:test :deal:domain:test :deal:feature:test :fulfillment:domain:test :fulfillment:feature:test :inventory:domain:test :inventory:feature:test :order:domain:test :order:feature:test :product:domain:test :product:feature:test :warehouse:domain:test :warehouse:feature:test" ;;
    content) echo ":content:app:test :blog:domain:test :blog:feature:test :game:domain:test :game:feature:test :place:domain:test :place:feature:test :ranking:domain:test :ranking:feature:test" ;;
    engagement) echo ":engagement:app:test :experiment:domain:test :experiment:feature:test :recommendation:domain:test :recommendation:feature:test" ;;
    search) echo ":search:app:test" ;;
    sideapp) echo ":sideapp:app:test :chatbot:domain:test :chatbot:feature:test :gifticon:domain:test :gifticon:feature:test :quant:domain:test :quant:feature:test" ;;
  esac
}
