import React from 'react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'rect' | 'circle';
  width?: string | number;
  height?: string | number;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  className = '', 
  variant = 'text', 
  width, 
  height 
}) => {
  const baseClass = "bg-slate-200 animate-pulse transition-all duration-300 ease-in-out";
  const variantClass = {
    text: "h-3 w-full rounded",
    rect: "rounded-lg",
    circle: "rounded-full"
  }[variant];

  const style: React.CSSProperties = {
    width: width,
    height: height
  };

  return (
    <div 
      className={`${baseClass} ${variantClass} ${className}`} 
      style={style}
    />
  );
};

export default Skeleton;

// 🧊 Squelette spécifique pour une ligne de tableau (Cahier / PV)
export const TableRowSkeleton: React.FC = () => (
  <div className="flex items-center space-x-4 p-4 border-b border-slate-100 w-full">
    <Skeleton variant="rect" width="10%" height="16px" />
    <Skeleton variant="rect" width="30%" height="16px" />
    <Skeleton variant="rect" width="20%" height="16px" />
    <Skeleton variant="rect" width="20%" height="16px" />
    <div className="flex-1 flex justify-end">
       <Skeleton variant="circle" width="32px" height="32px" />
    </div>
  </div>
);

// 🧊 Squelette spécifique pour une carte (Card) de statistiques
export const CardSkeleton: React.FC = () => (
  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton variant="circle" width="40px" height="40px" />
      <Skeleton variant="rect" width="60px" height="12px" />
    </div>
    <Skeleton variant="text" width="40%" height="24px" />
    <Skeleton variant="text" width="80%" height="12px" />
  </div>
);
