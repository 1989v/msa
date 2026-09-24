import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  adsErrorMessage,
  fetchAdvertiserMe,
  registerAdvertiser,
  type AdvertiserDashboard,
} from '../../api/adsConsoleApi';
import { buildLoginHref, isLoggedIn } from '../../auth/auth';
import ThemeToggle from '../../components/ThemeToggle';
import { useHeritageSurface } from '../../hooks/useHeritageSurface';
import { adsConsoleMeta } from '../../seo/copy.mjs';
import { useSeo } from '../../seo/useSeo';
import CampaignEditor from './CampaignEditor';
import ConsoleDashboard from './ConsoleDashboard';
import ConsoleReports from './ConsoleReports';
import TopUpForm from './TopUpForm';
import { consoleHref } from './consoleView';
import './AdsConsole.css';

export type ConsoleView = 'dashboard' | 'top-up' | 'campaign-new' | 'campaign' | 'reports';

const VIEW_TITLE: Record<ConsoleView, string> = {
  dashboard: '대시보드',
  'top-up': '충전',
  'campaign-new': '새 캠페인',
  campaign: '캠페인',
  reports: '리포트',
};

/**
 * 광고주 콘솔 (ADR-0098). 첫 화면은 셋으로 갈린다 —
 * 비로그인이면 apex 로그인으로(돌아올 주소를 싣고), 로그인했지만 광고주가 아니면 등록,
 * 정지된 광고주면 조회만 되는 안내. 색인하지 않는다.
 */
export default function AdsConsolePage({ view }: { view: ConsoleView }) {
  useHeritageSurface();
  useSeo(adsConsoleMeta(VIEW_TITLE[view]));
  const loggedIn = isLoggedIn();

  useEffect(() => {
    // 로그인은 apex 한 곳이다 (ADR-0079). 여기서 그리면 OAuth 콜백이 이 호스트로 잡힌다.
    if (!loggedIn) window.location.replace(buildLoginHref());
  }, [loggedIn]);

  const me = useQuery({
    queryKey: ['ads', 'me'],
    queryFn: fetchAdvertiserMe,
    enabled: loggedIn,
  });

  if (!loggedIn) {
    return (
      <ConsoleFrame>
        <div className="adc-entry" data-entry="login">
          <h1 className="adc-entry__title">로그인이 필요합니다</h1>
          <p className="adc-entry__text">로그인 화면으로 이동합니다. 로그인하면 이 화면으로 돌아옵니다.</p>
          <a className="adc-btn" href={buildLoginHref()}>
            로그인
          </a>
        </div>
      </ConsoleFrame>
    );
  }

  if (me.isLoading) {
    return (
      <ConsoleFrame>
        <p className="adc-status">불러오는 중…</p>
      </ConsoleFrame>
    );
  }

  if (me.isError) {
    return (
      <ConsoleFrame>
        <p className="adc-status adc-status--error" role="alert">
          광고주 정보를 불러오지 못했습니다.
        </p>
      </ConsoleFrame>
    );
  }

  const advertiser = me.data ?? null;
  if (!advertiser) {
    return (
      <ConsoleFrame>
        <RegisterAdvertiser />
      </ConsoleFrame>
    );
  }

  const readOnly = advertiser.status === 'SUSPENDED';
  return (
    <ConsoleFrame advertiser={advertiser} view={view} readOnly={readOnly}>
      {readOnly && (
        <div className="adc-suspended" role="status" data-entry="suspended">
          <strong>정지된 광고주입니다.</strong> 잔액과 리포트는 볼 수 있고, 충전·캠페인·소재는 바꿀 수 없습니다.
          {advertiser.suspendReason && <span className="adc-suspended__reason">사유: {advertiser.suspendReason}</span>}
        </div>
      )}
      {view === 'dashboard' && <ConsoleDashboard advertiser={advertiser} readOnly={readOnly} />}
      {view === 'top-up' && <TopUpForm advertiser={advertiser} readOnly={readOnly} />}
      {view === 'campaign-new' && <CampaignEditor readOnly={readOnly} />}
      {view === 'campaign' && <CampaignEditor readOnly={readOnly} existing />}
      {view === 'reports' && <ConsoleReports />}
    </ConsoleFrame>
  );
}

function ConsoleFrame({
  advertiser,
  view,
  readOnly = false,
  children,
}: {
  advertiser?: AdvertiserDashboard;
  view?: ConsoleView;
  readOnly?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="adc-page">
      <header className="adc-top">
        <Link className="adc-top__brand" to={consoleHref('')}>
          1989v 광고
        </Link>
        <span className="adc-top__host">ads.1989v.com</span>
        {advertiser && <span className="adc-top__me">{advertiser.displayName} · 광고주</span>}
      </header>
      <div className="adc-bar">
        {advertiser && (
          <nav className="adc-nav" aria-label="콘솔">
            <NavItem to={consoleHref('')} current={view === 'dashboard' || view === 'top-up'}>
              대시보드
            </NavItem>
            {!readOnly && (
              <NavItem to={consoleHref('/campaigns/new')} current={view === 'campaign-new' || view === 'campaign'}>
                새 캠페인
              </NavItem>
            )}
            <NavItem to={consoleHref('/reports')} current={view === 'reports'}>
              리포트
            </NavItem>
          </nav>
        )}
        <ThemeToggle />
      </div>
      <main className="adc-main">{children}</main>
    </div>
  );
}

function NavItem({ to, current, children }: { to: string; current: boolean; children: ReactNode }) {
  return (
    <Link className="adc-nav__item" to={to} aria-current={current ? 'page' : undefined}>
      {children}
    </Link>
  );
}

function RegisterAdvertiser() {
  const queryClient = useQueryClient();
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);

  const register = useMutation({
    mutationFn: () => registerAdvertiser(displayName.trim()),
    onSuccess: () => {
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['ads', 'me'] });
    },
    onError: (err) => setError(adsErrorMessage(err, '광고주로 등록하지 못했습니다.')),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('광고주 이름을 적어 주세요.');
      return;
    }
    register.mutate();
  };

  return (
    <form className="adc-entry" data-entry="register" onSubmit={onSubmit}>
      <h1 className="adc-entry__title">광고주 등록</h1>
      <p className="adc-entry__text">
        1989v 서비스 지면에 광고를 내려면 광고주로 등록합니다. 크레딧은 가상으로 발행되고 실제 결제는 없습니다.
      </p>
      <label className="adc-field">
        <span className="adc-field__label">광고주 이름</span>
        <input
          className="kh-field"
          value={displayName}
          maxLength={100}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="광고에 함께 표시됩니다"
        />
      </label>
      {error && (
        <p className="adc-error" role="alert">
          {error}
        </p>
      )}
      <button className="adc-btn" type="submit" disabled={register.isPending}>
        등록
      </button>
    </form>
  );
}
