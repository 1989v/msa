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
