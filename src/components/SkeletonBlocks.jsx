import Skeleton from './Skeleton';

export function TopicHeaderSkeleton() {
  return (
    <div style={{ padding: '14px 0 8px' }} aria-hidden="true">
      <Skeleton width={140} height={14} radius={8} style={{ marginBottom: 12 }} />
      <Skeleton width={'72%'} height={34} radius={14} style={{ marginBottom: 10 }} />
      <Skeleton width={'88%'} height={18} radius={10} style={{ marginBottom: 14 }} />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <Skeleton width={110} height={28} radius={999} />
        <Skeleton width={110} height={28} radius={999} />
        <Skeleton width={110} height={28} radius={999} />
      </div>
    </div>
  );
}

export function TopicsGridSkeleton({ count = 12 } = {}) {
  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <div className="topics-grid" aria-hidden="true">
      {items.map((i) => (
        <div key={i} style={{ width: '100%' }}>
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.75)',
              borderRadius: 24,
              padding: 16,
              boxShadow: 'var(--shadow-sm)',
              border: '1px solid rgba(11, 18, 32, 0.06)',
              minHeight: 150,
            }}
          >
            <Skeleton width={54} height={54} radius={16} style={{ marginBottom: 12 }} />
            <Skeleton width={'70%'} height={18} radius={10} style={{ marginBottom: 10 }} />
            <Skeleton width={'92%'} height={14} radius={10} style={{ marginBottom: 8 }} />
            <Skeleton width={'84%'} height={14} radius={10} style={{ marginBottom: 14 }} />
            <div style={{ display: 'flex', gap: 10 }}>
              <Skeleton width={92} height={32} radius={999} />
              <Skeleton width={92} height={32} radius={999} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileTabsSkeleton() {
  return (
    <div className="profile-tabs" role="tablist" aria-label="Profile sections" aria-hidden="true">
      {['One', 'Two', 'Three', 'Four', 'Five'].map((k) => (
        <div key={k} className="profile-tab" style={{ padding: 0, background: 'transparent' }}>
          <Skeleton width={92} height={34} radius={999} />
        </div>
      ))}
    </div>
  );
}
