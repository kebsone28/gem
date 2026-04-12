import React from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   DESIGN SYSTEM ANALYTICS - MÉTRIQUES D'USAGE
   ═══════════════════════════════════════════════════════════════════════════ */

interface ComponentUsage {
  component: string;
  timestamp: number;
  props?: Record<string, any>;
  page?: string;
}

class DesignSystemAnalytics {
  private static instance: DesignSystemAnalytics;
  private usageData: ComponentUsage[] = [];
  private isEnabled = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

  private constructor() {
    // Load existing data from localStorage
    this.loadFromStorage();
  }

  static getInstance(): DesignSystemAnalytics {
    if (!DesignSystemAnalytics.instance) {
      DesignSystemAnalytics.instance = new DesignSystemAnalytics();
    }
    return DesignSystemAnalytics.instance;
  }

  trackUsage(component: string, props?: Record<string, any>, page?: string) {
    if (!this.isEnabled || typeof window === 'undefined') return;

    const usage: ComponentUsage = {
      component,
      timestamp: Date.now(),
      props: this.sanitizeProps(props),
      page: page || window.location.pathname,
    };

    this.usageData.push(usage);
    this.saveToStorage();

    // Log to console in development
    console.debug(`🎨 [DS] ${component}`, {
      props: usage.props,
      page: usage.page,
    });
  }

  getUsageStats() {
    const stats = this.usageData.reduce(
      (acc, usage) => {
        if (!acc[usage.component]) {
          acc[usage.component] = { count: 0, pages: new Set(), lastUsed: 0 };
        }
        acc[usage.component].count++;
        if (usage.page) {
          acc[usage.component].pages.add(usage.page);
        }
        acc[usage.component].lastUsed = Math.max(acc[usage.component].lastUsed, usage.timestamp);
        return acc;
      },
      {} as Record<string, { count: number; pages: Set<string>; lastUsed: number }>
    );

    // Convert Sets to Arrays for JSON serialization
    return Object.entries(stats).map(([component, data]) => ({
      component,
      count: data.count,
      pages: Array.from(data.pages),
      lastUsed: new Date(data.lastUsed).toISOString(),
    }));
  }

  getPopularComponents(limit = 10) {
    return this.getUsageStats()
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  getUnusedComponents(availableComponents: string[]) {
    const usedComponents = new Set(this.usageData.map((u) => u.component));
    return availableComponents.filter((comp) => !usedComponents.has(comp));
  }

  clearData() {
    this.usageData = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem('design-system-analytics');
    }
  }

  exportData() {
    return {
      metadata: {
        exportedAt: new Date().toISOString(),
        totalUsages: this.usageData.length,
        componentsTracked: new Set(this.usageData.map((u) => u.component)).size,
      },
      stats: this.getUsageStats(),
      rawData: this.usageData,
    };
  }

  private sanitizeProps(props?: Record<string, any>) {
    if (!props) return undefined;

    const sanitized: Record<string, any> = {};

    // List of keys to always exclude
    const excludeKeys = new Set([
      'children',
      'onClick',
      'onChange',
      'ref',
      'onBlur',
      'onFocus',
      'onKeyDown',
    ]);

    Object.keys(props).forEach((key) => {
      if (excludeKeys.has(key)) return;

      const value = props[key];

      // Only keep basic serializable types
      if (value === null || value === undefined) {
        sanitized[key] = value;
      } else if (typeof value === 'string') {
        sanitized[key] = value.length > 100 ? value.substring(0, 100) + '...' : value;
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        sanitized[key] = value;
      } else if (Array.isArray(value)) {
        sanitized[key] = `Array(${value.length})`;
      } else if (typeof value === 'object') {
        // For objects, we just store a summary to avoid circular refs
        if (value.$$typeof) {
          sanitized[key] = 'ReactComponent';
        } else if (value instanceof HTMLElement) {
          sanitized[key] = `HTMLElement(${value.tagName})`;
        } else {
          sanitized[key] = 'Object';
        }
      } else if (typeof value === 'function') {
        sanitized[key] = 'Function';
      }
    });

    return sanitized;
  }

  private saveToStorage() {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('design-system-analytics', JSON.stringify(this.usageData));
    } catch (error) {
      console.warn('Failed to save design system analytics to localStorage:', error);
    }
  }

  private loadFromStorage() {
    if (typeof window === 'undefined') return;

    try {
      const data = localStorage.getItem('design-system-analytics');
      if (data) {
        this.usageData = JSON.parse(data);
      }
    } catch (error) {
      console.warn('Failed to load design system analytics from localStorage:', error);
    }
  }
}

export const analytics = DesignSystemAnalytics.getInstance();

// HOC pour tracker l'usage des composants
export function withAnalytics<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return React.forwardRef<any, P>((props, ref) => {
    React.useEffect(() => {
      analytics.trackUsage(componentName, props as Record<string, any>);
    }, []); // Track once per component instance

    return React.createElement(Component, { ...(props as any), ref });
  });
}

// Hook pour accéder aux métriques
export function useDesignSystemAnalytics() {
  return {
    getUsageStats: () => analytics.getUsageStats(),
    getPopularComponents: (limit?: number) => analytics.getPopularComponents(limit),
    getUnusedComponents: (availableComponents: string[]) =>
      analytics.getUnusedComponents(availableComponents),
    clearData: () => analytics.clearData(),
    exportData: () => analytics.exportData(),
  };
}
