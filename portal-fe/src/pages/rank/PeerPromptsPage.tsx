import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPeerPrompt, fetchPeerPrompts, promptDomains, promptTags, reviewLabel, type PromptTag } from '../../api/peerPromptsApi';
import { blogErrorMessage } from '../../api/blogApi';
import { useAuth } from '../../auth/useAuth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import { peerPromptsMeta } from '../../seo/copy.mjs';
import ThemeToggle from '../../components/ThemeToggle';
import AppInstallMenu from '../../components/shell/AppInstallMenu';
import PromptComposer from './PromptComposer';
import PeerPromptView from './PeerPromptView';
import PromptExampleList from './PromptExampleList';
import { peerPromptExamples } from './peerPromptExamples';
import { PEER_ORIGIN } from './peerPromptLinks';
import './RankPage.css';
import './PeerPromptsPage.css';

export default function PeerPromptsPage({ create = false }: { create?: boolean }) {
  useHeritageSurface();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const domain = params.get('domain') ?? '';
  const tag = params.get('tag') ?? '';
  const rawPage = Number(params.get('page') ?? 0);
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  const auth = useAuth();
  const list = useQuery({ queryKey: ['peer-prompts', domain, tag, page, auth.userId], queryFn: () => fetchPeerPrompts(domain, page, tag), enabled: !id && !create });
  const detail = useQuery({ queryKey: ['peer-prompt', id, auth.userId], queryFn: () => fetchPeerPrompt(id!), enabled: !!id });
  useSeo({ ...peerPromptsMeta(), title: create ? '프롬프트 공유하기 | 1989v 랭킹' : detail.data ? `${detail.data.summary.title} | 1989v` : peerPromptsMeta().title,
    canonical: `${PEER_ORIGIN}/prompts${id ? `/${id}` : ''}`, noindex: create || !!id || !!domain || !!tag || page > 0 });
  function filter(key: 'domain' | 'tag', value: string) {
    const next = new URLSearchParams(params); next.delete('page');
    if (value) next.set(key, value); else next.delete(key);
    setParams(next);
  }
  const examplesFirst = !list.data?.items.length && peerPromptExamples.some(item => (!domain || item.domain === domain) && (!tag || item.tags.includes(tag)));
  const pageParams = (target: number) => ({ ...(domain ? { domain } : {}), ...(tag ? { tag } : {}), page: String(target) });
  const examples = <PromptExampleList key="examples" domain={domain} tag={tag} />;
  const community = (
      <section key="community" id="community" className="peer-community" aria-labelledby="peer-community-title">
        <div className="peer-section-heading"><h2 id="peer-community-title">동료가 공유한 프롬프트</h2><details className="peer-ranking-note"><summary>순위 기준</summary><p>같은 분야에서 리뷰 3개부터 평점 평균순으로 비교합니다. 동점은 리뷰 수·최근 등록순입니다. 리뷰 0~2개는 순위 없이 최근 등록순으로 표시합니다. 업무 태그를 선택하면 해당 조건의 글만 표시합니다.</p></details></div>
        {list.isPending && <p className="peer-callout" role="status">프롬프트를 불러오는 중… 아래 사용 예시를 먼저 살펴보세요.</p>}
        {list.isError && <div className="peer-callout" role="alert"><p>{blogErrorMessage(list.error, '목록을 불러오지 못했습니다.')}</p><p className="peer-note">사용 예시는 계속 볼 수 있어요.</p><button className="kh-button kh-button-ghost" onClick={() => void list.refetch()}>다시 불러오기</button></div>}
        {list.data?.items.length === 0 && <p className="peer-empty-line">아직 공유된 프롬프트가 없습니다. <Link to="/prompts/new">첫 프롬프트 공유하기</Link></p>}
        <ol className="peer-list">{list.data?.items.map((prompt, index) => <li key={prompt.id} className="peer-list-row">
          <span className="peer-rank kh-mono" aria-label={domain && prompt.ranked ? `${page * 20 + index + 1}위` : '순위 미정'}>{domain && prompt.ranked ? String(page * 20 + index + 1).padStart(2, '0') : '—'}</span>
          <div className="peer-list-body"><div className="peer-card-meta"><span>{promptDomains[prompt.domain]}</span>{(prompt.tags ?? []).filter(code => code in promptTags).map(code => <span key={code}>{promptTags[code as PromptTag]}</span>)}</div><h3><Link to={`/prompts/${prompt.id}`}>{prompt.title}</Link></h3><p className="peer-list-purpose">{prompt.purpose}</p><p className="peer-note">{prompt.authorName} · {reviewLabel(prompt)}</p></div><Link className="peer-row-link" to={`/prompts/${prompt.id}`} aria-label={`${prompt.title} 상세 보기`}>↗</Link>
        </li>)}</ol>
        {list.data && (page > 0 || list.data.hasMore) && <nav className="peer-pagination" aria-label="페이지 이동"><button className="kh-button kh-button-ghost" disabled={page === 0 || list.isFetching} onClick={() => setParams(pageParams(page - 1))}>이전</button><span>{page + 1}페이지</span><button className="kh-button kh-button-ghost" disabled={!list.data.hasMore || list.isFetching} onClick={() => setParams(pageParams(page + 1))}>다음</button></nav>}
      </section>
  );
  return <main className={`peer-page ${create || id ? 'peer-page--context' : ''}`}>
    <header className="peer-header">
      <div className="peer-topbar"><Link to="/" className="peer-brand kh-display">1989v <span>랭킹</span></Link><div className="peer-header-tools"><AppInstallMenu /><ThemeToggle /></div></div>
      {(create || id) && <nav className="peer-breadcrumb" aria-label="현재 위치"><Link to="/">랭킹</Link><span aria-hidden="true">/</span>{create || id ? <Link to="/prompts">프롬프트 동료 리뷰</Link> : <span>프롬프트 동료 리뷰</span>}{create && <><span aria-hidden="true">/</span><span>공유하기</span></>}</nav>}
      <div className="peer-title-row"><div><h1 className="kh-display">{create ? '프롬프트 공유하기' : '프롬프트 동료 리뷰'}</h1><p className="peer-intro">{create ? '작성하고, 미리 보고, 준비되면 공개하세요.' : id ? '원문과 사용 맥락, 동료의 경험을 함께 읽어보세요.' : '어떤 업무에 어떻게 썼는지, 결과와 한계까지 함께 나눠요.'}</p></div>{!create && <Link className="kh-button peer-share" to="/prompts/new">프롬프트 공유하기 <span aria-hidden="true">↗</span></Link>}</div>

    </header>
    {create ? <PromptComposer /> : id ? <>
      {detail.isPending && <p className="peer-callout" role="status">프롬프트를 불러오는 중…</p>}
      {detail.isError && <div className="peer-callout" role="alert"><p>{blogErrorMessage(detail.error, '프롬프트를 불러오지 못했습니다.')}</p><button className="kh-button kh-button-ghost" onClick={() => void detail.refetch()}>다시 불러오기</button><Link to="/prompts">목록과 예시 보기</Link></div>}
      {detail.data && <PeerPromptView key={id} detail={detail.data} />}
    </> : <>
      <section className="peer-filters" aria-label="프롬프트 필터">
        <fieldset><legend>분야</legend><div className="peer-chips"><button className="peer-chip" aria-pressed={!domain} onClick={() => filter('domain', '')}>전체 분야</button>{Object.entries(promptDomains).map(([value, label]) => <button className="peer-chip" key={value} aria-pressed={domain === value} onClick={() => filter('domain', value)}>{label}</button>)}</div></fieldset>
        <fieldset><legend>업무 목적</legend><div className="peer-chips"><button className="peer-chip" aria-pressed={!tag} onClick={() => filter('tag', '')}>전체 업무</button>{Object.entries(promptTags).map(([value, label]) => <button className="peer-chip" key={value} aria-pressed={tag === value} onClick={() => filter('tag', value)}>{label}</button>)}</div></fieldset>
        {(domain || tag) && <Link className="peer-reset" to="/prompts">필터 초기화</Link>}
      </section>
      {examplesFirst ? [examples, community] : [community, examples]}
    </>}
    <footer className="peer-footer"><p>분야·역할은 본인 소개이며 자격 인증이 아닙니다. AI를 실행하거나 결과를 보증하지 않습니다.</p><p><a href="https://1989v.com/contact">운영자 문의</a> · <a href="https://1989v.com/privacy">개인정보처리방침</a></p></footer>
  </main>;
}
