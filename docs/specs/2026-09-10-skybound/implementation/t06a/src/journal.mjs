// Original field notes for discovered places. Discovery visibility is owned by the map.
export function discoveryNote(id, progress) {
  switch (id) {
    case 'camp': return '바람이 잠잠한 첫 야영지. 길을 잃으면 이곳으로 돌아와 지도를 다시 펼친다. 설정에서 탐험 기록을 유지한 채 돌아올 수 있다.';
    case 'stone': return progress.stoneRuinActive
      ? '프리즘이 받침의 홈에 맞물렸다. 돌에 새겨진 선들이 이제 섬 안쪽을 가리킨다.'
      : '받침의 긴 홈과 프리즘의 긴 모서리는 같은 방향이어야 할 것 같다. 들어 올린 뒤 회전시켜 지면에 내려놓아 보자.';
    case 'watch': return progress.watchRuinActive
      ? '파수터가 싸움을 멈추고 바람을 읽기 시작했다. 작은 장치의 고리가 중앙 문을 향해 서 있다.'
      : '수호석은 공격 전에 멈춰 서서 발밑에 원을 그린다. 원 밖으로 피한 뒤 빈틈을 노리고, 잠잠해지면 옆 장치를 살펴보자.';
    case 'wind': return progress.windRuinActive
      ? '높은 제단에서 내려다보니 두 착지대가 하나의 길이었다. 이제 이 바람도 중앙 문으로 흐른다.'
      : '첫 착지대에서 쉬고, 더 낮은 두 번째 착지대로 이어가자. 제단 가운데에 두 발을 디디면 장치를 만질 수 있다.';
    case 'gate': return progress.stoneRuinActive && progress.watchRuinActive && progress.windRuinActive
      ? '세 방향의 바람이 만나는 자리. 돛으로 충분히 높이 오른 뒤 오른쪽 전망섬을 향하면 새 항로가 보일 것이다.'
      : '세 유적에서 이어진 선들이 닫힌 고리 아래 모인다. 옆 풀밭의 수호기는 한 번 방향을 정하면 곧장 달려든다. 옆으로 돌아갈 길을 남겨 두자.';
    case 'overlook': return '여기서 보면 끊어진 길에도 다음 도착점이 있다. 완성한 지도는 끝이 아니라, 다시 돌아올 수 있다는 약속이다.';
    case 'ridge': return '북쪽 끝에서 바람섬을 돌아본다. 오래된 관측자들도 이곳에서 처음 항로를 그렸을까. 이 풍경을 지도의 여백에 남긴다.';
    default: return '';
  }
}
