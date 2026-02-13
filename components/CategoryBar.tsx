import React, { useMemo } from 'react';
import { Product } from '../types';

interface CategoryBarProps {
  products: Product[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}

const CategoryBar: React.FC<CategoryBarProps> = ({ products, selectedCategory, onSelectCategory }) => {
  // Extract unique categories from products
  const categories = useMemo(() => {
    const unique = new Set(products.map(p => p.category?.trim()).filter(Boolean));
    const sortedCats = Array.from(unique).sort();
    return ['Todos', '⭐ Más Vendidos', ...sortedCats];
  }, [products]);

  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex space-x-3">
        {categories.map((cat: any) => {
            const isActive = selectedCategory === cat;
            
            // Reference Style: 
            // Inactive: White pill, grey text.
            // Active: Black/Dark Brown pill, white text.
            
            return (
                <button
                    key={cat}
                    onClick={() => onSelectCategory(cat)}
                    className={`
                        px-6 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all duration-200 transform active:scale-95 border
                        ${isActive 
                            ? 'bg-brand-dark text-white border-brand-dark shadow-md' 
                            : 'bg-white text-gray-500 border-white hover:border-gray-200 hover:text-gray-700 shadow-sm'
                        }
                    `}
                >
                    {cat === 'Todos' ? 'All' : cat}
                </button>
            );
        })}
      </div>
    </div>
  );
};

export default CategoryBar;