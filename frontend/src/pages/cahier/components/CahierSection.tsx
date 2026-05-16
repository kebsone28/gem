import React from 'react';

/**
 * Composant de section pour le Cahier des Charges
 */
export const CahierSection: React.FC<{
  title: string;
  color: string;
  children: React.ReactNode;
}> = ({ title, color, children }) => (
  <div className="mb-8">
    <div className="flex items-center space-x-2 mb-4">
      <div
        className="w-1 h-5 rounded-full bg-[var(--section-color)]"
        style={{ '--section-color': color } as React.CSSProperties}
      />
      <h4 className="font-bold text-slate-100 uppercase tracking-[0.14em] text-xs">{title}</h4>
    </div>
    {children}
  </div>
);
