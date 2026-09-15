# 프로바이더 · comfyui — 로컬 ComfyUI(Apple Silicon/MPS) 로 2D 에셋 생성

유료 이미지 API 없이 로컬 ComfyUI 로 PNG 를 만들고, 배경 제거 → 정규화 → 스프라이트시트까지 잇는다.
**상태(2026-09-15): 스크립트 골격이다. ComfyUI 실연동은 미검증** — 아래 사다리를 STEP 1 부터 밟고, 각 단계가
실제로 동작한 것을 확인한 뒤에만 다음으로 간다. 문제가 나면 우회하지 말고 환경과 오류 메시지부터 본다.

## 언제 쓰나

`BRIEF.md` 의 아트 프로바이더가 `comfyui` 일 때. 그래도 **코어 루프·게임필은 procedural 로 먼저** 만들고
이미지는 나중에 갈아 끼운다 — 이미지 생성이 막혀도 게임이 막히면 안 된다.

## 사다리 (STEP 1~11)

| STEP | 할 일 | 확인 |
|---|---|---|
| 1 | ComfyUI 설치(Desktop 또는 공식 저장소, Apple Silicon 에서 안정적인 쪽). MPS 가속 | `http://127.0.0.1:8188` 응답 |
| 2 | 체크포인트 1개(SDXL 또는 경량) 를 `models/checkpoints/` 에 | UI 에서 로드 |
| 3 | UI 에서 512×512 **1장** 생성 | PNG 저장됨 |
| 4 | 같은 UI 로 "투명 배경 2D 게임 캐릭터 1장" — 전신·중앙·단일·실루엣 명확 | 작게 봐도 읽힘 |
| 5 | 배경 제거를 **생성과 분리** — `process_asset.py`(rembg 등 로컬 도구) | 알파 PNG |
| 6 | PNG 정규화: crop → padding → 512 리사이즈 | 규격 일치 |
| 7 | 그 워크플로를 **API 포맷**으로 저장 → `workflows/sdxl-txt2img.json` 의 자리표시자에 맞춘다 | JSON 존재 |
| 8 | `generate_asset.py` 가 `/prompt` 로 같은 결과를 냄. **같은 seed·같은 프롬프트 → 같은 그림** | 재현성 |
| 9 | `--type character --name x --prompt "…"` 한 명령으로 raw+metadata 저장 | `assets/generated/raw/x.png` + `x.json` |
| 10 | 배치: 이름·프롬프트 목록으로 N장 (512 → 4장 → 20장 순으로 늘린다) | 메모리 안정 |
| 11 | `create_spritesheet.py` 로 클립 폴더 → 시트 + 프레임 JSON | 게임에서 로드 |

M4 Pro 주의: 처음부터 1024² · FLUX · batch 8 로 가지 않는다. **512² · 1장 · 고정 seed** 가 첫 목표다.

## 프롬프트 구조 — 한 줄로 관리하지 않는다

`prompts/style.json` 의 슬롯을 합쳐 만든다. 게임 전체에서 **고정**: checkpoint · sampler · scheduler · resolution ·
GLOBAL_STYLE · CAMERA · lighting · composition. 캐릭터마다 **바꾸는 것**: description · color · equipment · expression · pose.

```
[ASSET_TYPE 문구] + CHARACTER_DESCRIPTION + POSE + CAMERA + GLOBAL_STYLE + QUALITY + BACKGROUND
NEGATIVE 는 공통
```

## 명령

```bash
python3 assets/providers/comfyui/generate_asset.py --type character --name robot_warrior_001 \
  --prompt "cute small retro robot warrior, short energy sword" --seed 12345
python3 assets/providers/comfyui/process_asset.py --in assets/generated/raw/robot_warrior_001.png \
  --out assets/generated/processed/robot_warrior_001.png --size 512
python3 assets/providers/comfyui/create_spritesheet.py --dir assets/characters/robot/idle --out assets/characters/robot/idle.png --cols 4
```

Python 의존성: `generate_asset.py` 는 표준 라이브러리만. `process_asset.py`·`create_spritesheet.py` 는 Pillow, 배경 제거는 rembg(선택).

## 에셋 메타데이터

생성마다 `assets/generated/raw/<name>.json` — name · type · model · seed · width · height · prompt · negative_prompt · created_at.
`assets/manifest.json` 에도 한 줄 옮긴다. seed 와 프롬프트가 없으면 그 그림은 다시 만들 수 없다.

## 폴더

```
assets/
  characters/ enemies/ vehicles/ items/ backgrounds/ ui/     # 게임이 읽는 최종본
  generated/ raw/ processed/                                 # 생성 원본 · 정규화본 (raw 는 git 제외)
  providers/comfyui/ workflows/ prompts/ *.py
```
