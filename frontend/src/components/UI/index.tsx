import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { withAnalytics } from '../../utils/designSystemAnalytics';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = withAnalytics(
  ({ variant = 'primary', size = 'md', isLoading = false, icon, children, disabled, ...props }) => {
    const baseClasses =
      'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';

    const variantClasses = {
      primary:
        'bg-gradient-to-r from-blue-600 to-blue-400 text-white hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0',
      secondary:
        'bg-gray-100 text-gray-900 border border-gray-200 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100 dark:border-gray-700 dark:hover:bg-gray-700',
      outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950',
      ghost: 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
      danger: 'bg-red-600 text-white hover:bg-red-700 hover:shadow-lg hover:-translate-y-0.5',
    };

    const sizeClasses = {
      sm: 'px-3 py-1.5 text-sm',
      md: 'px-4 py-2 text-base',
      lg: 'px-6 py-3 text-lg',
    };

    return (
      <button
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]}`}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        ) : (
          icon && <span className="flex-shrink-0">{icon}</span>
        )}
        {children}
      </button>
    );
  },
  'Button'
);

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  elevated?: boolean;
}

export const Card: React.FC<CardProps> = ({ elevated = false, className = '', ...props }) => {
  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 transition-all duration-200 ${
        elevated ? 'shadow-lg hover:shadow-xl' : 'shadow-sm hover:shadow-md'
      } ${className}`}
      {...props}
    />
  );
};

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'error' | 'info' | 'primary';
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'primary', className = '', ...props }) => {
  const variantClasses = {
    success: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200',
    warning: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200',
    error: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200',
    info: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
    primary: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200',
  };

  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
};

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ label, error, icon, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">{icon}</div>
        )}
        <input
          className={`w-full px-4 py-2 ${icon ? 'pl-10' : ''} rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 ${
            error ? 'border-red-500 focus:ring-red-500' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  className?: string;
}

export const Select: React.FC<SelectProps> = withAnalytics(
  ({
    options,
    value,
    onChange,
    placeholder = 'Sélectionner...',
    label,
    error,
    disabled = false,
    className = '',
  }) => {
    const [isOpen, setIsOpen] = useState(false);
    const selectRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
          setIsOpen(false);
        }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find((option) => option.value === value);

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            {label}
          </label>
        )}
        <div className="relative" ref={selectRef}>
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            className={`w-full px-4 py-2 text-left rounded-lg border bg-white dark:bg-gray-800 transition-all duration-200 flex items-center justify-between ${
              error
                ? 'border-red-500 focus:ring-red-500'
                : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2'} ${className}`}
          >
            <span
              className={
                selectedOption
                  ? 'text-gray-900 dark:text-gray-100'
                  : 'text-gray-400 dark:text-gray-500'
              }
            >
              {selectedOption ? selectedOption.label : placeholder}
            </span>
            <ChevronDown
              className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {isOpen && (
            <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    if (!option.disabled) {
                      onChange?.(option.value);
                      setIsOpen(false);
                    }
                  }}
                  className={`w-full px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150 flex items-center justify-between ${
                    option.disabled ? 'opacity-50 cursor-not-allowed' : ''
                  } ${value === option.value ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}
                  disabled={option.disabled}
                >
                  {option.label}
                  {value === option.value && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
        {error && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  },
  'Select'
);

interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'success' | 'warning' | 'error' | 'info';
  icon?: React.ReactNode;
}

export const Alert: React.FC<AlertProps> = withAnalytics(
  ({ variant = 'info', icon, className = '', ...props }) => {
    const variantClasses = {
      success:
        'bg-green-100 dark:bg-green-900/50 border-l-4 border-green-600 text-green-900 dark:text-green-100 font-medium',
      warning:
        'bg-yellow-100 dark:bg-yellow-900/50 border-l-4 border-yellow-600 text-yellow-900 dark:text-yellow-100 font-medium',
      error:
        'bg-red-100 dark:bg-red-900/50 border-l-4 border-red-600 text-red-900 dark:text-red-100 font-medium',
      info: 'bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-600 text-blue-900 dark:text-blue-100 font-medium',
    };

    return (
      <div
        className={`p-4 rounded flex gap-3 transition-all duration-200 ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {icon && <div className="flex-shrink-0 mt-0.5">{icon}</div>}
        <div className="flex-1">{props.children}</div>
      </div>
    );
  },
  'Alert'
);

