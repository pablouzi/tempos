import React from 'react';
import { Product } from '../types';

interface ProductManagementProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

// Tag Configuration (Same as ProductCard)
const TAG_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'vegan': { label: 'Vegano', icon: '🌿', color: 'bg-green-100 text-green-800 border-green-200' },
  'gluten_free': { label: 'Sin Gluten', icon: '🚫🌾', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'sugar_free': { label: 'Sin Azúcar', icon: '🚫🍬', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'lactose_free': { label: 'Sin Lactosa', icon: '🥛', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
};

const ProductManagement: React.FC<ProductManagementProps> = ({ products, onEdit, onDelete, onAddNew }) => {
  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">Gestión de Productos</h2>
            <p className="text-gray-500 text-sm">Administra tu catálogo, precios y recetas.</p>
        </div>
        <button 
            onClick={onAddNew} 
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-2.5 rounded-lg shadow-md hover:bg-green-700 transition-all font-medium active:scale-95"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nuevo Producto
        </button>
      </div>
      
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
                <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Producto</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Precio</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Receta</th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Acciones</th>
                </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
                {products.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="px-6 py-10 text-center text-gray-400">
                            No hay productos registrados.
                        </td>
                    </tr>
                ) : (
                    products.map((product) => (
                        <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-3 whitespace-nowrap">
                                <div className="flex items-center">
                                    <div className="flex-shrink-0 h-12 w-12">
                                        <img className="h-12 w-12 rounded-lg object-cover border border-gray-100" src={product.imagen_url} alt="" />
                                    </div>
                                    <div className="ml-4">
                                        <div className="text-sm font-bold text-gray-900">{product.nombre}</div>
                                        {/* Display Tags here */}
                                        {product.tags && product.tags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {product.tags.map(tagKey => {
                                                    const config = TAG_CONFIG[tagKey];
                                                    if (!config) return null;
                                                    return (
                                                        <span key={tagKey} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.color}`}>
                                                            <span className="mr-1">{config.icon}</span>
                                                            {config.label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        )}
                                        {/* Optional: Short Description Preview */}
                                        {product.descripcion && (
                                            <p className="text-xs text-gray-400 mt-0.5 truncate max-w-[150px]">{product.descripcion}</p>
                                        )}
                                    </div>
                                </div>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap">
                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                    {formatCurrency(product.precio)}
                                </span>
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500">
                                {product.receta ? `${product.receta.length} ingredientes` : 'Sin receta'}
                            </td>
                            <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                                <button 
                                    onClick={() => onEdit(product)}
                                    className="text-indigo-600 hover:text-indigo-900 mr-4 p-2 hover:bg-indigo-50 rounded-full transition-colors"
                                    title="Editar"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                </button>
                                <button 
                                    onClick={() => onDelete(product.id)}
                                    className="text-red-600 hover:text-red-900 p-2 hover:bg-red-50 rounded-full transition-colors"
                                    title="Eliminar"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                </button>
                            </td>
                        </tr>
                    ))
                )}
            </tbody>
            </table>
        </div>
      </div>
    </div>
  );
};

export default ProductManagement;