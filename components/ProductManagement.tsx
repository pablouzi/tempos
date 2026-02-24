import React, { useState, useMemo } from 'react';
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
    const [filterCategory, setFilterCategory] = useState('Todos');

    // 1. Extract Unique Categories
    const categories = useMemo(() => {
        const unique = new Set(products.map(p => p.category || 'General'));
        // Convert Set to Array and Sort
        const sorted = Array.from(unique).sort();
        return ['Todos', ...sorted];
    }, [products]);

    // 2. Filter Logic
    const filteredAdminProducts = useMemo(() => {
        return products.filter(product => {
            const cat = product.category || 'General';
            return filterCategory === 'Todos' || cat === filterCategory;
        });
    }, [products, filterCategory]);

    return (
        <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Gestión de Productos</h2>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">Administra tu catálogo, precios y recetas.</p>
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

            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilterCategory(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border
                ${filterCategory === cat
                                ? 'bg-coffee-600 text-white border-coffee-600 shadow-sm'
                                : 'bg-white dark:bg-brand-card text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/10 hover:bg-coffee-50 dark:hover:bg-brand-dark hover:text-coffee-800 dark:hover:text-coffee-200'
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="bg-white dark:bg-brand-card rounded-xl shadow-sm border border-gray-200 dark:border-white/5 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-white/5">
                        <thead className="bg-gray-50 dark:bg-white/5">
                            <tr>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Producto</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Categoría</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Precio</th>
                                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Receta</th>
                                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-brand-card divide-y divide-gray-200 dark:divide-white/5">
                            {filteredAdminProducts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-10 text-center text-gray-400 dark:text-gray-500">
                                        No hay productos en esta categoría.
                                    </td>
                                </tr>
                            ) : (
                                filteredAdminProducts.map((product) => (
                                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                                        {/* Product Info */}
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-12 w-12">
                                                    <img className="h-12 w-12 rounded-lg object-cover border border-gray-100 dark:border-white/10" src={product.imagen_url} alt="" />
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-bold text-gray-900 dark:text-white">{product.nombre}</div>
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

                                        {/* Category Badge */}
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            <span className="px-2.5 py-1 inline-flex text-xs leading-4 font-bold rounded-md bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-white/5">
                                                {product.category || 'General'}
                                            </span>
                                        </td>

                                        {/* Price */}
                                        <td className="px-6 py-3 whitespace-nowrap">
                                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                {formatCurrency(product.precio)}
                                            </span>
                                        </td>

                                        {/* Recipe Info */}
                                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                                            {product.receta && product.receta.length > 0
                                                ? `${product.receta.length} ingredientes`
                                                : <span className="text-gray-400 dark:text-gray-500 italic">Sin receta (Re-venta)</span>
                                            }
                                        </td>

                                        {/* Actions */}
                                        <td className="px-6 py-3 whitespace-nowrap text-right text-sm font-medium">
                                            <button
                                                onClick={() => onEdit(product)}
                                                className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 mr-4 p-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-full transition-colors"
                                                title="Editar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => onDelete(product.id)}
                                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 p-2 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-full transition-colors"
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