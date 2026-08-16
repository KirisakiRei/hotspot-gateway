import { ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string | number;
  change?: {
    value: string;
    positive: boolean;
  };
  iconBg?: string;
}

export function StatCard({ icon: Icon, label, value, change, iconBg = 'bg-primary/10' }: StatCardProps) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className="w-5 h-5 text-primary" />
        </div>
        {change && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
            change.positive 
              ? 'bg-success/10 text-success' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            {change.positive ? '+' : ''}{change.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-foreground mb-0.5">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

interface DataTableProps {
  headers: string[];
  children: ReactNode;
}

export function DataTable({ headers, children }: DataTableProps) {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th key={index}>{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

interface ActionButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost' | 'destructive';
  size?: 'sm' | 'md';
  icon?: LucideIcon;
  onClick?: () => void;
  disabled?: boolean;
}

export function ActionButton({ 
  children, 
  variant = 'primary', 
  size = 'md',
  icon: Icon,
  onClick,
  disabled = false
}: ActionButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantStyles = {
    primary: 'bg-primary text-primary-foreground hover:opacity-90',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    ghost: 'text-foreground hover:bg-secondary',
    destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
  };
  
  const sizeStyles = {
    sm: 'h-9 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
  };

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

interface BadgeProps {
  children: ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'destructive';
  className?: string;
}

export function Badge({ children, variant = 'default', className = '' }: BadgeProps) {
  const variants = {
    default: 'bg-secondary text-secondary-foreground',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
  };

  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
