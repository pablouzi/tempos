import React, { useEffect, useState, useMemo } from 'react';
import { Sale, Ingredient, Product } from '../types';
import { getSalesHistory, getIngredients, getProducts, requestVoidSale, approveVoidSale, rejectVoidSale } from '../services/firebaseService';

interface SalesDashboardProps {
  userRole: 'admin' | 'cajero' | null;
  currentUser: any; // Firebase user object
}

// Interfaces for Transaction Grouping
interface DailyGroup {
  dateKey: string;
  total: number;
  sales: Sale[];
  timestamp: number;
}

const SalesDashboard: React.FC<SalesDashboardProps> = ({ userRole, currentUser }) => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter State
  const [filterMethod, setFilterMethod] = useState<string>('all');

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

  // --- Filter Logic ---
  const filteredSales = useMemo(() => {
    if (filterMethod === 'all') return sales;
    return sales.filter(s => s.paymentMethod === filterMethod);
  }, [sales, filterMethod]);

  const pendingVoidSales = useMemo(() => {
    return sales.filter(s => s.status === 'pending_void');
  }, [sales]);

  // --- Actions Logic ---

  // Cashier Request OR Admin Direct Void (if selected via special flow, though Admin usually approves)
  const handleRequestVoid = async (sale: Sale) => {
    // Determine action based on role
    const isDirectVoid = userRole === 'admin';
    const title = isDirectVoid ? 'Anular Venta Directamente' : 'Solicitar Anulación';
    const text = isDirectVoid
      ? 'Esta acción anulará la venta y restaurará el stock inmediatamente.'
      : 'Se enviará una solicitud al administrador.';

    const { value: reason } = await window.Swal.fire({
      title: title,
      text: text,
      input: 'textarea',
      inputLabel: 'Motivo',
      inputPlaceholder: 'Ej: Error de digitación, cliente cambió de opinión...',
      showCancelButton: true,
      confirmButtonText: isDirectVoid ? 'Anular Ahora' : 'Enviar Solicitud',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#d33'
    });

    if (reason) {
      try {
        if (isDirectVoid) {
          // Admin Direct Void
          await approveVoidSale(sale, currentUser.email, reason);
          window.Swal.fire('Anulada', 'Venta anulada y stock restaurado.', 'success');
        } else {
          // Cashier Request
          await requestVoidSale(sale.id!, reason, currentUser.email);
          window.Swal.fire('Solicitada', 'Solicitud enviada al Administrador.', 'info');
        }
        fetchData();
      } catch (e: any) {
        window.Swal.fire('Error', 'No se pudo procesar: ' + e.message, 'error');
      }
    }
  };

  const handleApproveVoid = async (sale: Sale) => {
    const confirm = await window.Swal.fire({
      title: '¿Aprobar Anulación?',
      html: `Motivo: <i>"${sale.voidReason}"</i><br/><br/>Esto devolverá los ingredientes al stock.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      confirmButtonText: 'Sí, Aprobar'
    });

    if (confirm.isConfirmed) {
      try {
        await approveVoidSale(sale, currentUser.email);
        window.Swal.fire('Aprobada', 'Venta anulada y stock restaurado.', 'success');
        fetchData();
      } catch (e: any) {
        window.Swal.fire('Error', 'Fallo al restaurar stock: ' + e.message, 'error');
      }
    }
  };

  const handleRejectVoid = async (sale: Sale) => {
    try {
      await rejectVoidSale(sale.id!, currentUser.email);
      window.Swal.fire('Rechazada', 'La venta vuelve a estado completado.', 'success');
      fetchData();
    } catch (e) {
      window.Swal.fire('Error', 'No se pudo rechazar', 'error');
    }
  };

  // --- KPI Calculations ---
  // Only count completed sales for revenue, using FILTERED sales
  const validSales = filteredSales.filter(s => s.status === 'completed');

  const totalRevenue = validSales.reduce((sum, s) => sum + s.total, 0);
  const totalTransactions = validSales.length;
  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Stock Alerts
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
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    const maxVal = sorted[0]?.count || 1;
    return sorted.map(p => ({ ...p, percent: (p.count / maxVal) * 100 }));
  }, [validSales]);

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
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [validSales, products]);

  // --- Grouping Logic ---
  const groupedTransactions = useMemo(() => {
    const monthsMap: Record<string, { total: number; daysMap: Record<string, DailyGroup>; timestamp: number }> = {};

    filteredSales.forEach(sale => {
      let dateObj: Date;
      try {
        if (sale.fecha && typeof sale.fecha.toDate === 'function') {
          dateObj = sale.fecha.toDate();
        } else {
          dateObj = new Date(sale.fecha);
        }
      } catch {
        dateObj = new Date();
      }

      if (isNaN(dateObj.getTime())) {
        dateObj = new Date();
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
      if (result[0].days.length > 0) setExpandedDays(new Set([result[0].days[0].dateKey]));
    }

    return result;
  }, [filteredSales, expandedMonths.size]);

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
        return <span className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-bold border border-orange-200 animate-pulse">PENDIENTE</span>;
      default:
        return <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold border border-green-200">COMPLETADA</span>;
    }
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
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 dark:text-white">
            {userRole === 'admin' ? 'Dashboard & Historial' : 'Historial de Caja'}
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            {userRole === 'admin' ? 'Resumen general y anulación de ventas' : 'Mis ventas recientes'}
          </p>
        </div>

        <div className="flex gap-4 items-center w-full md:w-auto">
          <div className="w-full md:w-48">
            <select
              value={filterMethod}
              onChange={(e) => setFilterMethod(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-sm border-gray-300 dark:border-white/20 focus:outline-none focus:ring-coffee-500 focus:border-coffee-500 rounded-lg border shadow-sm bg-white dark:bg-brand-card text-gray-900 dark:text-gray-100"
            >
              <option value="all">Todos los Pagos</option>
              <option value="efectivo">Efectivo 💵</option>
              <option value="tarjeta">Tarjeta 💳</option>
              <option value="otro">Otro ✨</option>
            </select>
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-white dark:bg-brand-card border border-gray-300 dark:border-white/20 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-brand-dark transition-colors text-sm font-medium"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            )}
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {/* ADMIN ALERTS: PENDING VOIDS */}
      {userRole === 'admin' && pendingVoidSales.length > 0 && (
        <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 p-4 rounded-md shadow-sm">
          <h3 className="text-lg font-bold text-orange-800 dark:text-orange-400 mb-2">Solicitudes de Anulación Pendientes ({pendingVoidSales.length})</h3>
          <div className="space-y-2">
            {pendingVoidSales.map(sale => (
              <div key={sale.id} className="flex justify-between items-center bg-white dark:bg-brand-card p-3 rounded border border-orange-200 dark:border-orange-800/30">
                <div>
                  <span className="font-bold text-gray-800 dark:text-white">{formatCurrency(sale.total)}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400 mx-2">|</span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{sale.voidRequestedBy || 'Desconocido'}</span>
                  <p className="text-xs text-red-500 dark:text-red-400 italic mt-1">Motivo: "{sale.voidReason}"</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveVoid(sale)}
                    className="bg-red-600 text-white px-3 py-1 rounded text-xs font-bold hover:bg-red-700"
                  >
                    Aprobar & Anular
                  </button>
                  <button
                    onClick={() => handleRejectVoid(sale)}
                    className="bg-gray-200 text-gray-700 px-3 py-1 rounded text-xs font-bold hover:bg-gray-300"
                  >
                    Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ADMIN ONLY: FULL ANALYTICS */}
      {userRole === 'admin' && (
        <>
          {/* KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className={`bg-white dark:bg-brand-card p-6 rounded-xl shadow-sm border flex items-center justify-between ${lowStockCount > 0 ? 'border-red-200 dark:border-red-800/30 bg-red-50 dark:bg-red-900/20' : 'border-gray-100 dark:border-white/5'}`}>
              <div>
                <p className={`text-sm font-bold mb-1 ${lowStockCount > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}>Alertas de Stock</p>
                <h3 className={`text-2xl font-bold ${lowStockCount > 0 ? 'text-red-800 dark:text-red-300' : 'text-gray-800 dark:text-white'}`}>
                  {lowStockCount} <span className="text-sm font-normal">insumos</span>
                </h3>
              </div>
              <div className={`p-3 rounded-full ${lowStockCount > 0 ? 'bg-red-200 dark:bg-red-900/40 text-red-700 dark:text-red-400' : 'bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ingresos Reales</p>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(totalRevenue)}</h3>
              </div>
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ventas Válidas</p>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{totalTransactions}</h3>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
              </div>
            </div>

            <div className="bg-white dark:bg-brand-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-white/5 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Ticket Promedio</p>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white">{formatCurrency(averageTicket)}</h3>
              </div>
              <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Detailed Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-brand-card rounded-xl shadow-sm border border-gray-200 dark:border-white/5 p-6 flex flex-col">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-gray-800 dark:text-white text-lg">Top 10 Ventas 🌟</h3>
              </div>
              {topProducts.length === 0 ? <div className="flex-grow flex items-center justify-center text-gray-400 dark:text-gray-500">Sin datos</div> : (
                <div className="space-y-4 flex-grow">
                  {topProducts.map((prod, idx) => (
                    <div key={prod.name} className="relative">
                      <div className="flex justify-between text-sm mb-1 z-10 relative">
                        <span className={`font-medium ${idx === 0 ? 'text-yellow-700 font-bold' : 'text-gray-700 dark:text-gray-300'}`}>{idx + 1}. {prod.name}</span>
                        <span className="text-gray-500 dark:text-gray-400 font-mono">{prod.count} un.</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 dark:bg-white/10 rounded-full"><div className={`h-full rounded-full ${idx === 0 ? 'bg-yellow-500' : 'bg-gray-400'}`} style={{ width: `${prod.percent}%` }}></div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white dark:bg-brand-card rounded-xl shadow-sm border border-gray-200 dark:border-white/5 p-6 flex flex-col">
              <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-6">10 Menos Vendidos 📉</h3>
              <div className="flex-grow space-y-3">
                {leastSoldProducts.map((prod, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 rounded bg-gray-50 dark:bg-white/5">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{idx + 1}. {prod.name}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${prod.count === 0 ? 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/40' : 'text-gray-500 dark:text-gray-400'}`}>{prod.count} un.</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Transactions List */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
          {userRole === 'admin' ? 'Historial Completo' : 'Mis Ventas'}
          <span className="ml-2 text-sm font-normal text-gray-400">({filterMethod === 'all' ? 'Todos los pagos' : filterMethod})</span>
        </h3>

        {loading ? (
          <div className="p-10 text-center text-gray-500 dark:text-gray-400">Cargando transacciones...</div>
        ) : groupedTransactions.length === 0 ? (
          <div className="bg-white dark:bg-brand-card rounded-xl shadow-sm p-10 text-center text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/5">No hay transacciones registradas con este criterio.</div>
        ) : (
          groupedTransactions.map((monthGroup) => {
            const isMonthExpanded = expandedMonths.has(monthGroup.monthKey);
            return (
              <div key={monthGroup.monthKey} className="rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-white/5 bg-white dark:bg-brand-card">
                <div
                  onClick={() => toggleMonth(monthGroup.monthKey)}
                  className="bg-gray-800 dark:bg-brand-dark/80 text-white p-4 flex justify-between items-center cursor-pointer hover:bg-gray-700 dark:hover:bg-brand-dark transition-colors select-none"
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
                  <div className="bg-gray-50 dark:bg-transparent animate-fade-in pb-2">
                    {monthGroup.days.map((dayGroup) => {
                      const isDayExpanded = expandedDays.has(dayGroup.dateKey);
                      return (
                        <div key={dayGroup.dateKey} className="border-b border-gray-200 dark:border-white/5 last:border-0">
                          <div
                            onClick={(e) => toggleDay(e, dayGroup.dateKey)}
                            className="bg-white dark:bg-brand-dark/40 hover:bg-gray-50 dark:hover:bg-brand-dark/60 px-4 md:px-6 py-3 flex justify-between items-center cursor-pointer transition-colors border-l-4 border-l-coffee-500 dark:border-l-coffee-400"
                          >
                            <div className="flex items-center gap-2">
                              <span className={`text-coffee-600 transform transition-transform duration-200 ${isDayExpanded ? 'rotate-90' : ''}`}>
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </span>
                              <span className="font-bold text-gray-700 dark:text-gray-200 text-sm">{dayGroup.dateKey}</span>
                              <span className="text-xs text-gray-400 dark:text-gray-500">({dayGroup.sales.length} ops)</span>
                            </div>
                            {userRole === 'admin' && (
                              <span className="font-bold text-gray-900 dark:text-white bg-gray-50 dark:bg-brand-card px-2 py-0.5 rounded text-xs shadow-sm border border-gray-200 dark:border-white/10">
                                {formatCurrency(dayGroup.total)}
                              </span>
                            )}
                          </div>

                          {isDayExpanded && (
                            <div className="px-0 sm:px-4 py-1 bg-gray-50 dark:bg-transparent shadow-inner">
                              <table className="min-w-full text-sm bg-white dark:bg-brand-card rounded-md border border-gray-100 dark:border-white/5 overflow-hidden mb-2">
                                <thead className="text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5">
                                  <tr>
                                    <th className="px-4 py-2 text-left font-normal w-24 text-xs">Hora</th>
                                    <th className="px-4 py-2 text-left font-normal w-24 text-xs">Pago</th>
                                    <th className="px-4 py-2 text-left font-normal text-xs">Estado</th>
                                    <th className="px-4 py-2 text-left font-normal text-xs">Detalle</th>
                                    <th className="px-4 py-2 text-right font-normal w-32 text-xs">Monto</th>
                                    <th className="px-4 py-2 text-center font-normal w-24 text-xs">Acción</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {dayGroup.sales.map((sale) => (
                                    <tr key={sale.id} className={`transition-colors border-t border-gray-50 dark:border-white/5 ${sale.status === 'pending_void' ? 'bg-orange-50 dark:bg-orange-900/20' : sale.status === 'voided' ? 'bg-gray-50 dark:bg-white/5 opacity-60' : 'hover:bg-gray-50 dark:hover:bg-white/10'}`}>
                                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 font-mono text-xs">
                                        {formatTime(sale.fecha)}
                                      </td>
                                      <td className="px-4 py-3">
                                        {renderPaymentBadge(sale.paymentMethod)}
                                      </td>
                                      <td className="px-4 py-3">
                                        {renderStatusBadge(sale)}
                                        {sale.voidReason && (
                                          <p className="text-[10px] text-gray-500 dark:text-gray-400 italic mt-1 max-w-[120px] leading-tight truncate" title={sale.voidReason}>"{sale.voidReason}"</p>
                                        )}
                                      </td>
                                      <td className="px-4 py-3 text-gray-800 dark:text-gray-200">
                                        <div className="flex flex-wrap gap-2">
                                          {sale.items.map((item, idx) => (
                                            <span key={idx} className={`px-2 py-0.5 rounded text-xs border truncate max-w-[200px] ${sale.status === 'voided' ? 'text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/10 border-gray-200 dark:border-white/5 decoration-line-through' : 'text-orange-800 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 border-orange-100 dark:border-orange-800/30'}`}>
                                              <b>{item.cantidad}</b> {item.nombre}
                                            </span>
                                          ))}
                                        </div>
                                      </td>
                                      <td className={`px-4 py-3 text-right font-bold ${sale.status === 'voided' ? 'text-gray-400 dark:text-gray-500 decoration-line-through' : 'text-gray-800 dark:text-white'}`}>
                                        {formatCurrency(sale.total)}
                                      </td>
                                      <td className="px-4 py-3 text-center">
                                        {/* ACTION BUTTONS LOGIC */}
                                        {sale.status === 'completed' && (
                                          <button
                                            onClick={() => handleRequestVoid(sale)}
                                            className={`text-xs px-2 py-1 rounded border transition-colors ${userRole === 'admin' ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800/30 hover:bg-red-100 dark:hover:bg-red-900/40' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 dark:hover:text-red-400 border-gray-300 dark:border-white/20'}`}
                                            title={userRole === 'admin' ? 'Anular Directamente' : 'Solicitar Anulación'}
                                          >
                                            {userRole === 'admin' ? 'Anular' : 'Solicitar'}
                                          </button>
                                        )}
                                        {sale.status === 'pending_void' && (
                                          <span className="text-xs text-orange-500 dark:text-orange-400 italic">Pendiente...</span>
                                        )}
                                        {sale.status === 'voided' && (
                                          <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
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