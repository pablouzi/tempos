import React, { useMemo } from 'react';
import { Sale } from '../types';

interface WeeklyTrendsProps {
  sales: Sale[];
}

interface DayMetric {
  dayIndex: number;
  dayName: string;
  totalRevenue: number;
  transactionCount: number;
  avgTicket: number;
  topProduct: string;
  peakHour: number;
  projection: number;
  trend: 'up' | 'stable' | 'down';
  rank: number; // 1 = Best selling day
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

const WeeklyTrends: React.FC<WeeklyTrendsProps> = ({ sales }) => {

  const metrics = useMemo(() => {
    // 1. Initialize Containers
    const dayBuckets = Array(7).fill(null).map(() => ({
      total: 0,
      count: 0,
      items: {} as Record<string, number>,
      hours: Array(24).fill(0),
      // Map of "YYYY-MM-DD" -> dailyTotal for projection logic
      dateTotals: {} as Record<string, number>
    }));

    // 2. Process Sales
    sales.forEach(sale => {
      if (sale.status !== 'completed') return;

      let date: Date;
      if (!sale.fecha) return;

      if (typeof sale.fecha.toDate === 'function') {
        date = sale.fecha.toDate();
      } else if (typeof sale.fecha === 'object' && sale.fecha !== null && 'seconds' in sale.fecha) {
        date = new Date(sale.fecha.seconds * 1000);
      } else {
        date = new Date(sale.fecha);
      }

      if (isNaN(date.getTime())) return;

      const dayIdx = date.getDay();
      const dateKey = date.toISOString().split('T')[0];
      const hour = date.getHours();

      const bucket = dayBuckets[dayIdx];

      // Revenue & Count
      bucket.total += sale.total;
      bucket.count += 1;

      // Hourly Traffic
      bucket.hours[hour] += 1;

      // Item Popularity
      sale.items.forEach(item => {
        bucket.items[item.nombre] = (bucket.items[item.nombre] || 0) + item.cantidad;
      });

      // Daily grouping for projection
      bucket.dateTotals[dateKey] = (bucket.dateTotals[dateKey] || 0) + sale.total;
    });

    // 3. Compute Metrics
    const computedStats: DayMetric[] = dayBuckets.map((bucket, idx) => {
      // Top Product
      const topProdEntry = Object.entries(bucket.items).sort((a, b) => b[1] - a[1])[0];
      const topProduct = topProdEntry ? topProdEntry[0] : 'N/A';

      // Peak Hour
      const peakHour = bucket.hours.indexOf(Math.max(...bucket.hours));

      // Avg Ticket
      const avgTicket = bucket.count > 0 ? bucket.total / bucket.count : 0;

      // --- PROJECTION ENGINE ---
      // Get unique dates for this day of week, sorted newest first
      const uniqueDates = Object.entries(bucket.dateTotals)
        .sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime()); // Descending

      let projection = 0;
      let trend: 'up' | 'stable' | 'down' = 'stable';

      if (uniqueDates.length >= 3) {
        const [w1, w2, w3] = uniqueDates; // w1 is newest
        // Check Trend (W1 > W2 > W3)
        if (w1[1] > w2[1] && w2[1] > w3[1]) {
          trend = 'up';
          // Project average of last 3 + 10%
          const avgRecent = (w1[1] + w2[1] + w3[1]) / 3;
          projection = avgRecent * 1.10;
        } else {
          // Simple average of last 3
          projection = (w1[1] + w2[1] + w3[1]) / 3;
          if (w1[1] < w2[1]) trend = 'down';
        }
      } else if (uniqueDates.length > 0) {
        // Not enough data, just average what we have
        projection = uniqueDates.reduce((acc, curr) => acc + curr[1], 0) / uniqueDates.length;
      }

      return {
        dayIndex: idx,
        dayName: DAYS[idx],
        totalRevenue: bucket.total,
        transactionCount: bucket.count,
        avgTicket,
        topProduct,
        peakHour,
        projection,
        trend,
        rank: 0 // To be filled
      };
    });

    // 4. Ranking (for color coding)
    const maxRev = Math.max(...computedStats.map(s => s.totalRevenue));
    const sortedByRev = [...computedStats].sort((a, b) => b.totalRevenue - a.totalRevenue);

    computedStats.forEach(stat => {
      // Rank 1 is best
      stat.rank = sortedByRev.findIndex(s => s.dayIndex === stat.dayIndex) + 1;
    });

    return computedStats;

  }, [sales]);

