import React, { useEffect, useState, useMemo } from 'react';
import { Sale, Ingredient, Product } from '../types';
import { getSalesHistory, getIngredients, getProducts, requestVoidSale, approveVoidSale, rejectVoidSale } from '../services/firebaseService';

interface SalesDashboardProps {
  userRole: 'admin' | 'cajero' | null;
}

// Interfaces for Transaction Grouping
interface DailyGroup {
  dateKey: string;
  total: number;
  sales: Sale[];
  timestamp: number;
}

interface MonthlyGroup {
  monthKey: string;
  total: number;
  days: DailyGroup[];
  timestamp: number;
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ userRole }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]); 
  const [loading, setLoading] = useState(true);
  
  // State for Transaction Accordions
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  const fetchData = async () => {
    setLoading(true);
    try {
      const [salesData, ingredientsData, productsData] = await Promise.all([
        getSalesHistory(),
        getIngredients(),
        getProducts()
      ]);
      setSales(salesData);
      setIngredients(ingredientsData);
      setProducts(productsData);
    } catch (error: any) {
      console.error("Error fetching dashboard data:", error);
      window.Swal.fire('Error', 'No se pudo cargar el dashboard', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // --- Actions Logic ---

  const handleRequestVoid = async (sale: Sale) => {
    const { value: text } = await window.Swal.fire({
      input: 'textarea',
      inputLabel: 'Motivo de anulación',
      inputPlaceholder: 'Ej: Error de digitación, cliente cambió de opinión...',
      inputAttributes: {
        'aria-label': 'Escribe el motivo de la anulación'
      },
      showCancelButton: true,
      confirmButtonText: 'Solicitar',
      cancelButtonText: 'Cancelar'
    });

    if (text) {
      try {
        await requestVoidSale(sale.id!, text);
        window.Swal.fire('Solicitada', 'La anulación está pendiente de aprobación.', 'info');
        fetchData();
      } catch (e) {
        window.Swal.fire('Error', 'No se pudo procesar la solicitud', 'error');
      }
    }
  };

  const handleApproveVoid = async (sale: Sale) => {
    const confirm = await window.Swal.fire({
      title: '¿Confirmar Anulación?',
      text: "Esto devolverá los ingredientes al stock y anulará la venta definitivamente.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, Anular y Devolver Stock'
    });

    if (confirm.isConfirmed) {
      try {
        await approveVoidSale(sale);
        window.Swal.fire('Anulada', 'Venta anulada y stock restaurado.', 'success');
        fetchData();
      } catch (e: any) {
        window.Swal.fire('Error', 'Fallo al restaurar stock: ' + e.message, 'error');
      }
    }
  };

  const handleRejectVoid = async (sale: Sale) => {
    try {
      await rejectVoidSale(sale.id!);
      window.Swal.fire('Rechazada', 'La venta vuelve a estado completado.', 'success');
      fetchData();
    } catch (e) {
      window.Swal.fire('Error', 'No se pudo rechazar', 'error');
    }
  };

  // --- KPI Calculations ---
  // Only count completed sales for revenue
  const validSales = sales.filter(s => s.status === 'completed');
  
  const totalRevenue = validSales.reduce((sum, s) => sum + s.total, 0);
  const totalTransactions = validSales.length;
  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;
  
  // Only Admin sees Stock Alerts in full detail, but logic remains
  const lowStockCount = ingredients.filter(i => {
    const min = i.stockMinimo || 5;
    return i.stock <= min;
  }).length;

  // --- ANALYTICS LOGIC (Memoized) ---

  const topProducts = useMemo(() => {
    const productCount: Record<string, number> = {};
    validSales.forEach(sale => {
        sale.items.forEach(item => {
            productCount[item.nombre] = (productCount[item.nombre] || 0) + item.cantidad;
        });
    });

    const sorted = Object.entries(productCount)
        .sort((a, b) => b[1] - a[1]) 
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));
    
    const maxVal = sorted[0]?.count || 1;
    return sorted.map(p => ({ ...p, percent: (p.count / maxVal) * 100 }));
  }, [sales]);

  const leastSoldProducts = useMemo(() => {
    if (products.length === 0) return [];
    const productCount: Record<string, number> = {};
    products.forEach(p => productCount[p.nombre] = 0);

    validSales.forEach(sale => {
        sale.items.forEach(item => {
            if (productCount[item.nombre] !== undefined) {
                productCount[item.nombre] += item.cantidad;
            }
        });
    });

    return Object.entries(productCount)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 5) 
        .map(([name, count]) => ({ name, count }));
  }, [sales, products]);

  const hourlyActivity = useMemo(() => {
    const hours = new Array(24).fill(0); 
    // Re-filter specifically for this chart to avoid closure staleness and ensure type safety
    const chartSales = sales.filter(s => s.status === 'completed');

    chartSales.forEach(sale => {
        if (!sale.fecha) return;
        
        let dateObj: Date;
        try {
            // Handle Firestore Timestamp or JS Date or ISO String
            if (sale.fecha && typeof sale.fecha.toDate === 'function') {
                dateObj = sale.fecha.toDate();
            } else {
                dateObj = new Date(sale.fecha);
            }
        } catch (e) {
            return; 
        }

        // Validate Date
        if (isNaN(dateObj.getTime())) return;

        const hour = dateObj.getHours();
        if (hour >= 0 && hour < 24) hours[hour]++;
    });

    // Ensure maxActivity is at least 1 to prevent division by zero or NaN
    const maxActivity = Math.max(...hours, 1);
    
    return hours.map((count, hour) => ({
        hour, 
        count, 
        heightPercent: (count / maxActivity) * 100, 
        label: `${hour}:00`
    })); 
  }, [sales]);

  // --- Grouping Logic (Includes ALL sales for history list) ---
  const groupedTransactions = useMemo(() => {
    const monthsMap: Record<string, { total: number; daysMap: Record<string, DailyGroup>; timestamp: number }> = {};

    sales.forEach(sale => {
      // Robust Date Parsing for Grouping
      let dateObj: Date;
      try {
        if (sale.fecha && typeof sale.fecha.toDate === 'function') {
            dateObj = sale.fecha.toDate();
        } else {
            dateObj = new Date(sale.fecha);
        }
      } catch {
        // Fallback for corrupt dates
        dateObj = new Date();
      }

      if (isNaN(dateObj.getTime())) {
          dateObj = new Date(); // Fallback
      }

      const monthKey = dateObj.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
      const monthLabel = monthKey.charAt(0).toUpperCase() + monthKey.slice(1);
      const dayKey = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });

      if (!monthsMap[monthLabel]) {
        monthsMap[monthLabel] = {
          total: 0,
          daysMap: {},
          timestamp: new Date(dateObj.getFullYear(), dateObj.getMonth(), 1).getTime()
        };
      }

      if (!monthsMap[monthLabel].daysMap[dayKey]) {
        monthsMap[monthLabel].daysMap[dayKey] = {
          dateKey: dayKey,
          total: 0,
          sales: [],
          timestamp: new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime()
        };
      }

      // Only add to Total if Completed
      if (sale.status === 'completed') {
        monthsMap[monthLabel].total += sale.total;
        monthsMap[monthLabel].daysMap[dayKey].total += sale.total;
      }
      
      monthsMap[monthLabel].daysMap[dayKey].sales.push(sale);
    });

    const result = Object.entries(monthsMap).map(([mKey, mData]) => {
      const sortedDays = Object.values(mData.daysMap).sort((a, b) => b.timestamp - a.timestamp);
      return {
        monthKey: mKey,
        total: mData.total,
        days: sortedDays,
        timestamp: mData.timestamp
      };
    }).sort((a, b) => b.timestamp - a.timestamp);

    if (result.length > 0 && expandedMonths.size === 0) {
        setExpandedMonths(new Set([result[0].monthKey]));
        if(result[0].days.length > 0) setExpandedDays(new Set([result[0].days[0].dateKey]));
    }

    return result;
  }, [sales]);

  // --- Render Helpers ---

  const formatCurrency = (amount: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
  
  const formatTime = (timestamp: any) => {
    if (!timestamp) return '-';
    let d;
    try {
        d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        if (isNaN(d.getTime())) return '-';
    } catch {
        return '-';
    }
    return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  const toggleMonth = (monthKey: string) => {
    const newExpanded = new Set(expandedMonths);
    newExpanded.has(monthKey) ? newExpanded.delete(monthKey) : newExpanded.add(monthKey);
    setExpandedMonths(newExpanded);
  };

  const toggleDay = (e: React.MouseEvent, dayKey: string) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedDays);
    newExpanded.has(dayKey) ? newExpanded.delete(dayKey) : newExpanded.add(dayKey);
    setExpandedDays(newExpanded);
  };

  const renderStatusBadge = (sale: Sale) => {
    switch (sale.status) {
      case 'voided':
        return <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold border border-red-200">ANULADA</span>;
      case 'pending_void':
        return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold border border-orange-200 animate-pulse">PENDIENTE ANULACIÓN</span>;
      default: // completed
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold border border-green-200">COMPLETADA</span>;
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">
            {userRole === 'admin' ? 'Dashboard & Historial' : 'Historial de Caja'}
          </h2>
          <p className="text-gray-500">
             {userRole === 'admin' ? 'Resumen general y analítica' : 'Mis ventas recientes'}
          </p>
        </div>
        <button 
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 transition-colors text-sm font-medium"
        >
          {loading ? (
             <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
          )}
          Actualizar
        </button>
      </div>

      {/* ADMIN ONLY: FULL ANALYTICS */}
      {userRole === 'admin' && (
      <>
        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`bg-white p-6 rounded-xl shadow-sm border flex items-center justify-between ${lowStockCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-100'}`}>
            <div>
                <p className={`text-sm font-bold mb-1 ${lowStockCount > 0 ? 'text-red-700' : 'text-gray-500'}`}>Alertas de Stock</p>
                <h3 className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-800' : 'text-gray-800'}`}>
                    {lowStockCount} <span className="text-sm font-normal">insumos</span>
                </h3>
            </div>
            <div className={`p-3 rounded-full ${lowStockCount > 0 ? 'bg-red-200 text-red-700' : 'bg-green-100 text-green-600'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Ingresos Reales</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(totalRevenue)}</h3>
            </div>
            <div className="p-3 bg-green-50 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Ventas Válidas</p>
                <h3 className="text-2xl font-bold text-gray-800">{totalTransactions}</h3>
            </div>
            <div className="p-3 bg-blue-50 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
            <div>
                <p className="text-sm font-medium text-gray-500 mb-1">Ticket Promedio</p>
                <h3 className="text-2xl font-bold text-gray-800">{formatCurrency(averageTicket)}</h3>
            </div>
            <div className="p-3 bg-purple-50 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
            </div>
            </div>
        </div>

        {/* Detailed Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 text-lg">Top 5 Ventas 🌟</h3>
                </div>
                {topProducts.length === 0 ? <div className="flex-grow flex items-center justify-center text-gray-400">Sin datos</div> : (
                    <div className="space-y-4 flex-grow">
                        {topProducts.map((prod, idx) => (
                            <div key={prod.name} className="relative">
                                <div className="flex justify-between text-sm mb-1 z-10 relative">
                                    <span className={`font-medium ${idx===0?'text-yellow-700 font-bold':'text-gray-700'}`}>{idx+1}. {prod.name}</span>
                                    <span className="text-gray-500 font-mono">{prod.count} un.</span>
                                </div>
                                <div className="h-2 w-full bg-gray-100 rounded-full"><div className={`h-full rounded-full ${idx===0?'bg-yellow-500':'bg-gray-400'}`} style={{width: `${prod.percent}%`}}></div></div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                <h3 className="font-bold text-gray-800 text-lg mb-6">Actividad 24h 🕗</h3>
                <div className="flex-grow flex items-end gap-1 h-40">
                    {hourlyActivity.map((slot, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                            {/* Tooltip on Hover */}
                            <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                                <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 shadow-lg whitespace-nowrap text-center">
                                    <div className="font-bold">{slot.count}</div>
                                    <div className="text-[10px] opacity-75">{slot.label}</div>
                                </div>
                                <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1"></div>
                            </div>

                            {/* Bar */}
                            <div 
                                className={`w-full max-w-[12px] rounded-t-sm transition-all duration-200 ${slot.count > 0 ? 'bg-coffee-600 opacity-90 group-hover:opacity-100' : 'bg-gray-100'}`} 
                                style={{ height: `${slot.count > 0 ? Math.max(slot.heightPercent, 5) : 2}%` }}
                            ></div>
                            
                            {/* X-Axis Labels (every 4 hours) */}
                            {idx % 4 === 0 && (
                                <div className="absolute top-full mt-1 text-[9px] text-gray-400 font-mono whitespace-nowrap">
                                    {idx}h
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                 <h3 className="font-bold text-gray-800 text-lg mb-6">Menos Vendidos 📉</h3>
                 <div className="flex-grow space-y-3">
                    {leastSoldProducts.map((prod, idx) => (
                        <div key={idx} className="flex justify-between items-center p-2 rounded bg-gray-50">
                             <span className="text-sm font-medium text-gray-700 truncate">{idx+1}. {prod.name}</span>
                             <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prod.count===0?'text-red-600 bg-red-100':'text-gray-500'}`}>{prod.count} un.</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
      </>
      )}

      {/* Transactions List */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-800">
            {userRole === 'admin' ? 'Historial Completo' : 'Mis Ventas'}
        </h3>
        
        {loading ? (
             <div className="p-10 text-center text-gray-500">Cargando transacciones...</div>
        ) : groupedTransactions.length === 0 ? (
             <div className="bg-white rounded-xl shadow-sm p-10 text-center text-gray-500 border border-gray-200">No hay transacciones registradas.</div>
        ) : (
             groupedTransactions.map((monthGroup) => {
                const isMonthExpanded = expandedMonths.has(monthGroup.monthKey);
                return (
                    <div key={monthGroup.monthKey} className="rounded-xl overflow-hidden shadow-sm border border-gray-200 bg-white">
                        <div 
                            onClick={() => toggleMonth(monthGroup.monthKey)}
                            className="bg-gray-800 text-white p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700 transition-colors select-none"
                        >
                            <div className="flex items-center gap-3">
                                <span className={`transform transition-transform duration-200 ${isMonthExpanded ? 'rotate-180' : ''}`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                </span>
                                <h3 className="text-lg font-bold capitalize">{monthGroup.monthKey}</h3>
                            </div>
                            {userRole === 'admin' && (
                                <div className="text-right">
                                    <span className="text-xs text-gray-400 block uppercase">Válido Mes</span>
                                    <span className="text-xl font-bold text-green-400">{formatCurrency(monthGroup.total)}</span>
                                </div>
                            )}
                        </div>

                        {isMonthExpanded && (
                            <div className="bg-gray-50 animate-fade-in pb-2">
                                {monthGroup.days.map((dayGroup) => {
                                    const isDayExpanded = expandedDays.has(dayGroup.dateKey);
                                    return (
                                        <div key={dayGroup.dateKey} className="border-b border-gray-200 last:border-0">
                                            <div 
                                                onClick={(e) => toggleDay(e, dayGroup.dateKey)}
                                                className="bg-white hover:bg-gray-50 px-4 md:px-6 py-3 flex justify-between items-center cursor-pointer transition-colors border-l-4 border-l-coffee-500"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span className={`text-coffee-600 transform transition-transform duration-200 ${isDayExpanded ? 'rotate-90' : ''}`}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </span>
                                                    <span className="font-bold text-gray-700 text-sm">{dayGroup.dateKey}</span>
                                                    <span className="text-xs text-gray-400">({dayGroup.sales.length} ops)</span>
                                                </div>
                                                {userRole === 'admin' && (
                                                    <span className="font-bold text-gray-900 bg-gray-50 px-2 py-0.5 rounded text-xs shadow-sm border border-gray-200">
                                                        {formatCurrency(dayGroup.total)}
                                                    </span>
                                                )}
                                            </div>

                                            {isDayExpanded && (
                                                <div className="px-0 sm:px-4 py-1 bg-gray-50 shadow-inner">
                                                    <table className="min-w-full text-sm bg-white rounded-md border border-gray-100 overflow-hidden mb-2">
                                                        <thead className="text-gray-400 bg-gray-100">
                                                            <tr>
                                                                <th className="px-4 py-2 text-left font-normal w-24 text-xs">Hora</th>
                                                                <th className="px-4 py-2 text-left font-normal text-xs">Estado</th>
                                                                <th className="px-4 py-2 text-left font-normal text-xs">Detalle</th>
                                                                <th className="px-4 py-2 text-right font-normal w-32 text-xs">Monto</th>
                                                                <th className="px-4 py-2 text-center font-normal w-24 text-xs">Acción</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {dayGroup.sales.map((sale) => (
                                                                <tr key={sale.id} className={`transition-colors border-t border-gray-50 ${sale.status==='pending_void' && userRole==='admin' ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                                                                    <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                                                                        {formatTime(sale.fecha)}
                                                                    </td>
                                                                    <td className="px-4 py-3">
                                                                        {renderStatusBadge(sale)}
                                                                        {sale.voidReason && (
                                                                            <p className="text-[10px] text-gray-500 italic mt-1 max-w-[120px] leading-tight">"{sale.voidReason}"</p>
                                                                        )}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-gray-800">
                                                                        <div className="flex flex-wrap gap-2">
                                                                            {sale.items.map((item, idx) => (
                                                                                <span key={idx} className={`px-2 py-0.5 rounded text-xs border truncate max-w-[200px] ${sale.status==='voided'?'text-gray-400 bg-gray-100 border-gray-200 decoration-line-through':'text-orange-800 bg-orange-50 border-orange-100'}`}>
                                                                                    <b>{item.cantidad}</b> {item.nombre}
                                                                                </span>
                                                                            ))}
                                                                        </div>
                                                                    </td>
                                                                    <td className={`px-4 py-3 text-right font-bold ${sale.status==='voided'?'text-gray-400 decoration-line-through':'text-gray-800'}`}>
                                                                        {formatCurrency(sale.total)}
                                                                    </td>
                                                                    <td className="px-4 py-3 text-center">
                                                                        {/* ACTION BUTTONS LOGIC */}
                                                                        {userRole === 'cajero' && sale.status === 'completed' && (
                                                                            <button 
                                                                                onClick={() => handleRequestVoid(sale)}
                                                                                className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-red-50 hover:text-red-600 border border-gray-300"
                                                                            >
                                                                                Anular
                                                                            </button>
                                                                        )}

                                                                        {userRole === 'admin' && sale.status === 'pending_void' && (
                                                                            <div className="flex justify-center gap-2">
                                                                                <button 
                                                                                    onClick={() => handleApproveVoid(sale)}
                                                                                    className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 border border-red-300 font-bold"
                                                                                    title="Confirmar Anulación"
                                                                                >
                                                                                    ✓
                                                                                </button>
                                                                                <button 
                                                                                    onClick={() => handleRejectVoid(sale)}
                                                                                    className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded hover:bg-gray-200 border border-gray-300"
                                                                                    title="Rechazar solicitud"
                                                                                >
                                                                                    ✕
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
             })
        )}
      </div>
    </div>
  );
};

export default SalesDashboard;