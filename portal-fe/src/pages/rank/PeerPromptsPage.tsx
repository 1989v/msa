import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fetchPeerPrompt, fetchPeerPrompts, promptDomains, reviewLabel } from '../../api/peerPromptsApi';
import { blogErrorMessage } from '../../api/blogApi';
import { useAuth } from '../../auth/useAuth';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { useSeo } from '../../seo/useSeo';
import { peerPromptsMeta } from '../../seo/copy.mjs';
import ThemeToggle from '../../components/ThemeToggle';
import { PromptForm, PeerField, PeerDomainOptions } from './PeerPromptForms';
import PeerPromptView from './PeerPromptView';
import { PEER_ORIGIN, peerLoginHref } from './peerPromptLinks';
import './RankPage.css';
import './PeerPromptsPage.css';

export default function PeerPromptsPage({ create = false }: { create?: boolean }) {
  useHeritageSurface();
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const domain = params.get('domain') ?? '';
  const rawPage = Number(params.get('page') ?? 0);
  const page = Number.isInteger(rawPage) && rawPage >= 0 ? rawPage : 0;
  const auth = useAuth();
  const list = useQuery({ queryKey: ['peer-prompts', domain, page, auth.userId], queryFn: () => fetchPeerPrompts(domain, page), enabled: !id && !create });
  const detail = useQuery({ queryKey: ['peer-prompt', id, auth.userId], queryFn: () => fetchPeerPrompt(id!), enabled: !!id });
  useSeo({ ...peerPromptsMeta(), title: detail.data ? `${detail.data.summary.title} | 1989v` : peerPromptsMeta().title,
    canonical: `${PEER_ORIGIN}/prompts${id ? `/${id}` : ''}`, noindex: create || !!id || !!domain || page > 0 });
  return <main className="rank-page peer-page">
    <header className="rank-header">
      <div className="rank-header__bar"><Link to="/" className="rank-header__brand">1989v 랭킹</Link><ThemeToggle /></div>
      <p className="kh-section-label">PEER PROMPTS</p>
      <h1 className="rank-header__title kh-display">분야별 프롬프트<br /><span className="kh-display-accent">동료 리뷰</span></h1>
      <p className="rank-header__subtitle">어떤 업무에서 어떻게 썼는지, 동료의 경험과 함께 읽어보세요.</p>
      <p className="peer-note">분야·역할은 본인 소개이며 자격 인증이 아닙니다. AI 실행 없이 프롬프트와 리뷰를 공유합니다.</p>
      <nav className="peer-actions" aria-label="프롬프트 탐색"><Link to="/prompts">모두 보기</Link><Link to="/prompts/new">프롬프트 공유</Link>{!auth.isLoggedIn && <a href={peerLoginHref()}>로그인</a>}</nav>
    </header>
    {create ? <PromptForm /> : id ? <>
      {detail.isPending && <p role="status">프롬프트를 불러오는 중…</p>}
      {detail.isError && <div role="alert"><p>{blogErrorMessage(detail.error, '프롬프트를 불러오지 못했습니다.')}</p><button onClick={() => void detail.refetch()}>다시 불러오기</button></div>}
      {detail.data && <PeerPromptView key={id} detail={detail.data} />}
    </> : <>
      <section className="peer-toolbar" aria-label="분야별 순위">
        <PeerField label="분야"><select value={domain} onChange={(e) => setParams(e.target.value ? { domain: e.target.value } : {})}><option value="">전체 분야</option><PeerDomainOptions /></select></PeerField>
        <p className="peer-note">리뷰 3개부터 평점 평균 내림차순, 동점은 리뷰 수·최근 등록순입니다. 리뷰 0~2개는 순위 없이 최근 등록순으로 표시합니다. {domain ? '선택한 분야의 순위입니다.' : '분야를 선택하면 해당 분야 순위를 볼 수 있습니다.'}</p>
      </section>
      {list.isPending && <p role="status">프롬프트를 불러오는 중…</p>}
      {list.isError && <div role="alert"><p>{blogErrorMessage(list.error, '목록을 불러오지 못했습니다.')}</p><button onClick={() => void list.refetch()}>다시 불러오기</button></div>}
      {list.data?.items.length === 0 && <section className="peer-panel"><h2>아직 공유된 프롬프트가 없습니다</h2><p>첫 프롬프트와 사용 맥락을 남겨 동료의 리뷰를 받아보세요.</p><Link to="/prompts/new">첫 프롬프트 공유하기</Link></section>}
      <ol className="peer-list">{list.data?.items.map((prompt, index) => <li key={prompt.id} className="peer-panel">
        <div className="peer-card-meta"><span>{promptDomains[prompt.domain]}</span>{domain && prompt.ranked && <strong>{page * 20 + index + 1}위</strong>}</div>
        <h2><Link to={`/prompts/${prompt.id}`}>{prompt.title}</Link></h2><p>{prompt.purpose}</p>
        <p className="peer-note">{prompt.authorName} · {reviewLabel(prompt)}</p>
      </li>)}</ol>
      {list.data && <nav className="peer-actions" aria-label="페이지 이동"><button disabled={page === 0 || list.isFetching} onClick={() => setParams({ ...(domain ? { domain } : {}), page: String(page - 1) })}>이전</button><span>{page + 1}페이지</span><button disabled={!list.data.hasMore || list.isFetching} onClick={() => setParams({ ...(domain ? { domain } : {}), page: String(page + 1) })}>다음</button></nav>}
    </>}
    <footer className="peer-note"><a href="https://1989v.com/contact">운영자에게 문의</a> · 비밀키·개인정보·회사 기밀을 게시하지 마세요. 공개한 원문은 수정되지 않으며 삭제 후 새 글로 공유할 수 있습니다.</footer>
  </main>;
}
