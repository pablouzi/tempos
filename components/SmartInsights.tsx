import React, { useEffect, useState } from 'react';
import { Sale, WeatherSnapshot } from '../types';
import { getSalesHistory } from '../services/firebaseService';
import { getCurrentWeather, getTomorrowForecast, getWeatherIcon } from '../services/weatherService';
import { generateSmartInsights, getPredictiveInsights } from '../services/biService';
import WeeklyTrends from './WeeklyTrends';

const SmartInsights: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const [currentWeather, setCurrentWeather] = useState<WeatherSnapshot | undefined>(undefined);
  const [tomorrowWeather, setTomorrowWeather] = useState<WeatherSnapshot | undefined>(undefined);

  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        const [salesData, weather, forecast] = await Promise.all([
          getSalesHistory(),
          getCurrentWeather(),
          getTomorrowForecast()
        ]);
        setSales(salesData);
        setCurrentWeather(weather);
        setTomorrowWeather(forecast);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-gray-500">
        <svg className="animate-spin h-8 w-8 text-coffee-600 mr-2" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        Analizando datos y clima...
      </div>
    );
  }

  // Basic Alerts
  const insights = generateSmartInsights(sales, currentWeather);

  // Predictive Analysis
  const prediction = getPredictiveInsights(sales, tomorrowWeather);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 animate-fade-in pb-20">

      {/* Header with Weather */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Title & Current Weather */}
        <div className="lg:col-span-2 flex flex-col md:flex-row justify-between items-center bg-gradient-to-r from-coffee-800 to-coffee-600 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
          <div className="z-10">
            <h2 className="text-3xl font-bold mb-2">Pronóstico Semanal </h2>
            <p className="opacity-90">Análisis de tus datos y clima para pronosticar tu semana.</p>
          </div>

          {currentWeather ? (
            <div className="flex items-center gap-4 bg-white/20 p-4 rounded-xl mt-4 md:mt-0 backdrop-blur-sm z-10">
              <span className="text-5xl">{getWeatherIcon(currentWeather.category)}</span>
              <div className="text-right">
                <p className="text-xs uppercase tracking-wider opacity-75">Ahora</p>
                <p className="text-3xl font-bold">{currentWeather.temp}°C</p>
                <p className="font-medium text-sm">{currentWeather.condition}</p>
              </div>
            </div>
          ) : (
            <div className="z-10 mt-4 text-xs opacity-75">GPS no activo</div>
          )}

          {/* Background Decoration */}
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white opacity-5 rounded-full z-0"></div>
        </div>

        {/* Tomorrow's Forecast & Recommendation Card */}
        <div className="bg-white rounded-2xl p-6 shadow-md border border-gray-100 flex flex-col justify-between relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-2 opacity-5 group-hover:opacity-10 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
          </div>

          {tomorrowWeather && prediction ? (
            <>
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pronóstico Mañana</p>
                  <h3 className="text-xl font-bold text-gray-800">{prediction.tomorrowDay}</h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl">{getWeatherIcon(tomorrowWeather.category)}</span>
                  <span className="block text-sm font-bold text-gray-600">{tomorrowWeather.temp}°C</span>
                </div>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm text-blue-900 mb-2">
                Se prevé clima <b>{prediction.tomorrowCondition.toLowerCase()}</b>.
                Históricamente, la venta de <b>{prediction.recommendedProduct}</b> sube un <b>{prediction.increasePercentage}%</b>.
              </div>

              <p className="text-xs text-gray-500 italic">
                💡 Sugerencia: {prediction.tip}
              </p>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-400 text-sm text-center">
              <p>Faltan datos históricos o clima para generar predicción.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommended Actions (Quick Alerts) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {insights.map((insight, idx) => (
          <div key={idx} className={`rounded-xl p-5 border-l-4 shadow-sm flex gap-4 items-start bg-white
            ${insight.type === 'promo' ? 'border-green-500' :
              insight.type === 'alert' ? 'border-orange-500' : 'border-blue-500'}`}>
            <div className="text-3xl bg-gray-50 p-2 rounded-lg">{insight.icon}</div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">
                {insight.type === 'promo' ? 'Oportunidad' :
                  insight.type === 'alert' ? 'Atención' : 'Gestión'}
              </p>
              <p className="text-gray-800 font-medium leading-snug">{insight.message}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Weekly Trends Component */}
      <WeeklyTrends sales={sales} />

    </div>
  );
};

export default SmartInsights;