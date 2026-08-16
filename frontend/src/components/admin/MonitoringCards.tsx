import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}

const colorClasses = {
  primary: 'bg-primary/10 text-primary',
  success: 'bg-green-500/10 text-green-600',
  warning: 'bg-yellow-500/10 text-yellow-600',
  danger: 'bg-red-500/10 text-red-600',
  info: 'bg-blue-500/10 text-blue-600',
};

export function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  description, 
  trend,
  color = 'primary' 
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mb-1">{value}</p>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span className={`text-sm font-medium ${trend.isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {trend.isPositive ? '↑' : '↓'} {trend.value}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
    </div>
  );
}

interface ProgressCardProps {
  title: string;
  used: number;
  total: number;
  unit: string;
  icon: LucideIcon;
  color?: 'primary' | 'success' | 'warning' | 'danger';
}

const progressColors = {
  primary: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
};

export function ProgressCard({
  title,
  used,
  total,
  unit,
  icon: Icon,
  color = 'primary',
}: ProgressCardProps) {
  const percentage = total > 0 ? Math.round((used / total) * 100) : 0;
  const free = total - used;

  // Determine color based on percentage
  let barColor = progressColors[color];
  if (percentage >= 90) barColor = progressColors.danger;
  else if (percentage >= 75) barColor = progressColors.warning;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{percentage}%</p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      
      <div className="flex justify-between text-sm text-gray-600">
        <span>Used: {used.toFixed(1)} {unit}</span>
        <span>Free: {free.toFixed(1)} {unit}</span>
      </div>
    </div>
  );
}
