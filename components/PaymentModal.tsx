import React, { useState, useEffect, useRef } from 'react';
import { PaymentMethod } from '../types';

interface PaymentModalProps {
  isOpen: boolean;
  total: number;
  onClose: () => void;
  onConfirm: (method: PaymentMethod, received?: number, change?: number) => void;
  paymentStatus: 'idle' | 'loading' | 'success' | 'error';
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, total, onClose, onConfirm, paymentStatus }) => {
  const [step, setStep] = useState<'select' | 'cash_input'>('select');
  const [cashGiven, setCashGiven] = useState('');
  const [clickedMethod, setClickedMethod] = useState<string | null>(null); // Track which button was clicked
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setStep('select');
      setCashGiven('');
      setClickedMethod(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (step === 'cash_input' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  if (!isOpen) return null;

  const handleCashInput = (val: string) => {
    // Only numbers
    if (/^\d*$/.test(val)) {
      setCashGiven(val);
    }
  };

  const handleMethodClick = (method: PaymentMethod | 'cash_step') => {
      if (paymentStatus !== 'idle') return; // Prevent double clicks

      if (method === 'cash_step') {
          setStep('cash_input');
      } else {
          setClickedMethod(method);
          onConfirm(method);
      }
  };

  const handleFinalizeCash = () => {
      if (paymentStatus !== 'idle') return;
      setClickedMethod('efectivo');
      onConfirm('efectivo', amountReceived, change);
  };

  const amountReceived = parseInt(cashGiven) || 0;
  const change = amountReceived - total;
  const isValidCash = amountReceived >= total;
  const isProcessing = paymentStatus !== 'idle';

  // Helper to render content based on status
  const renderButtonContent = (methodKey: string, defaultIcon: React.ReactNode, label: string) => {
      // If this specific button is the one active and processing
      if (clickedMethod === methodKey && paymentStatus === 'loading') {
          return (
              <>
                <svg className="animate-spin h-8 w-8 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-lg font-bold">Procesando...</span>
              </>
          );
      }
      
      // If success (we generally assume the last clicked is the success one)
      if (clickedMethod === methodKey && paymentStatus === 'success') {
          return (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white animate-bounce" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span className="text-lg font-bold">¡Venta Exitosa!</span>
              </>
          );
      }

      // Default state
      return (
          <>
            {defaultIcon}
            <span className="text-lg font-bold">{label}</span>
          </>
      );
  };

  // Dynamic Class for buttons
  const getButtonClass = (baseColor: string, methodKey: string) => {
      if (clickedMethod === methodKey && paymentStatus === 'success') {
          return 'bg-emerald-500 scale-105'; // Success Transformation
      }
      if (isProcessing && clickedMethod !== methodKey) {
          return 'bg-gray-300 dark:bg-gray-700 opacity-50 cursor-not-allowed'; // Disable others
      }
      if (isProcessing && clickedMethod === methodKey) {
          return `${baseColor} opacity-75 cursor-not-allowed`; // Loading state
      }
      return `${baseColor} hover:brightness-110 active:scale-95 shadow-lg`; // Default interactive
  };

  return (
    <div className="fixed inset-0 z-[80] overflow-y-auto" role="dialog" aria-modal="true">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        
        {/* Backdrop - Block clicks if processing */}
        <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-75 dark:bg-black/80 transition-opacity backdrop-blur-sm" 
            onClick={() => !isProcessing && onClose()}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-dark-surface rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg w-full relative border dark:border-dark-border">
          
          {/* Header */}
          <div className="bg-gray-50 dark:bg-dark-bg px-6 py-4 border-b border-gray-100 dark:border-dark-border flex justify-between items-center">
            <h3 className="text-lg font-medium text-gray-500 dark:text-dark-text-sec">Cobrar Venta</h3>
            {!isProcessing && (
                <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-main transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            )}
          </div>

          {/* Total Big Display */}
          <div className="bg-white dark:bg-dark-surface px-6 py-6 text-center">
            <p className="text-sm font-bold text-gray-400 dark:text-dark-text-sec uppercase tracking-widest">Total a Pagar</p>
            <h2 className="text-5xl font-black text-gray-800 dark:text-dark-text-main mt-2">{formatCurrency(total)}</h2>
          </div>

          <div className="px-6 pb-6">
            {step === 'select' ? (
                <div className="grid grid-cols-2 gap-4 mt-2">
                    {/* Efectivo */}
                    <button 
                        onClick={() => handleMethodClick('cash_step')}
                        disabled={isProcessing}
                        className={`col-span-2 text-white rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all duration-300 group
                        ${isProcessing ? 'bg-gray-300 dark:bg-gray-700 opacity-50 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 active:scale-95 shadow-green-200 dark:shadow-none shadow-lg'}`}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <span className="text-xl font-bold">Efectivo 💵</span>
                    </button>

                    {/* Tarjeta */}
                    <button 
                        onClick={() => handleMethodClick('tarjeta')}
                        disabled={isProcessing}
                        className={`text-white rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all duration-300 h-32 group
                        ${getButtonClass('bg-blue-600', 'tarjeta')}`}
                    >
                        {renderButtonContent('tarjeta', (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        ), 'Tarjeta 💳')}
                    </button>

                    {/* Otros */}
                    <button 
                        onClick={() => handleMethodClick('otro')}
                        disabled={isProcessing}
                        className={`text-white rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-all duration-300 h-32 group
                        ${getButtonClass('bg-purple-600', 'otro')}`}
                    >
                        {renderButtonContent('otro', (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                            </svg>
                        ), 'Otros ✨')}
                    </button>
                </div>
            ) : (
                <div className="animate-fade-in">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-dark-text-sec mb-2">Cliente paga con:</label>
                        <div className="relative">
                            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-gray-500 font-bold">$</span>
                            <input 
                                ref={inputRef}
                                type="text" 
                                disabled={isProcessing}
                                className="block w-full pl-8 pr-12 py-4 text-3xl font-bold border-gray-300 dark:border-dark-border rounded-lg focus:ring-green-500 focus:border-green-500 text-gray-900 dark:text-dark-text-main bg-gray-50 dark:bg-dark-bg disabled:bg-gray-100 disabled:text-gray-400"
                                placeholder="0"
                                value={cashGiven}
                                onChange={(e) => handleCashInput(e.target.value)}
                            />
                        </div>
                        
                        {/* Quick Cash Suggestions */}
                        {!isProcessing && (
                            <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
                                {[5000, 10000, 20000].map(val => (
                                    <button 
                                        key={val}
                                        onClick={() => setCashGiven(val.toString())}
                                        className="px-3 py-1 bg-gray-100 dark:bg-dark-border hover:bg-gray-200 dark:hover:bg-dark-accent rounded-full text-xs font-bold text-gray-600 dark:text-dark-text-main border border-gray-200 dark:border-dark-border whitespace-nowrap"
                                    >
                                        {formatCurrency(val)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className={`p-4 rounded-xl mb-6 transition-colors ${isValidCash ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'}`}>
                        <div className="flex justify-between items-center">
                            <span className="font-medium text-gray-600 dark:text-dark-text-sec">Vuelto a entregar:</span>
                            <span className={`text-2xl font-bold ${isValidCash ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                {isValidCash ? formatCurrency(change) : 'Falta dinero'}
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => setStep('select')}
                            disabled={isProcessing}
                            className="bg-gray-200 dark:bg-dark-border text-gray-700 dark:text-dark-text-main py-4 rounded-xl font-bold hover:bg-gray-300 dark:hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Atrás
                        </button>
                        <button 
                            onClick={handleFinalizeCash}
                            disabled={!isValidCash || isProcessing}
                            className={`py-4 rounded-xl font-bold text-white shadow-md transition-all duration-300 flex justify-center items-center gap-2
                            ${getButtonClass('bg-green-600', 'efectivo')}`}
                        >
                            {renderButtonContent('efectivo', (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            ), 'Finalizar')}
                        </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;