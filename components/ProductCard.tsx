import React from 'react';
import { Product } from '../types';
import { useTheme } from '../context/ThemeContext'; // Importamos para el radio dinámico

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, quantity: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  ingredientsMap?: Record<string, string>;
}

// Configuración de Etiquetas (Centralizada para fácil mantenimiento)
const TAG_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'vegan': { label: 'Vegano', icon: '🌿', color: 'bg-green-100 text-green-800 border-green-200' },
  'gluten_free': { label: 'Sin Gluten', icon: '🚫🌾', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'sugar_free': { label: 'Sin Azúcar', icon: '🚫🍬', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'lactose_free': { label: 'Sin Lactosa', icon: '🥛', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd, onEdit, onDelete }) => {
  const { settings } = useTheme(); // Obtenemos settings para el borderRadius

  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd(product, 1);
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEdit) onEdit(product);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onDelete) onDelete(product.id);
  };

  return (
    <div
      onClick={() => onAdd(product, 1)}
      className="bg-brand-card shadow-card hover:shadow-lg transition-all duration-200 cursor-pointer relative group border border-transparent hover:border-brand-orange/10 flex flex-col h-full overflow-hidden"
      style={{ borderRadius: settings.borderRadius }} // Aplicamos el radio dinámico aquí
    >
      {/* Edit/Delete Overlay (Admin only) */}
      {(onEdit || onDelete) && (
        <div className="absolute top-4 right-4 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button onClick={handleEditClick} className="bg-white p-2 rounded-full shadow-md text-yellow-600 hover:text-yellow-700">✏️</button>
          )}
          {onDelete && (
            <button onClick={handleDeleteClick} className="bg-white p-2 rounded-full shadow-md text-red-600 hover:text-red-700">🗑️</button>
          )}
        </div>
      )}

      {/* Image Area */}
      <div className="w-full h-48 relative">
        <img
          src={product.imagen_url}
          alt={product.nombre}
          className="h-full w-full object-cover transform group-hover:scale-105 transition-transform duration-300"
        />
      </div>

      <div className="p-5 flex-grow flex flex-col items-start">
        <h3 className="text-md font-bold text-gray-900 dark:text-white leading-tight mb-1 uppercase tracking-tight">
          {product.nombre}
        </h3>

        {/* TAGS DINÁMICOS: Esto soluciona tu problema */}
        <div className="flex flex-wrap gap-1 mb-2">
          {product.tags && product.tags.length > 0 ? (
            product.tags.map(tagKey => {
              const config = TAG_CONFIG[tagKey];
              if (!config) return null;
              return (
                <span key={tagKey} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${config.color}`}>
                  <span className="mr-1">{config.icon}</span>
                  {config.label}
                </span>
              );
            })
          ) : (
            <span className="text-[10px] text-transparent select-none">.</span>
          )}
        </div>

        <p className="text-xs text-gray-400 font-medium mb-4 line-clamp-2">
          {product.descripcion || "Descripción de producto"}
        </p>

        <div className="mt-auto w-full flex items-center justify-between">
          <span className="text-2xl font-bold text-brand-orange">
            {formatCurrency(product.precio)}
          </span>

          <button
            onClick={handleAddToCart}
            className="w-14 h-14 rounded-full bg-brand-cart hover:bg-brand-orange text-brand-orange hover:text-white flex items-center justify-center text-3xl font-bold transition-colors shadow-sm"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;