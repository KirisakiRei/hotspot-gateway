import { useState, useEffect } from 'react';
import { Search, Filter, Download, Calendar, RefreshCw, Loader2 } from 'lucide-react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { AdminHeader } from '@/components/admin/AdminHeader';
import { DataTable, ActionButton, Badge } from '@/components/admin/AdminComponents';
import { logApi, type SystemLog } from '@/services/api';
import { toast } from 'sonner';

export default function AdminLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('today');

  useEffect(() => {
    loadLogs();
  }, [dateRange, statusFilter]);

  const loadLogs = async () => {
    try {
      setIsLoading(true);
      const params: Record<string, string | number | boolean | undefined> = { limit: 100 };
      
      // Date range filter
      const now = new Date();
      if (dateRange === 'today') {
        params.startDate = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      } else if (dateRange === 'yesterday') {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        params.startDate = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
        params.endDate = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();
      } else if (dateRange === 'week') {
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        params.startDate = weekAgo.toISOString();
      } else if (dateRange === 'month') {
        const monthAgo = new Date(now);
        monthAgo.setDate(monthAgo.getDate() - 30);
        params.startDate = monthAgo.toISOString();
      }
      
      if (statusFilter !== 'all') {
        params.status = statusFilter.toUpperCase();
      }

      const response = await logApi.getAll(params);
      setLogs(response.data.data || []);
    } catch (error) {
      toast.error('Gagal memuat logs');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = () => {
    // Export logs as CSV
    const headers = ['Timestamp', 'Type', 'Action', 'Description', 'Status', 'IP Address', 'MAC Address'];
    const rows = logs.map(l => [
      new Date(l.createdAt).toLocaleString('id-ID'),
      l.type,
      l.action,
      l.description || '-',
      l.status,
      l.ipAddress || '-',
      l.macAddress || '-',
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported successfully');
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.description?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.macAddress?.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (log.ipAddress?.includes(searchQuery));
    return matchesSearch;
  });

  const getStatusVariant = (status: string): 'success' | 'destructive' | 'warning' | 'default' => {
    switch (status.toUpperCase()) {
      case 'SUCCESS': return 'success';
      case 'ERROR': return 'destructive';
      case 'WARNING': return 'warning';
      default: return 'default';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      
      <main className="admin-content">
        <AdminHeader title="System Logs" subtitle="Monitor system events and user activities" />
        
        <div className="p-6 space-y-6 animate-fade-in">
          {/* Filters */}
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search MAC, user, event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10 pl-9 pr-4 rounded-xl bg-secondary border-0 text-sm placeholder:text-muted-foreground focus:ring-2 focus:ring-primary w-full sm:w-64"
                />
              </div>

              {/* Date Filter */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <select 
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                >
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">Last 7 days</option>
                  <option value="month">Last 30 days</option>
                </select>
              </div>

              {/* Status Filter */}
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-muted-foreground" />
                <select 
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="h-10 px-3 rounded-xl bg-secondary border-0 text-sm"
                >
                  <option value="all">All Events</option>
                  <option value="success">Success</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                  <option value="info">Info</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <ActionButton variant="ghost" size="sm" icon={isLoading ? Loader2 : RefreshCw} onClick={loadLogs}>
                {isLoading ? 'Loading...' : 'Refresh'}
              </ActionButton>
              <ActionButton variant="secondary" icon={Download} onClick={handleExport}>
                Export
              </ActionButton>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="stat-card flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-success" />
              <div>
                <p className="text-xl font-bold text-foreground">
                  {logs.filter(l => l.status === 'SUCCESS').length}
                </p>
                <p className="text-xs text-muted-foreground">Success</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <div>
                <p className="text-xl font-bold text-foreground">
                  {logs.filter(l => l.status === 'WARNING').length}
                </p>
                <p className="text-xs text-muted-foreground">Warnings</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <div>
                <p className="text-xl font-bold text-foreground">
                  {logs.filter(l => l.status === 'ERROR').length}
                </p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>
            <div className="stat-card flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-primary" />
              <div>
                <p className="text-xl font-bold text-foreground">
                  {logs.filter(l => l.status === 'INFO').length}
                </p>
                <p className="text-xs text-muted-foreground">Info</p>
              </div>
            </div>
          </div>

          {/* Logs Table */}
          <div className="stat-card overflow-x-auto">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
            <DataTable headers={['Timestamp', 'Type', 'Action', 'Description', 'IP Address', 'Status']}>
              {filteredLogs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('id-ID')}
                  </td>
                  <td className="text-xs text-muted-foreground">{log.type}</td>
                  <td className="font-medium text-foreground">{log.action}</td>
                  <td className="text-sm text-muted-foreground max-w-xs truncate">{log.description || '-'}</td>
                  <td className="font-mono text-xs text-muted-foreground">{log.ipAddress || '-'}</td>
                  <td>
                    <Badge variant={getStatusVariant(log.status)}>
                      {log.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </DataTable>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
              <p className="text-sm text-muted-foreground">
                Showing {filteredLogs.length} of {logs.length} logs
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
