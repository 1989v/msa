# Frontend Design Convention

AI 에이전트가 FE 코드를 생성할 때 적용하는 디자인 가드레일.
"AI가 만든 티"(AI Slop)를 방지하고 디자인 완성도를 높이는 것이 목적이다.

> 출처: [Impeccable](https://impeccable.style/) 규칙을 MSA 프로젝트에 맞게 내재화.
> 외부 의존성 없이 이 문서 자체가 source of truth.

---

## 1. AI Slop 금지 패턴

AI가 반복적으로 생성하는 제네릭 패턴. **코드 리뷰 시 자동 FAIL 대상.**

### 시각 요소
| 패턴 | 설명 |
|------|------|
| Side-stripe border | 카드 한쪽에 두꺼운 색상 보더 (`border-left: 4px solid`) |
| Gradient text | `background-clip: text` + 그래디언트 |
| Glassmorphism 남용 | 장식용 블러, 글래스 카드, 글로우 보더 |
| 둥근 카드 + 드롭섀도 | 기억에 남지 않는 가장 안전한 형태 |
| Sparkline 장식 | 의미 없는 작은 차트를 장식으로 배치 |

### 타이포그래피
| 패턴 | 설명 |
|------|------|
| 과용 폰트 | Inter, Roboto, Open Sans, Lato, Montserrat — "보이지 않는 기본값" |
| 아이콘 타일 + 헤딩 | 둥근 아이콘 위에 헤딩 텍스트 — AI 피처카드 템플릿 |
| Monospace = "기술적" | 분위기용 monospace 남발 |

### 색상
| 패턴 | 설명 |
|------|------|
| 보라색 그래디언트 | purple/violet + cyan 조합 — AI 생성 1위 지표 |
| 다크모드 + 글로우 | 어두운 배경에 colored box-shadow |
| 순수 검정 배경 | `#000000` — 거칠고 부자연스러움 |

### 레이아웃
| 패턴 | 설명 |
|------|------|
| 모든 것 center-align | 텍스트 전부 가운데 정렬 |
| 중첩 카드 | 카드 안에 카드 (Cardocalypse) |
| 동일 카드 그리드 | 같은 크기 카드 + 아이콘 + 헤딩 + 텍스트 반복 |
| 모든 것 카드로 감싸기 | 간격과 타이포만으로 충분한 곳에 불필요한 카드 |

### 모션
| 패턴 | 설명 |
|------|------|
| Bounce/elastic easing | 2015년 트렌드, 현재는 촌스러움 |

---

## 2. 타이포그래피

### 타입 스케일 (5단계)

| Token | Size | 용도 |
|-------|------|------|
| `--text-xs` | 0.75rem (12px) | 캡션, 법적 고지 |
| `--text-sm` | 0.875rem (14px) | 보조 UI, 메타데이터 |
| `--text-base` | 1rem (16px) | 본문 |
| `--text-lg` | 1.25rem (20px) | 소제목 |
| `--text-xl`+ | 2-4rem | 헤드라인, 히어로 |

- 단계 간 최소 비율: **1.25x**
- 비슷한 크기 남발 금지 (14, 15, 16, 18px 같은 것)

### 규칙

- body 텍스트 최소 **16px**, 절대 14px 미만 금지
- `rem` 단위 사용 (`px` 금지)
- line-height: body **1.5-1.7**, heading **1.1-1.2**
- 텍스트 줄 길이: `max-width: 65ch` (45-75ch 범위)
- 앱 UI/대시보드: **고정 rem 스케일** (fluid type은 마케팅 페이지 헤드라인에만)
- `user-scalable=no` 금지
- 폰트 페어링: 대부분 **하나의 폰트 패밀리 + 다중 웨이트**로 충분
- 비슷하지만 동일하지 않은 두 폰트를 페어링하지 말 것
- 데이터 테이블: `font-variant-numeric: tabular-nums`

---

## 3. 색상과 대비

### 60-30-10 규칙

| 비율 | 역할 | 예시 |
|------|------|------|
| 60% | 뉴트럴 배경, 여백, 베이스 서피스 | bg, card surface |
| 30% | 보조 — 텍스트, 보더, 비활성 상태 | body text, dividers |
| 10% | 액센트 — CTA, 하이라이트, 포커스 | primary button, links |

> 액센트 색상 남용 금지 — **희소성이 힘**

### 규칙

- OKLCH 사용 권장 (HSL 대비 지각적 균일성)
- 뉴트럴에 브랜드 색상 방향으로 미세 chroma (0.005-0.015) 추가 — **순수 회색 금지**
- 순수 검정(`#000`) 금지 — 어두운 뉴트럴에도 chroma 0.005-0.01
- 컬러 배경 위 회색 텍스트 금지 — 배경색의 더 어두운 셰이드 사용
- 텍스트 대비: **4.5:1** 이상 (WCAG AA)
- UI 컴포넌트 대비: **3:1** 이상
- 색상만으로 정보 전달 금지 — 아이콘, 라벨, 패턴 병행
- 브랜드 색상 외 최대 2-4개 색상
- `rgba/hsla` 남용은 불완전한 팔레트의 증거 — 명시적 오버레이 색상 정의

### 다크 모드

- 단순 색상 반전 금지
- 깊이를 그림자 대신 **서피스 밝기**로 표현
- 순수 검정 배경 금지 — 어두운 뉴트럴 (oklch 12-18%) 사용
- 밝은 텍스트에 font-weight 약간 줄임 (400→350)
- 액센트 색상 약간 탈채도

---

## 4. 공간과 레이아웃

### 4pt 간격 시스템

| Token | Value | 용도 |
|-------|-------|------|
| `--space-xs` | 4px | 인라인 요소 간격 |
| `--space-sm` | 8px | 관련 요소 간 간격 |
| `--space-md` | 16px | 섹션 내 간격 |
| `--space-lg` | 24px | 섹션 간 간격 |
| `--space-xl` | 48px | 주요 섹션 구분 |
| `--space-2xl` | 96px | 페이지 섹션 구분 |

### 규칙

- 시맨틱 토큰 사용 (`--space-sm`, `--spacing-8` 아님)
- `gap` 사용 (margin collapse 방지)
- 관련 항목은 타이트하게 (8-12px), 섹션 간은 넓게 (48-96px) — **리듬 만들기**
- 균일한 간격은 계층 구조를 파괴함
- 자기 조정 그리드: `repeat(auto-fit, minmax(280px, 1fr))`
- Flexbox: 1차원 (행, 네비바, 버튼 그룹)
- CSS Grid: 2차원 (페이지 구조, 대시보드)
- 터치 타겟: 최소 **44px** (시각적으로 작아도 padding/pseudo-element로 인터랙티브 영역 확장)
- z-index 시맨틱 스케일:

| Layer | z-index |
|-------|---------|
| dropdown | 100 |
| sticky | 200 |
| modal-backdrop | 300 |
| modal | 400 |
| toast | 500 |
| tooltip | 600 |

---

## 5. 모션

### 타이밍 가이드라인

| 구간 | 용도 |
|------|------|
| 100-150ms | 즉각 피드백 (버튼, 색상 변경) |
| 200-300ms | 상태 전환 (메뉴, 툴팁) |
| 300-500ms | 레이아웃 이동 (아코디언, 모달) |
| 500-800ms | 입장 애니메이션 (페이지 로드) |

> 퇴장은 입장의 ~75% 속도

### 이징 커브

```css
/* 사용 */
--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);   /* 입장 */
--ease-in-expo: cubic-bezier(0.7, 0, 0.84, 0);     /* 퇴장 */

/* 금지 */
ease;              /* 제네릭 */
bounce / elastic;  /* 촌스러움 */
```

### 규칙

- `transform`과 `opacity`만 애니메이션
- width/height 변경: `grid-template-rows: 0fr → 1fr`
- `prefers-reduced-motion` 지원 **필수** (선택 아님)
- 목적 없는 장식 애니메이션 금지
- `will-change` 남용 금지

---

## 6. 인터랙션

### 8가지 필수 상태

모든 인터랙티브 요소에 적용:

1. **Default** — 기본 상태
2. **Hover** — 색상, scale, 또는 shadow로 미세 피드백
3. **Focus** — `:focus-visible`로 키보드 내비게이션에만 표시, 2-3px, 3:1 대비
4. **Active** — 클릭/탭 피드백
5. **Disabled** — 명확히 비활성으로 보이게
6. **Loading** — 비동기 동작 피드백
7. **Error** — 유효성 검사 상태
8. **Success** — 완료 확인

### 규칙

- 포커스 링 절대 제거 금지 (`:focus { outline: none }` 금지)
- 버튼 계층: Primary (뷰당 하나), Secondary, Ghost, Text link — 모든 버튼이 Primary면 아무것도 Primary가 아님
- placeholder는 label이 아님 (입력 시 사라짐)
- 에러 메시지는 필드 아래 `aria-describedby`로 배치
- 스켈레톤 > 스피너 (로딩 상태)
- 확인 대화상자보다 **Undo**가 나음 (파괴적 동작)
- 드롭다운: `overflow: hidden` 내부 `position: absolute` 금지 — Portal 패턴 사용

---

## 7. 반응형

### 규칙

- **모바일 퍼스트**: `min-width` 미디어 쿼리
- 콘텐츠 기반 브레이크포인트 (디바이스 크기가 아닌, 디자인이 깨지는 지점)
- 입력 방식 감지:
  ```css
  @media (pointer: fine) { /* 마우스/트랙패드 */ }
  @media (pointer: coarse) { /* 터치 — 더 큰 타겟 */ }
  ```
- 호버에 기능 의존 금지 — 터치 사용자는 호버 불가
- 모바일에서 기능 제거(amputate) 금지 — 인터페이스를 **적응**시킬 것
- `env(safe-area-inset-*)` — 노치 디바이스 대응
- 가로 스크롤 금지
- 고정 너비 텍스트 컨테이너 금지

---

## 8. UX 라이팅

### 규칙

- 버튼: "OK", "Submit" 대신 구체적 동작 — "Save changes", "Delete 5 items"
- 에러 메시지 3가지: 무엇이 발생했는가, 왜, 어떻게 고치는가
- 빈 상태: 온보딩 기회 — "아직 프로젝트가 없습니다. 첫 번째를 만들어보세요"
- 용어 일관성: "Delete" vs "Remove", "Settings" vs "Preferences" — 프로젝트 전체에서 하나만
- 번역 고려: 독일어 ~30% 확장, 중국어 ~30% 압축

---

## 9. 접근성

- WCAG AA 준수 (대비 4.5:1 / 3:1)
- 시맨틱 HTML + ARIA 역할/라벨
- 논리적 탭 순서, 키보드 트랩 금지
- heading 레벨 건너뜀 금지 (h1→h3)
- 이미지에 설명적 alt 텍스트
- 폼: 모든 입력에 label + 에러 `aria-describedby`
- 터치 타겟 44x44px 이상
- 전체 기능 키보드 내비게이션
- `prefers-reduced-motion` 필수 지원
- 고대비 모드 호환

---

## 10. 프로덕션 강건화

### 엣지 케이스 대응

- 60+ 글자 이름, 단일 문자, 이모지, RTL 텍스트
- 백만/십억 단위 숫자, 1000+ 항목 리스트, 데이터 없음(zero) 상태
- 네트워크 실패, API 에러 (400-500), 권한 에러, Rate limiting
- 더블 클릭 submit 방지

### i18n 고려

- 텍스트 30% 확장 여유 (독일어)
- RTL 지원: 논리적 CSS 속성 (`margin-inline-start`)
- `Intl.DateTimeFormat`, `Intl.NumberFormat` 사용
- 복수형 처리

---

## 검증

이 컨벤션의 준수 여부는 `/hns:validate-fe-design`으로 검증한다.
