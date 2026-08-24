import { useState, useEffect, useCallback } from 'react';
import { Activity, Cpu, HardDrive, Users, Wifi, TrendingUp, TrendingDown, RefreshCw, Clock, Radio, Info } from 'lucide-react';
import { StatsCard, ProgressCard } from './MonitoringCards';
import { mikrotikApi, type MonitoringDashboard as MonitoringDashboardType } from '@/services/api';
import { toast } from 'sonner';

interface MonitoringDashboardProps {
  isConnected: boolean;
}

// Inner component — live monitoring via WebSocket dinonaktifkan.
// Dashboard admin sekarang membaca data dari DB (RADIUS accounting).
function MonitoringDashboardInner({ isConnected }: MonitoringDashboardProps) {
  const [dashboardData, setDashboardData] = useState<MonitoringDashboardType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const loadDashboardData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await mikrotikApi.getMonitoringDashboard();
      if (response.data.success && response.data.data) {
        setDashboardData(response.data.data);
        setLastUpdate(new Date());
      }
    } catch {
      if (!silent) {
        setDashboardData(null);
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Setup polling fallback when WebSocket is not available
  useEffect(() => {
    if (!isConnected) return;
    
    // Live monitoring via WebSocket dinonaktifkan (diganti RADIUS accounting).
    // Load data via REST saat pertama kali dan refresh manual.
    if (isConnected) {
      loadDashboardData();
    }
  }, [isConnected, loadDashboardData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDashboardData();
    toast.success('Data monitoring diperbarui');
  };

  const formatBytes = (bytes: number): string => {
    if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
    if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${bytes} B`;
  };

  const formatUptime = (uptime: string): string => {
    const match = uptime.match(/(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (!match) return uptime;
    const [, weeks, days, hours, minutes] = match;
    const parts = [];
    if (weeks) parts.push(`${weeks}w`);
    if (days) parts.push(`${days}d`);
    if (hours) parts.push(`${hours}h`);
    if (minutes) parts.push(`${minutes}m`);
    return parts.join(' ') || uptime;
  };

  if (!isConnected) {
    return (
      <div className="bg-muted border border-border rounded-2xl p-8 text-center">
        <Info className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
        <p className="text-foreground font-medium">Live Monitoring Dinonaktifkan</p>
        <p className="text-muted-foreground text-sm mt-1">
          Statistik sesi tersedia di Dasbor admin (dari database RADIUS accounting).
        </p>
      </div>
    );
  }

  const system = dashboardData?.system || {
    cpuLoad: 0, freeMemory: 0, totalMemory: 0, freeHddSpace: 0, totalHddSpace: 0,
    uptime: '0s', version: 'Unknown', boardName: 'Unknown',
  };
  const sessions = dashboardData?.sessions || {
    totalSessions: 0, totalBytesIn: 0, totalBytesOut: 0, sessions: [],
  };
  const iface = dashboardData?.interface || {
    name: 'ether1', rxByte: 0, txByte: 0, rxPacket: 0, txPacket: 0,
    rxError: 0, txError: 0, running: false, rxDrop: 0, txDrop: 0,
  };
  const hotspot = dashboardData?.hotspot || { totalUsers: 0, totalProfiles: 0, activeUsers: 0 };
  const displayLastUpdate = lastUpdate;

  if (isLoading && !dashboardData && !useStreaming) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <RefreshCw className="w-12 h-12 text-gray-400 mx-auto mb-3 animate-spin" />
        <p className="text-gray-600">Memuat data monitoring...</p>
      </div>
    );
  }

  // Calculate memory and storage usage
  const memoryUsed = (system.totalMemory || 0) - (system.freeMemory || 0);
  const memoryUsedMB = memoryUsed / (1024 * 1024);
  const memoryTotalMB = (system.totalMemory || 0) / (1024 * 1024);

  const storageUsed = (system.totalHddSpace || 0) - (system.freeHddSpace || 0);
  const storageUsedMB = storageUsed / (1024 * 1024);
  const storageTotalMB = (system.totalHddSpace || 0) / (1024 * 1024);

  return (
    <div className="space-y-6">
      {/* Connection Mode Indicator */}
      {mode === 'polling' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600" />
          <p className="text-sm text-yellow-800">
            Pembaruan langsung tidak tersedia. Data diperbarui setiap 10 detik.
          </p>
        </div>
      )}
      {/* Header with refresh button */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">Monitoring Dashboard</h2>
            {/* Connection mode badge */}
            <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${
              mode === 'streaming' 
                ? 'bg-green-100 text-green-700' 
                : mode === 'polling'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-700'
            }`}>
              <Radio className={`w-3 h-3 ${mode === 'streaming' ? 'animate-pulse' : ''}`} />
              {mode === 'streaming' ? 'Langsung' : mode === 'polling' ? 'Berkala' : 'Tidak terhubung'}
            </span>
          </div>
          {displayLastUpdate && (
            <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
              <Clock className="w-4 h-4" />
              Pembaruan terakhir: {displayLastUpdate.toLocaleTimeString('id-ID')}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* System Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Beban CPU"
          value={`${system.cpuLoad || 0}%`}
          icon={Cpu}
          description={system.boardName || 'N/A'}
          color={(system.cpuLoad || 0) > 80 ? 'danger' : (system.cpuLoad || 0) > 60 ? 'warning' : 'success'}
        />
        
        <StatsCard
          title="Active Users"
          value={sessions.totalSessions || 0}
          icon={Users}
          description={`${hotspot.totalUsers || 0} total users`}
          color="primary"
        />
        
        <StatsCard
          title="System Uptime"
          value={formatUptime(system.uptime || '0s')}
          icon={Activity}
          description={`Versi perangkat ${system.version || '-'}`}
          color="info"
        />
        
        <StatsCard
          title="Total Traffic"
          value={formatBytes((sessions.totalBytesIn || 0) + (sessions.totalBytesOut || 0))}
          icon={Wifi}
          description={`↑ ${formatBytes(sessions.totalBytesOut || 0)} / ↓ ${formatBytes(sessions.totalBytesIn || 0)}`}
          color="success"
        />
      </div>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ProgressCard
          title="Memory Usage"
          used={memoryUsedMB}
          total={memoryTotalMB}
          unit="MB"
          icon={Activity}
          color="primary"
        />
        
        <ProgressCard
          title="Storage Usage"
          used={storageUsedMB}
          total={storageTotalMB}
          unit="MB"
          icon={HardDrive}
          color="primary"
        />
      </div>

      {/* Interface Statistics */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Network Interface: {iface.name || 'N/A'}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Download</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatBytes(iface.rxByte || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">{(iface.rxPacket || 0).toLocaleString()} packets</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Upload</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{formatBytes(iface.txByte || 0)}</p>
            <p className="text-xs text-gray-500 mt-1">{(iface.txPacket || 0).toLocaleString()} packets</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-gray-600">Errors</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {(iface.rxError || 0) + (iface.txError || 0)}
            </p>
            <p className="text-xs text-gray-500 mt-1">Masuk: {iface.rxError || 0} / Keluar: {iface.txError || 0}</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Wifi className="w-5 h-5 text-gray-600" />
              <span className="text-sm font-medium text-gray-600">Status</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {iface.running ? (
                <span className="text-green-600">Online</span>
              ) : (
                <span className="text-red-600">Offline</span>
              )}
            </p>
            <p className="text-xs text-gray-500 mt-1">Paket terbuang: {(iface.rxDrop || 0) + (iface.txDrop || 0)}</p>
          </div>
        </div>
      </div>

      {/* Active Sessions Table */}
      {sessions.sessions && sessions.sessions.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Active Sessions ({sessions.totalSessions || 0})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left text-sm font-medium text-gray-600 pb-3">User</th>
                  <th className="text-left text-sm font-medium text-gray-600 pb-3">IP Address</th>
                  <th className="text-left text-sm font-medium text-gray-600 pb-3">MAC Address</th>
                  <th className="text-left text-sm font-medium text-gray-600 pb-3">Uptime</th>
                  <th className="text-right text-sm font-medium text-gray-600 pb-3">Download</th>
                  <th className="text-right text-sm font-medium text-gray-600 pb-3">Upload</th>
                </tr>
              </thead>
              <tbody>
                {sessions.sessions.slice(0, 10).map((session) => (
                  <tr key={session.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 text-sm font-medium text-gray-900">{session.user}</td>
                    <td className="py-3 text-sm text-gray-600">{session.address}</td>
                    <td className="py-3 text-xs text-gray-600 font-mono">{session.mac}</td>
                    <td className="py-3 text-sm text-gray-600">{session.uptime}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">{formatBytes(session.bytesIn || 0)}</td>
                    <td className="py-3 text-sm text-gray-600 text-right">{formatBytes(session.bytesOut || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.sessions.length > 10 && (
              <p className="text-sm text-gray-500 text-center mt-4">
                Menampilkan 10 dari {sessions.totalSessions || 0} sesi aktif
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Wrapper component — WebSocket context tidak lagi diperlukan
export function MonitoringDashboardSection({ isConnected }: MonitoringDashboardProps) {
  return <MonitoringDashboardInner isConnected={isConnected} />;
}
