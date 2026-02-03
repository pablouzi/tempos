import React from 'react';
import { Product } from '../types';

interface ProductCardProps {
  product: Product;
  onAdd: (product: Product, quantity: number) => void;
  onEdit?: (product: Product) => void;
  onDelete?: (id: string) => void;
  ingredientsMap?: Record<string, string>;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

// Tag Configuration
const TAG_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'vegan': { label: 'Vegano', icon: '🌿', color: 'bg-green-100 text-green-800 border-green-200' },
  'gluten_free': { label: 'Sin Gluten', icon: '🚫🌾', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'sugar_free': { label: 'Sin Azúcar', icon: '🚫🍬', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'lactose_free': { label: 'Sin Lactosa', icon: '🥛', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
};

const ProductCard: React.FC<ProductCardProps> = ({ product, onAdd, onEdit, onDelete, ingredientsMap }) => {
  
  const handleAddToCart = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAdd(product, 1);
  };
  
  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(onEdit) onEdit(product);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if(onDelete) onDelete(product.id);
  };

  // Resolve Ingredient Names
  const ingredientNames = product.receta?.map(r => ingredientsMap?.[r.idInsumo]).filter(Boolean).join(', ');

  return (
    <div 
      onClick={() => onAdd(product, 1)}
      className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-xl transition-shadow cursor-pointer border border-gray-100 flex flex-col h-full transform hover:scale-[1.02] duration-200 group relative"
    >
      <div className="h-40 w-full overflow-hidden bg-gray-200 relative">
        <img 
          src={product.imagen_url} 
          alt={product.nombre} 
          className="w-full h-full object-cover"
          loading="lazy"
        />
        
        {/* Admin Actions Overlay (Visible on hover or mobile) */}
        <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
            {onEdit && (
                <button 
                    onClick={handleEditClick}
                    className="bg-white text-yellow-600 p-1.5 rounded-full shadow hover:bg-yellow-50"
                    title="Editar"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </button>
            )}
            {onDelete && (
                <button 
                    onClick={handleDeleteClick}
                    className="bg-white text-red-600 p-1.5 rounded-full shadow hover:bg-red-50"
                    title="Eliminar"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                </button>
            )}
        </div>

        <div className="absolute bottom-0 right-0 bg-coffee-600 text-white px-3 py-1 rounded-tl-lg font-bold shadow-sm z-10">
          {formatCurrency(product.precio)}
        </div>
      </div>
      
      <div className="p-4 flex-grow flex flex-col">
        <h3 className="text-lg font-bold text-gray-800 leading-tight mb-1 group-hover:text-coffee-700 transition-colors">{product.nombre}</h3>
        
        {/* Badges / Tags */}
        {product.tags && product.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
                {product.tags.map(tagKey => {
                    const config = TAG_CONFIG[tagKey];
                    if (!config) return null;
                    return (
                        <span key={tagKey} className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wider ${config.color}`}>
                            <span className="mr-1 text-xs">{config.icon}</span>
                            {config.label}
                        </span>
                    );
                })}
            </div>
        )}

        {/* Description */}
        {product.descripcion && (
            <p className="text-xs text-gray-500 line-clamp-2 mb-1 leading-relaxed">
                {product.descripcion}
            </p>
        )}

        {/* Ingredients List */}
        {ingredientNames && (
           <p className="text-[10px] text-gray-400 mt-1 italic leading-snug border-t border-gray-100 pt-1">
             <span className="font-semibold text-gray-500">Ingredientes:</span> {ingredientNames}
           </p>
        )}
        
        <div className="mt-auto pt-4">
          <button 
            onClick={handleAddToCart}
            className="w-full bg-coffee-100 text-coffee-800 text-sm font-bold py-2 rounded hover:bg-coffee-200 hover:text-coffee-900 transition-colors border border-coffee-200"
          >
            Agregar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;