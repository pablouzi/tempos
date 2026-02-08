import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Product, CartItem, Customer, PaymentMethod, CashSession, Sale } from './types';
import { getProducts, getIngredients, processSale, deleteProduct, getUserRole, getCustomers, createCustomer, getActiveCashSession, getSalesHistory } from './services/firebaseService';
import { logError } from './services/logService';
import InventoryTable from './components/InventoryTable';
import AddProductForm from './components/AddProductForm';
import EditProductModal from './components/EditProductModal';
import SalesDashboard from './components/SalesDashboard';
import ProductManagement from './components/ProductManagement';
import Login from './components/Login';
import ProductCard from './components/ProductCard'; 
import CategoryBar from './components/CategoryBar'; 
import CustomerList from './components/CustomerList'; 
import CustomerSearch from './components/CustomerSearch';
import SmartInsights from './components/SmartInsights'; 
import FinancialDashboard from './components/FinancialDashboard';
import PaymentModal from './components/PaymentModal'; 
import CashRegisterModal from './components/CashRegisterModal'; 
import CashSessionHistory from './components/CashSessionHistory';
import DailySalesReport from './components/DailySalesReport'; 
import AdminTelemetry from './components/AdminTelemetry'; 
import ThemeSettings from './components/ThemeSettings'; 
import { ThemeProvider, useTheme } from './context/ThemeContext'; // Import useTheme
import { auth } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';

enum View {
  POS = 'POS',
  ADMIN = 'ADMIN',
  INVENTORY = 'INVENTORY',
  ADD_PRODUCT = 'ADD_PRODUCT',
  SALES_HISTORY = 'SALES_HISTORY',
  CUSTOMERS = 'CUSTOMERS',
  INSIGHTS = 'INSIGHTS',
  FINANCE = 'FINANCE',
  CASH_HISTORY = 'CASH_HISTORY',
  DAILY_REPORT = 'DAILY_REPORT',
  TELEMETRY = 'TELEMETRY'
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

// --- HELPER COMPONENT: Stamp Progress Bar ---
const StampProgress: React.FC<{ stamps: number }> = ({ stamps }) => {
  const currentCycle = Math.floor(stamps / 10);
  const progress = stamps % 10;
  const canRedeemCount = currentCycle; 

  return (
    <div className="mt-1 animate-fade-in">
        <div className="flex justify-between items-end mb-1">
            <span className="text-xs font-bold text-gray-500 dark:text-dark-text-sec uppercase tracking-widest">Meta de Sellos</span>
            <span className="text-xs font-bold text-coffee-600 dark:text-dark-accent">{progress}/10 ({stamps} total)</span>
        </div>
        <div className="flex gap-1 h-3 mb-2">
            {[...Array(10)].map((_, i) => (
                <div 
                    key={i} 
                    className={`flex-1 rounded-sm transition-all duration-500 ${i < progress ? 'bg-coffee-500 dark:bg-dark-accent' : 'bg-gray-200 dark:bg-dark-border'}`}
                ></div>
            ))}
        </div>
        {canRedeemCount > 0 && (
             <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-700/50 rounded p-2 flex items-center gap-2 text-yellow-800 dark:text-yellow-200 text-xs font-bold animate-bounce">
                <span>🎁</span>
                <span>¡Premio Disponible! Tienes {canRedeemCount} canje(s).</span>
             </div>
        )}
    </div>
  );
};

const MainContent: React.FC = () => {
  const { settings } = useTheme(); // Access Theme Settings for Columns
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'cajero' | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [currentView, setCurrentView] = useState<View>(View.POS);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredientsMap, setIngredientsMap] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartItem[]>([]); 
  
