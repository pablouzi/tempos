import React, { useEffect, useState } from 'react';
import { Sale } from '../types';
import { getSalesHistory } from '../services/firebaseService';

// --- Types for Grouping ---
interface DailyGroup {
  dateKey: string;    // "24/01/2026" - Display label
  total: number;      // Sum of sales for this day
  sales: Sale[];      // The transactions
  timestamp: number;  // For sorting
}

interface MonthlyGroup {
  monthKey: string;   // "Enero 2026" - Display label
  total: number;      // Sum of sales for this month
  days: DailyGroup[]; // Nested days
  timestamp: number;  // For sorting
}

const SalesHistory: React.FC = () => {
  const [allSales, setAllSales] = useState<Sale[]>([]);
  const [groupedSales, setGroupedSales] = useState<MonthlyGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [filterMethod, setFilterMethod] = useState<string>('all');

  // Accordion State: Stores the keys of expanded months
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchSales = async () => {
      setLoading(true);
      try {
        const data = await getSalesHistory();
        setAllSales(data);
      } catch (error: any) {
        console.error("Error fetching sales:", error);
        window.Swal.fire('Error', 'No se pudo cargar el historial de ventas', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchSales();
  }, []);

  // React to filter changes
  useEffect(() => {
    if (allSales.length > 0 || !loading) {
      const filtered = filterMethod === 'all'
        ? allSales
        : allSales.filter(s => s.paymentMethod === filterMethod);

      processSalesData(filtered);
    }
  }, [allSales, filterMethod]);

  // --- Data Processing Logic ---
  const processSalesData = (salesData: Sale[]) => {
    // 1. Calculate Global Total (Based on Filter)
    const total = salesData.reduce((acc, curr) => acc + curr.total, 0);
    setTotalRevenue(total);

    // 2. Grouping Algorithm
    const monthsMap: Record<string, { total: number; daysMap: Record<string, DailyGroup>; timestamp: number }> = {};

    salesData.forEach(sale => {
      // Robust Date Parsing
      let dateObj: Date;
      if (sale.fecha && typeof sale.fecha.toDate === 'function') {
        dateObj = sale.fecha.toDate();
      } else {
        dateObj = new Date(sale.fecha);
      }

      // Generate Keys
      // Month Key: "Enero 2026"
      const monthKey = dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      // monthKeyCapitalized: "Enero 2026"
      const monthLabel = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);

      // Day Key: "24/01/2026"
      const dayKey = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Initialize Month Group if not exists
      if (!monthsMap[monthLabel]) {
        monthsMap[monthLabel] = {
          total: 0,
          daysMap: {},
          timestamp: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime() // First day of month for sorting
        };
      }

      // Initialize Day Group if not exists within Month
      if (!monthsMap[monthLabel].daysMap[dayKey]) {
        monthsMap[monthLabel].daysMap[dayKey] = {
          dateKey: dayKey,
          total: 0,
          sales: [],
          timestamp: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime()
        };
      }

      // Add Data
      monthsMap[monthLabel].total += sale.total;
      monthsMap[monthLabel].daysMap[dayKey].total += sale.total;
      monthsMap[monthLabel].daysMap[dayKey].sales.push(sale);
    });

    // 3. Transform Map to Sorted Arrays
    const result: MonthlyGroup[] = Object.entries(monthsMap).map(([mKey, mData]) => {
      // Sort Days Descending
      const sortedDays = Object.values(mData.daysMap).sort((a, b) => b.timestamp - a.timestamp);
      return {
        monthKey: mKey,
        total: mData.total,
        days: sortedDays,
        timestamp: mData.timestamp
      };
    });

    // Sort Months Descending
    result.sort((a, b) => b.timestamp - a.timestamp);

    setGroupedSales(result);

    // Auto-expand the first month (most recent) if strictly initialized
    if (result.length > 0 && expandedMonths.size === 0) {
      setExpandedMonths(new Set([result[0].monthKey]));
    }
  };

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    if (newExpanded.has(monthKey)) {
      newExpanded.delete(monthKey);
    } else {
      newExpanded.add(monthKey);
    }
    setExpandedMonths(newExpanded);
  };

  // --- Formatters ---
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    let d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const renderPaymentBadge = (method?: string) => {
    switch (method) {
      case 'efectivo':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 border border-green-200">Efectivo 💵</span>;
      case 'tarjeta':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">Tarjeta 💳</span>;
      case 'otro':
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800 border border-purple-200">Otro ✨</span>;
      default:
        return <span className="text-gray-400">-</span>;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-coffee-800 dark:text-coffee-300">Historial Contable</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Registro detallado de transacciones.</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-end sm:items-center w-full md:w-auto">

          {/* Payment Filter */}
          <div className="w-full sm:w-48">
            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 mb-1 uppercase">Filtrar Pago</label>
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 dark:border-white/20 focus:outline-none focus:ring-coffee-500 focus:border-coffee-500 sm:text-sm rounded-md border bg-white dark:bg-brand-card text-gray-900 dark:text-gray-100"
            >
              <option value="all">Todos los Métodos</option>
              <option value="efectivo">Efectivo 💵</option>
              <option value="tarjeta">Tarjeta 💳</option>
              <option value="otro">Otro ✨</option>
            </select>
          </div>

          {/* Total Revenue Card */}
          <div className="bg-white dark:bg-brand-card p-3 rounded-lg shadow-sm border border-gray-200 dark:border-white/5 flex items-center gap-3 min-w-[200px]">
            <div className="bg-green-100 dark:bg-green-900/40 p-2 rounded-full text-green-600 dark:text-green-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-[10px] text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider">Acumulado ({filterMethod === 'all' ? 'Total' : filterMethod})</p>
              <p className="text-xl font-bold text-gray-800 dark:text-white">{formatCurrency(totalRevenue)}</p>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">
          <svg className="animate-spin h-8 w-8 text-coffee-600 dark:text-coffee-400 mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-gray-500 dark:text-gray-400">Procesando contabilidad...</p>
        </div>
      ) : groupedSales.length === 0 ? (
        <div className="bg-white dark:bg-brand-card rounded-lg p-10 text-center border border-gray-200 dark:border-white/5">
          <p className="text-gray-500 dark:text-gray-400">No hay registros de ventas con este criterio.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedSales.map((monthGroup) => {
            const isExpanded = expandedMonths.has(monthGroup.monthKey);

            return (
              <div key={monthGroup.monthKey} className="rounded-xl overflow-hidden shadow-lg border border-gray-200 dark:border-white/5 bg-white dark:bg-brand-card">

                {/* LEVEL 1: Month Header (Accordion) */}
                <div
                  onClick={() => toggleMonth(monthGroup.monthKey)}
                  className="bg-gray-800 dark:bg-brand-dark/80 text-white p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700 dark:hover:bg-brand-dark transition-colors select-none"
                >
                  <div className="flex items-center gap-3">
                    <span className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </span>
                    <h3 className="text-lg font-bold capitalize">{monthGroup.monthKey}</h3>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-gray-400 block uppercase">Total Mes</span>
                    <span className="text-xl font-bold text-green-400">{formatCurrency(monthGroup.total)}</span>
                  </div>
                </div>

                {/* LEVEL 2: Days List */}
                {isExpanded && (
                  <div className="bg-white dark:bg-brand-card animate-fade-in">
                    {monthGroup.days.map((dayGroup) => (
                      <div key={dayGroup.dateKey} className="border-b border-gray-100 dark:border-white/5 last:border-0">

                        {/* Day Header */}
                        <div className="bg-gray-100 dark:bg-brand-dark/40 px-6 py-2 flex justify-between items-center border-l-4 border-l-coffee-500 dark:border-l-coffee-400">
                          <span className="font-bold text-gray-700 dark:text-gray-200">{dayGroup.dateKey}</span>
                          <span className="font-bold text-gray-900 dark:text-white bg-white dark:bg-brand-card px-2 py-0.5 rounded text-sm shadow-sm border border-gray-200 dark:border-white/10">
                            {formatCurrency(dayGroup.total)}
                          </span>
                        </div>

                        {/* LEVEL 3: Sales Table */}
                        <div className="px-0 sm:px-4 py-2">
                          <table className="min-w-full text-sm">
                            <thead className="text-gray-400 dark:text-gray-500 border-b border-gray-100 dark:border-white/5">
                              <tr>
                                <th className="px-4 py-2 text-left font-normal w-24">Hora</th>
                                <th className="px-4 py-2 text-left font-normal w-32">Pago</th>
                                <th className="px-4 py-2 text-left font-normal">Detalle</th>
                                <th className="px-4 py-2 text-right font-normal w-32">Monto</th>
                              </tr>
                            </thead>
                            <tbody>
                              {dayGroup.sales.map((sale) => (
                                <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                                    {formatTime(sale.fecha)}
                                  </td>
                                  <td className="px-4 py-3">
                                    {renderPaymentBadge(sale.paymentMethod)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                                    <div className="flex flex-wrap gap-2">
                                      {sale.items.map((item, idx) => (
                                        <span key={idx} className="bg-orange-50 dark:bg-orange-900/20 text-orange-800 dark:text-orange-400 px-2 py-0.5 rounded text-xs border border-orange-100 dark:border-orange-800/30 truncate max-w-[200px]">
                                          <b>{item.cantidad}</b> {item.nombre}
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                                    {formatCurrency(sale.total)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SalesHistory;