import React, { useEffect, useState, useMemo } from 'react';
import { LogEntry } from '../types';
import { getSystemLogs } from '../services/logService';

const AdminTelemetry: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'sync_issues'>('all');

  const fetchLogs = async () => {
    setLoading(true);
    const data = await getSystemLogs();
    setLogs(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchLogs, 60000);
    return () => clearInterval(interval);
  }, []);

  const filteredLogs = useMemo(() => {
    if (filter === 'sync_issues') {
      return logs.filter(l => l.syncStatus === 'offline' || l.message.toLowerCase().includes('sync') || l.message.toLowerCase().includes('network'));
    }
    return logs;
  }, [logs, filter]);

  // KPIs
  const errorsLast24h = useMemo(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    return logs.filter(l => {
      if (!l.timestamp) return false;
      const date = l.timestamp.toDate ? l.timestamp.toDate() : new Date(l.timestamp);
      return date > yesterday;
    }).length;
  }, [logs]);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Pendiente...';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleString('es-CL');
    } catch {
      return 'Fecha inválida';
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            📡 Telemetría & Logs
            <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded-full uppercase">Beta</span>
          </h2>
          <p className="text-sm text-gray-500">Monitoreo de errores y estado de red de los cajeros.</p>
        </div>
        <button 
          onClick={fetchLogs} 
          className="text-blue-600 hover:text-blue-800 text-sm font-bold flex items-center gap-1"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          Refrescar
        </button>
      </div>

      {/* KPI Card */}
      <div className="bg-white p-6 rounded-xl border-l-4 border-red-500 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Errores (Últimas 24h)</p>
          <h3 className="text-3xl font-black text-gray-800">{errorsLast24h}</h3>
        </div>
        <div className="h-12 w-12 bg-red-50 rounded-full flex items-center justify-center text-red-500">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button 
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'all' ? 'bg-gray-800 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          Todos los Logs
        </button>
        <button 
          onClick={() => setFilter('sync_issues')}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'sync_issues' ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'}`}
        >
          Fallas de Sincronización
        </button>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400">Cargando logs...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 font-medium">Hora</th>
                  <th className="px-6 py-3 font-medium">Contexto</th>
                  <th className="px-6 py-3 font-medium">Mensaje de Error</th>
                  <th className="px-6 py-3 font-medium">Conexión</th>
                  <th className="px-6 py-3 font-medium">Dispositivo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400">No hay logs registrados.</td>
                  </tr>
                ) : (
                  filteredLogs.map(log => (
                    <tr key={log.id} className="hover:bg-gray-50 group">
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 font-mono text-xs">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="px-6 py-4 font-bold text-gray-700">
                        {log.context}
                      </td>
                      <td className="px-6 py-4 text-red-600 font-medium">
                        {log.message}
                        {log.metadata && (
                          <details className="mt-1">
                            <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">Ver metadata</summary>
                            <pre className="text-[10px] bg-gray-100 p-2 rounded mt-1 overflow-x-auto max-w-xs">
                              {log.metadata}
                            </pre>
                          </details>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {log.syncStatus === 'online' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 animate-pulse">
                            Offline ⚠️
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400 max-w-xs truncate" title={log.deviceInfo}>
                        {log.deviceInfo}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminTelemetry;