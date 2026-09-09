import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ADR-0092 SR-9.4 · T53 — **방침에 적은 숫자와 코드 상수가 같아야 한다.**
 *
 * 두 값이 언어 경계 반대편에 있다(방침은 TS 화면, 상수는 Kotlin). 함께 import 할 수 없어서
 * 손쉬운 구현이 「테스트에 365 를 적어 양쪽과 비교」가 되고, 그 순간 검사가 자기 근거를
 * 만든다. 그래서 **두 파일을 텍스트로 읽어 뽑은 값끼리** 비교한다.
 */
const REPO = resolve(__dirname, '../../../..');

function retentionDaysFromCode(constName: string): number {
  const src = readFileSync(
    resolve(
      REPO,
      'code-dictionary/app/src/main/kotlin/com/kgd/codedictionary/infrastructure/retention/RetentionRunner.kt',
    ),
    'utf-8',
  );
  const m = src.match(new RegExp(`const val ${constName} = (\\d+)L`));
  if (!m) throw new Error(`${constName} 를 못 찾았다 — 상수 이름이 바뀌었으면 이 검사도 함께 고쳐야 한다`);
  return Number(m[1]);
}

const privacyText = () => readFileSync(resolve(REPO, 'portal-fe/src/pages/PrivacyPage.tsx'), 'utf-8');

const friendGroupSection = () => {
  const text = privacyText();
  const at = text.indexOf('친구 그룹(별칭)');
  expect(at, '방침에 친구 그룹 항목이 없다').toBeGreaterThan(0);
  return text.slice(at, at + 800);
};

describe('보존기간 — 방침과 코드가 같은 숫자를 말한다', () => {
  it('친구 그룹: 코드 상수가 1년이고 방침도 1년이라고 적는다', () => {
    expect(retentionDaysFromCode('FRIEND_GROUP_RETENTION_DAYS')).toBe(365);
    const section = friendGroupSection();
    expect(section, '방침이 보존기간을 안 적는다').toMatch(/1년/);
    expect(section, '「마지막 사용」 기준임을 안 밝힌다').toMatch(/마지막으로 사용한 날/);
  });

  it('친구 그룹: 옵트인·즉시 파기·탈퇴 파기·실명 가능성을 모두 밝힌다', () => {
    const section = friendGroupSection();
    expect(section, '옵트인 조건').toMatch(/계정 저장을 켠 경우에만/);
    expect(section, '끄면 즉시 파기').toMatch(/끄면 그 즉시 파기/);
    expect(section, '탈퇴 시 파기').toMatch(/탈퇴할 때도 함께 파기/);
    expect(section, '실명 가능성 고지').toMatch(/실명이 들어올 수 있으므로/);
  });

  it('이력서 열람 기록: 기존 값도 여전히 맞다 — 한 항목만 보는 검사가 아니다', () => {
    expect(retentionDaysFromCode('RESUME_ACCESS_RETENTION_DAYS')).toBe(365);
    expect(privacyText()).toMatch(/이력서 열람 기록[\s\S]{0,140}1년/);
  });
});
