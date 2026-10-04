# P1 전장 배경 원화

도구: 내장 image_gen. 결과 `03-empty-battlefield.png`, 스프라이트·타일 격자·진영 표시·방향·UI는 포함하지 않는 빈 전장 배경.

## 프롬프트

```text
Use case: stylized-concept. Asset type: empty battlefield background asset for playable Korean Joseon tower defense "대전 디펜스". Reference image is ONLY approved painted material and style reference, not geometry to copy. Produce one SQUARE native image, highest native resolution supported. ONE independent Korean fortress gate, ONE flat empty square-ish courtyard, ONE open outer dirt-and-stone invasion road. Absolutely NO soldiers, weapons, flags, grids, tile grid lines, text, UI, arrows, bars or panels. Runtime overlays all of them. This is background scenery only, not a gameplay screenshot.
Camera strictly near overhead orthographic 75 degrees, top-down straight axes, no diamond isometric, very little perspective. Match reference rich but restrained ink outlines, Korean dark tiled roofs, moss, warm worn stone, earthy packed road, pine trees, wood fence. Keep shadows/subtle shades compatible with the illustrated Korean sprites. No shiny 3D.
Exact normalized layout: at top center x=0.50 y=.10 to .20, modest dark Korean tiled fortress gate, gate doorway centered x=.50 y=.16. Gate with short wall to either side across top. Empty deployment courtyard is unobstructed rectangular horizontal flat pale stone field x=.25 to .79, y=.34 to .82. No internal lines or paving subtiles, plain continuous slightly weathered flat stone surface for runtime 5x5 grid, no perspective distortion. Raised thin low edge around courtyard no tall objects. Leave a broad walkable road along bottom y=.89 between x=.87 and .14; along left x=.14 between y=.89 and .25; along top y=.25 from x=.14 to .50; short connection center x=.50 from y=.25 into gate at y=.16. This is a SINGLE OPEN ROAD with entry at bottom right, travels across bottom toward left, up left side, then right along upper edge to gate. NOT a complete loop, do not connect right road up to gate, do not add second gate. Road width .09 of image, clear continuous tan packed earth and sparse worn stones. Empty but clearly accessible through gate doorway.
Scenery at far edges only x<.07, x>.91 and upper corners: restrained Korean pine, rocks, bamboo wooden palisades and a few crates. No trees, rocks, furniture, fires or architecture over path or courtyard. Warm daylight. Preserve enough calm empty space for small tiny game units. Natural moss details at boundaries, distinguish light stone courtyard from darker earth road. Colors sourced from reference root heritage materials: ink, dark tiled roof, hanji pale stone, muted ocher earth, pine greenery. No blue/red team color baked into image since it will be reused twice. No watermark.
```

## 시각 확인과 논리 경로

한 개의 상단 성문, 중앙 빈 배치장, 아래·왼쪽·상단 도로를 확인했다. 이 배경을 양쪽에 독립 사용해 공동 성문으로 보이지 않게 한다. 생성 배치장 실제 가장자리는 대략 x=.19..86,y=.27..78로 요청 좌표와 차이가 있다. 런타임 격자는 이 돌마당 안에 그리고 실제 논리 경로는 아래 입구→왼쪽→상단→성문으로 표시한다. 오른쪽 자갈 풍경은 논리 적 이동로가 아니다. 통이미지에서 유닛·격자·UI를 잘라 쓰지 않는다. 배경 한 장만으로 실제 경로·배치·전투를 구현했다고 주장하지 않는다.
