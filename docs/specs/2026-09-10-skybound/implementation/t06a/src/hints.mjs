// Opt-in clues reveal observation, ability, then exact controls. Never mutate progress.
export function explorationHint(destination, progress = {}, defeated = false) {
  let phase = destination, title, steps;
  if (['west-harbor', 'high-archive', 'north-launch'].includes(destination) || destination.startsWith('relay-')) {
    phase += progress.journeyComplete ? ':open' : ':sealed'; title = '서부 관측 항로';
    steps = progress.journeyComplete ? ['북단 출항대에서 서쪽 바다의 바람쉼터를 찾아보세요. 정박지 뒤로 높은 기록섬이 이어집니다.', '각 출항점의 가운데 기류에서 기력을 채우고 위쪽 경계 가까이 올라가세요. 한 번에 한 쉼터씩 건넙니다.', '점프 후 다시 점프 버튼으로 돛을 펴고 충분히 상승 → 길잡이의 다음 쉼터로 이동 → 쉼터 바로 위에서 점프 버튼으로 돛을 접어 착지하세요. 쉬어 기력을 채운 뒤 다음 기류에서 출항합니다.'] : ['첫 지도의 바람을 복원하면 북단 출항대가 깨어납니다.', '먼저 세 유적을 활성화하고 중앙 바람문에서 전망섬으로 건너가세요.', '길잡이를 ‘다음 목표 자동’으로 바꾸어 첫 결말까지 도달한 뒤, 서부 정박지나 높은 기록섬을 선택하세요.'];
  } else if (destination === 'stone' && !progress.stoneRuinActive) {
    title = '돌고리의 긴 홈';
    steps = ['밝은 프리즘 옆 받침을 살펴보세요. 서로 긴 모서리의 방향을 비교해 보세요.', '고리 도구로 프리즘을 들고 회전할 수 있습니다. 받침 위 지면에 안정되게 놓아야 합니다.', '프리즘을 조준해 집기(E) → 회전(R) 한 번 → 오른쪽 받침으로 시야를 돌려 배치 안내가 허용될 때 놓기(E). 운반 중 시야를 아래로 내리면 가까이에 놓습니다.'];
  } else if (destination === 'watch' && !progress.watchRuinActive) {
    phase += defeated ? ':device' : ':guardian'; title = defeated ? '깨어날 장치' : '파수터의 빈틈';
    steps = defeated ? ['잠잠해진 수호석 옆에 작은 장치가 있습니다.', '장치 가까이 지면에 서서 상호작용해 보세요.', '장치 앞으로 다가가 활성화(G) 버튼을 누르세요. 지도에서 파수터를 선택하면 장치 방향을 안내합니다.']
      : ['수호석은 공격하기 전에 멈춰 서서 바닥에 범위를 그립니다.', '예고 범위 밖으로 피한 뒤 수호석이 쉬는 동안 가까이서 공격하세요.', 'Q 또는 회피 버튼으로 옆으로 피하고, 회복 중 수호석을 향해 F 또는 공격 버튼을 누르세요. 세 번 맞힌 뒤 옆 장치를 활성화(G)하세요.'];
  } else if (destination === 'wind' && !progress.windRuinActive) {
    phase += progress.firstAerialLanding ? ':second' : ':first'; title = '두 착지대의 바람';
    steps = ['야영지 앞 금빛 바람 고리와 오른쪽 위 두 착지대를 찾아보세요.', '기류 안에서 돛을 펼치면 올라갑니다. 첫 발판에서 쉬고 더 낮은 두 번째 발판으로 날아가세요.', '금빛 고리에서 점프 후 공중에서 다시 점프 버튼을 눌러 돛을 펼치세요. 충분히 오른 뒤 오른쪽 첫 발판으로 이동, 착지 후 다음 발판으로 점프·활공하고 제단에서 활성화(G)를 누르세요.'];
  } else if (destination === 'gate' || destination === 'overlook') {
    const open = progress.stoneRuinActive && progress.watchRuinActive && progress.windRuinActive;
    phase += open ? ':open' : ':sealed'; title = open ? '전망섬으로 이어진 길' : '세 방향의 바람';
    steps = open ? ['열린 문 위 기류와 오른쪽 높은 섬을 살펴보세요.', '돛을 펼친 채 문 위로 상승한 뒤 섬보다 높을 때 건너가세요.', '중앙 바람문에서 점프 후 다시 점프 버튼으로 활공하세요. 길잡이가 전망섬을 가리키면 오른쪽으로 이동해 섬 위에 착지하세요.']
      : ['문 아래로 세 유적의 선이 모입니다.', '돌고리·파수터·바람탑을 각각 활성화해야 바람문이 열립니다. 순서는 자유입니다.', '길잡이를 ‘다음 목표 자동’으로 바꾸면 미완료 유적으로 안내합니다. 해당 유적을 선택한 뒤 힌트를 열어 자세한 조작을 확인하세요.'];
  } else {
    title = '지도의 여백';
    steps = ['지도에 남기지 않은 풍경을 찾아보세요. 황동 고리가 달린 표석도 관측 장소입니다.', '길잡이에서 장소를 선택하고 방향·거리·높이를 따라 이동하세요. 섬 가장자리는 발밑을 확인하세요.', '장소 가까이 같은 높이로 다가가면 자동으로 발견합니다. 지도(M)의 장소 이름을 누르면 돌아갈 길을 표시하고, 아래에서 나루의 기록을 읽을 수 있습니다.'];
  }
  return { phase, title, steps };
}
