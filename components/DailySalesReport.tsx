import { GoogleGenerativeAI } from "@google/generative-ai"; // <-- ESTA ES LA CLAVE
// Borra esto después de arreglarlo
console.log("¿La llave existe?:", !!import.meta.env.VITE_API_KEY);
import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Customer } from '../types';
import { getSalesByDateRange, getCustomers } from '../services/firebaseService';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
//import { GoogleGenAI } from "@google/genai";
import { Brain, Sparkles, Loader, Send, Search, ChevronDown, ChevronUp, TrendingUp, TrendingDown } from 'lucide-react';

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

  // Cargar contador de uso al cambiar fecha
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

  // 2. CÁLCULOS (Día, Mes e Inteligencia de Productos)
  const processed = useMemo(() => {
    const validSales = sales.filter(s => s.status === 'completed');
    
    const totalMes = validSales.reduce((acc, s) => acc + s.total, 0);

    const daySales = validSales.filter(s => {
      const d = s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha);
      return d.toISOString().split('T')[0] === selectedDate;
    });

    const hourCounts: Record<number, number> = {};
    const productCounts: Record<string, number> = {};
    const chartData = [];
    for (let h = 7; h <= 20; h++) chartData.push({ hour: `${h}:00`, ventas: 0 });

    let weather = { condition: 'Despejado', temp: 21.6 };

    const dayTotals = daySales.reduce((acc, sale) => {
      const m = sale.paymentMethod || 'otro';
      if (m === 'efectivo') acc.cash += sale.total;
      else if (m === 'tarjeta') acc.card += sale.total;
      else acc.other += sale.total;

      // Conteo de productos del día
      sale.items?.forEach((item: any) => {
        productCounts[item.nombre] = (productCounts[item.nombre] || 0) + (item.cantidad || 0);
      });

      if (sale.fecha) {
        const d = sale.fecha.toDate ? sale.fecha.toDate() : new Date(sale.fecha);
        const h = d.getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
        if (h >= 7 && h <= 20) chartData[h - 7].ventas += 1;
      }

      if (sale.weatherSnapshot) {
        weather = { 
          condition: sale.weatherSnapshot.condition || weather.condition, 
          temp: sale.weatherSnapshot.temp || weather.temp 
        };
      }
      return acc;
    }, { cash: 0, card: 0, other: 0 });

    // Arrays de Productos
    const allProductsSorted = Object.entries(productCounts)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // Top 5 (Para tarjeta dashboard)
    const top5 = allProductsSorted.slice(0, 5);

    // Top 10 (Para acordeón)
    const top10 = allProductsSorted.slice(0, 10);

    // Bottom 10 (Menos vendidos de los que se vendieron hoy)
    // Se invierte el array para mostrar primero los de menos ventas (1, 2, etc.)
    const bottom10 = [...allProductsSorted].sort((a, b) => a.cantidad - b.cantidad).slice(0, 10);

    const totalDia = dayTotals.cash + dayTotals.card + dayTotals.other;
    const peak = Object.keys(hourCounts).sort((a,b) => hourCounts[Number(b)] - hourCounts[Number(a)])[0] || "0";

    return { 
      totalMes, 
      totalDia, 
      dayTotals, 
      daySales, 
      chartData, 
      top5,
      top10,
      bottom10, 
      peak: `${peak}:00`, 
      weather, 
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
      Actúa como consultor senior de negocios para la cafetería "Libre Coffee". 
        Analiza los datos de hoy en Concepción:
        - Clima: ${processed.weather.condition} con ${processed.weather.temp}°C.
        - Ticket Promedio: ${formatCurrency(processed.ticket)}.
        - Top 5 Productos: ${processed.top5.map(p => `${p.nombre} (${p.cantidad}un)`).join(', ')}.

        TAREA:
        1. Identifica si la temperatura de ${processed.weather.temp}°C influyó en la preferencia de bebidas.
        2. Relaciona el flujo peak (${processed.peak}) con el clima.
        3. Dame una recomendación táctica para mañana.
        
        REGLA: Máximo 3 líneas de texto plano.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt
      });
      setAiResponse(response.text || "No se pudo generar el análisis.");
      incrementAiUsage();
    } catch (error) {
      console.error("Gemini Error:", error);
      setAiResponse("CafeinAi está tostándose un café. Intenta de nuevo.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // 4. PREGUNTA A CAFEINAI (Custom Query)
  const askCafeinAi = async () => {
    if (!userQuery.trim()) return analyzeWithIA(); // Si está vacío, usa el reporte standard
    if (!process.env.API_KEY) return;

    setIsAnalyzing(true);
    setAiResponse("");

    try {
        // 1. Preparar "Lean Data" para ahorrar tokens
        const leanSales = sales.map(s => {
            const dateObj = s.fecha.toDate ? s.fecha.toDate() : new Date(s.fecha);
            return {
                fecha: dateObj.toLocaleString('es-CL'), // Fecha y Hora
                total: s.total,
                items: s.items.map(i => i.nombre),
                metodo: s.paymentMethod,
                clima: s.weatherSnapshot ? `${s.weatherSnapshot.condition} (${s.weatherSnapshot.temp}°C)` : 'Sin datos'
            };
        });

        const leanDataStr = JSON.stringify(leanSales);
        
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `
            Eres el analista de Libre Coffee. Tienes acceso a este listado de ventas del mes, el cual incluye fecha, items, total y el CLIMA registrado al momento de la venta: 
            ${leanDataStr}
            
            El usuario pregunta: "${userQuery}".
            
            Responde de forma precisa basándote solo en los datos provistos. Si preguntan por fechas específicas, comparaciones o el clima de un día, búscalo en el listado.
            Sé breve y directo.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt
        });

        setAiResponse(response.text || "Sin respuesta.");
        incrementAiUsage();

    } catch (error) {
        console.error("Gemini Chat Error:", error);
        setAiResponse("CafeinAi tuvo un error al procesar tu pregunta específica.");
    } finally {
        setIsAnalyzing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isAnalyzing) {
        askCafeinAi();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in font-Montserrat">

    {/* HEADER Y SELECTOR DE FECHA */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Reporte de Inteligencia</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Auditoría y análisis de flujo diario</p>
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

     {/* SECCIÓN IA: CAFEINAI BRAIN */}
      <div className="bg-gradient-to-r from-[#1a2332] to-[#2d3a4f] rounded-[40px] p-8 shadow-xl flex flex-col md:flex-row items-start md:items-center gap-6 relative overflow-hidden">
         {/* Decoration */}
         <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
         
         {/* Icon */}
         <div className="bg-white/10 p-4 rounded-full flex-shrink-0 backdrop-blur-sm z-10 hidden md:block">
            <Brain className="h-10 w-10 text-brand-orange" />
         </div>

         <div className="flex-grow z-10 w-full md:mr-4">
            <div className="flex flex-col mb-4">
                <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-2xl font-bold text-white">CafeinAi</h3>
                    <span className="bg-brand-orange/20 text-brand-orange px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border border-brand-orange/30">Beta</span>
                </div>
                
                {/* Usage Bar */}
                <div className="max-w-xs w-full">
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-mono mb-1">
                        <span>Consultas usadas: {aiUsageCount} / 1500</span>
                    </div>
                    <div className="h-1 w-full bg-gray-700/50 rounded-full overflow-hidden">
                        <div 
                            className={`h-full rounded-full transition-all duration-500 ${aiUsageCount > 1400 ? 'bg-red-500' : 'bg-[#d37342]'}`}
                            style={{ width: `${Math.min((aiUsageCount / 1500) * 100, 100)}%` }}
                        ></div>
                    </div>
                </div>
            </div>
            
            {/* INPUT FIELD O RESPUESTA */}
            <div className="space-y-4">
                <div className="relative w-full">
                    <input 
                        type="text" 
                        value={userQuery}
                        onChange={(e) => setUserQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder='Pregunta algo... Ej: "¿Qué día vendí más Espressos?"'
                        className="w-full bg-white/10 border border-white/20 rounded-full py-3 px-5 pr-12 text-white placeholder-white/50 focus:outline-none focus:border-brand-orange focus:bg-white/20 transition-all text-sm backdrop-blur-sm"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2">
                        {isAnalyzing ? (
                             <Loader className="animate-spin text-brand-orange h-5 w-5" />
                        ) : (
                             <Search className="text-white/40 h-4 w-4" />
                        )}
                    </div>
                </div>

                {aiResponse && (
                  <div className="bg-white/10 p-5 rounded-2xl border border-white/10 text-gray-200 text-sm leading-relaxed animate-fade-in shadow-inner">
                      {aiResponse}
                  </div>
                )}
            </div>
         </div>

         <button
            onClick={askCafeinAi}
            disabled={isAnalyzing}
            className="bg-brand-orange hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-full shadow-lg transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap z-10 disabled:opacity-50 disabled:cursor-not-allowed h-12 self-end md:self-center"
         >
            {isAnalyzing ? <Loader className="animate-spin h-5 w-5" /> : (userQuery ? <Send className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />)}
            {userQuery ? 'ENVIAR' : 'GENERAR REPORTE'}
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

      {/* GRÁFICO (Top 5 card removed) */}
      <div className="w-full bg-white p-8 rounded-[35px] shadow-sm border border-gray-50">
          <h4 className="font-black text-gray-700 text-[11px] uppercase mb-6 tracking-widest">Ritmo de Ventas (7am - 8pm) 🕒</h4>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processed.chartData}>
                <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#cbd5e0'}} />
                <Tooltip cursor={{fill: '#f7fafc'}} contentStyle={{ borderRadius: '15px', border: 'none', boxShadow: '0 10px 15px rgba(0,0,0,0.1)' }} />
                <Bar dataKey="ventas" radius={[10, 10, 0, 0]}>
                  {processed.chartData.map((e, i) => <Cell key={i} fill={e.ventas > 0 ? '#d37342' : '#edf2f7'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
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

     

      {/* TABLA DE DETALLE */}
      <div className="bg-white rounded-[35px] shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-8 py-5 border-b border-gray-50 bg-gray-50/50">
          <h3 className="font-bold text-gray-700 uppercase text-xs tracking-widest">Listado de Operaciones</h3>
        </div>
        <div className="overflow-x-auto">
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
    </div>
  );
};

export default DailySalesReport;
