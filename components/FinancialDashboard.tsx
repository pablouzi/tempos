import React, { useEffect, useState, useMemo } from 'react';
import { Sale, Ingredient } from '../types';
import { getSalesHistory } from '../services/firebaseService';

const FinancialDashboard: React.FC = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const data = await getSalesHistory();
        setSales(data);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // --- Calculations ---
  const stats = useMemo(() => {
    const validSales = sales.filter(s => s.status === 'completed');
    
    let grossSales = 0;
    let totalCost = 0;

    // Grouping for Ranking
    const productStats: Record<string, { revenue: number, cost: number, count: number }> = {};

    validSales.forEach(sale => {
      grossSales += sale.total;
      totalCost += (sale.costoTotal || 0);

      // Distribute cost to items approx (Cost distribution is tricky if not stored per item line in history)
      // Since we store totalCost per sale, and item lines don't have individual cost in the legacy history,
      // we can estimate or just track global.
      // However, for the ranking, we want to know WHICH products give margin.
      // Limitation: If old sales didn't have cost, margin is 100%, which is skewed.
      // We will only calculate ranking for sales that have 'costoTotal' > 0 to ensure accuracy,
      // or accept the limitation for legacy data.
      
      if (sale.costoTotal && sale.costoTotal > 0) {
        // Simple heuristic: Distribute transaction cost proportionally to price for this ranking analysis
        // This isn't 100% perfect for mixed margins but is a good approximation without changing Sale Item structure deeply.
        const saleTotal = sale.total;
        sale.items.forEach(item => {
             const weight = item.precio / saleTotal;
             const itemEstimatedCost = (sale.costoTotal || 0) * weight;
             
             if (!productStats[item.nombre]) {
                 productStats[item.nombre] = { revenue: 0, cost: 0, count: 0 };
             }
             productStats[item.nombre].revenue += (item.precio * item.cantidad);
             productStats[item.nombre].cost += (itemEstimatedCost * item.cantidad); // item.cantidad is usually 1 in the items array unless grouped
             productStats[item.nombre].count += item.cantidad;
        });
      }
    });

    const netProfit = grossSales - totalCost;
    const margin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

    // Convert Ranking
    const ranking = Object.entries(productStats).map(([name, data]) => ({
        name,
        revenue: data.revenue,
        cost: data.cost,
        profit: data.revenue - data.cost,
        margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0
    })).sort((a, b) => b.profit - a.profit); // Sort by total profit ($)

    return { grossSales, totalCost, netProfit, margin, ranking };
  }, [sales]);

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

  if (loading) return <div className="p-10 text-center text-gray-500">Cargando finanzas...</div>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        <div className="relative z-10">
            <h2 className="text-3xl font-bold mb-2">Tablero Financiero 💰</h2>
            <p className="text-gray-400">Análisis de Utilidad Real basado en costos de insumos.</p>
        </div>
        <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-green-900 to-transparent opacity-20"></div>
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Revenue */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Ventas Brutas</p>
              <h3 className="text-3xl font-bold text-gray-800">{formatCurrency(stats.grossSales)}</h3>
          </div>

          {/* Cost (CMV) */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Costo de Venta (CMV)</p>
              <h3 className="text-3xl font-bold text-red-600">-{formatCurrency(stats.totalCost)}</h3>
              <p className="text-xs text-gray-400 mt-2">Insumos + Productos Externos</p>
          </div>

          {/* Net Profit */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Utilidad Neta</p>
              <h3 className="text-3xl font-bold text-green-600">{formatCurrency(stats.netProfit)}</h3>
              <div className="w-full bg-gray-200 h-1.5 mt-3 rounded-full overflow-hidden">
                  <div className="bg-green-500 h-full" style={{width: `${stats.margin}%`}}></div>
              </div>
          </div>

          {/* Margin % */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
              <div className="relative h-24 w-24 flex items-center justify-center">
                  <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                    <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                    <path className={`${stats.margin > 50 ? 'text-green-500' : stats.margin > 30 ? 'text-yellow-500' : 'text-red-500'}`} strokeDasharray={`${stats.margin}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                  </svg>
                  <span className="absolute text-xl font-bold text-gray-700">{Math.round(stats.margin)}%</span>
              </div>
              <p className="text-sm font-bold text-gray-400 mt-2">Margen Global</p>
          </div>
      </div>

      {/* Profitability Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2">
                  🏆 Top Productos por Rentabilidad
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">(Donde más ganas dinero real)</span>
              </h3>
              
              <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                      <thead>
                          <tr className="text-left text-gray-400 border-b border-gray-100">
                              <th className="pb-3 font-normal">Producto</th>
                              <th className="pb-3 font-normal text-right">Venta Total</th>
                              <th className="pb-3 font-normal text-right">Costo Est.</th>
                              <th className="pb-3 font-normal text-right text-green-700">Utilidad</th>
                              <th className="pb-3 font-normal text-right">Margen</th>
                          </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                          {stats.ranking.slice(0, 8).map((prod, idx) => (
                              <tr key={idx} className="hover:bg-gray-50 group transition-colors">
                                  <td className="py-3 font-medium text-gray-800 flex items-center gap-2">
                                      <span className="text-gray-300 w-4">{idx + 1}.</span> {prod.name}
                                  </td>
                                  <td className="py-3 text-right text-gray-600">{formatCurrency(prod.revenue)}</td>
                                  <td className="py-3 text-right text-gray-400">{formatCurrency(prod.cost)}</td>
                                  <td className="py-3 text-right font-bold text-green-600">{formatCurrency(prod.profit)}</td>
                                  <td className="py-3 text-right">
                                      <span className={`px-2 py-1 rounded text-xs font-bold ${prod.margin > 60 ? 'bg-green-100 text-green-800' : prod.margin > 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                          {Math.round(prod.margin)}%
                                      </span>
                                  </td>
                              </tr>
                          ))}
                      </tbody>
                  </table>
              </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
               <h3 className="font-bold text-gray-800 mb-4">Consejos Financieros</h3>
               <ul className="space-y-4 text-sm text-gray-600">
                   <li className="flex gap-3">
                       <span className="bg-white p-2 h-8 w-8 rounded-full shadow-sm flex items-center justify-center text-green-600">💡</span>
                       <p>El margen saludable para cafeterías suele estar entre el <b>15% y 25%</b> neto. Si estás bajo el 10%, revisa el costo de tu leche y café.</p>
                   </li>
                   <li className="flex gap-3">
                       <span className="bg-white p-2 h-8 w-8 rounded-full shadow-sm flex items-center justify-center text-blue-600">📉</span>
                       <p>Si el CMV supera el <b>35%</b> de tus ventas, considera subir precios o re-negociar con proveedores.</p>
                   </li>
                   <li className="flex gap-3">
                       <span className="bg-white p-2 h-8 w-8 rounded-full shadow-sm flex items-center justify-center text-yellow-600">⚖️</span>
                       <p>Productos como el té o americanos suelen tener márgenes sobre el <b>80%</b>. Promuévelos para subir tu utilidad global.</p>
                   </li>
               </ul>
          </div>
      </div>
    </div>
  );
};

export default FinancialDashboard;