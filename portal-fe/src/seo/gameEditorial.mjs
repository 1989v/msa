/** Verified public copy. No roster, room or browser state belongs in this module. */
export function marbleEditorial(lang) {
  return lang === 'en' ? {
    title: 'Pinball Random Picker — Marble Race | 1989v Games',
    heading: 'Marble Race — Pinball Random Picker',
    description: 'A free online pinball game for picking names and deciding an order with friends. Watch marbles bounce through six courses in a pinball draw, choose first, last or a target place, and replay the same race. For a pinball raffle or friendly pinball bets such as deciding who gets coffee, agree on the rule together before starting.',
    guide: [
      { label: 'How the draw works', text: 'Enter participant names, choose a course and select first place, last place, a target place or the full running order. Watch the marbles race to the finish; the game reports the result.' },
      { label: 'A pinball draw', text: 'The marbles move automatically through the obstacles. This name picker is a game to watch together; you do not operate flippers to control a marble.' },
      { label: 'Six courses', text: 'Choose Pinball, Cascade, Carousel, Zigzag, Bumper Forest or Seesaw. Each course uses different obstacles, so preview the course before starting.' },
      { label: 'Watch and replay', text: 'Use the menu to slow the view or highlight a participant. After the finish, the center replay button repeats the same race; the menu also offers result copying and a new race with the same participants.' },
    ],
  } : {
    title: '핀볼 추첨·내기 게임 — 구슬 레이스 | 1989v 게임',
    heading: '구슬 레이스 — 핀볼 추첨·내기 게임',
    description: '이름을 넣고 구슬이 장애물 사이를 통과하는 모습을 지켜보는 무료 핀볼게임입니다. 친구끼리 커피·점심 순서를 정하는 핀볼 내기나 이름을 뽑는 핀볼 추첨에 활용하세요. 핀볼을 포함한 6개 코스에서 1등·꼴찌·지정 등수·전체 순서를 선택하고, 결과 확인 뒤 같은 레이스를 다시 볼 수 있습니다. 내기 게임의 규칙은 시작 전에 함께 정하세요.',
    guide: [
      { label: '핀볼 추첨 방법', text: '참가자 이름을 넣고 코스를 고른 뒤 1등·꼴찌·지정 등수·전체 순서 중 원하는 방식을 선택하세요. 출발한 구슬이 결승에 도착하면 선택한 방식에 맞는 결과를 확인합니다.' },
      { label: '핀볼 게임 즐기기', text: '구슬이 장애물에 부딪치며 자동으로 이동하는 관전형 추첨입니다. 플리퍼를 조작해 점수를 올리는 방식이 아니라, 출발 전에 정한 규칙에 따라 도착 결과를 함께 확인합니다.' },
      { label: '6개 코스', text: '핀볼·폭포·회전목마·지그재그·범퍼 숲·시소 중에서 고르세요. 코스마다 장애물 구성이 다르므로 미리보기를 보고 선택할 수 있습니다.' },
      { label: '관전과 다시 보기', text: '메뉴에서 느리게 보거나 참가자를 강조할 수 있습니다. 완주 뒤 중앙 리플레이 버튼은 같은 레이스를 다시 재생하며, 메뉴에서는 결과 복사와 같은 참가자로 새 판을 시작할 수 있습니다.' },
    ],
  };
}

export function drawCopy(lang) {
  return lang === 'en' ? {
    title: 'Random Picker & Party Decision Games — Random Race | 1989v Games',
    heading: 'Random Race — Party Decision Games',
    description: 'Enter names for a random picker with friends. Choose a marble race, ladder draw or card flip to decide who goes last or set a running order.',
    intro: 'Choose a game to pick names or decide an order together. Random Race brings a marble race, ladder draw and card flip to one device, without creating a room.',
    guideHeading: 'How to choose with friends',
    steps: ['Enter 2–12 participant names, one per line. Choose who goes last or the full running order.', 'Select Marble Race, Ladder Draw, Card Flip or Random, then press Start. The chosen game receives the names and mode.', 'For friendly betting games such as deciding who gets coffee or choosing a lunch order, agree on the rule first. These are party decision games; there is no cash wagering or payout feature.'],
    privacy: 'Names and recent settings stay on this device. For friends on separate devices, use the friend invitation area.',
  } : {
    title: '내기 게임·랜덤 추첨 — 랜덤레이스 | 1989v 게임',
    heading: '랜덤레이스 — 친구와 즐기는 내기 게임',
    description: '커피·점심 내기 게임이나 순서 정하기가 필요할 때 이름을 넣고 시작하세요. 구슬 레이스·사다리 타기·카드 뒤집기 중에서 랜덤 추첨을 고를 수 있습니다.',
    intro: '친구끼리 이름을 뽑거나 순서를 정할 때 게임을 골라보세요. 한 기기에서 방을 만들지 않고 구슬 레이스·사다리 타기·카드 뒤집기로 랜덤 추첨을 시작합니다.',
    guideHeading: '내기 게임 고르고 시작하기',
    steps: ['참가자 2~12명의 이름을 한 줄에 한 명씩 입력하고, 꼴찌 뽑기 또는 전체 순서 정하기를 고르세요.', '구슬 레이스·사다리 타기·카드 뒤집기·무작위 중 하나를 선택하고 시작하기를 누르세요. 이름과 방식이 선택한 게임에 전달됩니다.', '커피·점심 내기나 발표 순서처럼 친구끼리 결정할 일을 시작 전에 함께 정하세요. 현금 베팅이나 배당을 제공하는 기능은 없습니다.'],
    privacy: '이름과 최근 설정은 이 기기에만 저장됩니다. 각자 다른 기기에서 함께하려면 친구 초대를 이용하세요.',
  };
}
