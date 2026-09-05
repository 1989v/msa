# 판정 시트 — grade 를 3(정확) / 2(관련) / 1(약함) / 0(무관) 으로 적는다

> 빠르게 하려면 **3 과 0 만** 써도 된다. 판정하지 않은 질의는 평가에서 빠진다(자동 정답 없음).
> `from` 은 그 문서를 어디서 찾았는지다 — `bm25#n` 은 현재 검색의 n위, `vec:모델` 은 그 모델의 벡터 상위 10.

## 궁궐  `ko`

의도: 조선 궁궐(경복궁·창덕궁·덕수궁·창경궁·경희궁). 핸드오프 §4 — 유사어 줄 없으면 0건이던 질의

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 경복궁 | history | 서울특별시 종로구 사직로 161 (세 | bm25#2 |
|  | 경희궁 | history | 서울특별시 종로구 새문안로 45 | bm25#4 |
|  | 경희궁 흥화문 | history | 서울특별시 종로구 새문안로 55 (신 | bm25#5 |
|  | 덕수궁 | history | 서울특별시 중구 세종대로 99 (정동 | bm25#3 |
|  | 덕수궁 돌담길 | culture | 서울특별시 중구 세종대로 지하 101 | bm25#9 |
|  | 창경궁 | history | 서울특별시 종로구 창경궁로 185 ( | bm25#1 |
|  | 창경궁 명정전 | history | 서울특별시 종로구 창경궁로 185 ( | bm25#6 |
|  | 창경궁 홍화문 | history | 서울특별시 종로구 창경궁로 185 ( | bm25#7 |
|  | 창덕궁 다래나무 | nature | 서울특별시 종로구 율곡로 99 | bm25#10 |
|  | 창덕궁 인정문 | history | 서울특별시 종로구 율곡로 99 | bm25#8 |
|  | 건청궁 | history | 서울특별시 종로구 사직로 161 (세 | vec:arctic-ko |
|  | 고려궁지 | history | 인천광역시 강화군 강화읍 북문길 42 | vec:harrier-270m |
|  | 국립고궁박물관 | culture | 서울특별시 종로구 효자로 12 (세종 | vec:harrier-270m |
|  | 궁중삼계탕 | food | 울산광역시 중구 먹자거리 6 | vec:arctic-ko |
|  | 궁집 | history | 경기도 남양주시 평내로 9 (평내동) | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 대궐안집 | food | 부산광역시 사상구 광장로 68 | vec:arctic-ko |
|  | 동십자각 | history | 서울특별시 종로구 삼청로 1 | vec:e5-small |
|  | 백제문화단지 | culture | 충청남도 부여군 규암면 백제문로 45 | vec:e5-small |
|  | 백제왕궁박물관 | culture | 전북특별자치도 익산시 왕궁면 궁성로  | vec:harrier-270m |
|  | 봉돈 | history | 경기도 수원시 팔달구 남수동 153 | vec:arctic-ko |
|  | 서동공원과 궁남지 | nature | 충청남도 부여군 부여읍 궁남로 52 | vec:harrier-270m |
|  | 서울 영휘원(순헌황귀비)과 숭인원 | history | 서울특별시 동대문구 홍릉로 90 (청 | vec:e5-small |
|  | 서울 운현궁 | history | 서울특별시 종로구 삼일대로 464 | vec:harrier-270m |
|  | 용흥궁 | history | 인천광역시 강화군 강화읍 동문안길21 | vec:harrier-270m |
|  | 익산 왕궁리유적 [유네스코 세계유산] | history | 전북특별자치도 익산시 왕궁면 궁성로  | vec:harrier-270m |
|  | 조선왕가 | history | 경기도 연천군 연천읍 현문로 339- | vec:harrier-270m |
|  | 창덕궁과 후원 [유네스코 세계유산] | history | 서울특별시 종로구 율곡로 99 (와룡 | vec:e5-small vec:arctic-ko |
|  | 청와대칠궁 | history | 서울특별시 종로구 창의문로 12 (궁 | vec:e5-small |

## 한옥  `ko`

의도: 한옥마을·한옥 문화 공간. 식당(한옥 생고기 류)은 무관. 핸드오프 §4

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 경기광주 한옥마을 | history | 경기도 광주시 새오개길 39 (목현동 | bm25#10 |
|  | 남산골한옥마을 | history | 서울특별시 중구 퇴계로34길 28 ( | bm25#8 |
|  | 논산한옥마을 | history | 충청남도 논산시 연산면 임3길 2 | bm25#7 |
|  | 북촌한옥마을 | history | 서울특별시 종로구 계동길 37 (계동 | bm25#1 |
|  | 송도 한옥마을 | history | 인천광역시 연수구 테크노파크로 180 | bm25#6 |
|  | 오성한옥마을 | history | 전북특별자치도 완주군 소양면 송광수만 | bm25#2 |
|  | 은평한옥마을 | history | 서울특별시 은평구 연서로50길 7-1 | bm25#5 |
|  | 익선동 한옥거리 | culture | 서울특별시 종로구 익선동 | bm25#9 |
|  | 전주 한옥 마을 역사관 | culture | 전북특별자치도 전주시 완산구 최명희길 | bm25#4 |
|  | 한옥글방 | culture | 전남광주통합특별시 순천시 금곡길 28 | bm25#3 |
|  | 김용학가옥 | history | 전남광주통합특별시 북구 하백로29번길 | vec:arctic-ko |
|  | 북촌 한옥청 | culture | 서울특별시 종로구 북촌로12길 29- | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 북촌한옥마을 | culture | 서울특별시 종로구 계동길 37 | vec:e5-small vec:harrier-270m |
|  | 삼청동오위장김춘영가옥 | history | 서울특별시 중구 퇴계로34길 28 | vec:e5-small |
|  | 서촌라운지 | culture | 서울특별시 종로구 필운대로 27-4  | vec:harrier-270m |
|  | 오창 미래지 한옥마을 | history | 충청북도 청주시 청원구 오창읍 미래지 | vec:harrier-270m |
|  | 원당마을한옥도서관 | culture | 서울특별시 도봉구 해등로32가길 17 | vec:e5-small |
|  | 전북 전주 한옥마을 [슬로시티] | history | 전북특별자치도 전주시 완산구 기린대로 | vec:arctic-ko vec:harrier-270m |
|  | 조선왕가 | history | 경기도 연천군 연천읍 현문로 339- | vec:e5-small |
|  | 청도한옥학교 | culture | 경상북도 청도군 화양읍 양정길 156 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 필운동 홍건익 가옥 | history | 서울특별시 종로구 필운대로1길 14- | vec:harrier-270m |
|  | 한양 한옥마을점 | food | 인천광역시 연수구 테크노파크로 180 | vec:arctic-ko |
|  | 한옥 생고기 | food | 경기도 포천시 신북면 포천로 2228 | vec:e5-small |
|  | 한일옥 | food | 서울특별시 종로구 수표로 94 한일타 | vec:arctic-ko |
|  | 한일옥 | food | 전북특별자치도 군산시 구영3길 63 | vec:arctic-ko |
|  | 한티옥 | food | 서울특별시 강남구 도곡로 418 (대 | vec:arctic-ko |
|  | 화천한옥학교 | culture | 강원특별자치도 화천군 간동면 모현동로 | vec:e5-small vec:arctic-ko vec:harrier-270m |

## 해수욕장  `ko`

의도: 해변·해수욕장(nature). 핸드오프 §4 정상 케이스

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 광안리해수욕장 | nature | 부산광역시 수영구 광안해변로 219  | bm25#7 |
|  | 구룡포해수욕장 | nature | 경상북도 포항시 남구 구룡포읍 호미로 | bm25#5 |
|  | 대광해수욕장 | nature | 전남광주통합특별시 신안군 임자면 광산 | bm25#8 |
|  | 변산해수욕장 | nature | 전북특별자치도 부안군 변산면 대항리  | bm25#10 |
|  | 사천해변 | nature | 강원특별자치도 강릉시 사천면 해안로  | bm25#1 |
|  | 신흥해수욕장 | nature | 전남광주통합특별시 완도군 청산면 신흥 | bm25#9 |
|  | 애견전용해수욕장 멍비치 | nature | 강원특별자치도 양양군 현남면 광진리  | bm25#2 |
|  | 일산해수욕장 | nature | 울산광역시 동구 해수욕장10길 18  | bm25#3 |
|  | 초곡해수욕장 | nature | 강원특별자치도 삼척시 근덕면 초곡2길 | bm25#4 |
|  | 춘장대해수욕장 | nature | 충청남도 서천군 서면 춘장대길 20 | bm25#6 |
|  | 광암해수욕장 | nature | 경상남도 창원시 마산합포구 진동면 요 | vec:harrier-270m |
|  | 궁평리 해수욕장 | nature | 경기도 화성시 서신면 수문개길 81- | vec:e5-small |
|  | 금능해수욕장 | nature | 제주특별자치도 제주시 한림읍 금능길  | vec:harrier-270m |
|  | 독산해수욕장 | nature | 충청남도 보령시 웅천읍 소황리 | vec:e5-small |
|  | 등대해수욕장 | nature | 강원특별자치도 속초시 영랑동 | vec:harrier-270m |
|  | 물안해수욕장 | nature | 경상남도 거제시 하청면 칠천로 973 | vec:e5-small |
|  | 바람아래해수욕장 | nature | 충청남도 태안군 고남면 장곡리 | vec:e5-small |
|  | 사곡해수욕장 | nature | 경상남도 거제시 사등면 사곡리 757 | vec:arctic-ko vec:harrier-270m |
|  | 사창해수욕장 | nature | 충청남도 보령시 오천면 원산도리 | vec:arctic-ko |
|  | 속초해수욕장 | nature | 강원특별자치도 속초시 해오름로 186 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 신남해변 | nature | 강원특별자치도 삼척시 원덕읍 신남길  | vec:e5-small |
|  | 신덕해수욕장 | nature | 전남광주통합특별시 여수시 신덕동 58 | vec:arctic-ko |
|  | 연포해수욕장 | nature | 충청남도 태안군 근흥면 도황리 | vec:e5-small |
|  | 영일대해수욕장 | nature | 경상북도 포항시 북구 두호동 685- | vec:harrier-270m |
|  | 옥계해수욕장 | nature | 경상남도 거제시 하청면 연구리 416 | vec:arctic-ko vec:harrier-270m |
|  | 왕산해수욕장 | nature | 인천광역시 영종구 을왕동 | vec:harrier-270m |
|  | 용두암해수랜드 | leisure | 제주특별자치도 제주시 서해안로 630 | vec:arctic-ko |
|  | 잔교리해수욕장 | nature | 강원특별자치도 양양군 현북면 잔교리 | vec:e5-small |
|  | 장사해수욕장 | nature | 경상북도 영덕군 남정면 장사리 | vec:arctic-ko |
|  | 청포대해수욕장 | nature | 충청남도 태안군 남면 청포대길 57- | vec:e5-small |
|  | 청호해수욕장 | nature | 강원특별자치도 속초시 아바이마을1길  | vec:e5-small |
|  | 해운대해수욕장 | nature | 부산광역시 해운대구 해운대해변로 26 | vec:arctic-ko |
|  | 협재해수욕장 | nature | 제주특별자치도 제주시 한림읍 한림로  | vec:harrier-270m |
|  | 후포해수욕장 | nature | 경상북도 울진군 후포면 삼율리 | vec:arctic-ko |

## 경복궁  `ko`

의도: 경복궁 본체가 1위. 상호에 지명이 든 상점은 0~1. 핸드오프 §4

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 경복궁 | history | 서울특별시 종로구 사직로 161 (세 | bm25#1 |
|  | 경희궁 | history | 서울특별시 종로구 새문안로 45 | bm25#5 |
|  | 경희궁 흥화문 | history | 서울특별시 종로구 새문안로 55 (신 | bm25#9 |
|  | 경희궁공원 | nature | 서울특별시 종로구 새문안로 55 (신 | bm25#10 |
|  | 궁집 | history | 경기도 남양주시 평내로 9 (평내동) | bm25#4 |
|  | 덕수궁 | history | 서울특별시 중구 세종대로 99 (정동 | bm25#3 |
|  | 서울 운현궁 | history | 서울특별시 종로구 삼일대로 464 | bm25#8 |
|  | 용흥궁 | history | 인천광역시 강화군 강화읍 동문안길21 | bm25#7 |
|  | 창경궁 | history | 서울특별시 종로구 창경궁로 185 ( | bm25#6 |
|  | 한복남 경복궁점 | culture | 서울특별시 종로구 사직로 133-5 | bm25#2 |
|  | [백년가게]경복궁식당 | food | 경상북도 김천시 대항면 황학동길 11 | vec:harrier-270m |
|  | 건청궁 | history | 서울특별시 종로구 사직로 161 (세 | vec:arctic-ko |
|  | 경복궁 | food | 울산광역시 남구 산업로 595 (삼산 | vec:arctic-ko vec:harrier-270m |
|  | 경복궁에 맛있는 부엌 | food | 서울특별시 종로구 사직로 103 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 경복식당 | food | 서울특별시 노원구 공릉로39길 10  | vec:harrier-270m |
|  | 경희궁 숭정전 | history | 서울특별시 종로구 새문안로 45 (신 | vec:e5-small |
|  | 광화문 | history | 서울특별시 종로구 사직로 161 | vec:harrier-270m |
|  | 국립고궁박물관 | culture | 서울특별시 종로구 효자로 12 (세종 | vec:e5-small |
|  | 동십자각 | history | 서울특별시 종로구 삼청로 1 | vec:e5-small vec:arctic-ko |
|  | 북촌한옥마을 | culture | 서울특별시 종로구 계동길 37 | vec:harrier-270m |
|  | 서울 경모궁지 | history | 서울특별시 종로구 창경궁로 202-1 | vec:arctic-ko |
|  | 창경궁 명정전 | history | 서울특별시 종로구 창경궁로 185 ( | vec:e5-small |
|  | 창덕궁과 후원 [유네스코 세계유산] | history | 서울특별시 종로구 율곡로 99 (와룡 | vec:harrier-270m |
|  | 천진궁 | history | 경상남도 밀양시 중앙로 324 (내일 | vec:e5-small |

## 바다가 보이는 곳  `ko`

의도: 해변·전망대·해안 산책로. 선착장·여객선은 0

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 가가책방 | culture | 충청남도 공주시 당간지주길 10 (반 | bm25#6 |
|  | 그림같은 수목원 | nature | 충청남도 홍성군 광천읍 충서로400번 | bm25#9 |
|  | 달빛곳간 | leisure | 전북특별자치도 임실군 삼계면 세심길  | bm25#8 |
|  | 마라도가는여객선 | leisure | 제주특별자치도 서귀포시 대정읍 송악관 | bm25#2 |
|  | 바다다이브 | leisure | 제주특별자치도 서귀포시 동홍로12번길 | bm25#5 |
|  | 연화도선착장 | leisure | 경상남도 통영시 욕지면 본촌길 (욕지 | bm25#1 |
|  | 원대리 자작나무 숲 | nature | 강원특별자치도 인제군 인제읍 자작나무 | bm25#10 |
|  | 이순신바다공원 | nature | 경상남도 남해군 고현면 남해대로388 | bm25#7 |
|  | 증평 장이익어가는마을 | culture | 충청북도 증평군 증평읍 송티로 76- | bm25#4 |
|  | 폭포가있는캠핑장 | leisure | 강원특별자치도 인제군 북면 미시령로  | bm25#3 |
|  | 구조라항 | nature | 경상남도 거제시 일운면 구조라로 73 | vec:harrier-270m |
|  | 끝등전망대 | culture | 전남광주통합특별시 여수시 돌산읍 금성 | vec:e5-small |
|  | 녹동항 바다정원 | nature | 전남광주통합특별시 고흥군 도양읍 봉암 | vec:e5-small |
|  | 다사항 | nature | 충청남도 서천군 비인면 갯벌체험로94 | vec:harrier-270m |
|  | 대진항 해상공원 | nature | 강원특별자치도 고성군 현내면 대진항길 | vec:e5-small |
|  | 떠오르길·김녕 바닷길 | nature | 제주특별자치도 제주시 구좌읍 김녕로1 | vec:harrier-270m |
|  | 문암항 | nature | 강원특별자치도 고성군 죽왕면 문암진리 | vec:e5-small |
|  | 바다다 캠핑장 | leisure | 인천광역시 강화군 화도면 내리 214 | vec:arctic-ko |
|  | 바다보는날 | food | 제주특별자치도 제주시 애월해안로 72 | vec:arctic-ko |
|  | 바다캠핑장 | leisure | 인천광역시 강화군 화도면 해안남로 2 | vec:arctic-ko |
|  | 백암해안전망대 | culture | 전남광주통합특별시 영광군 백수읍 해안 | vec:harrier-270m |
|  | 병대도전망대 | culture | 경상남도 거제시 남부면 다포리 산38 | vec:arctic-ko |
|  | 부잔교갯벌탐방로 | nature | 경상남도 사천시 용현면 금문리 212 | vec:harrier-270m |
|  | 안목해변 | nature | 강원특별자치도 강릉시 창해로14번길  | vec:arctic-ko vec:harrier-270m |
|  | 여자만 해넘이 전망대 | culture | 전남광주통합특별시 여수시 화양면 화서 | vec:arctic-ko |
|  | 역사의 디오라마 | culture | 부산광역시 중구 영주로 93 | vec:arctic-ko |
|  | 영도 하늘전망대 | culture | 부산광역시 영도구 동삼동 628-66 | vec:arctic-ko |
|  | 영뜰해변 | nature | 인천광역시 강화군 서도면 볼음도리 | vec:arctic-ko |
|  | 원포리해변 | nature | 강원특별자치도 양양군 현남면 원포리  | vec:e5-small |
|  | 은포리해안도로 | nature | 충청남도 보령시 주교면 송학리 296 | vec:harrier-270m |
|  | 장자도선착장 | nature | 전북특별자치도 군산시 옥도면 장자도1 | vec:e5-small |
|  | 주벅배전망대 | culture | 충청남도 서산시 팔봉면 호리 320- | vec:arctic-ko |
|  | 중리노을전망대 | culture | 부산광역시 영도구 동삼동 632-3 | vec:e5-small |
|  | 지경리해변 | nature | 경상북도 경주시 양남면 지경길 35 | vec:harrier-270m |
|  | 추암 출렁다리 | culture | 강원특별자치도 동해시 촛대바위길 28 | vec:harrier-270m |
|  | 평대해변 | nature | 제주특별자치도 제주시 구좌읍 평대리  | vec:harrier-270m |
|  | 학암포해수욕장 | nature | 충청남도 태안군 원북면 옥파로 116 | vec:e5-small |
|  | 함평항 | nature | 전남광주통합특별시 함평군 손불면 학산 | vec:e5-small |
|  | 해양생물테마파크 | nature | 경상남도 창원시 진해구 명동로 62 | vec:e5-small |

## 아이와 갈만한 곳  `ko`

의도: 테마파크·체험관·공원·동물원. 상호 속 '아이' 는 0

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 개목항 | nature | 충청남도 태안군 소원면 의항리 | bm25#9 |
|  | 당목항 | nature | 전남광주통합특별시 완도군 약산면 당목 | bm25#7 |
|  | 석천항 | nature | 경기도 화성시 우정읍 매향리 | bm25#10 |
|  | 속천항 | nature | 경상남도 창원시 진해구 진희로 36 | bm25#6 |
|  | 쉬미항 | nature | 전남광주통합특별시 진도군 진도읍 산월 | bm25#8 |
|  | 아이아이 연남 | leisure | 서울특별시 마포구 연남로 86 (연남 | bm25#5 |
|  | 아이와즈 | culture | 전남광주통합특별시 광산구 상완길 71 | bm25#2 |
|  | 와글아이 | leisure | 경기도 고양시 일산동구 중앙로 120 | bm25#1 |
|  | 유앤아이센터 | leisure | 경기도 화성시 태안로 145 (병점동 | bm25#3 |
|  | 한림항 | nature | 제주특별자치도 제주시 한림읍 한림해안 | bm25#4 |
|  | 가막들공원 | culture | 경기도 의왕시 양지편로 41-2 (청 | vec:harrier-270m |
|  | 갈매중앙공원 | culture | 경기도 구리시 산마루로 41 (갈매동 | vec:e5-small |
|  | 구봉산근린공원 | culture | 경기도 화성시 병점1로 110 (병점 | vec:arctic-ko |
|  | 금강습지생태공원 | nature | 전북특별자치도 군산시 성산면 성덕리  | vec:e5-small |
|  | 돌배야영장 | leisure | 강원특별자치도 인제군 북면 만해로 1 | vec:arctic-ko |
|  | 루덴시아 | nature | 경기도 여주시 산북면 금품1로 177 | vec:e5-small |
|  | 마치광장 | nature | 대전광역시 서구 구봉로131번길 27 | vec:harrier-270m |
|  | 몬스터리움 | nature | 경기도 김포시 대곶면 대명항1로 52 | vec:e5-small |
|  | 박물관 얼굴 | culture | 경기도 광주시 남종면 분원길 3-6 | vec:e5-small |
|  | 사상근린공원 | nature | 부산광역시 사상구 가야대로 35 (감 | vec:arctic-ko |
|  | 샤샤의놀이터 | leisure | 경상남도 창원시 의창구 대봉로 14  | vec:harrier-270m |
|  | 서귀포칠십리시공원 | nature | 제주특별자치도 서귀포시 현청로 41- | vec:e5-small |
|  | 수성패밀리파크 | culture | 대구광역시 수성구 팔현길 88-40  | vec:arctic-ko |
|  | 아동청소년친화공간 꿈이랑 | leisure | 강원특별자치도 속초시 중앙로 33 ( | vec:harrier-270m |
|  | 아빠랑놀자 키즈글램핑 | leisure | 경상남도 합천군 삼가면 동리외초길 2 | vec:arctic-ko vec:harrier-270m |
|  | 아이비캠프오토캠핑장 | leisure | 경상남도 밀양시 산내면 원서3길 47 | vec:arctic-ko |
|  | 오저여 | nature | 제주특별자치도 제주시 구좌읍 행원리 | vec:e5-small |
|  | 우리 글램핑카라반 | leisure | 경기도 포천시 이동면 금강로 6280 | vec:arctic-ko |
|  | 은여울공원 | culture | 경기도 김포시 김포한강8로 97 (마 | vec:harrier-270m |
|  | 음성큰바위얼굴테마파크 | nature | 충청북도 음성군 생극면 일생로 500 | vec:e5-small |
|  | 인천어린이천문대 | nature | 인천광역시 검단구 원당대로 454-1 | vec:arctic-ko |
|  | 임내숲 어린이공원 | culture | 경상남도 사천시 숲안길 7-8 (죽림 | vec:arctic-ko |
|  | 청주랜드 | nature | 충청북도 청주시 상당구 명암로 171 | vec:e5-small |
|  | 키즈글램핑GEO | leisure | 경기도 포천시 이동면 금강로 6561 | vec:arctic-ko |
|  | 키즈몬 강릉점 | culture | 강원특별자치도 강릉시 사임당로 66  | vec:harrier-270m |
|  | 포레스트벨 | culture | 경기도 용인시 처인구 원삼면 맹리로  | vec:harrier-270m |
|  | 플레이 아쿠아리움 부천 | culture | 경기도 부천시 원미구 조마루로 2 ( | vec:e5-small |

## 조용한 사찰  `ko`

의도: 산사·고찰. 사찰음식 체험관·공원은 0~1

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 개목항 | nature | 충청남도 태안군 소원면 의항리 | bm25#9 |
|  | 꽃절 | history | 충청북도 음성군 원남면 보덕로 330 | bm25#1 |
|  | 당목항 | nature | 전남광주통합특별시 완도군 약산면 당목 | bm25#7 |
|  | 석천항 | nature | 경기도 화성시 우정읍 매향리 | bm25#10 |
|  | 속천항 | nature | 경상남도 창원시 진해구 진희로 36 | bm25#6 |
|  | 쉬미항 | nature | 전남광주통합특별시 진도군 진도읍 산월 | bm25#8 |
|  | 온수도시자연공원 | nature | 서울특별시 구로구 고척로21나길 10 | bm25#2 |
|  | 전통술 박물관 산사원 | culture | 경기도 포천시 화현면 화동로432번길 | bm25#5 |
|  | 한국사찰음식문화체험관 | leisure | 서울특별시 종로구 율곡로 39 (안국 | bm25#3 |
|  | 한림항 | nature | 제주특별자치도 제주시 한림읍 한림해안 | bm25#4 |
|  | 각원사 | history | 충청남도 천안시 동남구 각원사길 24 | vec:e5-small |
|  | 금강정사 | history | 경기도 광명시 설월로 58 (소하동) | vec:harrier-270m |
|  | 남원사 | history | 전북특별자치도 익산시 여산면 서촌1길 | vec:e5-small vec:arctic-ko |
|  | 내원사 | history | 대전광역시 서구 배재로197번길 20 | vec:arctic-ko |
|  | 달마사 | history | 서울특별시 동작구 서달로 50-26  | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 동고사 | history | 전북특별자치도 전주시 완산구 낙수정2 | vec:e5-small |
|  | 무상사 | history | 충청남도 계룡시 엄사면 향적산길 12 | vec:arctic-ko |
|  | 문수사 | history | 경상북도 구미시 도개면 신곡4길 18 | vec:e5-small vec:harrier-270m |
|  | 반야사 | history | 경기도 수원시 영통구 청명북로 66  | vec:e5-small |
|  | 서광사 | history | 강원특별자치도 태백시 오투로 216  | vec:arctic-ko vec:harrier-270m |
|  | 석종사 | history | 충청북도 충주시 직동길 271-56  | vec:harrier-270m |
|  | 수선사 | history | 경상남도 산청군 산청읍 웅석봉로154 | vec:arctic-ko |
|  | 수암사 | history | 경상남도 의령군 의령읍 수암로 248 | vec:arctic-ko vec:harrier-270m |
|  | 순례자의 교회 | history | 제주특별자치도 제주시 한경면 일주서로 | vec:harrier-270m |
|  | 신광사 | history | 세종특별자치시 조치원읍 토골고개길 2 | vec:harrier-270m |
|  | 여여정사 | history | 경상남도 밀양시 삼랑진읍 행곡1길 1 | vec:arctic-ko |
|  | 여행책방 잔잔하게 | culture | 강원특별자치도 동해시 발한로 215- | vec:e5-small |
|  | 옥련선원 | history | 부산광역시 수영구 광남로257번길 5 | vec:arctic-ko |
|  | 장명사 | history | 강원특별자치도 태백시 계산1길 66  | vec:e5-small |
|  | 정혜사 | history | 경기도 고양시 일산동구 일산로 134 | vec:harrier-270m |
|  | 지장정사 | history | 충청남도 논산시 노성면 화곡안길 10 | vec:harrier-270m |
|  | 천장사 | history | 충청남도 서산시 고북면 천장사길 10 | vec:e5-small |

## 야경 명소  `ko`

의도: 야경 전망·다리·누리길. '가야경' 같은 부분 문자열은 0

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 가야경 오토캠핑장 | leisure | 경상북도 성주군 가천면 동신로 209 | bm25#2 |
|  | 달맞이근린공원 | culture | 서울특별시 성동구 금호동4가 산27 | bm25#7 |
|  | 달빛야경누리길 | culture | 울산광역시 중구 성안동 542 | bm25#1 |
|  | 더베이101 | culture | 부산광역시 해운대구 동백로 52 (우 | bm25#9 |
|  | 세병호 | nature | 전북특별자치도 전주시 덕진구 세병로  | bm25#6 |
|  | 소호동동다리 | culture | 전남광주통합특별시 여수시 소호로 39 | bm25#5 |
|  | 용두암해안도로 | nature | 제주특별자치도 제주시 서해안로 687 | bm25#8 |
|  | 유호리전망대 | culture | 경상남도 거제시 장목면 거제북로 23 | bm25#10 |
|  | 음악분수 휴게광장 | culture | 경상남도 통영시 도남동 | bm25#4 |
|  | 횟집명소거리 | culture | 강원특별자치도 동해시 일출로 151  | bm25#3 |
|  | N서울타워 | culture | 서울특별시 용산구 남산공원길 105 | vec:arctic-ko vec:harrier-270m |
|  | 경천대관광지 | culture | 경상북도 상주시 사벌국면 경천로 65 | vec:e5-small |
|  | 괴산 오작교 | culture | 충청북도 괴산군 괴산읍 동부리 178 | vec:e5-small vec:harrier-270m |
|  | 낙강교 | culture | 경상북도 상주시 중동면 회상리 | vec:e5-small |
|  | 남산 팔각정 | culture | 서울특별시 중구 예장동 8-1 | vec:arctic-ko vec:harrier-270m |
|  | 낭도야영장 | leisure | 전남광주통합특별시 여수시 화정면 여산 | vec:arctic-ko |
|  | 대야산 용추계곡 | nature | 경상북도 문경시 가은읍 | vec:e5-small |
|  | 빛누리정원 | nature | 경상북도 경주시 용담로 107 (황성 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 삼익비치수변공원 | nature | 부산광역시 수영구 남천동 148-10 | vec:arctic-ko |
|  | 선학산전망대 | culture | 경상남도 진주시 남강로 751-51  | vec:harrier-270m |
|  | 여수 국가산업단지 | leisure | 전남광주통합특별시 여수시 평여동 | vec:arctic-ko |
|  | 요천수경 음악분수 | culture | 전북특별자치도 남원시 어현동 741 | vec:arctic-ko |
|  | 용담공원 | nature | 제주특별자치도 제주시 용담일동 373 | vec:harrier-270m |
|  | 이포보 | culture | 경기도 여주시 금사면 금사로 40 | vec:e5-small vec:harrier-270m |
|  | 인왕산 무무대 전망대 | nature | 서울 종로구 옥인동 산3-1 | vec:arctic-ko vec:harrier-270m |
|  | 진주 남강음악분수대 | culture | 경상남도 진주시 남강로 542 (천수 | vec:e5-small |
|  | 천부해중전망대 | culture | 경상북도 울릉군 북면 울릉순환로 31 | vec:e5-small |
|  | 충주 탄금호 무지개길 | leisure | 충청북도 충주시 중앙탑면 중앙탑길 1 | vec:e5-small |
|  | 포천계곡 | nature | 경상북도 성주군 가천면 화죽리 | vec:e5-small |
|  | 형곡전망대 | culture | 경상북도 구미시 형곡동 산32-2 | vec:arctic-ko |

## 벚꽃 명소  `ko`

의도: 벚꽃길·벚꽃 축제 장소

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 가실벚꽃길 | culture | 경기도 용인시 처인구 포곡읍 가실리  | bm25#8 |
|  | 개금벚꽃길 | nature | 부산광역시 부산진구 개금동 765 | bm25#3 |
|  | 남면 벚꽃길 | nature | 충청남도 태안군 남면 달산포로 311 | bm25#1 |
|  | 맹방 벚꽃길 | nature | 강원특별자치도 삼척시 근덕면 상맹방리 | bm25#5 |
|  | 무심천 벚꽃 거리 | nature | 충청북도 청주시 서원구 무심천자전거길 | bm25#7 |
|  | 백리벚꽃길 | nature | 경상남도 합천군 용주면 가호리 | bm25#9 |
|  | 북한강로 벚꽃길 | nature | 경기도 가평군 청평면 삼회리 | bm25#4 |
|  | 왕지벚꽃길 | nature | 경상남도 남해군 설천면 노량리 37- | bm25#2 |
|  | 진해 벚꽃공원 | culture | 경상남도 창원시 진해구 장천동 175 | bm25#6 |
|  | 화양면 벚꽃길 | nature | 전남광주통합특별시 여수시 화양면 장수 | bm25#10 |
|  | 경화역 벚꽃길 | nature | 경상남도 창원시 진해구 진해대로 66 | vec:e5-small |
|  | 달창지 벚꽃길 | nature | 대구광역시 달성군 유가읍 본말리 | vec:arctic-ko |
|  | 대성리 국민관광지 | nature | 경기도 가평군 청평면 대성강변길 44 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 마이산 벚꽃길 | nature | 전북특별자치도 진안군 마령면 동촌리 | vec:harrier-270m |
|  | 벚꽃마을 | food | 전북특별자치도 진안군 마령면 마이산남 | vec:harrier-270m |
|  | 봉숫골 벚꽃길 | leisure | 경상남도 통영시 발개로 | vec:e5-small vec:arctic-ko |
|  | 서항마을 | culture | 경상남도 거제시 연하해안로 1439 | vec:e5-small |
|  | 안양천제방벚꽃길 | nature | 서울특별시 영등포구 양평동1가 | vec:e5-small |
|  | 예계마을 | culture | 경상남도 남해군 서면 남서대로1818 | vec:harrier-270m |
|  | 장곡사벚꽃길 | nature | 충청남도 청양군 대치면 장곡길 241 | vec:harrier-270m |
|  | 전군가도100리벚꽃길 | leisure | 전북특별자치도 익산시 목천동 | vec:e5-small |
|  | 전농로 벚꽃거리 | nature | 제주특별자치도 제주시 삼도일동 | vec:e5-small |
|  | 제주대 벚꽃길 | nature | 제주특별자치도 제주시 제주대학로 10 | vec:arctic-ko |
|  | 지리산벚꽃카라반캠핑장 | leisure | 경상남도 하동군 화개면 화개로 946 | vec:arctic-ko |
|  | 창녕 만옥정공원 | culture | 경상남도 창녕군 창녕읍 교상리 28- | vec:e5-small |
|  | 창원 소하천 벚꽃거리 | culture | 경상남도 창원시 마산합포구 문화동 | vec:harrier-270m |

## 단풍 명소  `ko`

의도: 단풍 산·숲·군락지

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 광교마루길 | nature | 경기도 수원시 장안구 하광교동 400 | bm25#8 |
|  | 내장산 단풍생태공원 | nature | 전북특별자치도 정읍시 내장동 560 | bm25#2 |
|  | 단양 보발재 | nature | 충청북도 단양군 가곡면 | bm25#7 |
|  | 독립기념관단풍나무숲길 | culture | 충청남도 천안시 동남구 목천읍 독립기 | bm25#4 |
|  | 송정제방길 | leisure | 서울특별시 성동구 송정동 | bm25#10 |
|  | 용인단풍숲캠핑장 | leisure | 경기도 용인시 처인구 원삼면 보개원삼 | bm25#3 |
|  | 우화정 | nature | 전북특별자치도 정읍시 내장동 598- | bm25#9 |
|  | 정읍 내장산 관광특구 | nature | 전북특별자치도 정읍시 내장동 | bm25#6 |
|  | 철암단풍군락지 | nature | 강원특별자치도 태백시 철암동 산 64 | bm25#1 |
|  | 횟집명소거리 | culture | 강원특별자치도 동해시 일출로 151  | bm25#5 |
|  | [남해바래길 7코스] 화전별곡길 | leisure | 경상남도 남해군 삼동면 동부대로103 | vec:harrier-270m |
|  | 내장야영장 | leisure | 전북특별자치도 정읍시 내장산로 800 | vec:harrier-270m |
|  | 단양 감골 바람개비마을 | culture | 충청북도 단양군 적성면 금수산로 78 | vec:harrier-270m |
|  | 단양 관광특구 | nature | 충청북도 단양군 단양읍 고수동굴길 3 | vec:e5-small vec:arctic-ko |
|  | 단양 구담봉·옥순봉 | nature | 충청북도 단양군 단성면 장회리 산 3 | vec:e5-small |
|  | 단양 패러글라이딩 패러에 반하다 | leisure | 충청북도 단양군 가곡면 두산길 196 | vec:e5-small |
|  | 단풍나무 | food | 충청북도 청주시 서원구 대림로 414 | vec:arctic-ko |
|  | 단풍산 | nature | 강원특별자치도 영월군 산솔면 녹전리 | vec:arctic-ko |
|  | 도담삼봉 | nature | 충청북도 단양군 매포읍 삼봉로 644 | vec:e5-small |
|  | 도솔계곡 | nature | 전북특별자치도 고창군 아산면 선운사로 | vec:arctic-ko |
|  | 백풍밀원 | nature | 강원특별자치도 춘천시 남이섬길 1 남 | vec:e5-small vec:harrier-270m |
|  | 산외한우마을 | culture | 전북특별자치도 정읍시 산외면 산외로  | vec:e5-small |
|  | 설악산소공원 | culture | 강원특별자치도 속초시 설악산로 105 | vec:arctic-ko vec:harrier-270m |
|  | 소백산국립공원 | nature | 충청북도 단양군 가곡면 남한강로 49 | vec:arctic-ko |
|  | 소요산국민관광지 | nature | 경기도 동두천시 평화로2910번길 1 | vec:arctic-ko |
|  | 온달관광지 | nature | 충청북도 단양군 영춘면 온달로 23 | vec:e5-small |
|  | 장풍숲 | nature | 경상남도 거창군 마리면 송계로 12 | vec:harrier-270m |
|  | 춘천시 수변공원 | nature | 강원특별자치도 춘천시 삼천동 200- | vec:e5-small |

## 온천  `ko`

의도: 온천·스파(온천수)

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 금강온천 | leisure | 충청남도 공주시 고마나루길 51-12 | bm25#10 |
|  | 담양리조트 온천 | leisure | 전남광주통합특별시 담양군 금성면 금성 | bm25#1 |
|  | 발리온천 | leisure | 울산광역시 울주군 온양읍 상발2길 3 | bm25#5 |
|  | 북수원온천 | leisure | 경기도 수원시 장안구 서부로 2139 | bm25#9 |
|  | 아산시 온천 관광특구 | nature | 충청남도 아산시 음봉면 신수리 일원 | bm25#4 |
|  | 예천온천 | leisure | 경상북도 예천군 감천면 온천길 27  | bm25#6 |
|  | 온양 온천 랜드 | leisure | 충청남도 아산시 삼동로28번길 46  | bm25#3 |
|  | 정관온천 | leisure | 부산광역시 기장군 정관읍 정관8로 1 | bm25#8 |
|  | 필례 게르마늄 온천 | leisure | 강원특별자치도 인제군 인제읍 필례약수 | bm25#2 |
|  | 휴온천 | leisure | 경상북도 칠곡군 동명면 기성5길 11 | bm25#7 |
|  | 덕산온천지구 | leisure | 충청남도 예산군 덕산면 온천단지2로  | vec:harrier-270m |
|  | 보원장탄온천 | leisure | 경기도 구리시 안골로 79 (수택동) | vec:e5-small |
|  | 수안보온천 관광특구 | culture | 충청북도 충주시 수안보면 주정산로 1 | vec:harrier-270m |
|  | 신천탕 | leisure | 충청남도 아산시 온천대로 1469 ( | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 앙성온천지구 | leisure | 충청북도 충주시 앙성면 가곡로 | vec:arctic-ko vec:harrier-270m |
|  | 연산온천파크 | leisure | 경상북도 포항시 북구 송라면 보경로  | vec:arctic-ko |
|  | 영일만온천 | leisure | 경상북도 포항시 남구 대송면 운제로3 | vec:e5-small |
|  | 온양온천지구 | leisure | 충청남도 아산시 온천동 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 온천천시민공원 | culture | 부산광역시 연제구 온천천남로 39 ( | vec:arctic-ko |
|  | 월드온천24 | leisure | 강원특별자치도 춘천시 신북읍 장본길  | vec:harrier-270m |
|  | 월문온천 휴양지 | leisure | 경기도 화성시 만세구 팔탄면 버들로1 | vec:e5-small |
|  | 이천온천공원 | nature | 경기도 이천시 애련정로136번길 84 | vec:arctic-ko |
|  | 청도 용암온천 | leisure | 경상북도 청도군 화양읍 온천길 23 | vec:harrier-270m |
|  | 파라다이스 스파 도고 | leisure | 충청남도 아산시 도고면 도고온천로 1 | vec:e5-small |
|  | 허심청 | leisure | 부산광역시 동래구 온천장로107번길  | vec:e5-small |

## 캠핑장  `ko`

의도: 캠핑장·오토캠핑장(수련원은 1)

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 곤달비캠핑장 | leisure | 경상북도 경주시 산내면 하신길 58- | bm25#7 |
|  | 난지캠핑장 | leisure | 서울특별시 마포구 한강난지로 28 ( | bm25#8 |
|  | 대충캠핑장 | leisure | 경상남도 고성군 대가면 유흥갈천길 2 | bm25#3 |
|  | 선야봉캠핑장 | leisure | 전북특별자치도 완주군 운주면 금고당로 | bm25#4 |
|  | 수덕캠핑장 | leisure | 충청남도 예산군 덕산면 노곡길 15 | bm25#9 |
|  | 용봉산캠핑장 | leisure | 충청남도 홍성군 홍북읍 이응노로 22 | bm25#10 |
|  | 트윈스캠핑장 | leisure | 충청남도 아산시 도고면 도고면로 11 | bm25#2 |
|  | 피노키오청소년수련원 | nature | 강원특별자치도 원주시 신림면 소야1길 | bm25#1 |
|  | 해밀캠핑장 | leisure | 전북특별자치도 무주군 안성면 덕산로  | bm25#6 |
|  | 호반캠핑장 | leisure | 경상남도 밀양시 산내면 발례1길 10 | bm25#5 |
|  | 구미캠핑장 | leisure | 경상북도 구미시 낙동제방길 200 ( | vec:arctic-ko |
|  | 그린하우스캠핑장 | leisure | 경상북도 경주시 산내면 대현길 91- | vec:arctic-ko |
|  | 별장 캠핑카펜션 | leisure | 충청남도 보령시 대천항1길 30 (신 | vec:arctic-ko |
|  | 솔바람캠핑장 | leisure | 충청남도 서천군 장항읍 장항산단로34 | vec:e5-small |
|  | 솔베이캠핑장 | leisure | 충청북도 괴산군 감물면 충민로 108 | vec:harrier-270m |
|  | 쉼표캠핑장 | leisure | 경상북도 김천시 아포읍 회성길 177 | vec:arctic-ko |
|  | 아산글램핑캠핑장 | leisure | 충청남도 아산시 선장면 학성로 214 | vec:arctic-ko |
|  | 에이스카라반 | leisure | 경기도 용인시 처인구 이동읍 이원로  | vec:e5-small |
|  | 온더락캠핑장 | leisure | 경기도 가평군 상면 수목원로 238- | vec:e5-small |
|  | 올래캠핑장 | leisure | 경기도 가평군 설악면 어비산길 203 | vec:harrier-270m |
|  | 임진강힐링카라반 | leisure | 경기도 연천군 장남면 원당리 | vec:e5-small |
|  | 자연펜션캠핑장 | leisure | 강원특별자치도 영월군 김삿갓면 내리계 | vec:arctic-ko |
|  | 작은쉼터캠핑장 | leisure | 경기도 시흥시 죽율로 25 (죽율동) | vec:e5-small |
|  | 장수방화동캠핑장 | leisure | 전북특별자치도 장수군 번암면 방화동로 | vec:e5-small vec:harrier-270m |
|  | 장항오토캠핑장 | leisure | 충청남도 서천군 장항읍 장항산단로34 | vec:harrier-270m |
|  | 천안OK캠핑 | leisure | 충청남도 천안시 동남구 북면 오곡1길 | vec:harrier-270m |
|  | 청석들오토캠핑 | leisure | 경상북도 경주시 산내면 대현길 176 | vec:arctic-ko |
|  | 추암오토캠핑장 | leisure | 강원특별자치도 동해시 촛대바위길 28 | vec:e5-small |
|  | 춘장대나드리캠핑장 | leisure | 충청남도 서천군 서면 춘장대길8번길  | vec:arctic-ko |
|  | 캠프ING | leisure | 경상북도 경주시 강동면 호명큰골길 4 | vec:harrier-270m |
|  | 캠프리카 캠핑장 | leisure | 경기도 양주시 백석읍 기산로440번길 | vec:e5-small |
|  | 캠플레이 캠핑장 | leisure | 경기도 가평군 상면 비룡로 1610- | vec:arctic-ko vec:harrier-270m |
|  | 코끼리캠핑장 | leisure | 경기도 가평군 북면 화악산로 1217 | vec:harrier-270m |
|  | 패밀리오토캠핑장 | leisure | 경상남도 밀양시 산외면 밀양대로 35 | vec:harrier-270m |
|  | 포시즌스오토캠핑장 | leisure | 경기도 포천시 신북면 탑신로 1259 | vec:e5-small |
|  | 하동다목적캠핑장 | leisure | 경상남도 하동군 옥종면 옥단로 183 | vec:arctic-ko |
|  | 해자연캠핑장 | leisure | 경기도 남양주시 오남읍 팔현로175번 | vec:e5-small |
|  | 홀리데이캠프캠핑장 | leisure | 경기도 가평군 설악면 유명로 654- | vec:harrier-270m |

## 케이블카  `ko`

의도: 케이블카 탑승지

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 거제케이블카 | nature | 경상남도 거제시 거제중앙로 288 | bm25#4 |
|  | 금오산케이블카 | leisure | 경상북도 구미시 금오산로 419 | bm25#6 |
|  | 남산케이블카 | leisure | 서울특별시 중구 소파로 83 | bm25#1 |
|  | 두륜산케이블카 | leisure | 전남광주통합특별시 해남군 삼산면 대흥 | bm25#7 |
|  | 설악산 케이블카 | leisure | 강원특별자치도 속초시 설악산로 108 | bm25#5 |
|  | 여수 해상케이블카 | leisure | 전남광주통합특별시 여수시 돌산읍 돌산 | bm25#8 |
|  | 왕피천케이블카 | leisure | 경상북도 울진군 근남면 왕피천공원길  | bm25#9 |
|  | 통영케이블카 | leisure | 경상남도 통영시 발개로 205 (도남 | bm25#3 |
|  | 팔공산 케이블카 | leisure | 대구광역시 동구 팔공산로185길 51 | bm25#10 |
|  | 하동케이블카 | leisure | 경상남도 하동군 경충로 461-7 | bm25#2 |
|  | 내장산 케이블카 | leisure | 전북특별자치도 정읍시 내장산로 117 | vec:e5-small |
|  | 대둔산케이블카 | leisure | 전북특별자치도 완주군 운주면 대둔산공 | vec:e5-small vec:harrier-270m |
|  | 목포 해상케이블카 | leisure | 전남광주통합특별시 목포시 해양대학로  | vec:arctic-ko |
|  | 발왕산 관광케이블카 | leisure | 강원특별자치도 평창군 대관령면 올림픽 | vec:arctic-ko |
|  | 부산 송도해상케이블카 | leisure | 부산광역시 서구 송도해변로 171 | vec:harrier-270m |
|  | 사천바다 케이블카 | leisure | 경상남도 사천시 사천대로 18 (대방 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 삼척해상케이블카 | leisure | 강원특별자치도 삼척시 근덕면 삼척로  | vec:e5-small vec:arctic-ko |
|  | 서해랑 제부도 해상케이블카 | leisure | 경기도 화성시 서신면 전곡항로 1-1 | vec:e5-small vec:harrier-270m |
|  | 앞산 케이블카 | culture | 대구광역시 남구 앞산순환로 574-1 | vec:e5-small vec:arctic-ko vec:harrier-270m |

## 등산 코스  `ko`

의도: 산·등산로·둘레길. 승마클럽·자전거길은 0

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | [서울둘레길 10코스] 우면산코스 | culture | 서울특별시 서초구 양재동 (매헌시민의 | bm25#6 |
|  | [서울둘레길 16코스] 봉산·앵봉산코스 | culture | 서울특별시 은평구 증산로5길 2 (증 | bm25#7 |
|  | [서울둘레길 17코스] 북한산 은평코스 | culture | 서울특별시 은평구 진관2로 29-21 | bm25#9 |
|  | [서울둘레길 19코스] 북한산 성북코스 | culture | 서울특별시 종로구 평창동 (형제봉 입 | bm25#10 |
|  | [서울둘레길 20코스] 북한산 강북코스 | culture | 서울특별시 강북구 화계사길 68 (수 | bm25#8 |
|  | [서울둘레길 5코스] 아차산코스 | leisure | 서울특별시 중랑구 면목동 (깔딱고개  | bm25#5 |
|  | [종로둘레길 3코스] 낙산 코스 | culture | 서울특별시 종로구 종로6가 70 | bm25#4 |
|  | 어등산승마클럽 | leisure | 전남광주통합특별시 광산구 고봉로185 | bm25#2 |
|  | 의암호자전거길 | nature | 강원특별자치도 춘천시 동면 공단로 1 | bm25#3 |
|  | 현등산 | nature | 경기도 가평군 조종면 운악리 | bm25#1 |
|  | [대구올레 팔공산 5코스] 구암마을 가는 길 | leisure | 대구광역시 수성구 신천동로86안길 1 | vec:arctic-ko |
|  | [대구올레 팔공산 7코스] 폭포골 가는 길 | leisure | 대구광역시 동구 팔공산로237길 14 | vec:harrier-270m |
|  | [밀양아리랑길 2코스] 추화산성길 | leisure | 경상남도 밀양시 밀양향교3길 19 ( | vec:arctic-ko |
|  | [서울둘레길 6코스] 고덕산코스 | leisure | 서울특별시 광진구 아차산로 지하571 | vec:arctic-ko |
|  | [양천구 둘레길] 산림형코스 | leisure | 서울특별시 양천구 신정동 | vec:e5-small |
|  | [영덕 블루로드] 3코스 바람의 언덕 | leisure | 경상북도 영덕군 강구면 영덕대게로 6 | vec:harrier-270m |
|  | [제주올레 15코스] 한림-고내 올레 (A) | leisure | 제주특별자치도 제주시 한림읍 한림해안 | vec:harrier-270m |
|  | 내린천 짚트랙 휴레저 | leisure | 강원특별자치도 인제군 인제읍 내린천로 | vec:arctic-ko |
|  | 덕재산 | nature | 전북특별자치도 임실군 성수면 봉강리 | vec:arctic-ko |
|  | 두타산협곡마천루 | nature | 강원특별자치도 동해시 삼화로 584  | vec:e5-small |
|  | 등광사 | history | 강원특별자치도 태백시 문곡소도동 산5 | vec:arctic-ko |
|  | 등선폭포 | nature | 강원특별자치도 춘천시 서면 덕두원리  | vec:e5-small |
|  | 만천하 알파인코스터 | leisure | 충청북도 단양군 적성면 옷바위길 10 | vec:harrier-270m |
|  | 망곡산 연인공원 | history | 경기도 연천군 연천읍 연천로 220 | vec:arctic-ko |
|  | 무등산국립공원 | nature | 전남광주통합특별시 화순군 화순읍 백운 | vec:e5-small |
|  | 베틀바위 | nature | 강원특별자치도 동해시 삼화로 538  | vec:e5-small |
|  | 북한산 백운대 | nature | 서울특별시 강북구 도선사길 234 ( | vec:arctic-ko |
|  | 삼악산 | nature | 강원특별자치도 춘천시 서면 경춘로 1 | vec:e5-small |
|  | 선달산 | nature | 강원특별자치도 영월군 김삿갓면 내리계 | vec:e5-small |
|  | 선바위산 | nature | 강원특별자치도 영월군 상동읍 선바위길 | vec:e5-small |
|  | 엘리시안 강촌 컨트리클럽 | leisure | 강원특별자치도 춘천시 남산면 북한강변 | vec:harrier-270m |
|  | 영남알프스 얼음골케이블카 | leisure | 경상남도 밀양시 산내면 얼음골로 24 | vec:harrier-270m |
|  | 용마골소공원 | nature | 경기도 과천시 과천동 549-23 | vec:harrier-270m |
|  | 원등산 | nature | 전북특별자치도 완주군 소양면 해월리 | vec:e5-small |
|  | 큰끝등대 | nature | 전남광주통합특별시 여수시 돌산읍 평사 | vec:e5-small |
|  | 토영이야길2코스 | leisure | 경상남도 통영시 미수동 산62-5 ( | vec:harrier-270m |
|  | 하이원리조트 알파인코스터 | leisure | 강원특별자치도 정선군 고한읍 하이원길 | vec:harrier-270m |
|  | 한라산 영실 | nature | 제주특별자치도 서귀포시 영실로 246 | vec:arctic-ko |

## 야시장  `ko`

의도: 야시장·밤 시장. 공원·랜드는 0

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 가야공원 | nature | 부산광역시 부산진구 엄광로 118 ( | bm25#2 |
|  | 가야랜드 | nature | 경상남도 김해시 인제로 368 (삼방 | bm25#3 |
|  | 가야진사 | history | 경상남도 양산시 원동면 용당들길 43 | bm25#4 |
|  | 국립가야역사문화센터 | culture | 경상남도 김해시 대청로 45 (관동동 | bm25#7 |
|  | 김해가야테마파크 | culture | 경상남도 김해시 가야테마길 161 ( | bm25#8 |
|  | 바다야놀자 | leisure | 충청남도 보령시 하학로 800 | bm25#10 |
|  | 비와야폭포 | nature | 강원특별자치도 태백시 양지길 25 ( | bm25#6 |
|  | 산호야관광농원 | leisure | 경상북도 구미시 옥성면 선상서로 79 | bm25#9 |
|  | 서문풍물야시장&서문시장삼겹살거리 | culture | 충청북도 청주시 상당구 무심동로392 | bm25#1 |
|  | 파주가야랜드 | leisure | 경기도 파주시 법원읍 사임당로 674 | bm25#5 |
|  | 국제시장 먹자골목 | leisure | 부산광역시 중구 중구로 36 | vec:arctic-ko |
|  | 대구 서문시장 & 서문시장 야시장 | shopping | 대구광역시 중구 큰장로26길 45 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 대구 칠성시장&별별상상 칠성야시장 | shopping | 대구광역시 북구 칠성시장로 28 | vec:arctic-ko |
|  | 대야전통시장 | shopping | 전북특별자치도 군산시 대야면 산월리 | vec:harrier-270m |
|  | 대인예술시장 한평갤러리 | culture | 전남광주통합특별시 동구 제봉로184번 | vec:e5-small vec:harrier-270m |
|  | 덕동자동차야영장 | leisure | 전북특별자치도 남원시 산내면 지리산로 | vec:harrier-270m |
|  | 덕유대오토캠핑장 | leisure | 전북특별자치도 무주군 설천면 백련사길 | vec:harrier-270m |
|  | 멍딩이마을 | culture | 충청북도 괴산군 소수면 원소로명덕2길 | vec:e5-small |
|  | 뿅의전설 야탑본점 | food | 경기도 성남시 분당구 야탑로139번길 | vec:harrier-270m |
|  | 서시장 | shopping | 전남광주통합특별시 여수시 광무동 | vec:harrier-270m |
|  | 설악산국립공원 자동차야영장 | leisure | 강원특별자치도 속초시 설악동 370번 | vec:harrier-270m |
|  | 수목원길 야시장 | shopping | 제주특별자치도 제주시 은수길 69 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 수암한우야시장 | shopping | 울산광역시 남구 수암로128번길 12 | vec:arctic-ko |
|  | 야반 | food | 경기도 이천시 경충대로 2849 (관 | vec:e5-small vec:arctic-ko |
|  | 야옹아멍멍해봐 강릉내곡점 | shopping | 강원특별자치도 강릉시 남부로17번길  | vec:e5-small |
|  | 영일만친구야시장 | shopping | 경상북도 포항시 북구 중앙상가길 56 | vec:e5-small vec:arctic-ko |
|  | 울산큰애기청년야시장 | shopping | 울산광역시 중구 젊음의거리 90 (옥 | vec:e5-small vec:arctic-ko |
|  | 종로3가 포장마차 거리 | culture | 서울특별시 종로구 관수동 종로 3가역 | vec:harrier-270m |
|  | 큰장길 침구류 명물거리 | culture | 대구광역시 서구 큰장로 35 (내당동 | vec:e5-small |
|  | 홈플러스 야탑점 | shopping | 경기도 성남시 분당구 성남대로925번 | vec:arctic-ko |
|  | 홍익문화공원 | culture | 서울특별시 마포구 와우산로21길 19 | vec:arctic-ko |

## 전통시장 먹거리  `ko`

의도: 전통시장·먹거리촌

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 금정산성마을 먹거리촌 | culture | 부산광역시 금정구 금성동 | bm25#5 |
|  | 꺼먹다리 | history | 강원특별자치도 화천군 화천읍 평화로  | bm25#10 |
|  | 들안길먹거리타운 | culture | 대구광역시 수성구 들안로 109-1  | bm25#8 |
|  | 먹점마을 | culture | 경상남도 하동군 하동읍 매화골먹점길  | bm25#9 |
|  | 보문숲머리먹거리촌 | culture | 경상북도 경주시 보문동 (보문동) | bm25#7 |
|  | 오대산먹거리마을 | culture | 강원특별자치도 평창군 진부면 오대산로 | bm25#2 |
|  | 우이령 숲속문화마을 | culture | 서울특별시 강북구 삼양로181길 20 | bm25#4 |
|  | 인하대후문먹거리타운 | culture | 인천광역시 미추홀구 경인남길30번길  | bm25#6 |
|  | 평촌먹거리촌 | culture | 경기도 안양시 동안구 평촌동 | bm25#1 |
|  | 행주산성먹거리촌 | culture | 경기도 고양시 덕양구 행주로15번길  | bm25#3 |
|  | 국제시장 먹자골목 | leisure | 부산광역시 중구 중구로 36 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 남선옥 | food | 경상북도 의성군 의성읍 전통시장1길  | vec:arctic-ko vec:harrier-270m |
|  | 남한산성 전통음식마을 | culture | 경기도 광주시 남한산성면 남한산성로  | vec:arctic-ko |
|  | 도예촌 쌀밥거리 | culture | 경기도 이천시 신둔면 경충대로 319 | vec:arctic-ko |
|  | 돌다리 곱창골목 | culture | 경기도 구리시 검배로6번길 31 (수 | vec:harrier-270m |
|  | 명동 남대문 북창동 다동무교동 관광특구 | nature | 서울특별시 중구 세종대로 40 (남대 | vec:e5-small |
|  | 부림시장 먹자골목 | culture | 경상남도 창원시 마산합포구 3·15대 | vec:harrier-270m |
|  | 서문풍물야시장&서문시장삼겹살거리 | culture | 충청북도 청주시 상당구 무심동로392 | vec:e5-small |
|  | 서부 오미가미거리 | culture | 대구광역시 서구 국채보상로75길 25 | vec:harrier-270m |
|  | 세종마을 음식문화거리 | culture | 서울특별시 종로구 자하문로1길 24  | vec:e5-small |
|  | 세종전통장류박물관 | culture | 세종특별자치시 전동면 배일길 90-4 | vec:e5-small |
|  | 안동시장 찜닭골목 | culture | 경상북도 안동시 번영길 30 | vec:arctic-ko vec:harrier-270m |
|  | 안양중앙시장 곱창골목 | culture | 경기도 안양시 만안구 안양로291번길 | vec:e5-small |
|  | 오향족발 | food | 서울특별시 마포구 만리재로 19 공덕 | vec:e5-small |
|  | 장충동 족발 골목 | culture | 서울특별시 중구 장충단로 174 (장 | vec:e5-small |
|  | 장항6080 음식골목 맛나로 | culture | 충청남도 서천군 장항읍 창선1리 일원 | vec:harrier-270m |
|  | 전통다원 | food | 서울특별시 종로구 인사동10길 11- | vec:arctic-ko |
|  | 조치원테마거리 | culture | 세종특별자치시 조치원읍 장안로 10- | vec:harrier-270m |
|  | 큰장길 침구류 명물거리 | culture | 대구광역시 서구 큰장로 35 (내당동 | vec:e5-small |
|  | 통영항 꿀빵거리 | culture | 경상남도 통영시 중앙동 | vec:arctic-ko |
|  | 파주 맛고을 음식문화거리 | culture | 경기도 파주시 탄현면 성동리 일원 | vec:arctic-ko |
|  | 포항전통문화체험관 | culture | 경상북도 포항시 북구 기북면 덕동문화 | vec:e5-small |
|  | 할매닭발 | food | 경상북도 의성군 전통시장3길 7-6 | vec:arctic-ko vec:harrier-270m |

## 서울 근교 드라이브  `ko`

의도: 수도권 근교 드라이브 코스·해안도로. 포항·영덕 등 원거리는 1 이하

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 서울 경모궁지 | history | 서울특별시 종로구 창경궁로 202-1 | bm25#10 |
|  | 서울 연산군묘 | history | 서울특별시 도봉구 방학로17길 46  | bm25#7 |
|  | 서울 운현궁 | history | 서울특별시 종로구 삼일대로 464 | bm25#6 |
|  | 서울 정동교회 | history | 서울특별시 중구 정동길 46 (정동) | bm25#8 |
|  | 서울 효창공원 | culture | 서울특별시 용산구 효창원로 177-1 | bm25#9 |
|  | 영덕 해안도로 드라이브 | nature | 경상북도 영덕군 영덕읍 창포리 | bm25#3 |
|  | 입곡 저수지 드라이브길 | nature | 경상남도 함안군 산인면 입곡공원길 2 | bm25#5 |
|  | 포항 해안드라이브 | nature | 경상북도 포항시 북구 해안로 226  | bm25#1 |
|  | 한우산 드라이브코스 | nature | 경상남도 의령군 대의면 신전리 | bm25#4 |
|  | 호명산드라이브코스 | leisure | 경기도 가평군 청평면 호반로 9 | bm25#2 |
|  | MAC 신세계백화점 타임스퀘어점 | shopping | 서울특별시 영등포구 영중로 9 (영등 | vec:harrier-270m |
|  | N서울타워 | culture | 서울특별시 용산구 남산공원길 105 | vec:harrier-270m |
|  | [K드라마 촬영지] 공근혜갤러리 | culture | 서울특별시 종로구 삼청로7길 38 | vec:harrier-270m |
|  | [서울둘레길 11코스] 관악산코스 | culture | 서울특별시 동작구 동작대로 지하3 ( | vec:e5-small |
|  | [서울둘레길 13코스] 안양천 상류코스 | leisure | 경기도 안양시 만안구 경수대로 143 | vec:e5-small |
|  | [서울둘레길 1코스] 수락산코스 | leisure | 서울특별시 도봉구 도봉로 948 (도 | vec:e5-small |
|  | [서울둘레길 2코스] 덕릉고개코스 | leisure | 서울특별시 노원구 상계동 산152-1 | vec:e5-small vec:arctic-ko |
|  | [서울둘레길 4코스] 망우·용마산코스 | leisure | 서울특별시 노원구 화랑로 지하510  | vec:e5-small |
|  | [서울둘레길 5코스] 아차산코스 | leisure | 서울특별시 중랑구 면목동 (깔딱고개  | vec:e5-small |
|  | [서울둘레길 6코스] 고덕산코스 | leisure | 서울특별시 광진구 아차산로 지하571 | vec:e5-small |
|  | [서울둘레길 7코스] 일자산코스 | leisure | 서울특별시 강동구 상일동 (명일근린공 | vec:e5-small vec:arctic-ko |
|  | 국립아세안자연휴양림 | nature | 경기도 양주시 백석읍 기산로 472 | vec:arctic-ko |
|  | 긱 라이브하우스 | culture | 서울특별시 마포구 신촌로10길 7 ( | vec:harrier-270m |
|  | 동서울승마클럽 | leisure | 경기도 남양주시 와부읍 월문천로 28 | vec:harrier-270m |
|  | 북악스카이 팔각정 | nature | 서울특별시 종로구 북악산로 267 ( | vec:harrier-270m |
|  | 서울광장 스케이트장 | leisure | 서울특별시 중구 을지로 12 시청광장 | vec:harrier-270m |
|  | 스시고 | food | 서울특별시 서초구 사평대로22길 15 | vec:arctic-ko |
|  | 엑스라이프(X-LIFE) | leisure | 경기도 양평군 옥천면 용천리 산29- | vec:arctic-ko |
|  | 위라이드 서울전차 | leisure | 서울특별시 종로구 종로 19 (종로1 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 장흥관광지 | nature | 경기도 양주시 장흥면 권율로 193 | vec:arctic-ko |
|  | 청계산골든밸리캠핑장 | leisure | 경기도 성남시 수정구 달래내로221번 | vec:arctic-ko |
|  | 청계천 자전거도로 | leisure | 서울특별시 성동구 살곶이길 115 ( | vec:e5-small |
|  | 현대 모터스튜디오 고양 | culture | 경기도 고양시 일산서구 킨텍스로 21 | vec:harrier-270m |
|  | 호전다실 | leisure | 서울특별시 종로구 자하문로11길 16 | vec:arctic-ko |
|  | 홍대걷고싶은거리 | culture | 서울특별시 마포구 서교동 | vec:harrier-270m |

## 비 오는 날 갈만한 곳  `ko`

의도: 실내 시설(박물관·아쿠아리움·워터파크·카페거리). '비응항' 은 0

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | GB가빈아트홀 | culture | 서울특별시 강남구 삼성로 534 (삼 | bm25#10 |
|  | KBS온 | culture | 서울특별시 영등포구 여의공원로 13  | bm25#7 |
|  | 남해척화비 | culture | 경상남도 남해군 설천면 노량로183번 | bm25#9 |
|  | 비응항 | nature | 전북특별자치도 군산시 비응도동 91 | bm25#1 |
|  | 생각하는 정원 | nature | 제주특별자치도 제주시 한경면 녹차분재 | bm25#3 |
|  | 예종대왕태실 및 비 | history | 전북특별자치도 전주시 완산구 태조로  | bm25#4 |
|  | 와온공원 | culture | 전남광주통합특별시 순천시 해룡면 상내 | bm25#5 |
|  | 와온항 | nature | 전남광주통합특별시 순천시 해룡면 상내 | bm25#6 |
|  | 파크하비오 워터킹덤&스파 | nature | 서울특별시 송파구 송파대로 111 ( | bm25#2 |
|  | 한림항 | nature | 제주특별자치도 제주시 한림읍 한림해안 | bm25#8 |
|  | [강원평화누리자전거길 16코스] 고성 울산바위비경길 | leisure | 강원특별자치도 고성군 토성면 잼버리로 | vec:e5-small |
|  | [부산 갈맷길] 2코스 2구간 | leisure | 부산광역시 해운대구 우동 | vec:harrier-270m |
|  | 고산일과해안도로 | nature | 제주특별자치도 서귀포시 대정읍 영락하 | vec:e5-small |
|  | 공지천유원지 | culture | 강원특별자치도 춘천시 이디오피아길 2 | vec:arctic-ko |
|  | 남강댐 노을공원 | nature | 경상남도 진주시 내동면 삼계로 453 | vec:e5-small |
|  | 물안개공원 | culture | 경기 양평군 양평읍 오빈리 154-1 | vec:arctic-ko vec:harrier-270m |
|  | 미포항 | nature | 부산광역시 해운대구 중동 | vec:e5-small |
|  | 바람쐬는길 | culture | 전북특별자치도 전주시 완산구 바람쐬는 | vec:arctic-ko |
|  | 배다리지 | nature | 경기도 평택시 죽백동 | vec:arctic-ko |
|  | 보광사계곡 | nature | 경기도 파주시 광탄면 영장리 | vec:arctic-ko |
|  | 부여하늘날기 | leisure | 충청남도 부여군 부여읍 성왕로173번 | vec:e5-small |
|  | 북한산 백운대 | nature | 서울특별시 강북구 도선사길 234 ( | vec:arctic-ko |
|  | 비내길 | leisure | 충청북도 충주시 앙성면 새바지길 17 | vec:harrier-270m |
|  | 비선대 | nature | 강원특별자치도 속초시 설악산로 109 | vec:e5-small |
|  | 비손농장 | leisure | 경상북도 포항시 북구 청하면 비학로  | vec:e5-small |
|  | 비양도선착장 | nature | 제주특별자치도 제주시 한림읍 한림해안 | vec:e5-small |
|  | 비와야폭포 | nature | 강원특별자치도 태백시 양지길 25 ( | vec:arctic-ko |
|  | 비인 선도리 쌍도해안 | nature | 충청남도 서천군 비인면 선도리 | vec:e5-small vec:harrier-270m |
|  | 비인해변 | nature | 충청남도 서천군 비인면 선도리 | vec:harrier-270m |
|  | 비토국민여가캠핑장 | leisure | 경상남도 사천시 서포면 용궁로 132 | vec:harrier-270m |
|  | 비학농원오토캠핑장 | leisure | 경기도 파주시 법원읍 만월로613번길 | vec:harrier-270m |
|  | 소인국테마파크 | culture | 제주특별자치도 서귀포시 안덕면 화순서 | vec:harrier-270m |
|  | 영도 하늘전망대 | culture | 부산광역시 영도구 동삼동 628-66 | vec:e5-small |
|  | 용산전망대 | culture | 전남광주통합특별시 순천시 해룡면 순천 | vec:harrier-270m |
|  | 유구천핑크뮬리 | nature | 충청남도 공주시 유구읍 유구리 648 | vec:harrier-270m |
|  | 태종대 | nature | 부산광역시 영도구 전망로 24 (동삼 | vec:arctic-ko |
|  | 호수유원지 | nature | 경기도 가평군 북면 도대리 | vec:arctic-ko |

## 실내 놀거리  `ko`

의도: 실내 체험·아이스링크·카트장·키즈카페

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 광주실내빙상장 | leisure | 전남광주통합특별시 서구 금화로 278 | bm25#5 |
|  | 노리매공원 | nature | 제주특별자치도 서귀포시 대정읍 중산간 | bm25#4 |
|  | 러쉬 실내 카트장 | leisure | 전북특별자치도 전주시 완산구 전주객사 | bm25#3 |
|  | 목동아이스링크 | leisure | 서울특별시 양천구 안양천로 939 ( | bm25#2 |
|  | 여성문화회관 수영장 | leisure | 인천광역시 부평구 길주로 539 (갈 | bm25#1 |
|  | 염주실내수영장 | leisure | 전남광주통합특별시 서구 금화로 278 | bm25#7 |
|  | 증평실내수영장 | leisure | 충청북도 증평군 증평읍 인삼로 23- | bm25#8 |
|  | 창원실내수영장 | culture | 경상남도 창원시 성산구 원이대로 45 | bm25#10 |
|  | 청주실내빙상장 | leisure | 충청북도 청주시 청원구 밀레니엄1로  | bm25#6 |
|  | 청주실내수영장 | leisure | 충청북도 청주시 서원구 흥덕로 61  | bm25#9 |
|  | 가평군어린이음악놀이터 | leisure | 경기도 가평군 가평읍 중앙로 10 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 고고랜드롤러스케이트장 일산 본점 | leisure | 경기도 고양시 일산서구 일현로 97- | vec:arctic-ko |
|  | 그라운드플래닛 | leisure | 경기도 과천시 대공원광장로 80 (막 | vec:arctic-ko vec:harrier-270m |
|  | 놀자숲 | culture | 경기도 동두천시 탑동가산로 1 (탑동 | vec:arctic-ko |
|  | 다이나믹 메이즈 속초점 | nature | 강원특별자치도 속초시 원암학사평길 8 | vec:e5-small |
|  | 다이나믹 메이즈 인사동 | nature | 서울특별시 종로구 인사동길 12 (인 | vec:harrier-270m |
|  | 레전드히어로즈 잠실롯데월드몰점 | leisure | 서울특별시 송파구 올림픽로 300 ( | vec:arctic-ko |
|  | 몬스터파크 부산명지점 | leisure | 부산광역시 강서구 명지국제1로 60- | vec:arctic-ko |
|  | 볼베어파크 부천점 | culture | 경기도 부천시 원미구 조마루로 2 ( | vec:arctic-ko |
|  | 스카이롤러파크 | leisure | 부산광역시 기장군 정관읍 정관중앙로  | vec:e5-small |
|  | 신기한놀이터 떼굴떼굴 | leisure | 서울특별시 서대문구 홍제동 산 41- | vec:harrier-270m |
|  | 안동 놀팍 | leisure | 경상북도 안동시 도산면 월천길 300 | vec:e5-small vec:harrier-270m |
|  | 양평어린이건강놀이터 | leisure | 경기도 양평군 양평읍 종합운동장로 5 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 오감만족새싹체험장 | leisure | 충청북도 음성군 원남면 원중로399번 | vec:harrier-270m |
|  | 용평공룡해양랜드 | culture | 강원특별자치도 평창군 대관령면 올림픽 | vec:e5-small |
|  | 울산시립어린이테마파크 | leisure | 울산광역시 동구 등대로 100 (일산 | vec:e5-small |
|  | 재미난 박물관 | culture | 인천광역시 제물포구 신포로23번길 8 | vec:harrier-270m |
|  | 주렁주렁 동물원 동탄점 | culture | 경기도 화성시 동탄대로5길 21 (송 | vec:harrier-270m |
|  | 쥬벅스 | leisure | 인천광역시 남동구 서창남순환로216번 | vec:e5-small |
|  | 키즈런스포츠파크 노원점 | leisure | 서울특별시 노원구 섬밭로 258 (중 | vec:arctic-ko |
|  | 파라다이스시티 원더박스 | nature | 인천광역시 영종구 영종해안남로321번 | vec:e5-small |
|  | 행복&피크닉 | leisure | 강원특별자치도 원주시 복거리길 40 | vec:arctic-ko |

## 미술관  `ko`

의도: 미술관·갤러리

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 교동미술관 | culture | 전북특별자치도 전주시 완산구 경기전길 | bm25#2 |
|  | 사비나미술관 | culture | 서울특별시 은평구 진관1로 93 (진 | bm25#10 |
|  | 엄미술관 | culture | 경기도 화성시 봉담읍 오궁길 37 | bm25#8 |
|  | 여수미술관 | culture | 전남광주통합특별시 여수시 도원로 26 | bm25#6 |
|  | 우리미술관 | culture | 인천광역시 제물포구 화도진로198번길 | bm25#3 |
|  | 우제길미술관 | culture | 전남광주통합특별시 동구 의재로 140 | bm25#4 |
|  | 이강하미술관 | culture | 전남광주통합특별시 남구 3·1만세운동 | bm25#5 |
|  | 전원미술관 | culture | 인천광역시 강화군 송해면 강화대로76 | bm25#1 |
|  | 전혁림 미술관 | culture | 경상남도 통영시 봉수1길 10 | bm25#7 |
|  | 홍천미술관 | culture | 강원특별자치도 홍천군 홍천읍 희망로  | bm25#9 |
|  | C아트뮤지엄 | culture | 경기도 양평군 양동면 다락근이길 57 | vec:e5-small |
|  | MUSEUM 209 | culture | 서울특별시 송파구 잠실로 209 (신 | vec:harrier-270m |
|  | 경기도미술관 | culture | 경기도 안산시 단원구 동산로 268  | vec:arctic-ko |
|  | 경북대학교 미술관 | culture | 대구광역시 북구 대학로 80 (산격동 | vec:harrier-270m |
|  | 경인미술관 | culture | 서울특별시 종로구 인사동10길 11- | vec:e5-small |
|  | 구하우스미술관 | culture | 경기도 양평군 서종면 무내미길 49- | vec:harrier-270m |
|  | 국립현대미술관 서울 | culture | 서울특별시 종로구 삼청로 30 (소격 | vec:e5-small vec:arctic-ko |
|  | 대구미술관 | culture | 대구광역시 수성구 미술관로 40 대구 | vec:arctic-ko vec:harrier-270m |
|  | 마이아트뮤지엄 | culture | 서울특별시 강남구 테헤란로 518 ( | vec:e5-small vec:harrier-270m |
|  | 못난이미술관 | culture | 전남광주통합특별시 무안군 일로읍 상사 | vec:e5-small |
|  | 미술관 자작나무숲 | culture | 강원특별자치도 횡성군 우천면 한우로두 | vec:e5-small |
|  | 부산시립미술관 | culture | 부산광역시 해운대구 APEC로 58  | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 상원미술관 | culture | 서울특별시 종로구 평창31길 27 | vec:arctic-ko |
|  | 서울시립 사진미술관 | culture | 서울특별시 도봉구 마들로13길 68  | vec:arctic-ko |
|  | 수원시립미술관 | culture | 경기도 수원시 팔달구 정조로 833  | vec:harrier-270m |
|  | 시안미술관 | culture | 경상북도 영천시 화산면 가래실로 36 | vec:arctic-ko |
|  | 진도 현대미술관 | culture | 전남광주통합특별시 진도군 진도읍 교동 | vec:harrier-270m |
|  | 천안시립미술관 | culture | 충청남도 천안시 동남구 성남면 종합휴 | vec:arctic-ko |
|  | 한국미술관 | culture | 경기도 용인시 기흥구 마북로 244- | vec:e5-small vec:harrier-270m |
|  | 한국미술관 | culture | 서울특별시 종로구 인사동길 12 (인 | vec:e5-small vec:arctic-ko vec:harrier-270m |

## 한복 대여  `ko`

의도: 한복 대여·체험 매장 — 여기서는 상점이 정답

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 강릉 한복 문화 창작소 | culture | 강원특별자치도 강릉시 동부시장3길 9 | bm25#1 |
|  | 비녀랑 한복이랑 | leisure | 세종특별자치시 조치원읍 안터길 107 | bm25#5 |
|  | 알파인스키보드 대여점 | leisure | 전북특별자치도 무주군 설천면 만선로  | bm25#4 |
|  | 한국한복진흥원 | culture | 경상북도 상주시 함창읍 무운로 159 | bm25#9 |
|  | 한복남 경복궁점 | culture | 서울특별시 종로구 사직로 133-5 | bm25#10 |
|  | 한복남 북촌점 | culture | 서울특별시 종로구 북촌로 35-4 ( | bm25#7 |
|  | 한복남 전주한옥마을점 | culture | 전북특별자치도 전주시 완산구 태조로  | bm25#3 |
|  | 한복남 창덕궁점 | culture | 서울특별시 종로구 돈화문로 86-1  | bm25#8 |
|  | 한복남 프리미엄점 | culture | 서울특별시 종로구 사직로 133-9  | bm25#6 |
|  | 한복입고 유유자적 | culture | 전남광주통합특별시 영암군 군서면 돌정 | bm25#2 |
|  | 대복 | food | 서울특별시 중구 세종대로14길 22 | vec:e5-small vec:arctic-ko |
|  | 동대문종합시장 한복상가 | shopping | 서울특별시 종로구 종로 266 (종로 | vec:arctic-ko vec:harrier-270m |
|  | 전통한복 | shopping | 서울특별시 중구 동호로 249 (장충 | vec:e5-small vec:arctic-ko |
|  | 한복마루 | shopping | 서울특별시 종로구 종로 207 (종로 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 한순례한복침구 | shopping | 서울특별시 강남구 압구정로 164 ( | vec:e5-small |
|  | 한스양복 | shopping | 서울특별시 용산구 이태원로 134 ( | vec:arctic-ko |

## 드라마 촬영지  `ko`

의도: 드라마·영화 촬영 세트장

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | [K드라마 촬영지] 공근혜갤러리 | culture | 서울특별시 종로구 삼청로7길 38 | bm25#4 |
|  | 낭만닥터김사부촬영지 | leisure | 경기도 포천시 영북면 산정호수로 77 | bm25#10 |
|  | 봄의 왈츠 드라마 촬영지 | leisure | 전남광주통합특별시 완도군 청산면 청산 | bm25#1 |
|  | 서편제 촬영지 | leisure | 전남광주통합특별시 완도군 청산면 | bm25#5 |
|  | 섬마을선생촬영지 | leisure | 인천광역시 옹진군 자월면 대이작로 4 | bm25#7 |
|  | 순천 드라마촬영장 | culture | 전남광주통합특별시 순천시 비례골길 2 | bm25#3 |
|  | 웰컴투동막골촬영지 | leisure | 강원특별자치도 평창군 미탄면 동막골길 | bm25#9 |
|  | 자산어보 촬영지 | culture | 전남광주통합특별시 신안군 도초면 발매 | bm25#6 |
|  | 태양의 후예 촬영지 | leisure | 강원특별자치도 태백시 통골길 116- | bm25#8 |
|  | 해양드라마세트장 | leisure | 경상남도 창원시 마산합포구 구산면 석 | bm25#2 |
|  | 논산 선샤인스튜디오 | leisure | 충청남도 논산시 연무읍 봉황로 90 | vec:e5-small vec:arctic-ko |
|  | 만양정육점 | culture | 충청북도 옥천군 옥천읍 마암로1길 5 | vec:arctic-ko vec:harrier-270m |
|  | 문경새재 오픈세트장 | leisure | 경상북도 문경시 문경읍 새재로 932 | vec:e5-small vec:arctic-ko |
|  | 석병리마을 | culture | 경상북도 포항시 남구 구룡포읍 일출로 | vec:harrier-270m |
|  | 쇠와꽃승마장 | leisure | 제주특별자치도 서귀포시 성산읍 섭지코 | vec:e5-small |
|  | 오산 드라마세트장 | leisure | 경기도 오산시 북삼미로 42 (내삼미 | vec:e5-small |
|  | 완도 청해포구촬영장 | leisure | 전남광주통합특별시 완도군 완도읍 청해 | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | 죽성드림세트장 | leisure | 부산광역시 기장군 기장읍 두호1길 2 | vec:e5-small vec:arctic-ko |
|  | 천북 청보리밭 | nature | 충청남도 보령시 천북면 천광로 73- | vec:harrier-270m |
|  | 폭풍속으로 드라마세트장 | culture | 경상북도 울진군 죽변면 등대길 74- | vec:e5-small vec:arctic-ko vec:harrier-270m |

## 일출 명소  `ko`

의도: 일출 전망지(해안·산). 상호 속 '일출' 은 0~1

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 맴섬 | nature | 전남광주통합특별시 해남군 송지면 땅끝 | bm25#9 |
|  | 석포일출일몰전망대 | culture | 경상북도 울릉군 북면 천부리 | bm25#5 |
|  | 성산일출봉 [유네스코 세계자연유산] | nature | 제주특별자치도 서귀포시 성산읍 일출로 | bm25#7 |
|  | 성주산일출전망대 | culture | 충청남도 보령시 성주면 성주리 산37 | bm25#6 |
|  | 일출공원 | culture | 강원특별자치도 동해시 해맞이길 289 | bm25#3 |
|  | 일출랜드 | nature | 제주특별자치도 서귀포시 성산읍 중산간 | bm25#2 |
|  | 일출봉유채밭 | nature | 제주특별자치도 서귀포시 성산읍 성산리 | bm25#4 |
|  | 일출선원 | history | 경상북도 포항시 남구 동해면 정동길  | bm25#1 |
|  | 장길리 복합 낚시공원 | nature | 경상북도 포항시 남구 구룡포읍 동해안 | bm25#10 |
|  | 횟집명소거리 | culture | 강원특별자치도 동해시 일출로 151  | bm25#8 |
|  | 강양항 | nature | 울산광역시 울주군 온산읍 강양길 12 | vec:arctic-ko |
|  | 고삼호수 | nature | 경기도 안성시 고삼면 봉산리 | vec:e5-small vec:arctic-ko |
|  | 구 조선식량영단 군산출장소 | history | 전북특별자치도 군산시 구영2길 43  | vec:e5-small |
|  | 남열해돋이해수욕장 | nature | 전남광주통합특별시 고흥군 영남면 남열 | vec:harrier-270m |
|  | 내수전일출전망대 | culture | 경상북도 울릉군 울릉읍 저동리 산 3 | vec:arctic-ko vec:harrier-270m |
|  | 대포항 전망대 | culture | 강원특별자치도 속초시 대포항1길 16 | vec:e5-small vec:harrier-270m |
|  | 떠오르길·김녕 바닷길 | nature | 제주특별자치도 제주시 구좌읍 김녕로1 | vec:harrier-270m |
|  | 묵호항수변공원 | nature | 강원특별자치도 동해시 일출로 92-1 | vec:e5-small vec:arctic-ko |
|  | 야미도 | nature | 전북특별자치도 군산시 옥도면 야미도리 | vec:e5-small |
|  | 요트탈래울산 | leisure | 울산 동구 일산동 915-41 | vec:harrier-270m |
|  | 웨이브글램핑 | stay | 경상북도 포항시 남구 일출로 465 | vec:arctic-ko |
|  | 전망대활어회센터 | culture | 강원특별자치도 동해시 일출로 88 ( | vec:e5-small |
|  | 중산 일몰전망대 | culture | 전남광주통합특별시 고흥군 남양면 고흥 | vec:arctic-ko |
|  | 하광정항 | nature | 강원특별자치도 양양군 현북면 하륜길  | vec:harrier-270m |
|  | 해맞이공원 | culture | 대구광역시 동구 효목동 212-2 | vec:e5-small vec:arctic-ko vec:harrier-270m |

## 섬 여행  `ko`

의도: 섬·도서 관광지

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | 곤충테마여행 | culture | 경기도 포천시 가산면 시우동2길 44 | bm25#4 |
|  | 남이섬 | culture | 강원특별자치도 춘천시 남이섬길 1 남 | bm25#7 |
|  | 돝섬 | nature | 경상남도 창원시 마산합포구 돝섬2길  | bm25#8 |
|  | 맴섬 | nature | 전남광주통합특별시 해남군 송지면 땅끝 | bm25#6 |
|  | 미르섬 | culture | 충청남도 공주시 금벽로 368 (신관 | bm25#9 |
|  | 배알도 섬 정원 | nature | 전남광주통합특별시 광양시 태인동 산1 | bm25#2 |
|  | 빛의 섬 루미버스 | culture | 제주특별자치도 서귀포시 표선면 민속해 | bm25#3 |
|  | 솔섬 | nature | 경상남도 하동군 금남면 중평해안길 2 | bm25#10 |
|  | 예술의 섬 장도 | culture | 전남광주통합특별시 여수시 웅천동 | bm25#1 |
|  | 제월섬 | nature | 전남광주통합특별시 곡성군 입면 제월리 | bm25#5 |
|  | 같이삽시도 | leisure | 충청남도 보령시 오천면 삽시도1길 8 | vec:harrier-270m |
|  | 고군산군도 | nature | 전북특별자치도 군산시 옥도면 대장도리 | vec:harrier-270m |
|  | 고군산섬잇길 | culture | 전북특별자치도 군산시 옥도면 방축도길 | vec:harrier-270m |
|  | 달아항 | nature | 경상남도 통영시 산양읍 미남리 822 | vec:arctic-ko |
|  | 동검도 | nature | 인천광역시 강화군 길상면 동검길63번 | vec:harrier-270m |
|  | 동섬 | nature | 경상남도 창원시 진해구 경화동 | vec:e5-small vec:harrier-270m |
|  | 무의도 | nature | 인천광역시 영종구 대무의로 310-1 | vec:e5-small |
|  | 소야도 | nature | 인천광역시 옹진군 덕적면 소야리 | vec:e5-small |
|  | 신시모도 | nature | 인천광역시 옹진군 북도면 신도리, 시 | vec:arctic-ko |
|  | 우도 | nature | 제주특별자치도 제주시 삼양고수물길 1 | vec:harrier-270m |
|  | 울릉도 유람선 | leisure | 경상북도 울릉군 울릉읍 도동2길 8- | vec:arctic-ko vec:harrier-270m |
|  | 월등도 | nature | 경상남도 사천시 서포면 비토리 | vec:arctic-ko |
|  | 위도 | nature | 전북특별자치도 부안군 위도면 치도리 | vec:e5-small |
|  | 장봉도 | nature | 인천광역시 옹진군 북도면 장봉리 | vec:arctic-ko vec:harrier-270m |
|  | 장자도여객터미널 | leisure | 전북특별자치도 군산시 옥도면 장자도1 | vec:e5-small vec:harrier-270m |
|  | 적촌선착장 | nature | 경상남도 통영시 용남면 원평리 293 | vec:arctic-ko |
|  | 조도 | nature | 경상남도 남해군 미조면 미조리 | vec:e5-small vec:arctic-ko |
|  | 주문도 | nature | 인천광역시 강화군 서도면 주문도1길  | vec:arctic-ko |
|  | 죽도마을 | culture | 전북특별자치도 고창군 부안면 죽도길  | vec:e5-small |
|  | 창선도 | nature | 경상남도 남해군 창선면 서대리 | vec:arctic-ko |
|  | 풀등모래섬 | nature | 인천 옹진군 자월면 이작리 | vec:e5-small |
|  | 한섬해변&한섬감성바닷길 | nature | 강원특별자치도 동해시 한섬해안길 9  | vec:e5-small |
|  | 행담도 | nature | 충청남도 당진시 신평면 서해안고속도로 | vec:e5-small |

## palace in seoul  `en`

의도: Joseon palaces in Seoul (Gyeongbokgung, Changdeokgung, Deoksugung, Changgyeonggung, Gyeonghuigung)

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | Changgyeonggung Palace | history | 185 Changgyeonggung- | bm25#3 |
|  | Deoksugung Palace | history | 99 Sejong-daero, Jun | bm25#2 |
|  | Earthen Fortification in Jeongbuk-dong | history | 353-2 Jeongbuk-dong, | bm25#9 |
|  | Gyeongbokgung Palace | history | 161 Sajik-ro, Jongno | bm25#1 |
|  | Gyeonghuigung Palace | history | 45 Saemunan-ro, Jong | bm25#8 |
|  | Hackberry Tree in Bukbu-ri | nature | 102-1 Bukbu-ri, Uich | bm25#10 |
|  | Napory Farm in Tongyeong | leisure | 152 Mireuksan-gil, S | bm25#6 |
|  | Temporary Palace at Hwaseong Fortress (Hwaseong Haenggung Palace) | history | 825 Jeongjo-ro, Pald | bm25#5 |
|  | The Kart in Tongyeong | leisure | 147 Dosanilju-ro, Do | bm25#7 |
|  | Yongheunggung Palace | history | 16-1, Dongmunan-gil  | bm25#4 |
|  | Bugak Skyway Palgakjeong Pavilion | nature | 267 Bugaksan-ro, Jon | vec:e5-small |
|  | Ceramic Palace Hall | culture | 90 Irwon-ro, Gangnam | vec:e5-small vec:arctic-ko |
|  | Changdeokgung Palace Complex [UNESCO World Heritage Site] | history | 99 Yulgok-ro, Jongno | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | Deoksugung Palace's Daehanmun Gate | history | 99 Sejong-daero, Jun | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | King Sejong The Great Museum | culture | 56, Hoegi-ro, Dongda | vec:e5-small |
|  | National Palace Museum of Korea | culture | 12 Hyoja-ro, Jongno- | vec:arctic-ko vec:harrier-270m |
|  | Seochon Village | culture | 45 Pirundae-ro, Jong | vec:harrier-270m |
|  | Seoul Plaza | nature | 110 Sejong-daero, Ju | vec:e5-small vec:harrier-270m |
|  | Unhyeongung Royal Residence | history | 464 Samil-daero, Jon | vec:e5-small vec:arctic-ko |

## beach near busan  `en`

의도: beaches in/near Busan (Haeundae, Gwangalli, Songjeong, Songdo)

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | Busan Songdo Beach | nature | 100 Songdohaebyeon-r | bm25#1 |
|  | Daejin Beach | nature | 46 Daejinhang-gil, D | bm25#7 |
|  | Geojampo Beach | nature | 11, Jamjindo-gil, Ye | bm25#2 |
|  | Haeundae Beach | nature | 264 Haeundaehaebyeon | bm25#4 |
|  | Hajodae Beach | nature | 35 Hajodaehaean-gil, | bm25#6 |
|  | Jinha Beach | nature | Jinhari, Seosaeng-my | bm25#5 |
|  | Kkotji Beach | nature | Seungeon-ri, Taean-g | bm25#9 |
|  | Muchangpo Beach | nature | 10 Yeollinbada 1-gil | bm25#10 |
|  | Unyeo Beach | nature | 535-57 Jangsampo-ro, | bm25#8 |
|  | Wangsan Beach | nature | Eulwang-dong, Yeongj | bm25#3 |
|  | Bijindo Beach | nature | 523-3 Bijin-ri, Hans | vec:harrier-270m |
|  | Bongpyeong Beach | nature | 1166, Uljinbuk-ro, U | vec:e5-small |
|  | Bongsudae Beach | nature | Oho-ri, Goseong-gun, | vec:harrier-270m |
|  | Bunam Beach | nature | Bunam Beach Road, Ge | vec:arctic-ko |
|  | Busan Air Cruise | leisure | 171 Songdohaebyeon-r | vec:e5-small |
|  | Byeonsan Beach | nature | 2076 Byeonsan-ro, Bu | vec:arctic-ko vec:harrier-270m |
|  | Dongho Beach | nature | Dongho-ri, Gochang-g | vec:arctic-ko |
|  | Gusan Beach | nature | Gusan-ri, Giseong-my | vec:arctic-ko |
|  | Gwangalli Beach | nature | 219 Gwanganhaebyeon- | vec:e5-small vec:harrier-270m |
|  | Gwangalli Ocean Leports Center | leisure | 222 Gwanganhaebyeon- | vec:e5-small |
|  | Haeundae Beach | nature | 264 Haeundaehaebyeon | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | Hwasun Golden Sand Beach | nature | Hwasunhaean-ro, Seog | vec:e5-small vec:harrier-270m |
|  | Hyanghohaebyeon Beach | nature | Hyangho-ri, Jumunjin | vec:harrier-270m |
|  | Jeoryeonghaean Coastal Walking Trail | nature | 52 Haeansanchaek-gil | vec:e5-small vec:harrier-270m |
|  | Mangsanghaebyeon Beach | nature | 6270-10, Donghae-dae | vec:arctic-ko |
|  | Naksan Beach | nature | 59 Haemaji-gil, Yang | vec:arctic-ko |
|  | Paradise Casino Busan | leisure | 296, Haeundaehaebyeo | vec:e5-small |
|  | Ulsan Ilsan Beach (일산해수욕장 (울산)) | nature | 18 Haesuyokjang 10-g | vec:e5-small vec:arctic-ko |

## quiet temple  `en`

의도: Buddhist temples, mountain temples

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | Bogyeongsa Temple | history | 523 Bogyeong-ro, Son | bm25#10 |
|  | Dasolsa Temple | history | 417 Dasolsa-gil, Sac | bm25#9 |
|  | Dogapsa Temple | history | 306, Dogapsa-ro, Yeo | bm25#8 |
|  | Gakwonsa Temple | history | 245 Gagwonsa-gil, Do | bm25#4 |
|  | Gamchusa Temple | history | 120 Haean-ro, Dongha | bm25#2 |
|  | Gujeolsa Temple | history | 226, Sangjung-gil, G | bm25#3 |
|  | Mihwangsa Temple | history | 164 Mihwangsa-gil, H | bm25#6 |
|  | Mugaksa Temple | history | 230, Uncheon-ro, Seo | bm25#1 |
|  | Taeansa Temple | history | 622-215, Taean-ro, J | bm25#7 |
|  | Unjusa Temple | history | 91-44, Cheontae-ro,  | bm25#5 |
|  | Banyasa Temple (반야사(논산)) | history | 104 Samjeon-gil, Gay | vec:e5-small vec:arctic-ko |
|  | Bulguksa Temple | history | 385 Bulguk-ro, Gyeon | vec:harrier-270m |
|  | Bulhoesa Temple (Naju) (불회사(나주)) | history | 1224-142 Dado-ro, Da | vec:e5-small |
|  | Cheongansa Temple | history | 20-8, Bulgwang-ro 10 | vec:arctic-ko |
|  | Cheongju Yonghwasa Temple (용화사(청주)) | history | 565 Musimseo-ro, Seo | vec:e5-small |
|  | Chungju Seokjongsa Temple (석종사(충주)) | history | 271-56 Jikdong-gil,  | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | Dorisa Temple (Gumi) (도리사(구미)) | history | 526 Dorisa-ro, Haepy | vec:arctic-ko |
|  | Ganghwa Bomunsa Temple (보문사 (강화)) | history | 44 Samsannam-ro 828b | vec:e5-small |
|  | Gilsangsa Temple (Seoul) (길상사(서울)) | history | 68 Seonjam-ro 5-gil, | vec:e5-small vec:harrier-270m |
|  | Goseong Hwaamsa Temple (화암사(고성)) | history | 100 Hwaamsa-gil, Tos | vec:harrier-270m |
|  | INSILENCE Seongsu Store[Tax Refund Shop] | shopping | 2F, 5, Yeonmujang 17 | vec:harrier-270m |
|  | Jeongchwiam Hermitage | history | 675-87 Duncheolsan-r | vec:arctic-ko |
|  | Jingwansa Temple (Seoul) [진관사(서울)] | history | 73 Jingwan-gil, Eunp | vec:e5-small vec:arctic-ko |
|  | Naewonsa Temple (Yangsan) (내원사(양산)) | history | 207 Naewon-ro, Habuk | vec:arctic-ko |
|  | Seosan Seogwangsa Temple (서광사(서산)) | history | 44, Buchunsan 1-ro,  | vec:arctic-ko |
|  | Suseonsa Temple | history | 102-23 Ungseokbong-r | vec:arctic-ko |
|  | Templestay Information Center | culture | 56, Ujeongguk-ro, Jo | vec:e5-small vec:harrier-270m |
|  | Tempur - Shinsegae Simon Premium Outlet Siheung Branch [Tax Refund Shop] | shopping | 2F, 699, Seohaean-ro | vec:e5-small |
|  | Uljin Bulyeongsa Temple (불영사(울진)) | history | 48, Buryeongsa-gil,  | vec:harrier-270m |
|  | Yeonggwang Bulgapsa Temple (불갑사 (영광)) | history | 450, Bulgapsa-ro, Ye | vec:harrier-270m |

## night view  `en`

의도: night view spots, bridges, observatories

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | Busan Yacht Tour 3355 Marine | leisure | 84 Haeundaehaebyeon- | bm25#7 |
|  | Chungju Tangeumho Rainbow Road | leisure | Ruam-ri, Jungangtap- | bm25#9 |
|  | Chungmugong Night Cruise | leisure | 269-38 Donam-ro, Ton | bm25#1 |
|  | Eight Scenic Views of Bukchon | history | 37, Gyedong-gil, Jon | bm25#2 |
|  | Haeundae River Cruise | leisure | 85 Suyeonggangbyeon- | bm25#8 |
|  | Janghwa-ri Sunset Viewing Point | nature | 1408 Janghwa-ri, Hwa | bm25#3 |
|  | Odojae Pass & Jirisan View Park | nature | 534 Jirisanganeun-gi | bm25#4 |
|  | Romantic Cart Bars | culture | 102 Hamel-ro, Yeosu- | bm25#10 |
|  | Soho Dongdong Bridge | culture | 505-2 Soho-dong, Yeo | bm25#6 |
|  | Ulsandaegyo Observatory | culture | 155-1 Bongsu-ro, Don | bm25#5 |
|  | Busan Tower | culture | 37-30 Yongdusan-gil, | vec:e5-small |
|  | Cheorwon Peace Observatory | culture | 588-14, Junggang-ri, | vec:arctic-ko |
|  | E-World 83 Tower | culture | 200 Duryugongwon-ro, | vec:arctic-ko |
|  | Gangneung Night | food | 74 Sanyang-gil, Gang | vec:harrier-270m |
|  | Garden Beau [Tax Refund Shop] | shopping | 166, Magokdong-ro, G | vec:e5-small vec:arctic-ko |
|  | Mokpo Skywalk | culture | 59 Haeyangdaehak-ro, | vec:arctic-ko vec:harrier-270m |
|  | Namhae Treasure Island Observatory | culture | 720 , Dongbu-daero,  | vec:harrier-270m |
|  | Noctemare Media Art | culture | 294 Manseong-ro, Yeo | vec:harrier-270m |
|  | SEEHO VISION E-Mart Bucheon Branch[Tax Refund Shop] | shopping | 4F, 1, Bucheon-ro, S | vec:e5-small |
|  | Sajik Forest of Light | culture | 49 Sajik-gil, Nam-gu | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | Sokcho Eye (속초해수욕장 대관람차(속초아이)) | leisure | 2 Cheonghohaean-gil, | vec:e5-small |
|  | Terra Fantasia | culture | 191 Bidulginang-gil, | vec:arctic-ko vec:harrier-270m |
|  | VIEWRAUM Mecenatpolis Branch [Tax Refund Shop] | shopping | 45, Yanghwa-ro, Mapo | vec:e5-small |
|  | Viewmap Yeonnam [Tax Refund Shop] | shopping | 1, Yeonnam-ro, Mapo- | vec:e5-small |
|  | Yacht Tale | leisure | 52 , Dongbaek-ro, Ha | vec:arctic-ko |
|  | Yeongdo Cheonghak Reservoir Observatory | culture | 36 Wachi-ro, Yeongdo | vec:e5-small |
|  | vyur LOTTE Premium Outlets Dongbusan Branch [Tax Refund Shop] | shopping | 2F, 147, Gijanghaean | vec:e5-small |

## kids friendly place  `en`

의도: theme parks, zoos, children's museums. 'Place' in a name is 0

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | Del Pino Ocean Play | culture | 1153 Misiryeongyet-g | bm25#4 |
|  | Dochidol Ranch | culture | 293 Dochidol-gil, Ae | bm25#8 |
|  | Goesan Natural Dream Park (자연드림파크(괴산)) | culture | 240 Jayeondream-gil, | bm25#7 |
|  | Gwangju Pyeongchon Village | culture | 15 Pyeongchon-gil, B | bm25#6 |
|  | Mangnidan Street | culture | Poeun-ro, Mapo-gu, S | bm25#5 |
|  | Nambusan Church | culture | 300 Jinnam-ro, Busan | bm25#10 |
|  | Osiria Coastal Walk | nature | Sirang-ri, Gijang-eu | bm25#9 |
|  | Santokki Park | leisure | 623 , Ibang-ro, Chan | bm25#3 |
|  | Twelve Scenic Places of Ulsan City | nature | Ulsan Metropolitan C | bm25#2 |
|  | Waple Wood Artwork Place | culture | 5-6 Wangsimni-ro 10- | bm25#1 |
|  | Children's Museum | culture | 130 Eoulluri-ro, Sej | vec:arctic-ko |
|  | Daks Kids - LOTTE Premium Outlets Paju Branch [Tax Refund Shop] | shopping | 430, Hoedong-gil, Pa | vec:e5-small |
|  | Figure Friends [Tax Refund Shop] | shopping | 8, Yanghwa-ro 18an-g | vec:e5-small |
|  | Gyeonggi Childrens Museum | culture | 6, Sanggal-ro, Giheu | vec:harrier-270m |
|  | KENZO Kids Shinsegae Department Store Gangnam Branch [Tax Refund Shop] | shopping | 176, Sinbanpo-ro, Se | vec:e5-small |
|  | KidZania Seoul | leisure | 240, Olympic-ro, Son | vec:harrier-270m |
|  | Kids Mall - Renecite Branch [Tax Refund Shop] | shopping | 7, Gwangjang-ro, Sas | vec:arctic-ko vec:harrier-270m |
|  | Laughing Child - Hyundai Department Store Mia Branch [Tax Refund Shop] | shopping | 315, Dongsomun-ro, S | vec:arctic-ko |
|  | Laughing Child - Hyundai Outlet Garden Five Branch [Tax Refund Shop] | shopping | 66, Chungmin-ro, Son | vec:arctic-ko |
|  | Laughing Child - Hyundai Outlets Dongdaemun Branch [Tax Refund Shop] | shopping | 8F, 20, Jangchungdan | vec:arctic-ko |
|  | Laughing Child - Starfield City Wirye Branch [Tax Refund Shop] | shopping | 200, Wirye-daero, Ha | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | Marithé Kids LOTTE Premium Outlet Giheung Branch[Tax Refund Shop] | shopping | 1F, 124, Singomae-ro | vec:e5-small |
|  | NBA Kids - NC Singuro Branch [Tax Refund Shop] | shopping | 152, Gurojungang-ro, | vec:e5-small |
|  | PUMA Kids Shinsegae Department Store Times Square Branch [Tax Refund Shop] | shopping | 8F, 9, Yeongjung-ro, | vec:e5-small |
|  | Playtime - Lotte Outlets Buyeo Branch [Tax Refund Shop] | shopping | B1F, 387, Baekjemun- | vec:arctic-ko vec:harrier-270m |
|  | Pony Land | leisure | 153-29 Daeam 1-gil,  | vec:harrier-270m |
|  | S Market Kids - LOTTE Premium Outlets Paju Branch [Tax Refund Shop] | shopping | 2F, 430, Hoedong-gil | vec:e5-small |
|  | S-Market Kids - NC Singuro Branch [Tax Refund Shop] | shopping | 152, Gurojungang-ro, | vec:e5-small |
|  | Seoul Children's Grand Park | nature | 216 Neungdong-ro, Gw | vec:arctic-ko vec:harrier-270m |
|  | Seoul Children's Museum | culture | 216 Neungdong-ro, Gw | vec:harrier-270m |
|  | SmartFriends Gangnam Station Underground Shopping Center Branch[Tax Refund Shop] | shopping | 396, Gangnam-daero,  | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | Sweet Park (Lotte Children's Food Experience Center) (스위트파크(롯데어린이식품체험관)) | culture | 201 Magokjungang-ro, | vec:arctic-ko vec:harrier-270m |

## hot spring  `en`

의도: hot springs / spa resorts

| grade | 제목 | 분류 | 주소 | 찾은 곳 |
|---|---|---|---|---|
|  | Bugok Hot Springs Special Tourist Zone | nature | 77 Oncheonjungang-ro | bm25#10 |
|  | Cheoksan Hot Springs Zone | leisure | 288 Gwangwang-ro, So | bm25#5 |
|  | Deungeok Hot Springs | leisure | 197, Alpeuseuoncheon | bm25#2 |
|  | Onyang Hot Springs | leisure | 1459 Oncheon-daero,  | bm25#3 |
|  | Oreve Hot Spring & Spa | leisure | 152 Taepyeong-ro, Se | bm25#7 |
|  | Suanbo Hot Springs Foot Bath Path | leisure | 35 Jujeongsan-ro, Su | bm25#8 |
|  | Suanbo Hot Springs Special Tourist Zone | culture | 12 Jujeongsan-ro, Su | bm25#9 |
|  | Weolmoon Hot Spring Resort | leisure | 5 Beodeul-ro 1597beo | bm25#4 |
|  | Yulam Hot Springs | leisure | 434-14 Oncheon-ro, P | bm25#6 |
|  | Yuseongoncheon Hot Springs | leisure | Oncheon-ro, Yuseong- | bm25#1 |
|  | Asan-si Hot Springs Special Tourist Zone | nature | 1459 Oncheon-daero,  | vec:e5-small vec:arctic-ko vec:harrier-270m |
|  | Deokgu Spaworld | leisure | 924, Deokguoncheon-r | vec:arctic-ko vec:harrier-270m |
|  | Hanwha Resort Sanjeonghosu Annecy Hot Spring | leisure | 402 Sanjeonghosu-ro, | vec:harrier-270m |
|  | Hurshimchung | leisure | 32 Oncheonjang-ro 10 | vec:arctic-ko vec:harrier-270m |
|  | Ildong Jaeil Yuhwang Oncheon | leisure | 1210 Hwadong-ro, Ild | vec:harrier-270m |
|  | Jeju Sanbangsan Carbonate Hot Springs | leisure | 192, Sagyebuk-ro 41b | vec:e5-small |
|  | Mt. Palgong Hot Spring Tourist Hotel (팔공산온천관광호텔(온천)) | leisure | 11 Palgongsan-ro 185 | vec:arctic-ko |
|  | Paradise Spa Dogo | leisure | 176 Dogooncheon-ro,  | vec:arctic-ko |
|  | Sono Belle Cheongsong Solsaem Hot Spring | leisure | 494-1 Juwangsan-ro,  | vec:e5-small vec:arctic-ko |
