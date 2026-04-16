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
  const baseClass = "bg-white/5 animate-pulse transition-all duration-300 ease-in-out";
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
  <div className="flex items-center space-x-4 p-4 border-b border-white/5 w-full bg-slate-900/20">
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
  <div className="p-6 rounded-[2rem] border border-white/5 bg-slate-900/40 backdrop-blur-xl shadow-2xl space-y-4">
    <div className="flex justify-between items-center">
      <Skeleton variant="circle" width="40px" height="40px" className="opacity-40" />
      <Skeleton variant="rect" width="60px" height="12px" className="opacity-20" />
    </div>
    <Skeleton variant="text" width="60%" height="24px" className="opacity-40" />
    <Skeleton variant="text" width="90%" height="12px" className="opacity-10" />
  </div>
);
