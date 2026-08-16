import { ChevronDown } from 'lucide-react';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
}

export function AdminHeader({ title, subtitle }: AdminHeaderProps) {
  return (
    <header className="h-16 border-b border-border bg-card px-6 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        {/* User Menu */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-secondary transition-colors">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-sm font-medium">
            A
          </div>
          <span className="text-sm font-medium text-foreground hidden sm:block">Admin</span>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
