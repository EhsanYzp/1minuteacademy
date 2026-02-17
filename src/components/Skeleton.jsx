import './Skeleton.css';

export default function Skeleton({
  width = '100%',
  height = 16,
  radius = 12,
  style,
  className,
  ariaHidden = true,
}) {
  return (
    <div
      className={['skeleton', className].filter(Boolean).join(' ')}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden={ariaHidden}
    />
  );
}
