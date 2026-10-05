# R4 리깅 파츠 원화 기록

2026-10-05. Built-in `image_gen` 편집 모드, 투명 배경 요청. 기존 `duel-defense/assets/enemies.png`를 먼저 확인한 뒤 캐릭터 정체성과 화풍 참조로 사용했다. 원본 아틀라스는 보존했다.

생성 결과: `portal-fe/public/games/duel-defense/assets/enemy-rig-parts-r4.png`, **1881×836, alpha 있음**,9열×4행(셀209×209). 출력 기본 경로에서 프로젝트에 복사했다. 게임 decoder는 투명 픽셀 bounds와 관절 위치를 명시적으로 정규화한다. 이것은 분리 texture atlas이며 완성된 걷기 프레임이나3D 모델이 아니다.

행: 척후 원형/방패 원형/중갑 원형/대장군 원형. 열: 몸통+머리·장비,앞팔+무기,뒷팔,앞허벅지,앞정강이,앞부츠,뒤허벅지,뒤정강이,뒤부츠. 정강이 출력 일부는 발 형태를 포함하므로 적용 시 별도 부츠와 이중 표시하지 않도록 연결부를 정규화한다. 실제 관절 연결과 foot-contact 시각 검증은 구현 검증에 기록한다.

## 최종 프롬프트

Use case: stylized-concept. Asset type: production 2D cutout skeletal animation texture atlas, NOT animation frames, NOT a concept poster. Reference image: existing Joseon tower-defense four enemy types. Match those exact four characters, ink outline, muted brown cloth, gray armor, stylized small proportions. Generate a clean TRANSPARENT atlas with EXACTLY FOUR horizontal rows and NINE equal-width columns, evenly spaced, no labels, no grid, no shadows. Each cell contains a single isolated character body PART, intended to rotate on a skeletal joint. Rows top to bottom: 1 brown light swordsman with cloth face covering; 2 armored shield soldier; 3 heavy mace soldier in yellow-brown cape; 4 armored commander with banner and shield. Columns left to right: 1 torso with head, tunic and any shield/banner as one rigid upperbody, NO arms and NO legs; 2 near full arm with hand holding its weapon (sword rows1/2, mace row3, axe row4); 3 far full arm and hand, NO weapon; 4 near upper thigh, hip to knee; 5 near shin, knee to ankle; 6 near boot, ankle to toe; 7 far upper thigh, hip to knee; 8 far shin, knee to ankle; 9 far boot, ankle to toe. Draw in neutral right-facing three-quarter side view, identical scale and character proportions across all parts in each row. Limb pieces should be fleshed-out complete opaque shapes with rounded overlapping joints, hidden surfaces fully painted so limbs can rotate without holes. Each joint area needs extra texture overlap padding. Do not draw assembled characters in the atlas; only the specified detached parts. Torso pieces must be legless and armless with solid opaque tunic down to hip; thigh knee and shin ankle clearly share matching thickness and material. The near and far limbs must be separate complete pieces even if they are hidden in the reference. Keep every part wholly inside its equal cell with clear transparent margins. Wide landscape high-resolution output, crisp game textures. No blood, no dead/collapsing poses, no motion smear, no magenta background, no text or watermark. Exact four rows by nine columns of parts.

## 선택 이유

최초 기존 PNG mask 기반 리그는 허벅지 일부가 장비/몸통에 가려져 연결부에 빈틈을 만들었다. 부모가 확대 연속 장면을 보고 해당 결과를 유지하지 않았다. 새 파츠는 가려진 허벅지/정강이까지 불투명하게 그려 리그 회전 때 관절 겹침을 확보한다. 생성 파츠 자체는 부모 확인 완료, 조립/움직임 품질은 별도 확인 대상이다.
