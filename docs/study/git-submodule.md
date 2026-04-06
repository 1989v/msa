# Git Submodule 동작 원리

## 개요

Git submodule은 하나의 Git 저장소 안에 다른 Git 저장소를 **독립적으로** 포함시키는 메커니즘이다.
부모 repo는 서브모듈의 파일 내용을 직접 추적하지 않고, **특정 커밋 SHA 하나만 포인터로 기록**한다.

---

## 핵심 개념: 커밋 해시 포인터

### 부모 repo가 저장하는 것

```
160000 commit 6444956c37dd5b6176488884da2c8a498523dfcf  ai
160000 commit 601e04d126ada126afdd70ec53a9546cdd5d3f8c  charting
```

- `160000`은 Git의 submodule 전용 파일 모드 (일반 파일은 `100644`, 디렉토리는 `040000`)
- 40자리 hex 값은 해당 서브모듈이 **체크아웃해야 할 정확한 커밋 SHA**

### 브랜치가 아닌 커밋을 고정하는 이유

브랜치는 움직이는 포인터다. `main`을 따라가게 하면 누군가 push할 때마다 부모 repo의 결과물이 달라진다.

커밋 SHA를 고정하면:
- 6개월 뒤에 clone해도 **동일한 코드** 보장
- 서브모듈이 아무리 업데이트돼도 부모가 **명시적으로 갱신하기 전까지 영향 없음**
- **재현 가능한 빌드(reproducible build)** 달성

---

## 구성 요소 3가지

| 파일/위치 | 역할 | 공유 여부 |
|-----------|------|-----------|
| `.gitmodules` | 서브모듈의 path와 원격 URL 매핑 | O (커밋됨) |
| `.git/config` | `git submodule init` 후 로컬에 복사된 URL 설정 | X (로컬) |
| git tree의 커밋 해시 | 부모가 "이 서브모듈은 이 커밋을 써라"라고 고정하는 포인터 | O (커밋됨) |

### `.gitmodules` 예시

```ini
[submodule "ai"]
    path = ai
    url = https://github.com/1989v/ai

[submodule "charting"]
    path = charting
    url = https://github.com/1989v/msa-charting.git
```

---

## 전체 구조

```
[부모 msa repo]
    │
    ├── ai  ──→  커밋 6444956 (포인터만 저장)
    │              ↓
    │         [ai repo]  ← 독립된 git 저장소
    │              └── 실제 파일들...
    │
    ├── charting ──→  커밋 601e04d (포인터만 저장)
    │                   ↓
    │              [charting repo]  ← 독립된 git 저장소
    │
    └── 기타 서브모듈들...
```

부모 repo는 서브모듈의 **파일 내용을 모르고**, 오직 **어떤 커밋을 체크아웃할지만** 추적한다.

---

## IDE 변경 리스트에 보이는 해시값의 정체

IDE에서 `ai` 폴더에 `f38d257f...` 같은 값이 변경으로 표시되는 이유:

1. `ai` 서브모듈 안에서 새 커밋을 만들었거나 pull 했음
2. 부모 repo 입장에서 **포인터가 가리키는 커밋 해시가 바뀜** (예: `6444956` → `f38d257`)
3. 아직 부모 repo에서 이 변경을 커밋하지 않은 상태

이 변경을 확정하려면 부모 repo에서 `git add ai && git commit`을 해야 한다.

---

## 주요 명령어

### 최초 clone 시 서브모듈 포함

```bash
# 방법 1: clone 시 한번에
git clone --recurse-submodules <repo-url>

# 방법 2: clone 후 초기화
git clone <repo-url>
git submodule init
git submodule update
```

### 서브모듈을 최신 커밋으로 갱신

```bash
# 방법 1: 서브모듈 안에서 직접 pull
cd ai
git pull origin main
cd ..
git add ai
git commit -m "chore: update ai submodule"

# 방법 2: 부모에서 한 줄로
git submodule update --remote ai
git add ai && git commit -m "chore: update ai submodule"
```

어느 쪽이든 **부모 repo에서 커밋해야** 포인터가 갱신된다. 자동으로 따라가는 것은 없다.

### 서브모듈 상태 확인

```bash
git submodule status
# 출력 예시:
#  6444956c37dd5b6176488884da2c8a498523dfcf ai (heads/main)
# +f38d257f1413c7964df5add9bb509ea30167a18c charting (heads/main)
#  ↑ +가 붙으면 부모가 기록한 커밋과 현재 체크아웃된 커밋이 다르다는 뜻
```

### 서브모듈 추가/제거

```bash
# 추가
git submodule add <url> <path>

# 제거 (3단계)
git submodule deinit -f <path>
rm -rf .git/modules/<path>
git rm -f <path>
```

---

## 2단계 커밋 워크플로

서브모듈 작업은 항상 **2단계 커밋**이 필요하다:

```
1단계: 서브모듈 내부에서 작업 → 커밋 → 푸시
       (서브모듈은 독립된 repo이므로 독자적으로 커밋/푸시)

2단계: 부모 repo에서 git add <submodule> → 커밋
       (부모의 포인터를 새 커밋 SHA로 갱신)
```

2단계를 빠뜨리면 다른 사람이 부모 repo를 pull할 때 여전히 **이전 커밋**을 체크아웃하게 된다.

---

## 주의사항

- 서브모듈 안에서 `detached HEAD` 상태가 되기 쉬움 → 작업 전 `git checkout main` 확인
- `git pull`만으로는 서브모듈이 갱신되지 않음 → `git submodule update` 별도 실행 필요
- CI/CD에서 `--recurse-submodules` 플래그를 빠뜨리면 빈 디렉토리로 빌드됨
