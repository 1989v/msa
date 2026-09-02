import { marked, type MarkedExtension, type Tokens } from 'marked';

/**
 * GitHub 콜아웃(`> [!NOTE]`)과 체크박스를 이 블로그가 쓰는 모양으로 바꾼다.
 *
 * 콜아웃 문법을 `:::note` 대신 GFM 쪽으로 고른 이유는 셋이다. 글을 옵시디언에서
 * 쓰는데 옵시디언 콜아웃이 같은 문법이고, 이미 쓴 글이 있고, 확장이 죽어도
 * 인용문으로 읽힌다(`:::` 는 기호가 글자로 노출된다).
 */

const ALERT_TYPES = ['note', 'tip', 'important', 'warning', 'caution'] as const;
type AlertType = (typeof ALERT_TYPES)[number];

/** 제목을 안 적었을 때 쓸 이름. */
const ALERT_LABEL: Record<AlertType, string> = {
  note: '참고',
  tip: '도움말',
  important: '중요',
  warning: '주의',
  caution: '경고',
};

const ALERT_HEAD = /^\[!(\w+)\][ \t]*(.*)$/;

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const blogMarkdown: MarkedExtension = {
  renderer: {
    /**
     * 첫 줄이 `[!TYPE]` 이면 콜아웃, 아니면 평범한 인용문.
     *
     * 표식 줄만 걷어내고 나머지는 **다시 마크다운으로 파싱**한다 — 콜아웃
     * 안에서도 목록·코드·강조가 그대로 살아야 한다.
     */
    blockquote(token: Tokens.Blockquote) {
      const [first, ...rest] = token.text.split('\n');
      const m = ALERT_HEAD.exec(first ?? '');
      const kind = m?.[1]?.toLowerCase();
      if (!m || !ALERT_TYPES.includes(kind as AlertType)) {
        return `<blockquote>${this.parser.parse(token.tokens)}</blockquote>\n`;
      }
      const type = kind as AlertType;
      const title = m[2]?.trim() || ALERT_LABEL[type];
      const body = this.parser.parse(marked.lexer(rest.join('\n')));
      return `<blockquote class="kh-alert kh-alert--${type}">`
        + `<p class="kh-alert__title">${escapeHtml(title)}</p>`
        + `${body}</blockquote>\n`;
    },

    /**
     * 체크박스를 `<input>` 대신 글자로 낸다.
     *
     * sanitizer 가 `input` 을 막고 있어서 기본 렌더러의 출력은 통째로 지워지고
     * 항목 앞에 빈칸만 남는다. 허용 목록을 넓히는 대신 글자로 바꾼다 — 읽기
     * 전용 표시라 폼 요소일 이유가 없고, sanitizer 설정을 안 건드린다.
     */
    checkbox({ checked }: Tokens.Checkbox) {
      return `<span class="kh-task" aria-hidden="true">${checked ? '☑' : '☐'}</span> `;
    },
  },
};
