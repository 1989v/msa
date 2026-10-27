# 원작 생성기 평가 자료

`data/original-normal-20261028.json`은 맵 설계 참고와 물리 비교용 자료입니다. Roblox의 파트 개수나 좌표를 원작과 같게 만드는 것이 제품 목표는 아닙니다.

- 명시 시드20261028, 보통 난이도, 생성목표3220 원작단위.
- 실제 원본 Tower/Leap/Biome/Pal/KgdMover 소스를 독립 .NET8 프로젝트에서 컴파일하여 실행합니다. 새 계단 생성기를 따로 작성하지 않습니다.
- Unity 배치 실행은 라이선스 부재로 exit198 실패했습니다. `/private/tmp/roblox-original-kpy_oise/export.log`에 `No valid Unity Editor license found`가 남아 있습니다. 라이선스를 우회하지 않았습니다.
- 대체 실행은 Unity엔진 출력이 아닙니다. `MathAdapter.cs`의 MathF, float벡터, System.Random(.NET8) 동작이 원래 Unity의 부동소수/난수 출력과 bit단위로 같다는 보장은 없습니다.
- Tower는 원본 첫부분~BandOf(1283줄)와 생성에서도 쓰는 Bhash(1538~1546줄)를 그대로 사용하며 렌더 메서드들을 제외합니다. Biome에서는 카메라/빛을 직접 변경하는 Apply만 제외합니다. Climber의 Height1.8/Radius.42는 어댑터에 명시합니다.
- 원작 파일을 수정하지 않고 `/private/tmp/roblox-original-source-*` 안에만 호스트 사본과 빌드 캐시를 만듭니다. 원본/어댑터의 SHA256와 절단정보는 `data/provenance.json`에 있습니다.

```sh
# 비대화형 원본 알고리즘 평가(기본 경로는 설치된 Unity의 독립.NET SDK)
python3 roblox/infinity-step/tools/export_source_host.py
# 유효 라이선스가 별도로 있을 때만 사용할 Unity엔진 경로. 현재 환경은 실패 상태.
python3 roblox/infinity-step/tools/export_original.py
```

확보한 자료: 슬래브1901(Dead26), 유효1875, 보장경로796, LinkArc795개 모두valid, 생성최고3223.533 원작단위. 실제 웹플레이나 Roblox Studio 물리 검증을 의미하지 않습니다.
