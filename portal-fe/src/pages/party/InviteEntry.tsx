import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { gamePath } from '../../seo/copy.mjs';
import { parseInvitation } from './invitation';
import type { GameLang } from '../../api/gameApi';

export default function InviteEntry({ lang = 'ko', onJoin }: { lang?: GameLang; onJoin?: (code: string) => void }) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const navigate = useNavigate();
  return <form className="party-join-form" onSubmit={(e) => {
    e.preventDefault();
    const invite = parseInvitation(value);
    if (invite.kind !== 'join') { setError(true); return; }
    setError(false);
    if (onJoin) onJoin(invite.code); else navigate(gamePath(lang, `/party/${invite.code}`));
  }}>
    <label htmlFor="invite-code">{lang === 'en' ? 'Room code or invitation link' : '방 코드 또는 초대 링크'}</label>
    <input id="invite-code" value={value} autoCapitalize="characters" spellCheck={false}
      placeholder="ABC234" onChange={(e) => setValue(e.target.value)} />
    <button type="submit" className="party-copy">{lang === 'en' ? 'Join room' : '코드로 입장'}</button>
    {error && <p role="alert">{lang === 'en' ? 'Enter a valid six-character room code.' : '올바른 6자리 방 코드를 입력하세요.'}</p>}
  </form>;
}
