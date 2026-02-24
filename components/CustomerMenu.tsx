import React, { useState, useMemo } from 'react';
import { Product } from '../types';
import CategoryBar from './CategoryBar';
import { Search, Coffee } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface CustomerMenuProps {
    products: Product[];
    ingredientsMap: Record<string, string>;
}

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const CustomerMenu: React.FC<CustomerMenuProps> = ({ products, ingredientsMap }) => {
    const { settings } = useTheme();
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("Todos");

    const filteredProducts = useMemo(() => {
        return products.map(product => ({
            ...product,
            category: product.category || 'General'
        })).filter(product => {
            const matchesSearch = product.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            let matchesCategory = selectedCategory === 'Todos' || product.category === selectedCategory || (selectedCategory === '⭐ Más Vendidos' && false);

            return matchesSearch && matchesCategory;
        });
    }, [products, searchTerm, selectedCategory]);

    return (
        <div className="flex flex-col h-full bg-[var(--main-bg)]">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl md:text-4xl font-extrabold text-[var(--text-dark)] flex items-center gap-3">
                        <Coffee className="text-[var(--primary-color)]" size={36} />
                        Nuestra Carta
                    </h1>
                    <p className="text-gray-500 mt-2 text-lg">Descubre nuestros deliciosos productos.</p>
                </div>
                <div className="relative w-full sm:w-80 group shadow-sm z-10">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[var(--primary-color)] transition-colors" />
                    </div>
                    <input
                        type="text"
                        placeholder="Buscar en el menú..."
                        className="pl-12 pr-4 py-3.5 rounded-2xl bg-[var(--card-bg)] border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] focus:border-transparent w-full text-[var(--text-dark)] transition-all font-medium text-base shadow-sm"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="mb-6 flex-shrink-0 hide-scrollbar pb-2">
                <CategoryBar products={products} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
            </div>

            <div className="flex-grow pb-10">
                {filteredProducts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-gray-400 bg-[var(--card-bg)] rounded-3xl border border-dashed border-gray-200 dark:border-gray-800">
                        <Coffee size={48} className="mb-4 opacity-30" />
                        <p className="text-lg font-medium">No encontramos productos con esa búsqueda.</p>
                        <button onClick={() => { setSearchTerm(''); setSelectedCategory('Todos'); }} className="text-[var(--primary-color)] mt-3 font-bold underline hover:text-opacity-80 transition-opacity">Ver todo el menú</button>
                    </div>
                ) : (
                    <div className="flex flex-col gap-12 mt-8 md:px-4">
                        {Object.entries(
                            filteredProducts.reduce((acc, product) => {
                                const cat = product.category || 'General';
                                if (!acc[cat]) acc[cat] = [];
                                acc[cat].push(product);
                                return acc;
                            }, {} as Record<string, typeof filteredProducts>)
                        ).sort((a, b) => {
                            return (b[1] as any[]).length - (a[1] as any[]).length;
                        }).map(([category, items]: [string, any[]]) => (
                            <div key={category} className="flex flex-col">
                                <div className="flex items-center gap-3 mb-6">
                                    {category.toLowerCase().includes('caf') ? (
                                        <Coffee className="text-[#eb5c27]" size={28} />
                                    ) : (
                                        <div className="w-7 h-7 flex items-center justify-center text-[#eb5c27] font-bold border-2 border-[#eb5c27] rounded-md text-sm">
                                            {category.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <h2 className="text-2xl font-extrabold text-[#2c4133]">{category}</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-32 gap-y-1">
                                    {items.map(product => {
                                        const isOutOfStock = product.isInventoryTracked && product.stock <= 0;
                                        return (
                                            <div key={product.id} className="flex flex-col group pb-2 border-b border-gray-100 last:border-0 md:last:border-b md:[&:nth-last-child(2)]:border-0">
                                                <div className="flex items-baseline w-full">
                                                    <h3 className={`font-bold text-lg text-[#2c4133] whitespace-nowrap pr-2 ${isOutOfStock ? 'opacity-50' : ''}`}>
                                                        {product.nombre}
                                                    </h3>
                                                    <div className="flex-grow border-b-2 border-dotted border-gray-300 mx-2 self-center relative top-[-4px]"></div>
                                                    <span className={`font-bold text-lg text-[#eb5c27] whitespace-nowrap pl-2 ${isOutOfStock ? 'opacity-50' : ''}`}>
                                                        {formatCurrency(product.precio)}
                                                    </span>
                                                </div>
                                                {product.descripcion && (
                                                    <p className={`text-gray-700 text-sm mt-1 mb-1 leading-relaxed max-w-[85%] ${isOutOfStock ? 'opacity-50' : ''}`}>
                                                        {product.descripcion}
                                                    </p>
                                                )}
                                                {isOutOfStock && (
                                                    <span className="text-red-500 text-xs font-bold mt-1 uppercase tracking-wide">
                                                        Agotado
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CustomerMenu;