interface TabsProps {
  tabs: { label: string; content: React.ReactNode }[];
  defaultTab?: number;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, defaultTab = 0 }) => {
  const [activeTab, setActiveTab] = React.useState(defaultTab);

  return (
    <div>
      <div className="flex gap-4 border-b-2 border-gray-200 dark:border-gray-700">
        {tabs.map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            className={`px-4 py-3 font-semibold text-base transition-all duration-200 border-b-2 -mb-2 relative ${
              activeTab === index
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400 shadow-sm'
                : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-6 animate-in fade-in duration-200">{tabs[activeTab].content}</div>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  trend?: { value: number; isPositive: boolean };
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, icon, trend }) => {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-gray-700 dark:text-gray-300 text-sm font-semibold">{label}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-50 mt-2">{value}</p>
          {trend && (
            <p
              className={`text-sm font-semibold mt-3 ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
            >
              {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
            </p>
          )}
        </div>
        {icon && <div className="text-3xl text-blue-600/40 dark:text-blue-400/40">{icon}</div>}
      </div>
    </Card>
  );
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
}) => {
  return (
    <div className="flex gap-2 justify-center">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
      >
        Précédent
      </Button>
      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <Button
          key={page}
          variant={page === currentPage ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => onPageChange(page)}
        >
          {page}
        </Button>
      ))}
      <Button
        variant="outline"
        size="sm"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
      >
        Suivant
      </Button>
    </div>
  );
};

interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  // 🔥 ACCESSIBILITY IMPROVEMENTS
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
}

export const Modal: React.FC<ModalProps> = withAnalytics(
  ({
    isOpen,
    onClose,
    title,
    children,
    actions,
    'aria-labelledby': ariaLabelledBy,
    'aria-describedby': ariaDescribedBy,
    ...props
  }) => {
    if (!isOpen) return null;

    return (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-black/50 dark:bg-black/70"
          onClick={onClose}
          role="presentation"
        />
        <div className="relative flex items-center justify-center min-h-screen p-4">
          <Card
            className="w-full max-w-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby={ariaLabelledBy || 'modal-title'}
            aria-describedby={ariaDescribedBy}
            {...props}
          >
            <div className="p-6">
              <h2
                id={ariaLabelledBy || 'modal-title'}
                className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4"
              >
                {title}
              </h2>
              <div
                className={
                  ariaDescribedBy
                    ? `text-gray-700 dark:text-gray-300 mb-6`
                    : 'text-gray-700 dark:text-gray-300 mb-6'
                }
              >
                {children}
              </div>
              {actions && <div className="flex gap-2 justify-end">{actions}</div>}
            </div>
          </Card>
        </div>
      </div>
    );
  },
  'Modal'
);

// ==================== SKELETON LOADER (Loading States) ====================
interface SkeletonProps {
  count?: number;
  height?: string;
  width?: string;
  circle?: boolean;
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({
  count = 1,
  height = 'h-4',
  width = 'w-full',
  circle = false,
  className = '',
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`
            ${height} 
            ${circle ? 'rounded-full' : 'rounded'}
            ${width}
            bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200
            dark:from-gray-700 dark:via-gray-600 dark:to-gray-700
            animate-pulse
            ${className}
            ${count > 1 && i < count - 1 ? 'mb-3' : ''}
          `}
        />
      ))}
    </>
  );
};

/**
 * SkeletonCard: Ready-to-use loading state for cards
 */
export const SkeletonCard: React.FC = () => (
  <Card className="p-6">
    <Skeleton height="h-6" width="w-1/3" className="mb-4" />
    <Skeleton count={3} height="h-4" className="mb-2" />
    <div className="mt-6 flex gap-2">
      <Skeleton height="h-10" width="w-1/4" className="rounded-lg" />
      <Skeleton height="h-10" width="w-1/4" className="rounded-lg" />
    </div>
  </Card>
);
