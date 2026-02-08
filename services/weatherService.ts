// Service to fetch weather data from Open-Meteo (Free, No Key required)
import { WeatherSnapshot } from '../types';

// Helper: Map WMO code to Business Category
export const getWeatherCategory = (code: number): 'Lluvioso' | 'Nublado' | 'Despejado' | 'Normal' => {
  // 0: Clear sky
  if (code === 0) return 'Despejado';
  
  // 1, 2, 3: Mainly clear, partly cloudy, and overcast
  // 45, 48: Fog
  if ((code >= 1 && code <= 3) || code === 45 || code === 48) return 'Nublado';
  
  // 51-99: Drizzle, Rain, Snow, Thunderstorm
  if (code >= 51 && code <= 99) return 'Lluvioso';
  
  return 'Normal';
};

const getWeatherLabel = (code: number): string => {
  if (code === 0) return 'Soleado'; 
  if (code >= 1 && code <= 3) return 'Nublado'; 
  if (code >= 45 && code <= 48) return 'Niebla'; 
  if (code >= 51 && code <= 67) return 'Lluvia Ligera'; 
  if (code >= 71 && code <= 77) return 'Nieve'; 
  if (code >= 80 && code <= 82) return 'Lluvia Fuerte'; 
  if (code >= 95 && code <= 99) return 'Tormenta'; 
  return 'Normal';
};

export const getWeatherIcon = (category: string): string => {
  switch (category) {
    case 'Despejado': return '☀️';
    case 'Nublado': return '☁️';
    case 'Lluvioso': return '🌧️';
    default: return '🌤️';
  }
};

export const getCurrentWeather = async (): Promise<WeatherSnapshot | undefined> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      console.warn("Geolocation not supported");
      resolve(undefined);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Open-Meteo API call for current weather
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
          );
          const data = await response.json();
          
          if (data && data.current_weather) {
            const wmoCode = data.current_weather.weathercode;
            resolve({
              temp: data.current_weather.temperature,
              code: wmoCode,
              condition: getWeatherLabel(wmoCode),
              category: getWeatherCategory(wmoCode)
            });
          } else {
            resolve(undefined);
          }
        } catch (error) {
          console.error("Error fetching weather:", error);
          resolve(undefined);
        }
      },
      (error) => {
        console.warn("Geolocation permission denied or error:", error);
        resolve(undefined);
      }
    );
  });
};

export const getTomorrowForecast = async (): Promise<WeatherSnapshot | undefined> => {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(undefined);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          // Open-Meteo API call for Daily Forecast
          // timezone=auto is crucial for correct "tomorrow" calculation
          const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=weathercode,temperature_2m_max&timezone=auto`
          );
          const data = await response.json();
          
          if (data && data.daily && data.daily.weathercode && data.daily.weathercode.length > 1) {
            // Index 0 is today, Index 1 is tomorrow
            const wmoCode = data.daily.weathercode[1];
            const maxTemp = data.daily.temperature_2m_max[1];
            
            resolve({
              temp: maxTemp, // Using max temp for forecast
              code: wmoCode,
              condition: getWeatherLabel(wmoCode),
              category: getWeatherCategory(wmoCode)
            });
          } else {
            resolve(undefined);
          }
        } catch (error) {
          console.error("Error fetching forecast:", error);
          resolve(undefined);
        }
      },
      () => resolve(undefined)
    );
  });
};