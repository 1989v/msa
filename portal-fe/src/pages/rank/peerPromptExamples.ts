import type { PromptDomain } from '../../api/peerPromptsApi';

export interface PeerPromptExample {
  slug: string;
  domain: PromptDomain;
  tags: string[];
  title: string;
  purpose: string;
  modelContext: string;
  promptText: string;
  sampleInput: string;
  sampleOutput: string;
}

// Editorial templates. Examples have no member identity, review count or ranking.
export const peerPromptExamples: PeerPromptExample[] = [
  {
    slug: 'release-note',
    domain: 'SOFTWARE',
    tags: ['WRITING', 'REVIEW'],
    title: '개발 변경 기록을 고객용 릴리스 노트로 옮기기',
    purpose: '배포 담당자가 구현 용어를 걷어내고 고객이 체감할 변경을 한 문단으로 정리할 때 씁니다.',
    modelContext: '텍스트 모델에 공개 가능한 변경 기록과 릴리스 범위를 함께 입력합니다.',
    promptText: '다음 변경 기록에서 고객이 직접 체감하는 변경만 골라 한국어 릴리스 노트를 작성해 줘. 고객이 할 수 있게 된 행동을 첫 문장에 써 줘. 메모에 없는 원인과 성능 수치는 추가하지 마. 내부 변경은 마지막에 편집자용 메모로 분리해 줘.\n\n변경 기록: {{변경 기록}}',
    sampleInput: '장바구니 쿠폰이 만료되면 결제 전 안내. 내부 캐시 키 변경.',
    sampleOutput: '이제 장바구니에서 쿠폰이 만료되면 결제 전에 확인할 수 있습니다.\n편집자 메모: 캐시 키 변경은 내부 작업입니다.',
  },
  {
    slug: 'funnel-review',
    domain: 'DATA',
    tags: ['ANALYSIS', 'REVIEW'],
    title: '전환율 변화에서 먼저 확인할 숫자 찾기',
    purpose: '분석가가 캠페인 전후의 비율과 표본 수를 함께 읽고 후속 질문을 만들 때 씁니다.',
    modelContext: '같은 기간 단위로 집계한 방문 수와 구매 수를 텍스트 모델에 입력합니다.',
    promptText: '두 기간의 방문·구매 건수로 전환율과 퍼센트포인트 차이를 계산해 줘. 관찰한 사실 두 문장과 원인을 구분하려면 필요한 추가 집계 한 가지를 써 줘. 입력만으로 캠페인 효과를 단정하지 마.\n\n집계: {{기간별 방문·구매 수}}',
    sampleInput: '지난주 방문 1,000건·구매 40건. 이번 주 방문 500건·구매 30건.',
    sampleOutput: '전환율은 4%에서 6%로 2%p 올랐습니다. 구매는 10건 줄었습니다. 유입 경로별 방문·구매 수를 비교하면 방문자 구성의 변화를 살필 수 있습니다.',
  },
  {
    slug: 'form-error',
    domain: 'DESIGN',
    tags: ['WRITING', 'REVIEW'],
    title: '사용자가 바로 고칠 수 있는 오류 문구 만들기',
    purpose: '디자이너가 입력 오류의 원인과 다음 행동을 한 줄로 안내할 때 씁니다.',
    modelContext: '입력 항목, 허용 조건, 실제 입력값을 함께 제공합니다.',
    promptText: '입력 필드 바로 아래에 표시할 한국어 오류 문구를 작성해 줘. 어떤 조건을 충족해야 하는지와 지금 할 수 있는 행동을 한 문장에 담아 줘. 사용자 탓으로 돌리거나 내부 오류 코드를 노출하지 마.\n\n필드와 조건: {{필드와 조건}}\n입력 예: {{입력 예}}',
    sampleInput: '모임 이름은 공백 제외 2~20자. 입력은 ‘봄’.',
    sampleOutput: '모임 이름을 공백 제외 2~20자로 입력해 주세요.',
  },
  {
    slug: 'campaign-brief',
    domain: 'MARKETING',
    tags: ['PLANNING', 'SUMMARY'],
    title: '캠페인 메모를 한 장의 브리프로 정리하기',
    purpose: '마케터가 회의 메모를 실행 항목으로 옮기고 미정인 결정을 따로 확인할 때 씁니다.',
    modelContext: '캠페인 메모만 사용하고 예산과 목표는 정해진 값만 옮깁니다.',
    promptText: '메모를 대상, 혜택, 발송 채널, 다음 결정으로 정리해 줘. 확정된 내용과 논의 중인 내용을 구분해 줘. 입력에 없는 예산·일정·목표치는 “미정”으로 표시해 줘.\n\n메모: {{캠페인 메모}}',
    sampleInput: '신규 가입자에게 무료 배송 쿠폰. 이메일 발송. 발송일은 운영팀 확인 필요.',
    sampleOutput: '대상: 신규 가입자 / 혜택: 무료 배송 쿠폰 / 채널: 이메일\n다음 결정: 운영팀과 발송일 확정. 예산과 목표치는 미정.',
  },
  {
    slug: 'operations-handoff',
    domain: 'BUSINESS',
    tags: ['SUMMARY', 'PLANNING'],
    title: '교대 메모에서 다음 담당자가 할 일 뽑기',
    purpose: '운영 담당자가 다음 근무자에게 미완료 업무와 확인 시점을 넘길 때 씁니다.',
    modelContext: '개인정보를 뺀 가상의 주문 식별자와 처리 메모를 입력합니다.',
    promptText: '교대 메모에서 완료 업무와 미완료 업무를 나눠 줘. 미완료 업무마다 다음 행동, 담당자, 확인 시점을 한 줄로 써 줘. 정해지지 않은 항목은 “확인 필요”로 남겨 줘.\n\n교대 메모: {{메모}}',
    sampleInput: '예시 주문 A 주소 변경 완료. 주문 B 재출고 여부는 물류팀이 내일 오전 회신 예정.',
    sampleOutput: '완료: 주문 A 주소 변경.\n미완료: 주문 B 재출고 여부 확인 / 회신 담당: 물류팀 / 확인 시점: 내일 오전.',
  },
  {
    slug: 'exit-ticket',
    domain: 'EDUCATION',
    tags: ['PLANNING', 'WRITING'],
    title: '수업 마지막 3분에 쓸 이해 확인 질문 만들기',
    purpose: '교사가 학습 목표별로 짧은 질문과 답안에서 확인할 기준을 짝지을 때 씁니다.',
    modelContext: '학년, 학습 목표, 수업에서 이미 사용한 예시를 입력합니다.',
    promptText: '수업 마지막 3분에 학생이 풀 수 있는 질문 한 개를 작성해 줘. 수업 예시와 다른 짧은 상황을 사용하고 답안에서 확인할 기준 두 가지를 붙여 줘.\n\n학년·목표·기존 예시: {{수업 정보}}',
    sampleInput: '초등 4학년. 같은 크기의 전체에서 분수를 비교한다. 수업에서는 피자 조각을 사용했다.',
    sampleOutput: '같은 길이의 리본 두 개에서 각각 3/4과 2/4만큼 잘랐습니다. 어느 쪽이 더 길고 왜 그런가요?\n확인 기준: 전체가 같은 길이임을 고려했는지, 같은 크기 조각의 개수로 설명했는지.',
  },
];
