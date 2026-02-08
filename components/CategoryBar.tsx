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
    
    // Inject "Todos" and "Más Vendidos" at the start
    return ['Todos', '⭐ Más Vendidos', ...sortedCats];
  }, [products]);

  // If we only have "Todos" and "Más Vendidos" and no real categories, maybe minimal UI, 
  // but usually we want to show them.
  
  return (
    <div className="w-full overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex space-x-2">
        {categories.map((cat: any) => {
            const isActive = selectedCategory === cat;
            // Visual tweak for "Más Vendidos"
            const isSpecial = cat === '⭐ Más Vendidos';
            
            return (
                <button
                    key={cat}
                    onClick={() => onSelectCategory(cat)}
                    className={`
                        px-5 py-3 rounded-xl font-bold text-sm whitespace-nowrap transition-all duration-200 transform active:scale-95 shadow-sm
                        ${isActive 
                            ? 'bg-coffee-600 dark:bg-dark-accent text-white shadow-md ring-2 ring-coffee-300 dark:ring-0 ring-offset-1 dark:shadow-[0_0_15px_rgba(193,139,74,0.3)]' 
                            : isSpecial 
                                ? 'bg-yellow-50 dark:bg-dark-surface text-yellow-800 dark:text-yellow-500 border border-yellow-200 dark:border-yellow-900/50 hover:bg-yellow-100 dark:hover:bg-dark-border'
                                : 'bg-white dark:bg-dark-surface text-gray-600 dark:text-dark-text-sec border border-gray-200 dark:border-dark-border hover:bg-coffee-50 dark:hover:bg-dark-border hover:text-coffee-800 dark:hover:text-dark-text-main'
                        }
                    `}
                >
                    {cat === 'Todos' ? '☕ Todos' : cat}
                </button>
            );
        })}
      </div>
    </div>
  );
};

export default CategoryBar;