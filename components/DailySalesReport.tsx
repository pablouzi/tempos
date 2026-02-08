import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Customer } from '../types';
import { getSalesByDateRange, getCustomers } from '../services/firebaseService';

const DailySalesReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const [year, month, day] = selectedDate.split('-').map(Number);
      
      const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
      const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);

      const salesData = await getSalesByDateRange(startDate, endDate);
      setSales(salesData);

      const customersData = await getCustomers();
      setCustomers(customersData);
      
    } catch (e) {
      console.error(e);
      window.Swal.fire('Error', 'No se pudieron cargar los datos del reporte.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedDate]);

  // --- Computations ---
  // STRICT FILTER: Only 'completed' sales count towards totals
  const summary = useMemo(() => {
    const validSales = sales.filter(s => s.status === 'completed');
    
    return validSales.reduce((acc, sale) => {
      const method = sale.paymentMethod || 'otro';
      if (method === 'efectivo') acc.cash += sale.total;
      else if (method === 'tarjeta') acc.card += sale.total;
      else acc.other += sale.total;
      
      return acc;
    }, { cash: 0, card: 0, other: 0 });
  }, [sales]);

  const getCustomerName = (id?: string) => {
    if (!id) return 'Anónimo';
    const c = customers.find(cust => cust.id === id);
    return c ? c.name : 'Desconocido';
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);
  
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in">
      
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Reporte Diario de Ventas</h2>
          <p className="text-gray-500">Auditoría detallada (excluye ventas anuladas).</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
            <span className="text-sm font-bold text-gray-500 uppercase px-2">Fecha:</span>
            <input 
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border-none outline-none text-gray-800 font-bold bg-transparent cursor-pointer"
            />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-green-500 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Total Efectivo</p>
                  <h3 className="text-2xl font-bold text-green-700">{formatCurrency(summary.cash)}</h3>
              </div>
              <div className="p-3 bg-green-50 rounded-full text-green-600">💵</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-blue-500 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Total Tarjeta</p>
                  <h3 className="text-2xl font-bold text-blue-700">{formatCurrency(summary.card)}</h3>
              </div>
              <div className="p-3 bg-blue-50 rounded-full text-blue-600">💳</div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border-b-4 border-purple-500 flex items-center justify-between">
              <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Total Otros</p>
                  <h3 className="text-2xl font-bold text-purple-700">{formatCurrency(summary.other)}</h3>
              </div>
              <div className="p-3 bg-purple-50 rounded-full text-purple-600">✨</div>
          </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
              <h3 className="font-bold text-gray-700">Detalle de Transacciones</h3>
          </div>

          {loading ? (
             <div className="p-10 text-center text-gray-400">Cargando transacciones...</div>
          ) : sales.length === 0 ? (
             <div className="p-10 text-center text-gray-400">No hay ventas registradas en esta fecha.</div>
          ) : (
             <div className="overflow-x-auto">
                 <table className="min-w-full text-sm text-left">
                     <thead className="text-gray-500 bg-white border-b border-gray-100">
                         <tr>
                             <th className="px-6 py-3 font-normal">Hora</th>
                             <th className="px-6 py-3 font-normal">Cliente</th>
                             <th className="px-6 py-3 font-normal">Método Pago</th>
                             <th className="px-6 py-3 font-normal text-right">Total</th>
                             <th className="px-6 py-3 font-normal text-right">Utilidad</th>
                         </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                         {sales.map((sale) => {
                             const profit = (sale.total - (sale.costoTotal || 0));
                             const isVoid = sale.status === 'voided';
                             const isPending = sale.status === 'pending_void';
                             
                             return (
                                 <tr key={sale.id} className={`hover:bg-gray-50 ${isVoid ? 'opacity-50 grayscale bg-gray-100' : isPending ? 'bg-orange-50' : ''}`}>
                                     <td className="px-6 py-4 font-mono text-gray-600">
                                         {formatTime(sale.fecha)}
                                     </td>
                                     <td className="px-6 py-4 font-medium text-gray-800">
                                         {getCustomerName(sale.customerId)}
                                     </td>
                                     <td className="px-6 py-4">
                                         {sale.paymentMethod === 'efectivo' && (
                                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
                                                 Efectivo
                                             </span>
                                         )}
                                         {sale.paymentMethod === 'tarjeta' && (
                                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                                                 Tarjeta
                                             </span>
                                         )}
                                         {(!sale.paymentMethod || sale.paymentMethod === 'otro') && (
                                             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">
                                                 Otro
                                             </span>
                                         )}
                                         {isVoid && <span className="ml-2 text-xs font-bold text-red-600 uppercase border border-red-200 px-1 rounded bg-red-50">[ANULADA]</span>}
                                         {isPending && <span className="ml-2 text-xs font-bold text-orange-600 uppercase border border-orange-200 px-1 rounded bg-orange-50">[PENDIENTE]</span>}
                                     </td>
                                     <td className={`px-6 py-4 text-right font-bold ${isVoid ? 'line-through decoration-red-500' : 'text-gray-800'}`}>
                                         {formatCurrency(sale.total)}
                                     </td>
                                     <td className={`px-6 py-4 text-right ${profit > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                         {!isVoid && !isPending ? (
                                             <>
                                                {formatCurrency(profit)}
                                                <span className="text-[10px] text-gray-400 block">
                                                    (Margen {sale.total > 0 ? Math.round((profit / sale.total) * 100) : 0}%)
                                                </span>
                                             </>
                                         ) : '-'}
                                     </td>
                                 </tr>
                             );
                         })}
                     </tbody>
                 </table>
             </div>
          )}
      </div>
    </div>
  );
};

export default DailySalesReport;