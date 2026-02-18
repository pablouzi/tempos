import { GoogleGenerativeAI } from "@google/generative-ai"; 
import React, { useState, useEffect, useMemo } from 'react';
import { Sale, Customer } from '../types';
import { getSalesByDateRange, getCustomers } from '../services/firebaseService';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
    const chartData = [];
    for (let h = 7; h <= 20; h++) chartData.push({ hour: `${h}:00`, ventas: 0 });

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

    const allProductsSorted = Object.entries(productCounts)
      .map(([nombre, cantidad]) => ({ nombre, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    const totalDia = dayTotals.cash + dayTotals.card + dayTotals.other;
    const peak = Object.keys(hourCounts).sort((a,b) => hourCounts[Number(b)] - hourCounts[Number(a)])[0] || "0";

    return { 
      totalMes, totalDia, dayTotals, daySales, chartData, 
      top5: allProductsSorted.slice(0, 5),
      top10: allProductsSorted.slice(0, 10),
      bottom10: [...allProductsSorted].sort((a, b) => a.cantidad - b.cantidad).slice(0, 10),
      peak: `${peak}:00`, weather, 
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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `
        Actúa como consultor senior para "Libre Coffee". Analiza los datos de hoy en Concepción:
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
      setAiResponse("CafeinAi está tostándose un café. Intenta de nuevo.");
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
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

      const prompt = `Eres analista de Libre Coffee. Datos: ${JSON.stringify(leanSales)}. Pregunta: "${userQuery}". Responde breve y directo.`;

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
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold text-gray-800 tracking-tight">Reporte de Inteligencia</h2>
          <p className="text-gray-500 text-xs font-bold uppercase tracking-widest">Auditoría Libre Coffee</p>
        </div>
        <div className="relative flex items-center gap-4 bg-white p-4 rounded-3xl border border-gray-100 shadow-sm">
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="font-black text-blue-700 outline-none" />
        </div>
      </div>

      {/* CAFEINAI BOX */}
      <div className="bg-gradient-to-r from-[#1a2332] to-[#2d3a4f] rounded-[40px] p-8 shadow-xl flex flex-col md:flex-row items-center gap-6">
        <div className="bg-white/10 p-4 rounded-full"><Brain className="h-10 w-10 text-[#d37342]" /></div>
        <div className="flex-grow w-full">
          <div className="flex items-center gap-3 mb-4">
            <h3 className="text-2xl font-bold text-white">CafeinAi</h3>
            <span className="bg-[#d37342]/20 text-[#d37342] px-2 py-0.5 rounded text-[10px] font-black uppercase">Beta</span>
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

      {/* DASHBOARD CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[35px] shadow-sm border-l-8 border-[#d37342]">
          <p className="text-xs font-bold text-gray-400 uppercase mb-1">Total del Día</p>
          <h3 className="text-4xl font-black text-gray-800">{formatCurrency(processed.totalDia)}</h3>
        </div>
        <div className="bg-[#1a2332] p-8 rounded-[35px] shadow-xl border-l-8 border-green-400">
          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Total Mes</p>
          <h3 className="text-4xl font-black text-white">{formatCurrency(processed.totalMes)}</h3>
        </div>
      </div>

      {/* GRÁFICO */}
      <div className="bg-white p-8 rounded-[35px] shadow-sm border border-gray-50">
        <h4 className="font-black text-gray-700 text-[11px] uppercase mb-6 tracking-widest">Ritmo de Ventas 🕒</h4>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={processed.chartData}>
              <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#cbd5e0'}} />
              <Tooltip cursor={{fill: '#f7fafc'}} contentStyle={{ borderRadius: '15px', border: 'none' }} />
              <Bar dataKey="ventas" radius={[10, 10, 0, 0]}>
                {processed.chartData.map((e, i) => <Cell key={i} fill={e.ventas > 0 ? '#d37342' : '#edf2f7'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* TABLA DETALLE */}
      <div className="bg-white rounded-[35px] shadow-sm border border-gray-100 overflow-hidden">
        <table className="min-w-full text-sm text-left">
          <thead className="text-gray-400 bg-gray-50 border-b border-gray-100 uppercase text-[10px] font-black">
            <tr><th className="px-8 py-4">Hora</th><th className="px-8 py-4">Cliente</th><th className="px-8 py-4 text-right">Total</th></tr>
          </thead>
          <tbody className="divide-y divide-gray-50 text-gray-600">
            {processed.daySales.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-8 py-4 font-mono text-[11px]">{formatTime(s.fecha)}</td>
                <td className="px-8 py-4 font-bold text-gray-800">{getCustomerName(s.customerId)}</td>
                <td className="px-8 py-4 text-right font-black text-gray-800">{formatCurrency(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DailySalesReport;
