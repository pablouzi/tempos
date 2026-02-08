import React from 'react';
import { useTheme } from '../context/ThemeContext';

interface ThemeSettingsProps {
  onClose: () => void;
}

const ThemeSettings: React.FC<ThemeSettingsProps> = ({ onClose }) => {
  const { settings, updateSettings, applyPreset } = useTheme();

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-gray-900/50 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      ></div>

      {/* Sidebar Panel */}
      <div className="relative w-full max-w-sm bg-white dark:bg-gray-900 h-full shadow-2xl p-6 overflow-y-auto animate-fade-in flex flex-col border-l dark:border-gray-800 transition-colors duration-300">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white">🎨 Estética Global</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-8 flex-grow">
          
          {/* 0. Dark Mode Toggle */}
          <section className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors duration-300">
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white">Modo Oscuro</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Reduce la fatiga visual.</p>
            </div>
            
            <button 
              onClick={() => updateSettings({ isDarkMode: !settings.isDarkMode })}
              className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none shadow-inner
              ${settings.isDarkMode ? 'bg-gray-700' : 'bg-blue-200'}`}
            >
              <span className={`inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition-transform flex items-center justify-center text-xs
                ${settings.isDarkMode ? 'translate-x-9' : 'translate-x-1'}`} 
              >
                {settings.isDarkMode ? '🌙' : '☀️'}
              </span>
            </button>
          </section>

          {/* 1. Presets */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Presets Rápidos</h3>
            <div className="grid grid-cols-3 gap-2">
              <button 
                onClick={() => applyPreset('coffee')}
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#fdf8f6] hover:border-[#8d6e63] transition-colors flex flex-col items-center gap-1"
              >
                <div className="w-6 h-6 rounded-full bg-[#8d6e63]"></div>
                <span className="text-xs font-medium text-gray-600">Clásico</span>
              </button>
              <button 
                onClick={() => applyPreset('dopamia')}
                className="p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-[#f5f3ff] hover:border-[#7c3aed] transition-colors flex flex-col items-center gap-1"
              >
                <div className="w-6 h-6 rounded-full bg-[#7c3aed]"></div>
                <span className="text-xs font-medium text-gray-600">Pop</span>
              </button>
              <button 
                onClick={() => applyPreset('dark')}
                className="p-3 rounded-none border border-gray-200 dark:border-gray-700 bg-gray-900 hover:border-blue-500 transition-colors flex flex-col items-center gap-1"
              >
                <div className="w-6 h-6 bg-blue-500"></div>
                <span className="text-xs font-medium text-gray-600">Noche</span>
              </button>
            </div>
          </section>

          {/* 2. Color Picker */}
          <section>
             <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Color Primario</h3>
             <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                {['#8d6e63', '#7c3aed', '#dc2626', '#059669', '#2563eb', '#db2777'].map(color => (
                  <button
                    key={color}
                    onClick={() => updateSettings({ primaryColor: color })}
                    className={`w-10 h-10 rounded-full flex-shrink-0 transition-transform shadow-sm ${settings.primaryColor === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-900' : ''}`}
                    style={{ backgroundColor: color }}
                  />
                ))}
             </div>
          </section>

          {/* 3. Border Radius */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Estilo de Bordes</h3>
            <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
              <button 
                onClick={() => updateSettings({ borderRadius: '0px' })}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${settings.borderRadius === '0px' ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                Rectos
              </button>
              <button 
                onClick={() => updateSettings({ borderRadius: '0.5rem' })}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${settings.borderRadius === '0.5rem' ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                Suaves
              </button>
              <button 
                onClick={() => updateSettings({ borderRadius: '2rem' })}
                className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${settings.borderRadius === '2rem' ? 'bg-white dark:bg-gray-700 shadow text-gray-800 dark:text-white' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
              >
                Redondos
              </button>
            </div>
          </section>

          {/* New: POS Column Selector */}
          <section>
            <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">Columnas POS</h3>
            <div className="flex gap-2">
                {[4, 5, 6].map(cols => (
                    <button
                        key={cols}
                        onClick={() => updateSettings({ posColumns: cols })}
                        className={`flex-1 py-3 rounded-xl border font-bold text-sm transition-all
                        ${settings.posColumns === cols 
                            ? 'border-[var(--primary-color)] bg-[var(--primary-bg)] dark:bg-gray-800 text-[var(--primary-color)] ring-2 ring-[var(--primary-color)] ring-opacity-20' 
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                    >
                        {cols} Cols
                    </button>
                ))}
            </div>
          </section>

          {/* 4. Typography Scale */}
          <section>
            <div className="flex justify-between items-center mb-3">
               <h3 className="text-sm font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Tamaño Texto</h3>
               <span className="text-xs font-mono bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded">{settings.baseFontSize}%</span>
            </div>
            <input 
              type="range" 
              min="85" 
              max="115" 
              step="5"
              value={settings.baseFontSize}
              onChange={(e) => updateSettings({ baseFontSize: parseInt(e.target.value) })}
              className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-[var(--primary-color)]"
            />
            <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-1">
              <span>Pequeño</span>
              <span>Grande</span>
            </div>
          </section>

          {/* 5. Compact Mode */}
          <section className="bg-gray-50 dark:bg-gray-800 p-4 rounded-xl border border-gray-100 dark:border-gray-700 flex items-center justify-between transition-colors">
            <div>
              <h4 className="font-bold text-gray-800 dark:text-white">Modo Compacto</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400">Reduce espacios.</p>
            </div>
            
            <button 
              onClick={() => updateSettings({ isCompact: !settings.isCompact })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${settings.isCompact ? 'bg-[var(--primary-color)]' : 'bg-gray-300 dark:bg-gray-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${settings.isCompact ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </section>

        </div>

        <div className="mt-auto pt-6 border-t border-gray-100 dark:border-gray-800">
          <button 
            onClick={onClose}
            className="w-full py-3 bg-gray-800 dark:bg-gray-700 text-white rounded-xl font-bold hover:bg-gray-900 dark:hover:bg-gray-600 transition-colors"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};

export default ThemeSettings;