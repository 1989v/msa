# Asset production manifest
## 현재 아트 산출물의 용도
00은 승인 톤,01은 성장 후 전장,02는 아군·탑 컨셉,03은 적·보스 컨셉.
모두 opaque 디자인 이미지이며 현재 게임에 직접 사용할 투명 atlas/프레임 애니메이션은 아니다.
생성 그림의 그리드/배율/한글은 완벽한 규격을 보장하지 않는다. 아래 표를 다음 제작 단계의 계약으로 사용한다.

## 아군
| id | 실루엣·색 | 필수 상태 |
|---|---|---|
| archer | 짧은 파랑 후드·기본 활·허리 화살통 | idle2/walk6/shoot6/hit1/death4 |
| hero_archer | 아이보리 테두리 청록 망토·복합 활, 같은 체격 | idle2/walk6/shoot6/hit1/death4 |
| longbow | 초록 긴 망토·길고 가는 활·높은 화살통 | idle2/walk6/shoot6/hit1/death4 |
| carpenter | 황갈색 앞치마·도구벨트·머리 노출 | idle2/walk6/chop6/mine6/carry6/build6/hit1/death4 |

캐릭터는8방향, 발바닥 pivot, 같은 프레임크기96×96 소스, opaque body높이64px로 제작 후 .5world scale.
원화와 다르게 촬영 방향을 임의 front portrait로 변경하지 말 것. 좌우대칭으로 도구손/화살통이 튀는 문제 검수.
루프: idle4fps/walk10fps, shoot6프레임은 실제 공격간격에 맞춰 재생, 발사 프레임4와 피해 시점 분리.
sprite grid행=방향(S,SW,W,NW,N,NE,E,SE), 열=프레임, clip별 파일. atlas JSON은 frame/pivot/opaqueBounds/clip/dir/fps 제공.
한꺼번에 8방향 모든 프레임을 이미지 생성으로 얻었다고 가정하지 말 것. 1역할1방향 걷기·사격부터 브라우저 검증.

## 적/보스
기본6종: zombie,ghoul,plague,bat,armored,vampire. 중간2:executioner,mine_lord. 최종:count.
각 idle2/move6/attack6/hit1/death4,8방향(박쥐 flying6; boss 별 tell6/cast6).
보스 크기는 DESIGN.md 비율, 얼굴 디테일보다 자세/무기/망토 외곽으로 구분.
공격예고는 지면의 별도 실제 범위효과, 원화에 고정으로 구워넣지 않음.

## 지형/시설/효과
- tile32world: 흙/자갈/풀/바위변형 각8, 자연 블렌딩 가장자리, no visible grid.
- 고도0/1/2 cliff faces,모서리·램프4방향·층간 연결,지형 collision/vision metadata.
- 나무6변형·채집 동작용 밑동·광산입구·광석·운반짐 wood/ore 각각.
- hall/well/recruit marker,타워 frame/construction25/50/75/complete/damaged/destroyed.
- 주둔 병력은 동적 aperture overlay로 표시. 빈 탑 이미지에 활잡이를 그려 고정하지 않음.
- crypt/camp6종 변형, dungeon door open/locked, bosses entrances, arrows, impacts, modest blood/debris.
- 오디오: 나무·채광·망치·활 시위·화살·발걸음·좀비·보스예고. 원작 추출금지.

## 산출·성능 목표
지역/역할별 atlas2048 이하 분할, WebP/PNG와 라이선스/출처 기록. 첫 playable download≤12MB 목표, 추가던전 lazy load.
500visible objects 테스트 시 GPU 메모리≤128MB 목표. 요구 수치이지 측정 완료 아님.
본 세션은 에셋 생성 파이프라인·atlas export·sprite code 구현을 하지 않는다.

<!-- source: portal-fe/public/games/lib/relay.js -->
<!-- source: portal-fe/public/games/lib/platform.js -->
