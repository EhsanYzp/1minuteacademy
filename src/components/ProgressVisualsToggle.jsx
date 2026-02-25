import useShowProgressVisuals from '../lib/useShowProgressVisuals';
import { setLocalShowProgressVisuals } from '../lib/progressVisuals';

export default function ProgressVisualsToggle({ className = '' } = {}) {
  const show = useShowProgressVisuals();

  function onToggle() {
    setLocalShowProgressVisuals(!show);
  }

  return (
    <button
      type="button"
      className={`catflow-button catflow-progressToggle ${className}`.trim()}
      data-on={show ? 'true' : 'false'}
      onClick={onToggle}
      role="switch"
      aria-checked={Boolean(show)}
      aria-label="Progress visuals"
      title="Show/hide progress bars and percentages"
    >
      <span className="catflow-progressToggleTrack" aria-hidden="true">
        <span className="catflow-progressToggleThumb" />
      </span>
      <span className="catflow-progressToggleLabel">Progress</span>
      <span className="catflow-progressToggleState">{show ? 'On' : 'Off'}</span>
    </button>
  );
}