  // --- Dynamic Text Generator ---
  const getRecommendation = (day: DayMetric) => {
    if (day.transactionCount === 0) return "Sin datos suficientes.";

    const timeStr = `${day.peakHour}:00`;
    if (day.rank <= 2) {
      return `🔥 Día Fuerte: El ${day.topProduct} lidera las ventas. Asegura stock extra antes de las ${timeStr}.`;
    } else if (day.trend === 'up') {
      return `📈 Tendencia al Alza: Se proyecta un crecimiento del 10%. Prepara la máquina de café.`;
    } else {
      return `💡 Oportunidad: El ticket promedio es de $${Math.round(day.avgTicket)}. Intenta hacer up-selling con repostería.`;
    }
  };

  const formatCurrency = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

  // Determine chart scale
  const maxProjection = Math.max(...metrics.map(m => m.projection), 100);

  return (
    <div className="space-y-8 animate-fade-in">

      {/* 1. Bar Chart Visualization */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
        <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>
          Proyección de Ingresos Semanal
        </h3>
        <div className="h-48 flex items-end justify-between gap-2 md:gap-4 relative">
          {/* Background Lines */}
          <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
            <div className="border-t border-gray-900 w-full h-0"></div>
            <div className="border-t border-gray-900 w-full h-0"></div>
            <div className="border-t border-gray-900 w-full h-0"></div>
          </div>

          {metrics.map((day) => {
            const height = (day.projection / maxProjection) * 100;
            const isToday = new Date().getDay() === day.dayIndex;
            const isTop = day.rank === 1;

            return (
              <div key={day.dayIndex} className="flex-1 flex flex-col items-center group relative h-full justify-end">
                <div className="mb-1 text-[10px] font-bold text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                  {formatCurrency(day.projection)}
                </div>
                <div
                  className={`w-full max-w-[40px] rounded-t-sm transition-all duration-700 ease-out relative
                            ${isTop ? 'bg-green-500' : isToday ? 'bg-coffee-600' : 'bg-gray-300 hover:bg-coffee-400'}`}
                  style={{ height: `${Math.max(height, 5)}%` }}
                >
                  {day.trend === 'up' && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-green-600 animate-bounce">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M12 7h1v10H7v-1h3.293l-5.647-5.646 1.414-1.414 4.94 4.939V7h1z" clipRule="evenodd" transform="rotate(180 10 10)" />
                      </svg>
                    </div>
                  )}
                </div>
                <span className={`mt-2 text-xs uppercase font-bold ${isToday ? 'text-coffee-700' : 'text-gray-400'}`}>
                  {day.dayName.substring(0, 3)}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* 2. Cards Grid (Dashboard) */}
      <div>
        <h3 className="text-xl font-bold text-gray-800 mb-4">Análisis Detallado por Día</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {metrics.map((day) => {
            const isToday = new Date().getDay() === day.dayIndex;
            // Card Color Logic
            let borderClass = 'border-gray-200';
            let bgClass = 'bg-white';
            if (day.rank <= 2) {
              borderClass = 'border-green-300';
              bgClass = 'bg-green-50';
            }
            if (isToday) {
              borderClass = 'border-coffee-400 ring-2 ring-coffee-100';
            }

            return (
              <div key={day.dayIndex} className={`rounded-xl p-4 border shadow-sm flex flex-col justify-between ${borderClass} ${bgClass} transition-all hover:shadow-md`}>
                {/* Header */}
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h4 className={`font-bold text-lg ${isToday ? 'text-coffee-800' : 'text-gray-700'}`}>
                      {day.dayName}
                    </h4>
                    <div className="text-xs text-gray-500 font-mono">
                      Ticket Prom: {formatCurrency(day.avgTicket)}
                    </div>
                  </div>
                  {day.rank === 1 && <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-bold">★ #1</span>}
                  {day.trend === 'up' && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-bold">↗ +10%</span>}
                </div>

                {/* Metrics */}
                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Producto Top</span>
                    <span className="font-semibold text-gray-800 truncate max-w-[100px]" title={day.topProduct}>{day.topProduct}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Hora Peak</span>
                    <span className="font-semibold text-gray-800">{day.peakHour}:00 - {day.peakHour + 1}:00</span>
                  </div>
                </div>

                {/* AI Recommendation Box */}
                <div className="bg-white/60 p-2 rounded border border-black/5 text-xs text-gray-600 italic leading-relaxed">
                  "{getRecommendation(day)}"
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyTrends;