import React, { useEffect, useState } from 'react';
import { CashSession } from '../types';
import { getCashSessionsHistory } from '../services/firebaseService';

const CashSessionHistory: React.FC = () => {
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await getCashSessionsHistory();
        setSessions(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    try {
        const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return d.toLocaleString('es-CL');
    } catch { return '-'; }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

  if (loading) return <div className="p-8 text-center text-gray-500">Cargando historial de caja...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 animate-fade-in">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Historial de Cierres de Caja</h2>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-500 border-b border-gray-200">
                        <tr>
                            <th className="px-6 py-3 text-left font-medium">Estado</th>
                            <th className="px-6 py-3 text-left font-medium">Apertura</th>
                            <th className="px-6 py-3 text-left font-medium">Cierre</th>
                            <th className="px-6 py-3 text-left font-medium">Usuario</th>
                            <th className="px-6 py-3 text-right font-medium">Ventas Efec.</th>
                            <th className="px-6 py-3 text-right font-medium">Real (Conteo)</th>
                            <th className="px-6 py-3 text-center font-medium">Diferencia</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {sessions.map(s => {
                            const isNegative = (s.difference || 0) < 0;
                            const isPositive = (s.difference || 0) > 0;
                            return (
                                <tr key={s.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${s.status === 'open' ? 'bg-green-100 text-green-700 animate-pulse' : 'bg-gray-100 text-gray-600'}`}>
                                            {s.status === 'open' ? 'ABIERTA' : 'CERRADA'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-gray-600">{formatDate(s.openTime)}</td>
                                    <td className="px-6 py-4 text-gray-600">{formatDate(s.closeTime)}</td>
                                    <td className="px-6 py-4 font-medium text-gray-800">{s.openedBy}</td>
                                    <td className="px-6 py-4 text-right text-gray-600">{formatCurrency(s.salesCash)}</td>
                                    <td className="px-6 py-4 text-right font-bold text-gray-800">
                                        {s.actualCash !== null ? formatCurrency(s.actualCash) : '-'}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        {s.difference !== null ? (
                                            <span className={`font-bold ${isNegative ? 'text-red-600' : isPositive ? 'text-blue-600' : 'text-green-600'}`}>
                                                {formatCurrency(s.difference)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                </tr>
                            );
                        })}
                        {sessions.length === 0 && (
                            <tr>
                                <td colSpan={7} className="px-6 py-10 text-center text-gray-400">No hay registros de caja.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    </div>
  );
};

export default CashSessionHistory;