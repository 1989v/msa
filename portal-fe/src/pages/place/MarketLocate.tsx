import { useEffect, useRef, useState } from 'react';
import type { MarketResponse } from '../../api/marketApi';
import type { PlaceLang } from '../../api/placeApi';
import { marketLocationGuide, type MarketUserPosition } from './marketView';

export default function MarketLocate({ data, lang, onPosition }: {
  data: MarketResponse; lang: PlaceLang; onPosition: (position: MarketUserPosition) => void;
}) {
  const en = lang === 'en';
  const [position, setPosition] = useState<MarketUserPosition | null>(null);
  const [status, setStatus] = useState<'idle' | 'pending' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const locate = () => {
    if (!navigator.geolocation) {
      setError(en ? 'This browser does not support location.' : '이 브라우저는 위치 확인을 지원하지 않습니다');
      setStatus('error'); return;
    }
    setStatus('pending'); setError('');
    navigator.geolocation.getCurrentPosition((result) => {
      if (!active.current) return;
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude, accuracy: result.coords.accuracy, timestamp: result.timestamp };
      setPosition(next); onPosition(next); setStatus('done');
    }, (failure) => {
      if (!active.current) return;
      setError(failure.code === 1 ? (en ? 'Location permission was denied.' : '위치 권한이 거부되었습니다')
        : failure.code === 3 ? (en ? 'Location was not found within 10 seconds.' : '10초 안에 위치를 확인하지 못했습니다')
          : (en ? 'Your location could not be determined.' : '현재 위치를 확인할 수 없습니다'));
      setStatus('error');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  };
  const guide = position ? marketLocationGuide(position, data.market as MarketResponse['market'] & { latitude?: number | null; longitude?: number | null }, data.boundary?.polygon, lang) : null;
  return <div className="place-market-locate">
    <button type="button" onClick={locate} disabled={status === 'pending'}>
      {status === 'pending' ? (en ? 'Locating…' : '위치 확인 중…') : status === 'idle' ? (en ? 'My location' : '내 위치') : (en ? 'Measure again' : '다시 재기')}
    </button>
    <div role="status" aria-live="polite">
      {error && <p>{error}</p>}
      {position && <>
        <p>{guide?.inside ? (en ? 'You are inside the market.' : '시장 안입니다')
          : guide ? (en ? `Market centre: ${Math.round(guide.distance)} m · ${guide.direction}` : `시장 중심까지 ${Math.round(guide.distance)} m · ${guide.direction}`)
            : (en ? 'The market centre is unavailable, so distance guidance cannot be shown.' : '시장 중심 위치가 없어 거리 안내를 표시할 수 없습니다')}</p>
        <p>{en ? 'Accuracy' : '정확도'} ±{Math.round(position.accuracy)} m · {en ? 'Measured' : '측정'} <time dateTime={new Date(position.timestamp).toISOString()}>{new Date(position.timestamp).toLocaleString(en ? 'en-GB' : 'ko-KR')}</time></p>
      </>}
    </div>
  </div>;
}
