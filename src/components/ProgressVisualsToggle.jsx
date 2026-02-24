import useShowProgressVisuals from '../lib/useShowProgressVisuals';
import { setLocalShowProgressVisuals } from '../lib/progressVisuals';

export default function ProgressVisualsToggle({ className = '' } = {}) {
  const show = useShowProgressVisuals();

  function onToggle() {
    setLocalShowProgressVisuals(!show);
  }

  const label = show ? 'Progress: On' : 'Progress: Off';

  return (
    <button
      type="button"
      className={`catflow-button catflow-progressToggle ${className}`.trim()}
      data-on={show ? 'true' : 'false'}
      onClick={onToggle}
      aria-pressed={Boolean(show)}
      aria-label="Toggle progress visuals"
      title="Show/hide progress bars and percentages"
    >
      {label}
    </button>
  );
}
