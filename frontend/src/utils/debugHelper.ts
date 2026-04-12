/**
 * Debug Helper - Track render counts and detect loops
 * Use in development to catch infinite render loops
 */

// Augment Performance interface for memory property (Chrome/Chromium)
declare global {
  interface Performance {
    memory?: {
      jsHeapSizeLimit: number;
      totalJSHeapSize: number;
      usedJSHeapSize: number;
    };
  }
}

let renderCounts: Record<string, number> = {};

export function trackRender(componentName: string) {
  renderCounts[componentName] = (renderCounts[componentName] || 0) + 1;
  const count = renderCounts[componentName];

  // Warn if rendering more than 5 times in a short period
  if (count > 5 && count % 10 === 0) {
    console.warn(`⚠️ [RENDER LOOP] ${componentName} has rendered ${count} times`);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`📊 ${componentName}: render #${count}`);
  }
}

export function resetRenderCounts() {
  renderCounts = {};
}

export function getRenderCounts(): Record<string, number> {
  return { ...renderCounts };
}

/**
 * Monitor memory usage in browser
 */
export function getMemoryInfo() {
  if (!performance.memory) {
    return null;
  }

  const { usedJSHeapSize, jsHeapSizeLimit, totalJSHeapSize } = performance.memory;
  const percentUsed = (usedJSHeapSize / jsHeapSizeLimit) * 100;

  return {
    used: `${(usedJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
    limit: `${(jsHeapSizeLimit / 1024 / 1024).toFixed(2)}MB`,
    total: `${(totalJSHeapSize / 1024 / 1024).toFixed(2)}MB`,
    percentUsed: `${percentUsed.toFixed(1)}%`,
    isHighMemory: percentUsed > 75,
  };
}

export function logMemoryWarning() {
  const info = getMemoryInfo();
  if (!info) return;

  if (info.isHighMemory) {
    console.warn(
      `⚠️ [MEMORY] High memory usage: ${info.used} / ${info.limit} (${info.percentUsed})`
    );
  } else {
    console.log(`💾 [MEMORY] ${info.used} / ${info.limit} (${info.percentUsed})`);
  }
}

// Auto-check memory every 10 seconds in development
if (process.env.NODE_ENV === 'development') {
  setInterval(logMemoryWarning, 10000);
}
