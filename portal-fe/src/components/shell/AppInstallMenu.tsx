import { useCallback, useContext, useRef, useState } from 'react';
import { Menu } from 'lucide-react';
import { InstallContext } from '../../shell/appInstall';
import { AppInstallButton } from './AppInstall';
import KhSheet from './KhSheet';

/** A header menu for services without the shared GNB; reuses the shell provider. */
export default function AppInstallMenu() {
  const { hidden } = useContext(InstallContext);
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => { setOpen(false); trigger.current?.focus(); }, []);
  if (hidden) return null;
  return <>
    <button ref={trigger} type="button" className="app-install-menu" aria-label="서비스 메뉴" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}><Menu size={20} aria-hidden="true" /></button>
    {open && <KhSheet label="서비스 메뉴" className="kh-sheet--dialog" onClose={close}>
      <AppInstallButton onBeforeInstall={close} />
      <button type="button" className="kh-button-ghost app-install-close" onClick={close}>닫기</button>
    </KhSheet>}
  </>;
}
