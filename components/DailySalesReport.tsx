import { GoogleGenerativeAI } from "@google/generative-ai";
import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Customer } from '../types';
import { getSalesByDateRange, getCustomers } from '../services/firebaseService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Brain, Sparkles, Loader, Send, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';
import logoTempos from '../src/ico-tempos.png';

// 1. HELPERS
const formatCurrency = (val: number) =>
  new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val);

const formatTime = (timestamp: any) => {
  if (!timestamp) return '-';
  const d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
};

const DailySalesReport: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  // Estados para IA
  const [aiResponse, setAiResponse] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [userQuery, setUserQuery] = useState<string>('');

  // Estados para Cuota Local
  const [aiUsageCount, setAiUsageCount] = useState<number>(0);

  // Estados para Acordeones
  const [showTop10, setShowTop10] = useState(true);
  const [showBottom10, setShowBottom10] = useState(true);

  // Log de diagnóstico
  console.log("¿La llave existe?:", !!import.meta.env.VITE_API_KEY);

  // Cargar contador de uso
  useEffect(() => {
    const savedUsage = localStorage.getItem(`ai_usage_${selectedDate}`);
    setAiUsageCount(savedUsage ? parseInt(savedUsage, 10) : 0);
  }, [selectedDate]);

  const incrementAiUsage = () => {
    const newCount = aiUsageCount + 1;
    setAiUsageCount(newCount);
    localStorage.setItem(`ai_usage_${selectedDate}`, newCount.toString());
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [year, month] = selectedDate.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1, 0, 0, 0, 0);
      const endDate = new Date(year, month, 0, 23, 59, 59, 999);

      const salesData = await getSalesByDateRange(startDate, endDate);
      const customersData = await getCustomers();

      setSales(salesData);
      setCustomers(customersData);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [selectedDate]);

  // 2. CÁLCULOS
  const processed = useMemo(() => {
    const validSales = sales.filter(s => s.status === 'completed');
    const totalMes = validSales.reduce((acc, s) => acc + s.total, 0);

    const daySales = validSales.filter(s => {
      const d = s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha);
      return d.toISOString().split('T')[0] === selectedDate;
    });

    const hourCounts: Record<number, number> = {};
    const productCounts: Record<string, number> = {};
    const chartData: any[] = [];
    for (let h = 7; h <= 20; h++) chartData.push({ hour: `${h}:00`, ventas: 0, ingresos: 0, isPeak: false });

    let weather = { condition: 'Despejado', temp: 21.6 };

    const dayTotals = daySales.reduce((acc, sale) => {
      const m = sale.paymentMethod || 'otro';
      if (m === 'efectivo') acc.cash += sale.total;
      else if (m === 'tarjeta') acc.card += sale.total;
      else acc.other += sale.total;

      sale.items?.forEach((item: any) => {
        productCounts[item.nombre] = (productCounts[item.nombre] || 0) + (item.cantidad || 0);
      });

      if (sale.fecha) {
        const d = sale.fecha.toDate ? sale.fecha.toDate() : new Date(sale.fecha);
        const h = d.getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
        if (h >= 7 && h <= 20) {
          chartData[h - 7].ventas += 1;
          chartData[h - 7].ingresos += sale.total;
        }
      }

      if (sale.weatherSnapshot) {
        weather = {
          condition: sale.weatherSnapshot.condition || weather.condition,
          temp: sale.weatherSnapshot.temp || weather.temp
        };
      }
      return acc;
    }, { cash: 0, card: 0, other: 0 });

    const allProductsSorted = Object.entries(productCounts)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const totalDia = dayTotals.cash + dayTotals.card + dayTotals.other;
    const peakHourInt = Object.keys(hourCounts).length > 0 ? Number(Object.keys(hourCounts).sort((a, b) => hourCounts[Number(b)] - hourCounts[Number(a)])[0]) : 0;
    const peak = peakHourInt > 0 ? `${peakHourInt}:00` : "0:00";
    if (peakHourInt >= 7 && peakHourInt <= 20) {
      chartData[peakHourInt - 7].isPeak = true;
    }

    return {
      totalMes, totalDia, dayTotals, daySales, chartData,
      top5: allProductsSorted.slice(0, 5),
      top10: allProductsSorted.slice(0, 10),
      bottom10: [...allProductsSorted].sort((a, b) => a.cantidad - b.cantidad).slice(0, 10),
      peak: `${peak}`, weather,
      ticket: daySales.length > 0 ? totalDia / daySales.length : 0
    };
  }, [sales, selectedDate]);

  const getCustomerName = (id?: string) => {
    const c = customers.find(cust => cust.id === id);
    return c ? c.name : 'Anónimo';
  };
  // 3. ANÁLISIS IA (Standard Report)
  const analyzeWithIA = async () => {
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) {
      setAiResponse("⚠️ API Key no configurada.");
      return;
    }

    setIsAnalyzing(true);
    setAiResponse("");

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const prompt = `
       Hoy es ${new Date().toLocaleDateString('es-CL')}.
        Actúa como consultor senior para "TEMPOS". Analiza los datos de hoy en Concepción:
        - Clima: ${processed.weather.condition} con ${processed.weather.temp}°C.
        - Ticket Promedio: ${formatCurrency(processed.ticket)}.
        - Top 5 Productos: ${processed.top5.map(p => `${p.nombre} (${p.cantidad}un)`).join(', ')}.
        TAREA: 
        1. ¿Influyó el clima en las bebidas?
        2. Relaciona el flujo peak (${processed.peak}) con el clima.
        3. Recomendación táctica para mañana.
        REGLA: Máximo 3 líneas de texto plano.
      `;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setAiResponse(response.text());
      incrementAiUsage();
    } catch (error) {
      console.error("Error IA:", error);
      setAiResponse("CAFEINAi está tostándose un café. Intenta de nuevo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 4. PREGUNTA A CAFEINAI (Custom Query)
  const askCafeinAi = async () => {
    if (!userQuery.trim()) return analyzeWithIA();
    const apiKey = import.meta.env.VITE_API_KEY;
    if (!apiKey) return;

    setIsAnalyzing(true);
    setAiResponse("");

    try {
      const leanSales = sales.slice(-20).map(s => ({
        f: s.fecha.toDate ? s.fecha.toDate().toLocaleDateString() : '?',
        t: s.total,
        i: s.items.map(item => item.nombre).join(','),
        c: s.weatherSnapshot ? s.weatherSnapshot.condition : '?'
      }));

      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

      const prompt = `Eres analista de TEMPOS. Datos: ${JSON.stringify(leanSales)}. Pregunta: "${userQuery}". Responde breve y directo.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      setAiResponse(response.text());
      incrementAiUsage();
    } catch (error) {
      console.error("Chat Error:", error);
      setAiResponse("CafeinAi tuvo un error al procesar tu pregunta.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in font-Montserrat">
      {/* HEADER */}
      {/* HEADER Y SELECTOR DE FECHA */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Reporte de Ventas</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Análisis Inteligente</p>
        </div>

        <div className="relative flex items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm hover:border-blue-200 transition-all cursor-pointer">
          <div className="flex items-center gap-3 pointer-events-none">
            <span className="text-xl">📅</span>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Fecha Auditoría</span>
              <span className="text-blue-700 font-black text-sm">{selectedDate.split('-').reverse().join(' / ')}</span>
            </div>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>
      </div>

      {/* CAFEINAI BOX */}
      <div className="bg-gradient-to-r from-[#1a2332] to-[#2d3a4f] rounded-[40px] p-8 shadow-xl flex flex-col md:flex-row items-center gap-6">
        <div className="flex items-center justify-center py-4">
          <img
            src={logoTempos}
            alt="TEMPOS"
            className="h-40 w-auto object-contain" /* Un tamaño más discreto para el menú */
          />
        </div>
        <div className="flex-grow w-full">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-2xl font-bold text-white">CAFEINAi</h3>
            <span className="bg-[#d37342]/20 text-[#d37342] px-2 py-0.5 rounded text-[10px] font-black uppercase">Asistente</span>
          </div>
          <input
            type="text" value={userQuery} onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && askCafeinAi()}
            placeholder='Pregunta algo... Ej: "¿Qué vendí más hoy?"'
            className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-5 text-white placeholder-white/50 focus:outline-none focus:border-[#d37342]"
          />
          {aiResponse && <div className="mt-4 bg-white/10 p-5 rounded-2xl text-gray-200 text-sm animate-fade-in">{aiResponse}</div>}
        </div>
        <button onClick={askCafeinAi} disabled={isAnalyzing} className="bg-[#d37342] hover:bg-orange-600 text-white font-bold py-3 px-8 rounded-full shadow-lg disabled:opacity-50">
          {isAnalyzing ? <Loader className="animate-spin h-5 w-5" /> : (userQuery ? <Send className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />)}
        </button>
      </div>

      {/* TARJETAS DE TOTALES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[35px] shadow-sm border-l-8 border-brand-orange flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Total del Día</p>
            <h3 className="text-4xl font-black text-gray-800">{formatCurrency(processed.totalDia)}</h3>
          </div>
          <div className="text-4xl">💰</div>
        </div>
        <div className="bg-[#1a2332] p-8 rounded-[35px] shadow-xl border-l-8 border-green-400 flex justify-between items-center">
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total Acumulado Mes</p>
            <h3 className="text-4xl font-black text-white">{formatCurrency(processed.totalMes)}</h3>
          </div>
          <div className="text-4xl">📈</div>
        </div>
      </div>
      {/* KPIs Y SMART INSIGHTS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-[25px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase">Efectivo Hoy</p>
          <h3 className="text-xl font-bold text-green-600">{formatCurrency(processed.dayTotals.cash)}</h3>
        </div>
        <div className="bg-white p-6 rounded-[25px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase">Tarjeta Hoy</p>
          <h3 className="text-xl font-bold text-blue-600">{formatCurrency(processed.dayTotals.card)}</h3>
        </div>
        <div className="bg-white p-6 rounded-[25px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase">Ticket Prom.</p>
          <h3 className="text-xl font-bold text-gray-800">{formatCurrency(processed.ticket)}</h3>
        </div>
        <div className="bg-white p-6 rounded-[25px] shadow-sm border border-gray-100">
          <p className="text-[10px] font-black text-gray-400 uppercase">Hora Peak / Clima</p>
          <h3 className="text-xl font-bold text-gray-800">{processed.peak}</h3>
          <span className="text-[10px] text-blue-400 font-bold uppercase">{processed.weather.condition} ({processed.weather.temp}°C)</span>
        </div>
      </div>
      {/* GRÁFICO */}
      <div className="bg-white p-8 rounded-[35px] shadow-sm border border-gray-50">
        <h4 className="font-black text-gray-700 text-[11px] uppercase mb-6 tracking-widest flex items-center justify-between">
          <span>Ritmo de Ventas 🕒</span>
          <span className="text-gray-400 text-[9px]">Ingresos vs Cantidad de Transacciones</span>
        </h4>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processed.chartData} margin={{ top: 20, right: 0, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorVentas" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d37342" stopOpacity={0.9} />
                  <stop offset="95%" stopColor="#d37342" stopOpacity={0.3} />
                </linearGradient>
                <linearGradient id="colorPeak" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={1} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0.4} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f4f8" />
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold', fill: '#cbd5e0' }} dy={10} />
              <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e0' }} tickFormatter={(value) => `$${value / 1000}k`} />
              <Tooltip
                cursor={{ fill: '#f7fafc' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    return (
                      <div className="bg-[#1a2332] text-white p-4 rounded-3xl shadow-xl border border-gray-700">
                        <p className="font-bold text-lg mb-2 flex items-center justify-between gap-4">
                          <span>🕒 {data.hour}</span>
                          {data.isPeak && <span className="text-yellow-900 font-black text-[10px] uppercase tracking-widest bg-yellow-400 px-2 py-1 rounded-full">PEAK</span>}
                        </p>
                        <div className="space-y-1">
                          <p className="text-sm text-gray-300">🛍️ Transacciones: <span className="font-bold text-white">{data.ventas}</span></p>
                          <p className="text-sm text-gray-300">💳 Ingresos: <span className="font-bold text-green-400">{formatCurrency(data.ingresos)}</span></p>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar yAxisId="left" dataKey="ingresos" radius={[12, 12, 0, 0]}>
                {processed.chartData.map((e, i) => (
                  <Cell key={i} fill={e.isPeak ? "url(#colorPeak)" : (e.ingresos > 0 ? "url(#colorVentas)" : '#edf2f7')} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* CONSEJOS AUTOMÁTICOS DE INVENTARIO */}
      <div className="bg-[#f8fafc] rounded-[35px] p-8 shadow-sm border border-blue-50">
        <h3 className="font-black text-gray-700 text-sm uppercase tracking-widest mb-4 flex items-center gap-2">
          💡 Acciones Recomendadas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex gap-4 items-start bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <span className="bg-green-100 p-3 rounded-full flex items-center justify-center text-green-600">🚀</span>
            <p className="text-sm text-gray-600">
              {processed.top10.length > 0 ? (
                <>Tu producto estrella hoy es el <b>{processed.top10[0].nombre}</b> ({processed.top10[0].cantidad} unidades). Asegura tu stock para mañana o crea una promoción (combo) con este producto para arrastrar ventas de otros artículos de menor salida.</>
              ) : (
                <>Aún no hay suficientes ventas para destacar un producto estrella hoy.</>
              )}
            </p>
          </div>
          <div className="flex gap-4 items-start bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
            <span className="bg-red-100 p-3 rounded-full flex items-center justify-center text-red-500">⚠️</span>
            <p className="text-sm text-gray-600">
              {processed.bottom10.length > 0 ? (
                <><b>{processed.bottom10[0].nombre}</b> ha tenido muy bajo movimiento ({processed.bottom10[0].cantidad} un.). Si es perecible, considera una venta flash de última hora para evitar mermas o revisa si su exhibición es la adecuada.</>
              ) : (
                <>Tus productos con menor rotación aparecerán aquí para que puedas tomar acción.</>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* SECCIÓN ACORDEONES: TOP 10 MEJORES Y PEORES */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Top 10 Mejores */}
        <div className="bg-white rounded-[35px] shadow-sm border border-gray-50 overflow-hidden">
          <button
            onClick={() => setShowTop10(!showTop10)}
            className="w-full px-8 py-6 flex justify-between items-center bg-green-50/50 hover:bg-green-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-green-100 p-2 rounded-full text-green-600">
                <TrendingUp size={20} />
              </div>
              <h4 className="font-black text-gray-700 text-sm uppercase tracking-widest">Top 10 Mejores Ventas</h4>
            </div>
            <div className="text-gray-400">
              {showTop10 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {showTop10 && (
            <div className="px-8 pb-8 pt-2 animate-fade-in">
              <div className="space-y-3">
                {processed.top10.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-xs">Sin datos hoy.</div>
                ) : (
                  processed.top10.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className={`text-xs font-black w-5 h-5 flex items-center justify-center rounded-full ${idx < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-700">{item.nombre}</span>
                      </div>
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">{item.cantidad} un.</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top 10 Peores */}
        <div className="bg-white rounded-[35px] shadow-sm border border-gray-50 overflow-hidden">
          <button
            onClick={() => setShowBottom10(!showBottom10)}
            className="w-full px-8 py-6 flex justify-between items-center bg-red-50/30 hover:bg-red-50/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2 rounded-full text-red-500">
                <TrendingDown size={20} />
              </div>
              <h4 className="font-black text-gray-700 text-sm uppercase tracking-widest">Top 10 Menos Vendidos</h4>
            </div>
            <div className="text-gray-400">
              {showBottom10 ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
            </div>
          </button>

          {showBottom10 && (
            <div className="px-8 pb-8 pt-2 animate-fade-in">
              <div className="space-y-3">
                {processed.bottom10.length === 0 ? (
                  <div className="text-center py-4 text-gray-400 text-xs">Sin datos hoy.</div>
                ) : (
                  processed.bottom10.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center border-b border-gray-50 pb-2 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black w-5 h-5 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
                          {idx + 1}
                        </span>
                        <span className="text-sm font-medium text-gray-600">{item.nombre}</span>
                      </div>
                      <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded-full">{item.cantidad} un.</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

      </div>
      {/* TABLA DETALLE */}
      <div className="bg-white rounded-[35px] shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full text-sm text-left">
          <thead className="text-gray-400 bg-white border-b border-gray-100 uppercase text-[10px] font-black">
            <tr><th className="px-8 py-4">Hora</th><th className="px-8 py-4">Cliente</th><th className="px-8 py-4">Método</th><th className="px-8 py-4 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-600">
            {processed.daySales.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-4 font-mono text-[11px]">{formatTime(s.fecha)}</td>
                <td className="px-8 py-4 font-bold text-gray-800">{getCustomerName(s.customerId)}</td>
                <td className="px-8 py-4"><span className="text-[9px] font-black uppercase text-gray-400 border px-2 py-0.5 rounded-full">{s.items.map(i => i.nombre)}</span></td>
                <td className="px-8 py-4 text-right font-black text-gray-800">{formatCurrency(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && processed.daySales.length === 0 && <div className="p-16 text-center text-gray-300 font-bold uppercase text-xs">Sin ventas este día</div>}
      </div>
    </div>
  );
};

export default DailySalesReport;
