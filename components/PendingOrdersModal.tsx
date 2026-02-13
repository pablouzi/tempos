import React from 'react';
import { PendingOrder } from '../types';
import { Clock, User, ArrowRight, Trash2 } from 'lucide-react';

interface PendingOrdersModalProps {
  isOpen: boolean;
  orders: PendingOrder[];
  onClose: () => void;
  onResume: (order: PendingOrder) => void;
  onDelete: (orderId: string) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const formatDate = (isoString: string) => {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '--:--';
  }
};

const PendingOrdersModal: React.FC<PendingOrdersModalProps> = ({ isOpen, orders, onClose, onResume, onDelete }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        
        <div 
            className="fixed inset-0 bg-gray-900 bg-opacity-75 transition-opacity backdrop-blur-sm" 
            onClick={onClose}
        ></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-middle bg-white dark:bg-gray-900 rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-2xl w-full border dark:border-gray-700">
          
          <div className="bg-orange-500 px-6 py-4 border-b border-orange-600 flex justify-between items-center">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Clock className="h-6 w-6" />
                Pedidos Pendientes
            </h3>
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors text-2xl leading-none">
                &times;
            </button>
          </div>

          <div className="p-6 max-h-[70vh] overflow-y-auto bg-[var(--main-bg)]">
            {orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                    <Clock size={48} className="mb-4 opacity-50" />
                    <p className="text-lg">No hay pedidos pendientes.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {orders.map((order) => (
                        <div key={order.id} className="bg-[var(--card-bg)] rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 transition-all hover:shadow-md">
                            
                            {/* Info Left */}
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-1">
                                    <span className="bg-orange-100 text-orange-800 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                        <Clock size={12} /> {formatDate(order.timestamp)}
                                    </span>
                                    {order.customer ? (
                                        <span className="flex items-center gap-1 text-sm font-bold text-gray-700 dark:text-gray-300">
                                            <User size={14} /> {order.customer.name}
                                        </span>
                                    ) : (
                                        <span className="text-sm text-gray-500 italic">Cliente Anónimo</span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {order.items.length} items • <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                                </p>
                                <div className="mt-2 text-xs text-gray-400 flex flex-wrap gap-1">
                                    {order.items.slice(0, 3).map((i, idx) => (
                                        <span key={idx} className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded border dark:border-gray-600 truncate max-w-[100px]">{i.nombre}</span>
                                    ))}
                                    {order.items.length > 3 && <span>...</span>}
                                </div>
                            </div>

                            {/* Total & Actions Right */}
                            <div className="flex flex-row sm:flex-col items-center sm:items-end gap-3 w-full sm:w-auto justify-between sm:justify-center">
                                <span className="text-2xl font-bold text-[var(--primary-color)]">
                                    {formatCurrency(order.total)}
                                </span>
                                
                                <div className="flex items-center gap-2">
                                    <button 
                                        onClick={() => onDelete(order.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                        title="Eliminar Pedido"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => onResume(order)}
                                        className="bg-[var(--primary-color)] hover:brightness-110 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg active:scale-95 flex items-center gap-2 transition-all"
                                    >
                                        Cobrar
                                        <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PendingOrdersModal;