import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { webVitalsDocument } from './webVitalsDocument';

/** A document that navigates away never resumes reporting on a return visit. */
export default function WebVitalsNavigationGuard() {
  const location = useLocation();
  useEffect(() => {
    const state = webVitalsDocument();
    if (state && window.location.href !== state.initialHref) state.stopped = true;
  }, [location]);
  return null;
}