  // Payment UX State
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  
  // Filtering State
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  
  // Best Sellers State
  const [topSellingNames, setTopSellingNames] = useState<string[]>([]);

  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);

  // --- Theme Settings State ---
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);

  // --- Customer Loyalty State ---
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]); 

  // --- Payment Modal State ---
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  // --- Cash Register (Arqueo) State ---
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashModalMode, setCashModalMode] = useState<'open' | 'close'>('open');

  // --- Navigation State ---
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const navRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingAuth(true);
      if (currentUser) {
        setUser(currentUser);
        try {
            const role = await getUserRole(currentUser.uid);
            setUserRole(role);
            loadData();
            calculateBestSellers(); // Telemetry
        } catch (e: any) {
            console.error("Error loading user role", e);
            logError(e.message, 'AuthLoad');
        }
      } else {
        setUser(null);
        setUserRole(null);
        setProducts([]);
      }
      setLoadingAuth(false);
    });
    
    // Close dropdowns on click outside
    const handleClickOutside = (event: MouseEvent) => {
        // Only close if we are clicking outside the nav entirely or outside a specific dropdown
        // Simplified: close all dropdowns on click body if not clicking a button
        if (navRef.current && !navRef.current.contains(event.target as Node)) {
            setActiveDropdown(null);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        if (unsubscribe) unsubscribe();
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, []);

  const loadData = async () => {
    try {
      const session = await getActiveCashSession();
      setActiveSession(session);
      
      if (!session) {
         setCashModalMode('open');
         setIsCashModalOpen(true);
      }

      const [productsData, ingredientsData, customersData] = await Promise.all([
        getProducts(),
        getIngredients(),
        getCustomers()
      ]);
      setProducts(productsData);
      setAllCustomers(customersData); 

      const map: Record<string, string> = {};
      ingredientsData.forEach(ing => {
        map[ing.id] = ing.nombre;
      });
      setIngredientsMap(map);
    } catch (error: any) {
      console.error("Error loading data:", error);
      logError(error.message, 'InitialDataLoad');
    }
  };

  // --- SALES TELEMETRY LOGIC ---
  const calculateBestSellers = async () => {
    try {
        const salesHistory = await getSalesHistory();
        // Limit to last 50 sales for relevance and performance
        const recentSales = salesHistory.slice(0, 50);
        
        const frequencyMap: Record<string, number> = {};
        recentSales.forEach(sale => {
            if(sale.status !== 'completed') return;
            sale.items.forEach(item => {
                frequencyMap[item.nombre] = (frequencyMap[item.nombre] || 0) + item.cantidad;
            });
        });

        const sortedNames = Object.entries(frequencyMap)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 10)
            .map(([name]) => name);
        
        setTopSellingNames(sortedNames);
    } catch (e) {
        console.warn("Could not calc best sellers", e);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCart([]);
    setSelectedCustomer(null);
    setActiveSession(null);
  };

  // ... (Keep existing Cart & Payment Logic) ...
  const addToCart = (product: Product) => {
    const newItem: CartItem = {
      ...product,
      cartId: Math.random().toString(36).substr(2, 9),
      originalPrice: product.precio,
      isRedeemed: false
    };
    setCart(prev => [...prev, newItem]);
  };

  const toggleRedeemItem = (cartId: string) => {
    if (!selectedCustomer) return;
    const currentlyRedeemedCount = cart.filter(i => i.isRedeemed && i.cartId !== cartId).length;
    const itemToToggle = cart.find(i => i.cartId === cartId);
    if (!itemToToggle) return;

    if (!itemToToggle.isRedeemed) {
        if ((currentlyRedeemedCount + 1) * 10 > selectedCustomer.stamps) {
            window.Swal.fire('Insuficientes Sellos', 'El cliente no tiene suficientes sellos para canjear otro producto.', 'warning');
            return;
        }
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) return { ...item, precio: 0, isRedeemed: true };
            return item;
        }));
    } else {
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) return { ...item, precio: item.originalPrice || 0, isRedeemed: false };
            return item;
        }));
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCart(prev => prev.map(i => ({...i, precio: i.originalPrice || 0, isRedeemed: false})));
  };

  const handleCreateNewCustomer = async (query: string) => {
    const isPhone = /^[0-9+]+$/.test(query);
    let name = '';
    let phone = '';

    if (isPhone) {
        phone = query;
        const { value: inputName } = await window.Swal.fire({
            title: 'Nuevo Cliente', text: `Teléfono: ${phone}. Ingresa el nombre:`, input: 'text',
            inputPlaceholder: 'Nombre del cliente', showCancelButton: true
        });
        if (!inputName) return;
        name = inputName;
    } else {
        name = query;
        const { value: inputPhone } = await window.Swal.fire({
            title: 'Nuevo Cliente', text: `Nombre: ${name}. Ingresa el teléfono:`, input: 'tel',
            inputPlaceholder: '9 1234 5678', showCancelButton: true
        });
        if (!inputPhone) return;
        phone = inputPhone;
    }

    try {
        const newCustomer = await createCustomer(name, phone);
        setAllCustomers(prev => [...prev, newCustomer]);
        setSelectedCustomer(newCustomer);
        window.Swal.fire('Registrado', 'Cliente creado con éxito', 'success');
    } catch (e: any) {
        window.Swal.fire('Error', e.message, 'error');
        logError(e.message, 'CreateCustomer');
    }
  };

  const handleOpenPayment = () => {
    if (!activeSession) {
        window.Swal.fire('Caja Cerrada', 'Debes abrir turno antes de vender.', 'warning')
          .then(() => {
              setCashModalMode('open');
              setIsCashModalOpen(true);
          });
        return;
    }
    if (cart.length === 0) return;
    setPaymentStatus('idle'); 
    setIsPaymentModalOpen(true);
  };

  const handlePaymentConfirm = (method: PaymentMethod, received?: number, change?: number) => {
      setPaymentStatus('success'); 
      const total = cart.reduce((sum, item) => sum + item.precio, 0);
      const cartSnapshot = [...cart]; 
      const customerSnapshot = selectedCustomer ? { ...selectedCustomer } : undefined;

      if (activeSession) {
          if (method === 'efectivo') {
              setActiveSession(prev => prev ? ({...prev, salesCash: prev.salesCash + total, expectedCash: prev.expectedCash + total }) : null);
          } else if (method === 'tarjeta') {
              setActiveSession(prev => prev ? ({...prev, salesCard: prev.salesCard + total }) : null);
          } else {
              setActiveSession(prev => prev ? ({...prev, salesOther: prev.salesOther + total }) : null);
          }
      }

      if (customerSnapshot) {
           const stampsEarned = cart.filter(i => i.givesStamp && !i.isRedeemed).length;
           const redeemedCount = cart.filter(i => i.isRedeemed).length;
           const newStamps = customerSnapshot.stamps + stampsEarned - (redeemedCount * 10);
           const updatedCustomer = { ...customerSnapshot, stamps: newStamps };
           setSelectedCustomer(updatedCustomer);
           setAllCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      }

      setTimeout(() => {
          setIsPaymentModalOpen(false);
          setCart([]);
          setPaymentStatus('idle');
          calculateBestSellers(); // Refresh top sellers after sale
      }, 600);

      processSale({
          cartItems: cartSnapshot, 
          total, 
          customerId: customerSnapshot?.id,
          paymentMethod: method,
          amountReceived: received,
          change: change
      }).catch((error) => {
          console.error("Background Sync Error:", error);
          logError(error.message || 'Unknown sale error', 'SaleProcessing', { total, method, cartLength: cartSnapshot.length });
          const Toast = window.Swal.mixin({ toast: true, position: 'bottom-end', showConfirmButton: false, timer: 5000 });
          Toast.fire({ icon: 'warning', title: '⚠️ Error de sincronización. La venta se guardará localmente.' });
      });
  };

  const handleCloseRegister = () => {
      if (!activeSession) return;
      setCashModalMode('close');
      setIsCashModalOpen(true);
  };

  const handleRegisterSuccess = async () => {
      setIsCashModalOpen(false);
      const session = await getActiveCashSession();
      setActiveSession(session);
  };

  const handleDeleteProduct = async (id: string) => {
    const result = await window.Swal.fire({
        title: '¿Eliminar?', text: 'Se borrará permanentemente.', icon: 'warning', showCancelButton: true, confirmButtonColor: '#dc2626'
    });
    if (result.isConfirmed) {
        try {
            await deleteProduct(id);
            window.Swal.fire('Eliminado', 'Producto borrado.', 'success');
            loadData();
        } catch (e: any) {
            window.Swal.fire('Error', e.message, 'error');
            logError(e.message, 'DeleteProduct');
        }
    }
  };
  
  const cartTotal = cart.reduce((sum, item) => sum + item.precio, 0);
  
 // --- UPDATED FILTERING LOGIC ---
  const filteredProducts = useMemo(() => {
    return products.map(product => ({
      ...product,
      category: product.category || 'General' 
    })).filter(product => {
      const matchesSearch = product.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      
      // Category Logic with "Best Sellers"
      let matchesCategory = false;
      if (selectedCategory === 'Todos') {
          matchesCategory = true;
      } else if (selectedCategory === '⭐ Más Vendidos') {
          matchesCategory = topSellingNames.includes(product.nombre);
      } else {
          matchesCategory = product.category === selectedCategory;
      }

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory, topSellingNames]);

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    setIsAddingNewProduct(false); 
    setActiveDropdown(null);
    setMobileMenuOpen(false);
  };

  const toggleDropdown = (name: string) => {
    setActiveDropdown(activeDropdown === name ? null : name);
  };

  // --- DYNAMIC GRID CLASS GENERATOR ---
  const getGridClass = () => {
      const cols = settings.posColumns || 5;
      switch (cols) {
          case 5: return 'grid-cols-2 md:grid-cols-4 xl:grid-cols-5';
          case 6: return 'grid-cols-3 md:grid-cols-4 xl:grid-cols-6';
          case 4: 
          default: return 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
      }
  };

  // --- RENDER SECTIONS ---
  const renderPOS = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      <div className="lg:w-[75%] flex flex-col h-full overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4 shrink-0">
          <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold text-gray-800 dark:text-dark-text-main">
                Hola, {userRole === 'admin' ? 'Administrador' : 'Cajero'} 👋
              </h2>
          </div>
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-focus-within:text-[var(--primary-color)] dark:text-dark-text-sec" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 dark:border-dark-border rounded-lg leading-5 bg-white dark:bg-dark-surface text-gray-900 dark:text-dark-text-main placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-coffee-500 dark:focus:ring-dark-accent focus:border-transparent transition-shadow shadow-sm"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4 shrink-0">
            <CategoryBar products={products} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
        </div>

        <div className="flex-grow overflow-y-auto pr-2 pb-20 lg:pb-0">
            {filteredProducts.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-500 bg-gray-50 dark:bg-dark-surface/50 rounded-xl border border-dashed border-gray-200 dark:border-dark-border">
                    <p className="text-lg font-medium dark:text-dark-text-sec">No hay productos en esta categoría</p>
                    <button onClick={() => setSelectedCategory('Todos')} className="text-coffee-600 dark:text-dark-accent font-bold mt-2 underline">Ver Todos</button>
                </div>
            ) : (
                <div className={`grid gap-4 animate-fade-in ${getGridClass()}`}>
                    {filteredProducts.map(product => (
                        <ProductCard 
                          key={product.id}
                          product={product}
                          onAdd={addToCart}
                          onEdit={userRole === 'admin' ? setEditingProduct : undefined}
                          onDelete={userRole === 'admin' ? handleDeleteProduct : undefined}
                          ingredientsMap={ingredientsMap}
                        />
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Cart Sidebar */}
      <div className="lg:w-[25%] flex flex-col h-[40vh] lg:h-full fixed bottom-0 left-0 right-0 lg:static z-40 bg-white dark:bg-dark-bg lg:bg-transparent shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] lg:shadow-none">
        <div className="bg-white dark:bg-dark-surface rounded-t-xl lg:rounded-xl shadow-xl flex flex-col h-full overflow-hidden border border-gray-100 dark:border-dark-border transition-colors duration-300">
            <div className="bg-coffee-50 dark:bg-dark-bg p-4 border-b border-gray-100 dark:border-dark-border">
                {!selectedCustomer ? (
                    <div className="space-y-2">
                        <CustomerSearch customers={allCustomers} onSelectCustomer={handleSelectCustomer} onCreateNew={handleCreateNewCustomer} />
                    </div>
                ) : (
                    <div className="bg-white dark:bg-dark-surface p-3 rounded border border-green-200 dark:border-dark-border shadow-sm animate-fade-in relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-bold text-gray-800 dark:text-dark-text-main">{selectedCustomer.name}</p>
                                <p className="text-xs text-gray-500 dark:text-dark-text-sec">{selectedCustomer.phone}</p>
                            </div>
                            <button onClick={() => { setSelectedCustomer(null); setCart(c => c.map(i => ({...i, isRedeemed:false, precio: i.originalPrice||0}))); }} className="text-gray-400 hover:text-red-500">✕</button>
                        </div>
                        <StampProgress stamps={selectedCustomer.stamps} />
                    </div>
                )}
            </div>

            <div className="p-3 border-b border-gray-100 dark:border-dark-border flex justify-between items-center bg-gray-50 dark:bg-dark-surface lg:bg-white lg:dark:bg-dark-surface">
                <h3 className="font-bold text-lg text-gray-800 dark:text-dark-text-main">Carrito</h3>
                <span className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-bold px-3 py-1 rounded-full text-xs">
                    {cart.length} ítems
                </span>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4 bg-white dark:bg-dark-surface">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-dark-text-sec opacity-60">
                        <p>Carrito vacío</p>
                    </div>
                ) : (
                    cart.map((item, index) => {
                        const canRedeem = selectedCustomer && selectedCustomer.stamps >= 10 && item.givesStamp;
                        const usedStamps = cart.filter(i => i.isRedeemed).length * 10;
                        const stampsAvailable = selectedCustomer ? selectedCustomer.stamps - usedStamps : 0;
                        const isRedeemableNow = !item.isRedeemed && stampsAvailable >= 10;

                        return (
                        <div key={item.cartId} className={`flex gap-3 items-center p-2 rounded-lg transition-colors 
                            ${item.isRedeemed 
                                ? 'bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800' 
                                : 'bg-transparent'}`}>
                            <img src={item.imagen_url} alt="" className="w-12 h-12 rounded object-cover border border-gray-100 dark:border-dark-border flex-shrink-0" />
                            <div className="flex-grow min-w-0">
                                <p className="font-semibold text-gray-800 dark:text-dark-text-main truncate text-sm">{item.nombre}</p>
                                <div className="flex items-center gap-2">
                                    <p className={`text-sm ${item.isRedeemed ? 'text-gray-400 line-through' : 'text-gray-500 dark:text-dark-text-sec'}`}>
                                        {formatCurrency(item.originalPrice || item.precio)}
                                    </p>
                                    {item.isRedeemed && (
                                        <span className="text-xs font-bold text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 rounded-full">GRATIS</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col items-end gap-2">
                                {canRedeem && (
                                    <button 
                                        onClick={() => toggleRedeemItem(item.cartId)}
                                        disabled={!item.isRedeemed && !isRedeemableNow}
                                        className={`text-[10px] px-2 py-1 rounded border font-bold flex items-center gap-1 transition-all
                                        ${item.isRedeemed 
                                            ? 'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 border-red-200 hover:bg-red-200 dark:hover:bg-red-900/40' 
                                            : isRedeemableNow 
                                                ? 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border-yellow-300 hover:bg-yellow-200' 
                                                : 'bg-gray-100 dark:bg-dark-bg text-gray-400 dark:text-gray-500 border-gray-200 dark:border-dark-border cursor-not-allowed'}`}
                                    >
                                        {item.isRedeemed ? '❌ Quitar' : '🎁 Canjear'}
                                    </button>
                                )}
                                <button onClick={() => setCart(prev => prev.filter(i => i.cartId !== item.cartId))} className="text-xs text-red-400 hover:text-red-600 dark:hover:text-red-300">Eliminar</button>
                            </div>
                        </div>
                    )})
                )}
            </div>

            <div className="p-5 border-t border-gray-100 dark:border-dark-border bg-gray-50 dark:bg-dark-bg">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-gray-500 dark:text-dark-text-sec font-medium">Subtotal</span>
                    <span className="text-3xl font-bold text-gray-800 dark:text-dark-text-main">{formatCurrency(cartTotal)}</span>
                </div>
                {selectedCustomer && (
                    <div className="mb-4 text-right text-xs text-green-600 dark:text-green-400 font-medium flex flex-col gap-1">
                        {cart.some(i => i.isRedeemed) && <span className="text-red-500 dark:text-red-300">Descontando {cart.filter(i => i.isRedeemed).length * 10} sellos</span>}
                        <span className="text-coffee-600 dark:text-dark-accent">Ganarás +{cart.filter(i => i.givesStamp && !i.isRedeemed).length} sellos</span>
                    </div>
                )}
                <button
                    disabled={cart.length === 0 || paymentStatus !== 'idle'}
                    onClick={handleOpenPayment}
                    className={`w-full py-3.5 rounded-lg font-bold text-lg shadow-lg transition-all flex justify-center items-center gap-2
                    ${cart.length === 0 ? 'bg-gray-300 dark:bg-dark-border text-gray-500 dark:text-dark-text-sec cursor-not-allowed' : 'bg-green-600 dark:bg-dark-accent text-white hover:bg-green-700 dark:hover:brightness-110'}`}
                >
                    {paymentStatus === 'loading' ? 'Procesando...' : 'PAGAR'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center dark:bg-dark-bg dark:text-dark-text-main">Cargando...</div>;

  return (
        <div className="min-h-screen bg-[var(--primary-bg)] dark:bg-dark-bg flex flex-col transition-all duration-300 font-sans text-[length:var(--base-scale)]">
            {!user ? (
                <Login onLoginSuccess={() => {}} />
            ) : (
                <>
                  {/* Top Navigation */}
                  <nav className="bg-white dark:bg-dark-surface shadow-sm border-b border-gray-200 dark:border-dark-border z-30 sticky top-0" ref={navRef}>
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                      <div className="flex justify-between h-16">
                        
                        {/* Left Side: Logo & Nav Links */}
                        <div className="flex items-center gap-4">
                          <div className="flex-shrink-0 flex items-center text-[var(--primary-color)] dark:text-dark-accent font-bold text-xl">
                            ☕ CaféPOS
                          </div>
                          
                          {/* Desktop Nav */}
                          <div className="hidden md:flex space-x-1 ml-4">
                            <button 
                              onClick={() => handleNavClick(View.POS)} 
                              className={`px-3 py-2 rounded-md text-sm font-bold transition-colors ${currentView === View.POS ? 'bg-coffee-50 dark:bg-dark-bg text-coffee-700 dark:text-dark-accent' : 'text-gray-500 dark:text-dark-text-sec hover:text-gray-900 dark:hover:text-dark-text-main hover:bg-gray-50 dark:hover:bg-dark-bg'}`}
                            >
                              Punto de Venta
                            </button>
                            
                            <button 
                              onClick={() => handleNavClick(View.SALES_HISTORY)} 
                              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === View.SALES_HISTORY ? 'bg-coffee-50 dark:bg-dark-bg text-coffee-700 dark:text-dark-accent' : 'text-gray-500 dark:text-dark-text-sec hover:text-gray-900 dark:hover:text-dark-text-main hover:bg-gray-50 dark:hover:bg-dark-bg'}`}
                            >
                              Ventas
                            </button>

                            {userRole === 'admin' && (
                              <>
                                <button 
                                  onClick={() => handleNavClick(View.CUSTOMERS)} 
                                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${currentView === View.CUSTOMERS ? 'bg-coffee-50 dark:bg-dark-bg text-coffee-700 dark:text-dark-accent' : 'text-gray-500 dark:text-dark-text-sec hover:text-gray-900 dark:hover:text-dark-text-main hover:bg-gray-50 dark:hover:bg-dark-bg'}`}
                                >
                                  Clientes
                                </button>

                                {/* Inventario Dropdown */}
                                <div className="relative group">
                                     <button 
                                        onClick={() => toggleDropdown('inventory')}
                                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 dark:text-dark-text-sec hover:text-gray-900 dark:hover:text-dark-text-main hover:bg-gray-50 dark:hover:bg-dark-bg inline-flex items-center gap-1 group-hover:text-coffee-700 focus:outline-none"
                                     >
                                        Inventario ▼
                                     </button>
                                     {activeDropdown === 'inventory' && (
                                        <div className="absolute left-0 mt-0 w-48 rounded-md shadow-lg bg-white dark:bg-dark-surface ring-1 ring-black ring-opacity-5 py-1 z-50 animate-fade-in border dark:border-dark-border">
                                            <button onClick={() => handleNavClick(View.ADMIN)} className="block px-4 py-2 text-sm text-gray-700 dark:text-dark-text-sec hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left hover:text-coffee-700 dark:hover:text-dark-text-main">Productos</button>
                                            <button onClick={() => handleNavClick(View.INVENTORY)} className="block px-4 py-2 text-sm text-gray-700 dark:text-dark-text-sec hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left hover:text-coffee-700 dark:hover:text-dark-text-main">Insumos</button>
                                        </div>
                                     )}
                                </div>

                                {/* Reportes Dropdown */}
                                <div className="relative group">
                                     <button 
                                        onClick={() => toggleDropdown('reports')}
                                        className="px-3 py-2 rounded-md text-sm font-medium text-gray-500 dark:text-dark-text-sec hover:text-gray-900 dark:hover:text-dark-text-main hover:bg-gray-50 dark:hover:bg-dark-bg inline-flex items-center gap-1 group-hover:text-coffee-700 focus:outline-none"
                                     >
                                        Reportes ▼
                                     </button>
                                     {activeDropdown === 'reports' && (
                                        <div className="absolute left-0 mt-0 w-48 rounded-md shadow-lg bg-white dark:bg-dark-surface ring-1 ring-black ring-opacity-5 py-1 z-50 animate-fade-in border dark:border-dark-border">
                                            <button onClick={() => handleNavClick(View.INSIGHTS)} className="block px-4 py-2 text-sm text-gray-700 dark:text-dark-text-sec hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left hover:text-coffee-700 dark:hover:text-dark-text-main">Smart Insights 🧠</button>
                                            <button onClick={() => handleNavClick(View.FINANCE)} className="block px-4 py-2 text-sm text-gray-700 dark:text-dark-text-sec hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left hover:text-coffee-700 dark:hover:text-dark-text-main">Finanzas 💰</button>
                                            <button onClick={() => handleNavClick(View.CASH_HISTORY)} className="block px-4 py-2 text-sm text-gray-700 dark:text-dark-text-sec hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left hover:text-coffee-700 dark:hover:text-dark-text-main">Cierres de Caja</button>
                                            <button onClick={() => handleNavClick(View.DAILY_REPORT)} className="block px-4 py-2 text-sm text-gray-700 dark:text-dark-text-sec hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left hover:text-coffee-700 dark:hover:text-dark-text-main">Reporte Diario</button>
                                            <div className="border-t border-gray-100 dark:border-dark-border my-1"></div>
                                            <button onClick={() => handleNavClick(View.TELEMETRY)} className="block px-4 py-2 text-sm text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 w-full text-left">Sistema 📡</button>
                                        </div>
                                     )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Right Side: Actions */}
                        <div className="flex items-center gap-2 sm:gap-4">
                           {userRole === 'admin' && (
                             <button 
                               onClick={() => setIsThemeSettingsOpen(true)}
                               className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-dark-text-main rounded-full hover:bg-gray-100 dark:hover:bg-dark-bg transition-colors"
                               title="Tema"
                             >
                               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                               </svg>
                             </button>
                           )}

                           <div className="hidden sm:flex flex-col items-end mr-2">
                               <span className="text-xs font-bold text-gray-700 dark:text-dark-text-main">{user.email}</span>
                               <span className="text-[10px] text-gray-400 dark:text-dark-text-sec uppercase">{userRole || 'Cajero'}</span>
                           </div>

                           <button 
                                onClick={() => {
                                    if (!activeSession) {
                                        setCashModalMode('open');
                                        setIsCashModalOpen(true);
                                    } else {
                                        handleCloseRegister();
                                    }
                                }}
                                className={`text-xs sm:text-sm font-bold px-3 py-1.5 rounded-lg border transition-all ${activeSession ? 'border-red-200 text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300' : 'border-green-200 text-green-600 bg-green-50 hover:bg-green-100 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300'}`}
                            >
                                {activeSession ? 'Cerrar Caja' : 'Abrir Caja'}
                            </button>

                            <button onClick={handleLogout} className="text-sm text-gray-400 hover:text-red-600 font-medium">Salir</button>
                            
                            {/* Mobile Menu Button */}
                            <div className="md:hidden flex items-center">
                                <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="text-gray-600 hover:text-gray-900 dark:text-dark-text-sec dark:hover:text-dark-text-main p-2">
                                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Menu Dropdown */}
                    {mobileMenuOpen && (
                        <div className="md:hidden bg-white dark:bg-dark-surface border-b border-gray-200 dark:border-dark-border px-2 pt-2 pb-3 space-y-1 shadow-lg absolute w-full z-50">
                            <button onClick={() => handleNavClick(View.POS)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left">Punto de Venta</button>
                            <button onClick={() => handleNavClick(View.SALES_HISTORY)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left">Ventas</button>
                            {userRole === 'admin' && (
                                <>
                                    <button onClick={() => handleNavClick(View.CUSTOMERS)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left">Clientes</button>
                                    <div className="border-t border-gray-100 dark:border-dark-border my-1"></div>
                                    <p className="px-3 text-xs font-bold text-gray-400 uppercase mt-2">Inventario</p>
                                    <button onClick={() => handleNavClick(View.ADMIN)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left pl-6">Productos</button>
                                    <button onClick={() => handleNavClick(View.INVENTORY)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left pl-6">Insumos</button>
                                    <div className="border-t border-gray-100 dark:border-dark-border my-1"></div>
                                    <p className="px-3 text-xs font-bold text-gray-400 uppercase mt-2">Reportes</p>
                                    <button onClick={() => handleNavClick(View.INSIGHTS)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left pl-6">Insights</button>
                                    <button onClick={() => handleNavClick(View.FINANCE)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left pl-6">Finanzas</button>
                                    <button onClick={() => handleNavClick(View.DAILY_REPORT)} className="block px-3 py-2 rounded-md text-base font-medium text-gray-700 dark:text-dark-text-main hover:text-gray-900 hover:bg-gray-50 dark:hover:bg-dark-bg w-full text-left pl-6">Cierre Diario</button>
                                </>
                            )}
                        </div>
                    )}
                  </nav>

                  <main className="flex-grow p-4 overflow-hidden h-[calc(100vh-4rem)]">
                     <div className="h-full overflow-y-auto">
                        {currentView === View.POS && renderPOS()}
                        {currentView === View.ADMIN && userRole === 'admin' && (
                            isAddingNewProduct 
                            ? <AddProductForm onSuccess={() => { setIsAddingNewProduct(false); loadData(); }} onCancel={() => setIsAddingNewProduct(false)} />
                            : <ProductManagement products={products} onEdit={setEditingProduct} onDelete={handleDeleteProduct} onAddNew={() => setIsAddingNewProduct(true)} />
                        )}
                        {currentView === View.INVENTORY && userRole === 'admin' && <InventoryTable />}
                        {currentView === View.SALES_HISTORY && (
                            <SalesDashboard userRole={userRole} currentUser={user} />
                        )}
                        {currentView === View.CUSTOMERS && <CustomerList />}
                        {currentView === View.INSIGHTS && <SmartInsights />}
                        {currentView === View.FINANCE && <FinancialDashboard />}
                        {currentView === View.CASH_HISTORY && <CashSessionHistory />}
                        {currentView === View.DAILY_REPORT && <DailySalesReport />}
                        {currentView === View.TELEMETRY && userRole === 'admin' && <AdminTelemetry />}
                     </div>
                  </main>

                  {/* Modals */}
                  {editingProduct && (
                    <EditProductModal 
                        product={editingProduct} 
                        isOpen={!!editingProduct} 
                        onClose={() => setEditingProduct(null)} 
                        onSuccess={() => { setEditingProduct(null); loadData(); }} 
                    />
                  )}
                  
                  <CashRegisterModal 
                    isOpen={isCashModalOpen} 
                    mode={cashModalMode}
                    sessionData={activeSession}
                    currentUser={user}
                    onSuccess={handleRegisterSuccess}
                    onClose={() => setIsCashModalOpen(false)}
                  />

                  <PaymentModal 
                    isOpen={isPaymentModalOpen}
                    total={cartTotal}
                    onClose={() => setIsPaymentModalOpen(false)}
                    onConfirm={handlePaymentConfirm}
                    paymentStatus={paymentStatus}
                  />

                  {isThemeSettingsOpen && (
                    <ThemeSettings onClose={() => setIsThemeSettingsOpen(false)} />
                  )}
                </>
            )}
        </div>
  );
};

// Wrap main logic in Provider
const App: React.FC = () => {
  return (
    <ThemeProvider>
      <MainContent />
    </ThemeProvider>
  );
};

export default App;