SELECT rh, expected, multiIf(rh = '', 'direct', rh = 'self', 'self',
               NOT match(rh, '^[a-z0-9.-]{1,253}$'), 'other',
               match(rh, '(^|\\.)google\\.(com|[a-z]{2,3}|com?\\.[a-z]{2})$') OR rh = 'com.google.android.googlequicksearchbox', 'search_google',
               match(rh, '^(m\\.)?search\\.naver\\.com$'), 'search_naver',
               match(rh, '^(m\\.)?search\\.daum\\.net$'), 'search_daum',
               match(rh, '(^|\\.)bing\\.com$'), 'search_bing',
               match(rh, '^(m\\.)?(blog|cafe)\\.naver\\.com$'), 'community_naver',
               match(rh, '^(m\\.)?cafe\\.daum\\.net$'), 'community_daum',
               match(rh, '(^|\\.)(chatgpt\\.com|perplexity\\.ai)$'), 'ai',
               match(rh, '(^|\\.)1989v\\.com$'), 'internal', 'other') AS source, source = expected AS ok
FROM values('rh String, expected String',
 ('www.google.com','search_google'),('www.google.co.kr','search_google'),('com.google.android.googlequicksearchbox','search_google'),
 ('m.search.naver.com','search_naver'),('blog.naver.com','community_naver'),('m.cafe.naver.com','community_naver'),
 ('search.daum.net','search_daum'),('cafe.daum.net','community_daum'),('www.bing.com','search_bing'),('chatgpt.com','ai'),
 ('blog.1989v.com','internal'),('1989v.com','internal'),('self','self'),('','direct'),
 ('google.com.evil.io','other'),('naver.com.evil.io','other'),('www.naver.com','other'),('a b','other'))
FORMAT TSV;
SELECT 'bot_rows', count(), sum(requests), min(hour), max(hour) FROM analytics.crawler_requests_hourly FINAL FORMAT TSV;
SELECT toDate(hour,'Asia/Seoul') d, bot, sum(requests) r, sumIf(requests, status_class='304') r304 FROM analytics.crawler_requests_hourly FINAL WHERE host='place.1989v.com' GROUP BY d, bot ORDER BY d, r DESC FORMAT TSV;
SELECT toDate(hour,'Asia/Seoul') d, uniqExact(hour), countIf(partial=1) FROM analytics.crawler_log_coverage_hourly FINAL GROUP BY d ORDER BY d FORMAT TSV;
