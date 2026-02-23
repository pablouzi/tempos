import React, { useEffect, useState, useMemo } from 'react';
import { Sale, Product, Ingredient } from '../types';
import { getSalesHistory, getProducts, getIngredients } from '../services/firebaseService';

const FinancialDashboard: React.FC = () => {
    const [sales, setSales] = useState<Sale[]>([]);
    const [products, setProducts] = useState<Product[]>([]);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const [salesData, productsData, ingredientsData] = await Promise.all([
                    getSalesHistory(),
                    getProducts(),
                    getIngredients()
                ]);
                setSales(salesData);
                setProducts(productsData);
                setIngredients(ingredientsData);
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    // --- Calculations ---
    const stats = useMemo(() => {
        const validSales = sales.filter(s => s.status === 'completed');

        // Build current cost map for products
        const productCostMap: Record<string, number> = {};
        products.forEach(p => {
            let cost = 0;
            if (p.receta && p.receta.length > 0) {
                p.receta.forEach(r => {
                    const ing = ingredients.find(i => i.id === r.idInsumo);
                    if (ing && ing.costoPorUnidad) {
                        cost += r.cantidadRequerida * ing.costoPorUnidad;
                    }
                });
            } else {
                cost = p.costoCompra || 0;
            }
            productCostMap[p.nombre] = cost;
        });

        let grossSales = 0;
        let totalCost = 0;

        // Grouping for Ranking
        const productStats: Record<string, { revenue: number, cost: number, count: number }> = {};

        validSales.forEach(sale => {
            grossSales += sale.total;

            let saleCalculatedCost = 0;

            sale.items.forEach(item => {
                const itemUnitCost = productCostMap[item.nombre] || 0;
                const itemTotalCost = itemUnitCost * item.cantidad;

                saleCalculatedCost += itemTotalCost;

                if (!productStats[item.nombre]) {
                    productStats[item.nombre] = { revenue: 0, cost: 0, count: 0 };
                }
                productStats[item.nombre].revenue += (item.precio * item.cantidad);
                productStats[item.nombre].cost += itemTotalCost;
                productStats[item.nombre].count += item.cantidad;
            });

            // Use the calculated cost dynamically to always reflect reality
            totalCost += sale.costoTotal && sale.costoTotal > 0 ? sale.costoTotal : saleCalculatedCost;
        });

        const netProfit = grossSales - totalCost;
        const margin = grossSales > 0 ? (netProfit / grossSales) * 100 : 0;

        // Convert Ranking
        const ranking = Object.entries(productStats).map(([name, data]) => ({
            name,
            revenue: data.revenue,
            cost: data.cost,
            profit: data.revenue - data.cost,
            margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0
        })).sort((a, b) => b.profit - a.profit); // Sort by total profit ($)

        return { grossSales, totalCost, netProfit, margin, ranking };
    }, [sales, products, ingredients]);

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(val);

    if (loading) return <div className="p-10 text-center text-gray-500">Cargando finanzas...</div>;

    return (
        <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-20">

            {/* Header */}
            <div className="bg-gray-900 text-white p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="relative z-10">
                    <h2 className="text-3xl font-bold mb-2">Tablero Financiero 💰</h2>
                    <p className="text-gray-400">Análisis de Utilidad Real basado en costos de insumos.</p>
                </div>
                <div className="absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-green-900 to-transparent opacity-20"></div>
            </div>

            {/* Main KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Revenue */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Ventas Brutas</p>
                    <h3 className="text-3xl font-bold text-gray-800">{formatCurrency(stats.grossSales)}</h3>
                </div>

                {/* Cost (CMV) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Costo de Venta (CMV)</p>
                    <h3 className="text-3xl font-bold text-red-600">-{formatCurrency(stats.totalCost)}</h3>
                    <p className="text-xs text-gray-400 mt-2">Insumos + Productos Externos</p>
                </div>

                {/* Net Profit */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Utilidad Neta</p>
                    <h3 className="text-3xl font-bold text-green-600">{formatCurrency(stats.netProfit)}</h3>
                    <div className="w-full bg-gray-200 h-1.5 mt-3 rounded-full overflow-hidden">
                        <div className="bg-green-500 h-full" style={{ width: `${stats.margin}%` }}></div>
                    </div>
                </div>

                {/* Margin % */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-center items-center">
                    <div className="relative h-24 w-24 flex items-center justify-center">
                        <svg className="h-full w-full transform -rotate-90" viewBox="0 0 36 36">
                            <path className="text-gray-100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                            <path className={`${stats.margin > 50 ? 'text-green-500' : stats.margin > 30 ? 'text-yellow-500' : 'text-red-500'}`} strokeDasharray={`${stats.margin}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="3" />
                        </svg>
                        <span className="absolute text-xl font-bold text-gray-700">{Math.round(stats.margin)}%</span>
                    </div>
                    <p className="text-sm font-bold text-gray-400 mt-2">Margen Global</p>
                </div>
            </div>

            {/* Profitability Ranking */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-2">
                        🏆 Top Productos por Rentabilidad
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded-full">(Donde más ganas dinero real)</span>
                    </h3>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-gray-400 border-b border-gray-100">
                                    <th className="pb-3 font-normal">Producto</th>
                                    <th className="pb-3 font-normal text-right">Venta Total</th>
                                    <th className="pb-3 font-normal text-right">Costo Est.</th>
                                    <th className="pb-3 font-normal text-right text-green-700">Utilidad</th>
                                    <th className="pb-3 font-normal text-right">Margen</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {stats.ranking.slice(0, 8).map((prod, idx) => (
                                    <tr key={idx} className="hover:bg-gray-50 group transition-colors">
                                        <td className="py-3 font-medium text-gray-800 flex items-center gap-2">
                                            <span className="text-gray-300 w-4">{idx + 1}.</span> {prod.name}
                                        </td>
                                        <td className="py-3 text-right text-gray-600">{formatCurrency(prod.revenue)}</td>
                                        <td className="py-3 text-right text-gray-400">{formatCurrency(prod.cost)}</td>
                                        <td className="py-3 text-right font-bold text-green-600">{formatCurrency(prod.profit)}</td>
                                        <td className="py-3 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${prod.margin > 60 ? 'bg-green-100 text-green-800' : prod.margin > 30 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                {Math.round(prod.margin)}%
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                    <h3 className="font-bold text-gray-800 mb-4">Consejos Financieros</h3>
                    <ul className="space-y-4 text-sm text-gray-600">
                        <li className="flex gap-3">
                            <span className="bg-white p-2 h-8 w-8 rounded-full shadow-sm flex items-center justify-center text-green-600">💡</span>
                            <p>
                                <b>Analista TEMPOS informa:</b><br />
                                {stats.margin < 10 && stats.grossSales > 0 ? (
                                    <>¡Atención! Tu margen neto actual es de un <b>{Math.round(stats.margin)}%</b>. El estándar para negocios competitivos oscila entre el 15% y 25% neto. Un margen bajo el 10% es una señal de alerta para revisar la estructura de costos y subir precios.</>
                                ) : stats.margin >= 10 && stats.margin < 15 ? (
                                    <>Tu margen neto es de <b>{Math.round(stats.margin)}%</b>, cerca del nivel saludable (15%). Intenta optimizar desperdicios y compras de proveedores.</>
                                ) : stats.margin >= 15 ? (
                                    <>¡Buen trabajo! Tu margen neto del <b>{Math.round(stats.margin)}%</b> está dentro o por encima del estándar recomendado para la industria (15%-25%).</>
                                ) : (
                                    <>Agrega costos a tus insumos o productos para evaluar tu rentabilidad frente al estándar del 15% al 25% neto.</>
                                )}
                            </p>
                        </li>
                        <li className="flex gap-3">
                            <span className="bg-white p-2 h-8 w-8 rounded-full shadow-sm flex items-center justify-center text-blue-600">📉</span>
                            <p>
                                {stats.grossSales > 0 ? (
                                    (stats.totalCost / stats.grossSales) * 100 > 35 ? (
                                        <>Tu Costo de Venta (CMV) es de <b>{Math.round((stats.totalCost / stats.grossSales) * 100)}%</b>, superando el límite del 35% de ingresos. Considera subir los precios o negociar mejores compras.</>
                                    ) : (
                                        <>Tu Costo de Venta (CMV) se mantiene sano en un <b>{Math.round((stats.totalCost / stats.grossSales) * 100)}%</b> (bajo la recomendación máxima del 35%). Tienes un buen control sobre los costos de inventario.</>
                                    )
                                ) : (
                                    <>Cuando comiences a vender, mantén tu Costo de Venta (CMV) por debajo del 35% de tus ingresos para evitar mermas escondidas.</>
                                )}
                            </p>
                        </li>
                        <li className="flex gap-3">
                            <span className="bg-white p-2 h-8 w-8 rounded-full shadow-sm flex items-center justify-center text-yellow-600">⚖️</span>
                            <p>
                                Identifica tus 5 artículos estrella y asegúrate de que nunca falten en stock.
                                {stats.ranking.length > 0 && stats.ranking[0].margin > 0 ? (
                                    <> Por ejemplo, impulsar las ventas de <b>{stats.ranking[0].name}</b>, que tiene un estupendo retorno (<b>{Math.round(stats.ranking[0].margin)}%</b> de margen), será el mejor impulso a tu caja.</>
                                ) : (
                                    <> Son el motor de tu flujo de caja; si ellos fallan, tu rentabilidad cae drásticamente.</>
                                )}
                            </p>
                        </li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default FinancialDashboard;