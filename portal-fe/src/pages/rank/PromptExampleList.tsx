import { useState } from 'react';
import { Link } from 'react-router-dom';
import { promptDomains, promptTags, type PromptTag } from '../../api/peerPromptsApi';
import { peerPromptExamples } from './peerPromptExamples';

export default function PromptExampleList({ domain, tag }: { domain: string; tag: string }) {
  const [notice, setNotice] = useState('');
  const examples = peerPromptExamples.filter(item => (!domain || item.domain === domain) && (!tag || item.tags.includes(tag)));
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('예시 프롬프트를 복사했습니다.'); }
    catch { setNotice('복사하지 못했습니다. 펼친 원문을 직접 선택해 복사해 주세요.'); }
  }
  return <section id="examples" className="peer-examples" aria-labelledby="peer-examples-title">
    <div className="peer-section-heading"><h2 id="peer-examples-title">사용 예시</h2><span className="peer-editorial">편집 예시</span></div>
    <p className="peer-note">원문과 입출력 예시를 살펴보고 내 업무에 맞게 고쳐보세요. 예시 출력은 설명용이며 실제 모델 응답이 아닙니다.</p>
    {examples.length === 0 && <p className="peer-callout">이 조건의 편집 예시는 아직 없습니다. <Link to="/prompts#examples">전체 예시 보기</Link> 또는 <Link to="/prompts/new">직접 작성하기</Link></p>}
    <div className="peer-example-grid">{examples.map(example => <article className="peer-example" key={example.slug}>
      <div className="peer-card-meta"><span>{promptDomains[example.domain]}</span><span>{example.tags.map(code => promptTags[code as PromptTag]).filter(Boolean).join(' · ')}</span></div>
      <h3>{example.title}</h3><p>{example.purpose}</p>
      <details><summary>입력·출력 예시와 원문 보기</summary><div className="peer-example-body"><h4>모델 · 사용 맥락</h4><p>{example.modelContext}</p><h4>프롬프트 원문</h4><pre tabIndex={0}>{example.promptText}</pre><h4>입력 예시</h4><pre tabIndex={0}>{example.sampleInput}</pre><h4>출력 예시</h4><pre tabIndex={0}>{example.sampleOutput}</pre></div></details>
      <div className="peer-actions"><Link className="kh-button kh-button-ghost" to={`/prompts/new?example=${encodeURIComponent(example.slug)}`}>이 예시로 작성</Link><button type="button" className="peer-text-button" onClick={() => void copy(example.promptText)}>원문 복사</button></div>
    </article>)}</div>
    {notice && <p role="status" className="peer-note">{notice}</p>}
  </section>;
}
