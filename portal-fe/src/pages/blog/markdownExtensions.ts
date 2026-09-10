import { marked, type MarkedExtension, type Tokens } from 'marked';
import { highlightCode, resolveLanguage } from './highlight';

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
     * 코드 블록 — 언어를 알면 하이라이트하고, 모르면 그대로 낸다.
     *
     * `data-lang` 은 화면이 오른쪽 위에 언어를 적는 데 쓴다. 코드 블록이 길어지면
     * 무슨 언어인지가 위에서만 보이는데, 스크롤하면 그 위가 화면 밖으로 나간다.
     *
     * 하이라이트 결과는 **이미 이스케이프된 HTML** 이다(`hljs` 가 처리한다).
     * 실패했거나 모르는 언어면 여기서 직접 이스케이프한다 — 둘 다 안 하면 코드 안의
     * `<` 가 태그로 읽힌다.
     */
    code(token: Tokens.Code) {
      const lang = resolveLanguage(token.lang);
      const highlighted = highlightCode(token.text, token.lang);
      const cls = lang ? ` class="hljs language-${lang}"` : '';
      const attr = lang ? ` data-lang="${escapeHtml(lang)}"` : '';
      const inner = highlighted ?? escapeHtml(token.text);
      return `<pre${attr}><code${cls}>${inner}</code></pre>\n`;
    },

    /**
     * 표의 각 칸에 자기 열 이름을 `data-label` 로 박는다.
     *
     * 좁은 화면에서는 열 셋을 351px 안에 욱여넣느라 브라우저가 열을 min-content 까지
     * 짓눌러, 「A · 검색 품질」이 세 줄로 쪼개진다. 화면은 이 표를 행 단위 블록으로
     * 펴서 그 경쟁을 없애는데, 그때 값만 남으면 무슨 열이었는지 알 수 없다.
     *
     * **CSS 는 다른 칸(헤더)의 글자를 읽지 못한다.** 그래서 여기서 미리 박아 둔다.
     * 열이 셋 이상일 때만 `kh-stack` 을 붙인다 — 두 열짜리는 이미 라벨:값 모양이라
     * 펴도 달라지는 게 없다.
     */
    table(token: Tokens.Table) {
      const labels = token.header.map((c) => c.text);
      const style = (c: Tokens.TableCell) => (c.align ? ` style="text-align:${c.align}"` : '');
      const head = token.header
        .map((c) => `<th${style(c)}>${this.parser.parseInline(c.tokens)}</th>`)
        .join('');
      const body = token.rows
        .map(
          (row) =>
            '<tr>'
            + row
              .map(
                (c, i) =>
                  `<td${style(c)} data-label="${escapeHtml(labels[i] ?? '')}">`
                  + `${this.parser.parseInline(c.tokens)}</td>`,
              )
              .join('')
            + '</tr>',
        )
        .join('');
      const stack = token.header.length >= 3;
      const table = `<table${stack ? ' class="kh-stack" data-view="table"' : ''}`
        + ` data-cols="${token.header.length}">`
        + `<thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>\n`;
      if (!stack) return table;
      // 기본은 표 모양이다 — 한 열을 아래로 훑는 읽기가 표의 기본 쓰임이고 행이
      // 1줄일 때 가장 빠르다. 한 행 안의 값 셋을 한 덩어리로 봐야 할 때만 편다.
      // 어느 쪽이 필요한지는 표가 아니라 **읽는 사람**이 아는 것이라 그 자리에서 고르게 둔다.
      //
      // 표를 감싸지 않고 **바로 앞 형제**로 둔다 — 감싸면 `.blog-body > table` 로
      // 걸어 둔 넓은 화면 규칙이 통째로 빗나간다. 누르는 동작은 본문이 innerHTML
      // 이라 여기서 못 걸고 `MarkdownBody` 가 컨테이너에 한 번 위임한다.
      return '<button type="button" class="kh-tableview" aria-pressed="false">'
        + '펴서 보기</button>\n' + table;
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
