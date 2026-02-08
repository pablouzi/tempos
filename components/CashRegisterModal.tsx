import React, { useState, useEffect } from 'react';
import { CashSession } from '../types';
import { openCashSession, closeCashSession } from '../services/firebaseService';

interface CashRegisterModalProps {
  isOpen: boolean;
  mode: 'open' | 'close';
  sessionData?: CashSession | null;
  currentUser: any;
  onSuccess: () => void;
  onClose: () => void; // Should only work if canceling close, not open (which is mandatory)
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const CashRegisterModal: React.FC<CashRegisterModalProps> = ({ isOpen, mode, sessionData, currentUser, onSuccess, onClose }) => {
  const [amount, setAmount] = useState(''); // Initial balance (open) or Actual Count (close)
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setAmount('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount) return;
    const val = parseInt(amount);
    if (isNaN(val) || val < 0) return;

    setIsProcessing(true);
    try {
      if (mode === 'open') {
        await openCashSession(val, currentUser.email || 'Cajero');
        window.Swal.fire('Caja Abierta', 'El turno ha comenzado.', 'success');
      } else {
        if (!sessionData) throw new Error("No session data");
        await closeCashSession(sessionData.id, val);
        window.Swal.fire('Caja Cerrada', 'Resumen guardado correctamente.', 'success');
      }
      onSuccess();
    } catch (err: any) {
      window.Swal.fire('Error', err.message, 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Calculations for Closing View
  const expected = sessionData?.expectedCash || 0;
  const currentCount = parseInt(amount) || 0;
  const diff = currentCount - expected;
  const isNegative = diff < 0;

  return (
    <div className="fixed inset-0 z-[90] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 text-center sm:block sm:p-0">
        
        <div className="fixed inset-0 bg-gray-900 bg-opacity-90 transition-opacity backdrop-blur-sm"></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen">&#8203;</span>

        <div className="inline-block align-middle bg-white rounded-xl text-left overflow-hidden shadow-2xl transform transition-all sm:max-w-md w-full border border-gray-200">
          
          <div className={`px-6 py-4 border-b flex justify-between items-center ${mode === 'open' ? 'bg-blue-600' : 'bg-gray-800'}`}>
            <h3 className="text-lg font-bold text-white">
              {mode === 'open' ? '🔓 Apertura de Caja' : '🔒 Cierre de Caja'}
            </h3>
            {mode === 'close' && (
                <button onClick={onClose} className="text-gray-300 hover:text-white">✕</button>
            )}
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            
            {mode === 'open' ? (
              <div className="text-center space-y-4">
                 <div className="bg-blue-50 p-4 rounded-full w-20 h-20 mx-auto flex items-center justify-center text-4xl">
                    💵
                 </div>
                 <p className="text-gray-600 text-sm">
                   Para comenzar a vender, ingresa el <b>Sencillo / Base</b> inicial en la caja.
                 </p>
                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">Monto Inicial</label>
                    <input 
                      type="number" 
                      autoFocus
                      className="block w-full text-center text-2xl font-bold border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3"
                      placeholder="$0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                 </div>
              </div>
            ) : (
              <div className="space-y-4">
                 {/* Summary Cards */}
                 <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
                    <div className="bg-gray-50 p-2 rounded border">
                        <span className="block text-gray-500 text-xs">Base Inicial</span>
                        <span className="font-bold">{formatCurrency(sessionData?.initialBalance || 0)}</span>
                    </div>
                    <div className="bg-green-50 p-2 rounded border border-green-100">
                        <span className="block text-green-600 text-xs">Ventas Efectivo</span>
                        <span className="font-bold text-green-700">+{formatCurrency(sessionData?.salesCash || 0)}</span>
                    </div>
                    <div className="bg-blue-50 p-2 rounded border border-blue-100">
                        <span className="block text-blue-600 text-xs">Tarjetas</span>
                        <span className="font-bold text-blue-700">{formatCurrency(sessionData?.salesCard || 0)}</span>
                    </div>
                    <div className="bg-purple-50 p-2 rounded border border-purple-100">
                        <span className="block text-purple-600 text-xs">Otros</span>
                        <span className="font-bold text-purple-700">{formatCurrency(sessionData?.salesOther || 0)}</span>
                    </div>
                 </div>

                 <div className="bg-gray-100 p-4 rounded-lg text-center">
                    <p className="text-xs uppercase font-bold text-gray-500">Debe haber en caja</p>
                    <p className="text-3xl font-black text-gray-800">{formatCurrency(expected)}</p>
                 </div>

                 <hr />

                 <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1">¿Cuánto contaste? (Efectivo Real)</label>
                    <input 
                      type="number" 
                      autoFocus
                      className="block w-full text-center text-2xl font-bold border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 py-3"
                      placeholder="$0"
                      value={amount}
                      onChange={e => setAmount(e.target.value)}
                    />
                 </div>

                 {amount && (
                     <div className={`p-3 rounded text-center font-bold ${isNegative ? 'bg-red-100 text-red-700' : diff > 0 ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                         Diferencia: {diff > 0 ? '+' : ''}{formatCurrency(diff)}
                         <span className="block text-xs font-normal">
                             {isNegative ? 'Falta dinero' : diff > 0 ? 'Sobra dinero' : 'Cuadre perfecto'}
                         </span>
                     </div>
                 )}
              </div>
            )}

            <div className="mt-6">
                <button
                    type="submit"
                    disabled={!amount || isProcessing}
                    className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all
                    ${mode === 'open' ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500' : 'bg-gray-800 hover:bg-gray-900 focus:ring-gray-500'}
                    ${(!amount || isProcessing) ? 'opacity-50 cursor-not-allowed' : ''}
                    `}
                >
                    {isProcessing ? 'Procesando...' : mode === 'open' ? 'Confirmar Apertura' : 'Cerrar Turno'}
                </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default CashRegisterModal;