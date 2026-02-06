import { useState, useRef, useEffect, ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
}

export default function PullToRefresh({ onRefresh, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [canPull, setCanPull] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const threshold = 80;
  const maxPull = 120;

  const handleTouchStart = (e: TouchEvent) => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop === 0) {
      setCanPull(true);
      setStartY(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!canPull || startY === 0 || isRefreshing) return;

    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) {
      setCanPull(false);
      setPullDistance(0);
      return;
    }

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY;

    if (distance > 0) {
      // Prevent default pull-to-refresh behavior
      e.preventDefault();
      // Apply resistance curve for natural feel
      const resistanceFactor = 0.5;
      const adjustedDistance = Math.min(distance * resistanceFactor, maxPull);
      setPullDistance(adjustedDistance);
    }
  };

  const handleTouchEnd = async () => {
    if (!canPull) return;

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true);
      if ('vibrate' in navigator) {
        navigator.vibrate(20);
      }
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
          setCanPull(false);
        }, 300);
      }
    } else {
      setPullDistance(0);
      setCanPull(false);
    }
    setStartY(0);
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: false });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchmove', handleTouchMove);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [startY, pullDistance, isRefreshing, canPull]);

  const rotation = isRefreshing ? 0 : (pullDistance / threshold) * 360;
  const opacity = Math.min(pullDistance / threshold, 1);
  const scale = Math.min(0.5 + (pullDistance / threshold) * 0.5, 1);

  return (
    <div ref={containerRef} className="relative no-overscroll">
      {/* Pull indicator */}
      <div 
        className="absolute top-0 left-1/2 -translate-x-1/2 z-50 transition-all duration-200"
        style={{ 
          transform: `translateX(-50%) translateY(${Math.min(pullDistance - 20, 60)}px) scale(${scale})`,
          opacity: opacity,
          pointerEvents: 'none'
        }}
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary shadow-lg">
          <RefreshCw 
            className={`h-6 w-6 text-primary-foreground transition-transform ${isRefreshing ? 'animate-spin' : ''}`}
            style={{ transform: isRefreshing ? 'none' : `rotate(${rotation}deg)` }}
          />
        </div>
      </div>
      
      {children}
    </div>
  );
}
