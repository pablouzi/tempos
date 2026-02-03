import React, { useState } from 'react';
import { addInsumo } from '../services/firebaseService';

interface AddInsumoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const AddInsumoModal: React.FC<AddInsumoModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [nombre, setNombre] = useState('');
  const [unidad, setUnidad] = useState('gr');
  const [stock, setStock] = useState('');
  const [stockMinimo, setStockMinimo] = useState('100'); // Default suggestion
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nombre.trim()) {
      window.Swal.fire('Error', 'El nombre es obligatorio', 'error');
      return;
    }
    
    const stockNum = parseFloat(stock);
    if (isNaN(stockNum) || stockNum < 0) {
      window.Swal.fire('Error', 'El stock debe ser un número válido', 'error');
      return;
    }

    const minStockNum = parseFloat(stockMinimo);
     if (isNaN(minStockNum) || minStockNum < 0) {
      window.Swal.fire('Error', 'El stock mínimo debe ser un número válido', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      await addInsumo({
        nombre,
        unidad,
        stock: stockNum,
        stockMinimo: minStockNum
      });
      window.Swal.fire('Éxito', 'Insumo agregado correctamente', 'success');
      setNombre('');
      setStock('');
      setStockMinimo('100');
      setUnidad('gr');
      onSuccess();
    } catch (e: any) {
      window.Swal.fire('Error', 'No se pudo guardar: ' + e.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" onClick={onClose} aria-hidden="true"></div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-md w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">Nuevo Insumo</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-500">
                        <span className="text-2xl">&times;</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Nombre del Insumo</label>
                        <input 
                            type="text" 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-coffee-500 focus:border-coffee-500 bg-white"
                            placeholder="Ej: Leche de Almendras"
                            value={nombre}
                            onChange={e => setNombre(e.target.value)}
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Unidad de Medida</label>
                        <select 
                            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-coffee-500 focus:border-coffee-500 bg-white"
                            value={unidad}
                            onChange={e => setUnidad(e.target.value)}
                        >
                            <option value="gr">Gramos (gr)</option>
                            <option value="kg">Kilos (kg)</option>
                            <option value="ml">Mililitros (ml)</option>
                            <option value="l">Litros (l)</option>
                            <option value="unid">Unidades (unid)</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700">Stock Inicial</label>
                            <input 
                                type="number" 
                                step="0.01"
                                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-coffee-500 focus:border-coffee-500 bg-white"
                                placeholder="0"
                                value={stock}
                                onChange={e => setStock(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-red-700">Stock Mínimo</label>
                            <input 
                                type="number" 
                                step="0.01"
                                className="mt-1 block w-full border border-red-200 bg-red-50 rounded-md shadow-sm p-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Alerta en..."
                                value={stockMinimo}
                                onChange={e => setStockMinimo(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200 flex justify-end gap-3">
                         <button 
                            type="button" 
                            onClick={onClose}
                            className="inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                        >
                            Cancelar
                        </button>
                        <button 
                            type="submit" 
                            disabled={isSubmitting}
                            className="inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-coffee-600 text-base font-medium text-white hover:bg-coffee-700 focus:outline-none sm:text-sm"
                        >
                            {isSubmitting ? 'Guardando...' : 'Guardar Insumo'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      </div>
    </div>
  );
};

export default AddInsumoModal;