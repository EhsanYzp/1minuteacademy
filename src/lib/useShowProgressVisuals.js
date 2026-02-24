import { useEffect, useState } from 'react';
import { getLocalShowProgressVisuals, PROGRESS_VISUALS_CHANGED_EVENT } from './progressVisuals';

export default function useShowProgressVisuals() {
  const [show, setShow] = useState(() => getLocalShowProgressVisuals());

  useEffect(() => {
    function refresh() {
      setShow(getLocalShowProgressVisuals());
    }

    window?.addEventListener?.(PROGRESS_VISUALS_CHANGED_EVENT, refresh);
    window?.addEventListener?.('storage', refresh);
    return () => {
      window?.removeEventListener?.(PROGRESS_VISUALS_CHANGED_EVENT, refresh);
      window?.removeEventListener?.('storage', refresh);
    };
  }, []);

  return show;
}
