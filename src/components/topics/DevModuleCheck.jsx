import { useEffect, useRef, useState } from 'react';

export default function DevModuleCheck({ enabled, children }) {
  const [checkOpen, setCheckOpen] = useState(false);
  const [checkTopic, setCheckTopic] = useState(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkReport, setCheckReport] = useState(null);
  const [checkError, setCheckError] = useState(null);
  const [checkOverrides, setCheckOverrides] = useState(() => new Map());
  const [checkPercent, setCheckPercent] = useState(0);
  const [checkPhase, setCheckPhase] = useState('');
  const eventSourceRef = useRef(null);

  useEffect(() => {
    return () => {
      try {
        eventSourceRef.current?.close?.();
      } catch {
        // ignore
      }
    };
  }, []);

  async function runModuleCheck(topic) {
    if (!enabled) return;
    if (!topic?.id) return;

    try {
      eventSourceRef.current?.close?.();
    } catch {
      // ignore
    }

    setCheckOpen(true);
    setCheckTopic(topic);
    setCheckLoading(true);
    setCheckReport(null);
    setCheckError(null);
    setCheckPercent(0);
    setCheckPhase('Starting…');

    try {
      const es = new EventSource(`/__dev/module-check/stream?topic=${encodeURIComponent(topic.id)}`);
      eventSourceRef.current = es;

      es.addEventListener('progress', (ev) => {
        try {
          const p = JSON.parse(ev.data);
          if (typeof p?.percent === 'number') setCheckPercent(Math.max(0, Math.min(100, p.percent)));
          if (p?.message) setCheckPhase(String(p.message));
          else if (p?.phase) setCheckPhase(String(p.phase));
        } catch {
          // ignore
        }
      });

      es.addEventListener('done', (ev) => {
        try {
          const data = JSON.parse(ev.data);
          setCheckReport(data);
          if (!data?.ok) setCheckError(data?.error || 'Some checks failed');

          try {
            const raw = window.localStorage.getItem(`oma_module_check_overrides:${topic.id}`);
            const parsed = raw ? JSON.parse(raw) : null;
            const m = new Map(Object.entries(parsed || {}));
            setCheckOverrides(m);
          } catch {
            setCheckOverrides(new Map());
          }
        } catch (e) {
          setCheckError(String(e?.message ?? e));
        } finally {
          setCheckLoading(false);
          setCheckPercent(100);
          try {
            es.close();
          } catch {
            // ignore
          }
        }
      });

      es.addEventListener('error', (ev) => {
        try {
          if (ev?.data) {
            const payload = JSON.parse(ev.data);
            setCheckError(payload?.error || 'Module check stream error');
          } else {
            setCheckError('Module check stream error');
          }
        } catch {
          setCheckError('Module check stream error');
        } finally {
          setCheckLoading(false);
          try {
            es.close();
          } catch {
            // ignore
          }
        }
      });
    } catch (e) {
      setCheckError(String(e?.message ?? e));
    }
  }

  function applyOverrides(items, overrides) {
    const arr = Array.isArray(items) ? items : [];
    if (!overrides || overrides.size === 0) return arr;
    return arr.map((it) => {
      const next = overrides.get(it.id);
      if (next !== 'pass' && next !== 'fail') return it;
      return { ...it, status: next, details: it.details };
    });
  }

  function summaryFor(items) {
    return (Array.isArray(items) ? items : []).reduce(
      (acc, it) => {
        const s = it?.status;
        if (!s) return acc;
        acc[s] = (acc[s] ?? 0) + 1;
        return acc;
      },
      { pass: 0, fail: 0, warn: 0, manual: 0 }
    );
  }

  const checkTopicId = checkTopic?.id ?? null;
  function getDevTestLabel(topicId) {
    return checkLoading && checkTopicId && String(checkTopicId) === String(topicId) ? 'Testing…' : 'Test';
  }

  return (
    <>
      {typeof children === 'function'
        ? children({
            enabled,
            runModuleCheck,
            getDevTestLabel,
          })
        : children}

      {enabled && checkOpen && (
        <div className="dev-check-modal" role="dialog" aria-modal="true">
          <div className="dev-check-modal-inner">
            <div className="dev-check-modal-header">
              <div className="dev-check-modal-title">Module check: {checkTopic?.title || checkTopic?.id}</div>
              <button
                type="button"
                className="dev-check-close"
                onClick={() => {
                  if (checkLoading) return;
                  setCheckOpen(false);
                }}
              >
                Close
              </button>
            </div>

            {checkLoading && <div className="dev-check-status">Running checks… (can take ~30–90s)</div>}
            {checkLoading && (
              <div className="dev-check-progress" aria-label="Module check progress">
                <div className="dev-check-progress-row">
                  <div className="dev-check-progress-text">{checkPhase || 'Running…'}</div>
                  <div className="dev-check-progress-pct">{Math.round(checkPercent)}%</div>
                </div>
                <div
                  className="dev-check-bar"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(checkPercent)}
                >
                  <div className="dev-check-bar-inner" style={{ width: `${Math.round(checkPercent)}%` }} />
                </div>
              </div>
            )}
            {checkError && !checkLoading && <div className="dev-check-error">{checkError}</div>}

            {checkReport && (
              <div className="dev-check-report">
                {(() => {
                  const mergedItems = applyOverrides(checkReport.items, checkOverrides);
                  const mergedSummary = summaryFor(mergedItems);
                  const ok = (mergedSummary.fail ?? 0) === 0 && (mergedSummary.manual ?? 0) === 0 && (mergedSummary.warn ?? 0) === 0;

                  return (
                    <>
                      <div className="dev-check-summary">
                        <span className={ok ? 'dev-check-ok' : 'dev-check-bad'}>{ok ? 'PASS' : 'FAIL'}</span>
                        <span className="dev-check-summary-meta">
                          pass: {mergedSummary.pass ?? 0} · fail: {mergedSummary.fail ?? 0} · warn: {mergedSummary.warn ?? 0} · manual:{' '}
                          {mergedSummary.manual ?? 0}
                        </span>
                      </div>

                      <div className="dev-check-items">
                        {mergedItems.map((it) => {
                          const isManual = it.status === 'manual';
                          const showStatus = isManual ? 'fail' : it.status;

                          return (
                            <div key={`${it.id}-${it.title}`} className={`dev-check-item dev-check-${showStatus}`}>
                              <div className="dev-check-item-title">
                                <span className="dev-check-pill">{String(it.status).toUpperCase()}</span>
                                <span className="dev-check-item-text">{it.title}</span>
                                <span className="dev-check-item-actions">
                                  <button
                                    type="button"
                                    className="dev-check-action"
                                    onClick={() => {
                                      const topicId = checkTopic?.id;
                                      if (!topicId) return;
                                      setCheckOverrides((prev) => {
                                        const next = new Map(prev);
                                        next.set(it.id, 'pass');
                                        try {
                                          window.localStorage.setItem(
                                            `oma_module_check_overrides:${topicId}`,
                                            JSON.stringify(Object.fromEntries(next.entries()))
                                          );
                                        } catch {
                                          // ignore
                                        }
                                        return next;
                                      });
                                    }}
                                  >
                                    Mark green
                                  </button>
                                  <button
                                    type="button"
                                    className="dev-check-action"
                                    onClick={() => {
                                      const topicId = checkTopic?.id;
                                      if (!topicId) return;
                                      setCheckOverrides((prev) => {
                                        const next = new Map(prev);
                                        next.set(it.id, 'fail');
                                        try {
                                          window.localStorage.setItem(
                                            `oma_module_check_overrides:${topicId}`,
                                            JSON.stringify(Object.fromEntries(next.entries()))
                                          );
                                        } catch {
                                          // ignore
                                        }
                                        return next;
                                      });
                                    }}
                                  >
                                    Mark red
                                  </button>
                                </span>
                              </div>
                              {it.section && <div className="dev-check-item-section">{it.section}</div>}
                              {it.details && <pre className="dev-check-item-details">{String(it.details)}</pre>}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
