import React, { useState, useEffect } from 'react';
import { Ingredient } from '../types';
import { getIngredients, addStock, seedDatabase, deleteIngredient, updateIngredient } from '../services/firebaseService';
import AddInsumoModal from './AddInsumoModal';

const InventoryTable: React.FC = () => {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const data = await getIngredients();
      setIngredients(data);
    } catch (error: any) {
      console.error("Error fetching inventory", error);
      if (error.code === 'permission-denied' || error.message.includes('Missing or insufficient permissions')) {
           window.Swal.fire({
            icon: 'error',
            title: 'Permisos Denegados (Inventario)',
            text: 'No se puede leer el inventario. Asegúrate de configurar las Reglas de Firestore a "allow read, write: if true;" para pruebas.',
            footer: '<a href="https://console.firebase.google.com" target="_blank">Ir a Firebase Console</a>'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, []);

  const handleAddStock = async (id: string) => {
    const { value: amount } = await window.Swal.fire({
      title: 'Re-abastecer Stock',
      input: 'number',
      inputLabel: 'Cantidad a ingresar',
      inputPlaceholder: 'Ej: 1000',
      showCancelButton: true,
      confirmButtonColor: '#795548',
      inputValidator: (value: string) => {
        if (!value || parseInt(value) <= 0) {
          return 'Debes ingresar una cantidad válida';
        }
      }
    });

    if (amount) {
      try {
        await addStock(id, parseInt(amount));
        window.Swal.fire('Actualizado', 'Stock agregado correctamente', 'success');
        fetchInventory();
      } catch (e) {
        window.Swal.fire('Error', 'No se pudo actualizar el stock', 'error');
      }
    }
  };

  const handleEdit = async (ingredient: Ingredient) => {
    // Determine default minimum if not set
    const currentMin = ingredient.stockMinimo || 5;

    const { value: formValues } = await window.Swal.fire({
      title: 'Editar Insumo',
      html:
        `<div class="flex flex-col gap-3">
          <label class="text-left text-sm font-bold">Nombre</label>
          <input id="swal-input1" class="swal2-input m-0 w-full" value="${ingredient.nombre}" placeholder="Nombre">
          
          <label class="text-left text-sm font-bold mt-2">Unidad</label>
          <input id="swal-input2" class="swal2-input m-0 w-full" value="${ingredient.unidad}" placeholder="Unidad (kg, g, l)">
          
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div>
                 <label class="text-left text-sm font-bold">Stock Actual</label>
                 <input id="swal-input3" type="number" class="swal2-input m-0 w-full" value="${ingredient.stock}" placeholder="Stock">
            </div>
            <div>
                 <label class="text-left text-sm font-bold text-red-600">Stock Mínimo</label>
                 <input id="swal-input4" type="number" class="swal2-input m-0 w-full border-red-200 bg-red-50" value="${currentMin}" placeholder="Alerta">
            </div>
          </div>
        </div>`,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonColor: '#d97706', // Amber/Orange for Edit
      confirmButtonText: 'Guardar Cambios',
      preConfirm: () => {
        return [
          (document.getElementById('swal-input1') as HTMLInputElement).value,
          (document.getElementById('swal-input2') as HTMLInputElement).value,
          (document.getElementById('swal-input3') as HTMLInputElement).value,
          (document.getElementById('swal-input4') as HTMLInputElement).value
        ]
      }
    });

    if (formValues) {
      const [nombre, unidad, stockStr, minStockStr] = formValues;
      if(!nombre || !unidad) return;
      
      try {
        await updateIngredient(ingredient.id, {
          nombre,
          unidad,
          stock: parseFloat(stockStr),
          stockMinimo: parseFloat(minStockStr)
        });
        window.Swal.fire('Actualizado', 'Insumo modificado.', 'success');
        fetchInventory();
      } catch (e: any) {
        window.Swal.fire('Error', 'No se pudo actualizar: ' + e.message, 'error');
      }
    }
  };

  const handleDelete = async (id: string) => {
    const result = await window.Swal.fire({
      title: '¿Eliminar Insumo?',
      text: "Esta acción no se puede deshacer. Los productos que usen este insumo podrían fallar.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626', // Red
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar'
    });

    if (result.isConfirmed) {
      try {
        await deleteIngredient(id);
        window.Swal.fire('Eliminado', 'El insumo ha sido eliminado.', 'success');
        fetchInventory();
      } catch (e: any) {
        window.Swal.fire('Error', 'No se pudo eliminar: ' + e.message, 'error');
      }
    }
  };

  const handleSeed = async () => {
     try {
        await seedDatabase();
        window.Swal.fire('Base de Datos Inicializada', 'Productos e Insumos de prueba creados.', 'success');
        fetchInventory();
     } catch (e: any) {
        let msg = 'Verifica la consola y tu configuración.';
        if (e.code === 'permission-denied') {
            msg = 'Permisos denegados. Habilita las reglas en Firestore Console.';
        }
        window.Swal.fire('Error', msg, 'error');
     }
  }

  // Visual logic for stock status
  const renderStatusBadge = (ing: Ingredient) => {
    const minStock = ing.stockMinimo || 5; // Default to 5 if not set
    
    if (ing.stock <= minStock) {
        return (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200 shadow-sm animate-pulse">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Crítico (Bajo {minStock})
            </span>
        );
    } else if (ing.stock <= minStock * 1.5) {
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200 shadow-sm">
                Bajo
            </span>
        );
    } else {
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200 shadow-sm">
                Normal
            </span>
        );
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-lg">
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-coffee-800">Inventario de Insumos</h2>
        <div className="flex gap-2">
            <button 
                onClick={() => setIsAddModalOpen(true)}
                className="bg-coffee-600 text-white px-4 py-2 rounded-lg hover:bg-coffee-700 transition shadow-sm font-medium"
            >
                ➕ Nuevo Insumo
            </button>
            <button 
                onClick={handleSeed}
                className="text-xs bg-gray-200 text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-300"
            >
                Datos Prueba
            </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center py-8">Cargando...</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm whitespace-nowrap">
            <thead className="uppercase tracking-wider border-b-2 border-gray-200 bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-4">Insumo</th>
                <th scope="col" className="px-6 py-4 text-center">Unidad</th>
                <th scope="col" className="px-6 py-4 text-center">Stock Actual</th>
                <th scope="col" className="px-6 py-4 text-center">Estado</th> 
                <th scope="col" className="px-6 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {ingredients.map((ing) => {
                 const minStock = ing.stockMinimo || 5;
                 const isCritical = ing.stock <= minStock;

                 return (
                    <tr key={ing.id} className={`border-b transition-colors ${isCritical ? 'bg-red-50 hover:bg-red-100' : 'hover:bg-gray-50'}`}>
                        <td className="px-6 py-4 font-medium text-gray-900">
                            {ing.nombre}
                        </td>
                        <td className="px-6 py-4 text-center text-gray-500">{ing.unidad}</td>
                        <td className={`px-6 py-4 text-center font-bold ${isCritical ? 'text-red-700' : 'text-gray-700'}`}>
                            {ing.stock}
                        </td>
                        <td className="px-6 py-4 text-center">
                            {renderStatusBadge(ing)}
                        </td>
                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                            <button
                            onClick={() => handleAddStock(ing.id)}
                            className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition text-xs font-medium shadow-sm"
                            title="Agregar Stock"
                            >
                            + Stock
                            </button>
                            <button
                            onClick={() => handleEdit(ing)}
                            className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded hover:bg-yellow-500 transition text-xs font-medium shadow-sm"
                            title="Editar Info"
                            >
                            Editar
                            </button>
                            <button
                            onClick={() => handleDelete(ing.id)}
                            className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600 transition text-xs font-medium shadow-sm"
                            title="Eliminar"
                            >
                            Borrar
                            </button>
                        </td>
                    </tr>
                 );
              })}
            </tbody>
          </table>
          {ingredients.length === 0 && (
            <div className="text-center py-10 text-gray-500">
                No hay insumos. Usa el botón de "Inicializar Datos" o agrega uno nuevo.
            </div>
          )}
        </div>
      )}

      {/* Add Insumo Modal */}
      <AddInsumoModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
            setIsAddModalOpen(false);
            fetchInventory();
        }}
      />
    </div>
  );
};

export default InventoryTable;