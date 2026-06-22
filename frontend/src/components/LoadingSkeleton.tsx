import React from 'react';
import Skeleton from 'react-loading-skeleton';

/**
 * A lightweight skeleton loader used while data is being fetched.
 * It accepts a `height` and `width` prop to match the expected
 * placeholder size. The component is intentionally simple so it can
 * be reused across the application without pulling in heavy UI
 * libraries.
 */
export interface LoadingSkeletonProps {
  height?: number | string;
  width?: number | string;
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  height = 20,
  width = '100%',
  count = 1,
}) => {
  return (
    <div style={{ width, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} height={height} />
      ))}
    </div>
  );
};

export default LoadingSkeleton;
