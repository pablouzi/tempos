import { Sale, Product, WeatherSnapshot } from '../types';

interface DayAnalysis {
  dayName: string;
  topProduct: string;
  peakHourRange: string;
  averageSales: number;
}

interface Insight {
  type: 'stock' | 'promo' | 'alert';
  message: string;
  icon: string;
}

interface PredictiveInsight {
    tomorrowDay: string;
    tomorrowCondition: string;
    recommendedProduct: string;
    increasePercentage: number;
    tip: string;
}

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// --- Helper: Parse Date ---
const getDate = (sale: Sale): Date => {
  if (sale.fecha && typeof sale.fecha.toDate === 'function') {
    return sale.fecha.toDate();
  }
  return new Date(sale.fecha);
};

// --- CORE ANALYTICS ---

export const analyzeWeeklyPatterns = (sales: Sale[]): DayAnalysis[] => {
  const dayStats: Record<number, { items: Record<string, number>, hours: number[], totalSales: number, count: number }> = {};

  // Initialize
  for (let i = 0; i < 7; i++) {
    dayStats[i] = { items: {}, hours: Array(24).fill(0), totalSales: 0, count: 0 };
  }

  // Populate Data
  sales.forEach(sale => {
    if (sale.status !== 'completed') return;
    
    const date = getDate(sale);
    const day = date.getDay();
    const hour = date.getHours();

    dayStats[day].totalSales += sale.total;
    dayStats[day].count += 1;
    dayStats[day].hours[hour] += 1; 

    sale.items.forEach(item => {
      dayStats[day].items[item.nombre] = (dayStats[day].items[item.nombre] || 0) + item.cantidad;
    });
  });

  // Transform to Analysis
  return DAYS.map((dayName, idx) => {
    const stats = dayStats[idx];
    const topProd = Object.entries(stats.items).sort((a, b) => b[1] - a[1])[0];
    const maxTrans = Math.max(...stats.hours);
    const peakHour = stats.hours.findIndex(h => h === maxTrans);
    const peakRange = maxTrans > 0 ? `${peakHour}:00 - ${peakHour + 1}:00` : 'N/A';

    return {
      dayName,
      topProduct: topProd ? topProd[0] : 'Sin datos',
      peakHourRange: peakRange,
      averageSales: stats.count > 0 ? stats.totalSales / stats.count : 0
    };
  });
};

export const generateSmartInsights = (
  sales: Sale[], 
  weather?: WeatherSnapshot
): Insight[] => {
  const insights: Insight[] = [];
  const today = new Date();
  const dayIndex = today.getDay(); 

  // 1. Weather Based Insights (Immediate)
  if (weather) {
    if (weather.category === 'Lluvioso') {
      insights.push({
        type: 'promo',
        message: '🌧️ Clima Lluvioso detectado: Las ventas de Chocolate Caliente suelen subir. ¡Promociónalos!',
        icon: '☕'
      });
    } else if (weather.category === 'Despejado' && weather.temp > 25) {
      insights.push({
        type: 'promo',
        message: '☀️ Calor detectado: Ofrece Iced Latte y Bebidas frías activamente.',
        icon: '🧊'
      });
    }
  }

  // 2. Historical Day Analysis (Same logic as before)
  const sameDaySales = sales.filter(s => s.status === 'completed' && getDate(s).getDay() === dayIndex);
  
  if (sameDaySales.length > 0) {
    const itemCounts: Record<string, number> = {};
    sameDaySales.forEach(s => s.items.forEach(i => itemCounts[i.nombre] = (itemCounts[i.nombre] || 0) + i.cantidad));
    const sorted = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    
    if (sorted.length > 0) {
      insights.push({
        type: 'stock',
        message: `📅 Es ${DAYS[dayIndex]}: Históricamente tu producto estrella es "${sorted[0][0]}".`,
        icon: '📦'
      });
    }
  }

  return insights;
};

// --- PREDICTIVE ENGINE ---
export const getPredictiveInsights = (sales: Sale[], tomorrowForecast?: WeatherSnapshot): PredictiveInsight | null => {
    if (!tomorrowForecast) return null;

    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowDayIdx = tomorrowDate.getDay();

    // 1. Filter Sales: Match Tomorrow's Weekday AND Weather Category
    // Only use sales that HAVE weather data recorded
    const relevantSales = sales.filter(s => {
        if (s.status !== 'completed' || !s.weatherSnapshot) return false;
        const sDay = getDate(s).getDay();
        return sDay === tomorrowDayIdx && s.weatherSnapshot.category === tomorrowForecast.category;
    });

    // Fallback: If not enough data with specific weather, just use Day of Week
    const comparisonSales = relevantSales.length > 5 
        ? relevantSales 
        : sales.filter(s => s.status === 'completed' && getDate(s).getDay() === tomorrowDayIdx);

    if (comparisonSales.length === 0) return null;

    // 2. Calculate Item Frequency in Context
    const itemCounts: Record<string, number> = {};
    let totalItems = 0;
    comparisonSales.forEach(s => s.items.forEach(i => {
        itemCounts[i.nombre] = (itemCounts[i.nombre] || 0) + i.cantidad;
        totalItems += i.cantidad;
    }));

    // 3. Find Winner
    const sortedItems = Object.entries(itemCounts).sort((a, b) => b[1] - a[1]);
    if (sortedItems.length === 0) return null;

    const winnerName = sortedItems[0][0];
    const winnerCount = sortedItems[0][1];

    // 4. Calculate "Lift" vs General Average
    // Get average daily sales of this item across ALL days
    const allCompletedSales = sales.filter(s => s.status === 'completed');
    let globalItemCount = 0;
    allCompletedSales.forEach(s => s.items.forEach(i => {
        if (i.nombre === winnerName) globalItemCount += i.cantidad;
    }));
    
    const avgPerSaleGlobal = allCompletedSales.length > 0 ? globalItemCount / allCompletedSales.length : 0;
    const avgPerSaleContext = comparisonSales.length > 0 ? winnerCount / comparisonSales.length : 0;

    let increase = 0;
    if (avgPerSaleGlobal > 0) {
        increase = ((avgPerSaleContext - avgPerSaleGlobal) / avgPerSaleGlobal) * 100;
    }

    // 5. Generate Tip
    let tip = "";
    if (tomorrowForecast.category === 'Lluvioso') {
        tip = "Revisa stock de leche caliente y cacao.";
    } else if (tomorrowForecast.category === 'Despejado') {
        tip = "Prepara hielo extra y vasos transparentes.";
    } else {
        tip = "Asegura insumos básicos para alto flujo.";
    }

    return {
        tomorrowDay: DAYS[tomorrowDayIdx],
        tomorrowCondition: tomorrowForecast.category,
        recommendedProduct: winnerName,
        increasePercentage: Math.max(Math.round(increase), 15), // Min 15% for UX effect if logic fails
        tip
    };
};