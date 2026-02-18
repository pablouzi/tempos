import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutGrid, 
  ShoppingBag, 
  Users, 
  Package, 
  BarChart3, 
  PieChart, 
  FileText, 
  Activity, 
  LogOut, 
  Settings, 
  ChevronLeft, 
  ChevronRight, 
  Coffee,
  Search,
  Lock,
  Unlock,
  LucideIcon,
  X,
  Clock, // Imported Clock for Pending Orders
  PauseCircle, // Imported PauseCircle
  Plus,
  Minus
} from 'lucide-react';
import { Product, CartItem, Customer, PaymentMethod, CashSession, PendingOrder } from './types';
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
import PendingOrdersModal from './components/PendingOrdersModal'; // Imported Modal
import { ThemeProvider, useTheme } from './context/ThemeContext';
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

const MainContent: React.FC = () => {
  const { settings } = useTheme();
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'cajero' | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Layout State
  const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 1280);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const [currentView, setCurrentView] = useState<View>(View.POS);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredientsMap, setIngredientsMap] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartItem[]>([]); 
  
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todos");
  const [topSellingNames, setTopSellingNames] = useState<string[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);
  const [isThemeSettingsOpen, setIsThemeSettingsOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]); 
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeSession, setActiveSession] = useState<CashSession | null>(null);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [cashModalMode, setCashModalMode] = useState<'open' | 'close'>('open');

  // --- Pending Orders State ---
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [isPendingOrdersModalOpen, setIsPendingOrdersModalOpen] = useState(false);

  // --- Persistence for Pending Orders ---
  useEffect(() => {
    const saved = localStorage.getItem('app_pending_orders');
    if (saved) {
      try {
        setPendingOrders(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load pending orders", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('app_pending_orders', JSON.stringify(pendingOrders));
  }, [pendingOrders]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingAuth(true);
      if (currentUser) {
        setUser(currentUser);
        try {
            const role = await getUserRole(currentUser.uid);
            setUserRole(role);
            loadData();
            calculateBestSellers();
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
    
    // Resize Listener to auto-collapse on small screens
    const handleResize = () => {
        if (window.innerWidth < 1280) {
            setIsCollapsed(true);
        }
        // Auto close cart on desktop resize if needed, or keep it manageable
        if (window.innerWidth >= 1280) {
            setIsCartOpen(false); // Reset mobile state when going desktop
        }
    };
    window.addEventListener('resize', handleResize);

    return () => {
        unsubscribe();
        window.removeEventListener('resize', handleResize);
    };
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

  const calculateBestSellers = async () => {
    try {
        const salesHistory = await getSalesHistory();
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

  const addToCart = (product: Product) => {
    setCart(prev => {
      // Check if product exists with same isRedeemed status (default false when adding)
      const existingItem = prev.find(item => item.id === product.id && !item.isRedeemed);
      
      if (existingItem) {
        return prev.map(item => 
          item.cartId === existingItem.cartId 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      const newItem: CartItem = {
        ...product,
        cartId: Math.random().toString(36).substr(2, 9),
        originalPrice: product.precio,
        isRedeemed: false,
        quantity: 1
      };
      return [...prev, newItem];
    });
  };

  const updateQuantity = (cartId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.cartId === cartId) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }).filter(item => item.quantity > 0));
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
      const total = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
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
           const stampsEarned = cart.reduce((acc, i) => acc + (i.givesStamp && !i.isRedeemed ? i.quantity : 0), 0);
           const redeemedCount = cart.reduce((acc, i) => acc + (i.isRedeemed ? i.quantity : 0), 0);
           
           const newStamps = customerSnapshot.stamps + stampsEarned - (redeemedCount * 10);
           const updatedCustomer = { ...customerSnapshot, stamps: newStamps };
           setSelectedCustomer(updatedCustomer);
           setAllCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
      }

      setTimeout(() => {
          setIsPaymentModalOpen(false);
          // Close mobile cart drawer if open
          setIsCartOpen(false);
          setCart([]);
          setPaymentStatus('idle');
          calculateBestSellers();
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

  // --- Pending Orders Handlers ---

  const handleSavePending = () => {
    if (cart.length === 0) {
      window.Swal.fire('Carrito Vacío', 'Agrega productos antes de dejar pendiente.', 'warning');
      return;
    }

    const newOrder: PendingOrder = {
      id: Math.random().toString(36).substr(2, 9),
      customer: selectedCustomer || null,
      items: [...cart],
      total: cartTotal,
      timestamp: new Date().toISOString(),
      status: 'pending'
    };

    setPendingOrders(prev => [newOrder, ...prev]);
    
    // Clear current state
    setCart([]);
    setSelectedCustomer(null);
    setIsCartOpen(false); // Close mobile drawer if open

    const Toast = window.Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    Toast.fire({ icon: 'success', title: 'Pedido dejado en Pendiente 🕒' });
  };

  const handleResumeOrder = (order: PendingOrder) => {
    if (cart.length > 0) {
      window.Swal.fire({
        title: 'Carrito no vacío',
        text: '¿Deseas reemplazar el carrito actual con el pedido pendiente?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, reemplazar',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          performResume(order);
        }
      });
    } else {
      performResume(order);
    }
  };

  const performResume = (order: PendingOrder) => {
    setCart(order.items);
    setSelectedCustomer(order.customer || null);
    
    // Remove from pending list
    setPendingOrders(prev => prev.filter(o => o.id !== order.id));
    
    // Close Modal and Switch to POS view
    setIsPendingOrdersModalOpen(false);
    setCurrentView(View.POS);
    
    const Toast = window.Swal.mixin({ toast: true, position: 'top-end', showConfirmButton: false, timer: 2000 });
    Toast.fire({ icon: 'info', title: 'Pedido recuperado 🚀' });
  };

  const handleDeletePendingOrder = (id: string) => {
    window.Swal.fire({
        title: '¿Eliminar Pedido?',
        text: 'Se borrará permanentemente de la lista de pendientes.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#d33',
        confirmButtonText: 'Eliminar'
    }).then((result) => {
        if (result.isConfirmed) {
            setPendingOrders(prev => prev.filter(o => o.id !== id));
            window.Swal.fire('Eliminado', 'Pedido pendiente borrado.', 'success');
        }
    });
  };
  
  const cartTotal = cart.reduce((sum, item) => sum + (item.precio * item.quantity), 0);
  
  const filteredProducts = useMemo(() => {
    return products.map(product => ({
      ...product,
      category: product.category || 'General' 
    })).filter(product => {
      const matchesSearch = product.nombre.toLowerCase().includes(searchTerm.toLowerCase());
      
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
    // Close cart drawer if open on nav change
    setIsCartOpen(false);
  };

  // --- LAYOUT COMPONENTS ---

  const NavItem = ({ view, label, icon: Icon, badge }: { view: View, label: string, icon: LucideIcon, badge?: number }) => {
      const isActive = currentView === view;
      return (
        <button
            onClick={() => handleNavClick(view)}
            className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 group rounded-lg mb-1 relative
            ${isActive 
                ? 'bg-brand-orange text-white shadow-md' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }
            ${isCollapsed ? 'justify-center' : 'justify-start'}
            `}
            title={isCollapsed ? label : ''}
        >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
            <span className={`font-semibold text-sm whitespace-nowrap overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                {label}
            </span>
            {badge !== undefined && badge > 0 && (
                <span className={`absolute top-2 right-2 bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full ${isCollapsed ? 'top-1 right-1' : ''}`}>
                    {badge}
                </span>
            )}
        </button>
      );
  };

  if (loadingAuth) return <div className="min-h-screen flex items-center justify-center bg-brand-bg text-gray-500">Cargando...</div>;

  return (
        <div className="h-screen w-full flex overflow-hidden bg-[var(--main-bg)] font-sans text-[length:var(--base-scale)] relative">
            {!user ? (
                <Login onLoginSuccess={() => {}} />
            ) : (
                <>
                  {/* COLUMN 1: LEFT SIDEBAR */}
                  <aside className={`bg-[var(--sidebar-bg)] flex flex-col h-full flex-shrink-0 z-30 shadow-xl transition-all duration-300 relative ${isCollapsed ? 'w-20' : 'w-64'}`}>
                      
                      {/* Logo & Toggle Area */}
                      <div className={`h-20 flex items-center px-4 ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
                          <div className="flex items-center gap-3 overflow-hidden">
                              <div className="bg-brand-orange p-2 rounded-xl flex-shrink-0 shadow-lg">
                                 <Coffee className="text-white h-6 w-6" />
                              </div>
                              <h1 className={`text-white font-bold text-xl tracking-tight whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                                  Steamcup
                              </h1>
                          </div>
                          
                          {/* Toggle Button (Hidden if collapsed, uses absolute positioning to float on edge if needed, or inside header) */}
                          <button 
                            onClick={() => setIsCollapsed(!isCollapsed)}
                            className={`text-gray-400 hover:text-white transition-colors ${isCollapsed ? 'hidden' : 'block'}`}
                          >
                             <ChevronLeft size={20} />
                          </button>
                      </div>

                      {/* Explicit Collapsed Toggle Button (Centered when collapsed) */}
                      {isCollapsed && (
                          <div className="flex justify-center pb-4">
                              <button onClick={() => setIsCollapsed(false)} className="text-gray-500 hover:text-white">
                                  <ChevronRight size={20} />
                              </button>
                          </div>
                      )}

                      {/* Navigation */}
                      <nav className="flex-1 px-1 py-4 space-y-1 overflow-y-auto scrollbar-hide">
                          <NavItem view={View.POS} label="Productos" icon={LayoutGrid} />
                          
                          {/* Pending Orders Button (Custom) */}
                          <button
                            onClick={() => setIsPendingOrdersModalOpen(true)}
                            className={`w-full flex items-center gap-3 px-4 py-3 transition-all duration-200 group rounded-lg mb-1 relative text-gray-400 hover:text-white hover:bg-white/5
                            ${isCollapsed ? 'justify-center' : 'justify-start'}
                            `}
                            title={isCollapsed ? 'Pedidos Pendientes' : ''}
                          >
                             <Clock size={22} strokeWidth={2} className="text-orange-400" />
                             <span className={`font-semibold text-sm whitespace-nowrap overflow-hidden transition-all duration-300 text-orange-100 ${isCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}>
                                Pendientes
                             </span>
                             {pendingOrders.length > 0 && (
                                <span className={`absolute top-2 right-2 bg-orange-500 text-white text-[10px] font-bold w-5 h-5 flex items-center justify-center rounded-full ${isCollapsed ? 'top-1 right-1' : ''}`}>
                                    {pendingOrders.length}
                                </span>
                             )}
                          </button>

                          <NavItem view={View.SALES_HISTORY} label="Historial Ventas" icon={ShoppingBag} />
                          
                          {userRole === 'admin' && (
                              <>
                                <div className={`my-4 border-t border-white/10 ${isCollapsed ? 'mx-2' : 'mx-4'}`}></div>
                                
                                {!isCollapsed && <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Administración</p>}
                                
                                <NavItem view={View.CUSTOMERS} label="Clientes" icon={Users} />
                                <NavItem view={View.ADMIN} label="Productos" icon={Package} />
                                <NavItem view={View.INVENTORY} label="Insumos" icon={Package} />
                                
                                <div className={`my-4 border-t border-white/10 ${isCollapsed ? 'mx-2' : 'mx-4'}`}></div>
                                
                                {!isCollapsed && <p className="px-4 text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Finanzas</p>}

                                <NavItem view={View.DAILY_REPORT} label="CafeinAi" icon={FileText} />
                                <NavItem view={View.INSIGHTS} label="Smart Insights" icon={Activity} />
                                <NavItem view={View.FINANCE} label="Rentabilidad" icon={PieChart} />
                                <NavItem view={View.TELEMETRY} label="Sistema Logs" icon={BarChart3} />
                              </>
                          )}
                      </nav>

                      {/* Cash Register Action */}
                      <div className="px-3 pb-4 pt-2">
                            <button 
                                onClick={() => {
                                    if (!activeSession) {
                                        setCashModalMode('open');
                                        setIsCashModalOpen(true);
                                    } else {
                                        handleCloseRegister();
                                    }
                                }}
                                className={`w-full py-3 rounded-xl font-bold text-sm shadow-lg transition-all transform active:scale-95 flex items-center gap-3 overflow-hidden
                                ${activeSession 
                                    ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20' 
                                    : 'bg-green-500/10 text-green-400 hover:bg-green-500/20 border border-green-500/20'}
                                ${isCollapsed ? 'justify-center px-0' : 'justify-center px-4'}
                                `}
                                title={activeSession ? 'Cerrar Caja' : 'Abrir Caja'}
                            >
                                {activeSession ? <Lock size={20} /> : <Unlock size={20} />}
                                <span className={`whitespace-nowrap transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100 block'}`}>
                                    {activeSession ? 'Cerrar Caja' : 'Abrir Caja'}
                                </span>
                            </button>
                        </div>

                      {/* Bottom User Area */}
                      <div className="p-4 border-t border-white/10 bg-black/20">
                          <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                              <div className="w-9 h-9 rounded-full bg-gray-700 flex items-center justify-center text-white font-bold flex-shrink-0 shadow-inner">
                                  {user.email?.[0].toUpperCase()}
                              </div>
                              <div className={`overflow-hidden transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                                  <p className="text-white text-xs font-medium truncate w-32">{user.email}</p>
                                  <p className="text-gray-400 text-[10px] uppercase">{userRole === 'admin' ? 'Manager' : 'Staff'}</p>
                              </div>
                          </div>
                          
                          <div className={`flex items-center gap-2 mt-3 ${isCollapsed ? 'flex-col' : 'flex-row'}`}>
                                <button 
                                    onClick={() => setIsThemeSettingsOpen(true)}
                                    className="p-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors"
                                    title="Configuración"
                                >
                                    <Settings size={18} />
                                </button>
                                <button 
                                    onClick={handleLogout} 
                                    className={`flex-grow py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-red-900/50 hover:text-red-200 text-xs font-bold transition-colors flex items-center justify-center gap-2 ${isCollapsed ? 'w-full' : ''}`}
                                    title="Salir"
                                >
                                    <LogOut size={18} />
                                    {!isCollapsed && <span>Salir</span>}
                                </button>
                          </div>
                      </div>
                  </aside>

                  {/* MAIN CONTENT AREA WRAPPER */}
                  <main className="flex-1 h-full overflow-hidden bg-[var(--main-bg)] relative flex flex-row">
                        
                        {/* COLUMN 2: CENTER CONTENT (Dynamic Grid) */}
                        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
                            {currentView === View.POS ? (
                                <div className="flex flex-col h-full p-4 lg:p-6 pb-24 lg:pb-6">
                                    {/* Header & Search */}
                                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                                        <h1 className="text-2xl lg:text-3xl font-bold text-[var(--text-dark)]">Menu</h1>
                                        <div className="relative w-full sm:w-72 group">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Search className="h-5 w-5 text-gray-400 group-focus-within:text-[var(--primary-color)] transition-colors" />
                                            </div>
                                            <input 
                                                type="text" 
                                                placeholder="Buscar productos..." 
                                                className="pl-10 pr-4 py-2.5 rounded-full bg-[var(--card-bg)] border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-[var(--primary-color)] w-full shadow-sm text-[var(--text-dark)] transition-all"
                                                value={searchTerm}
                                                onChange={(e) => setSearchTerm(e.target.value)}
                                            />
                                        </div>
                                    </div>

                                    {/* Category Filter */}
                                    <div className="mb-6 flex-shrink-0">
                                        <CategoryBar products={products} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
                                    </div>

                                    {/* Liquid Products Grid */}
                                    <div className="flex-grow overflow-y-auto pb-20 pr-2 scrollbar-hide">
                                        {filteredProducts.length === 0 ? (
                                            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                                                <Package size={48} className="mb-2 opacity-50" />
                                                <p>No se encontraron productos.</p>
                                                <button onClick={() => setSelectedCategory('Todos')} className="text-[var(--primary-color)] mt-2 font-bold underline">Ver todos</button>
                                            </div>
                                        ) : (
                                            <div 
                                                className="grid gap-4 lg:gap-5 transition-all duration-300" 
                                                style={{ 
                                                    // Safety Floor Logic: Ensure min 140px width for 2-col on mobile
                                                    gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, max(140px, 100% / ${settings.posColumns + 0.1})), 1fr))` 
                                                }}
                                            >
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
                            ) : (
                                /* Non-POS Views Container */
                                <div className="h-full overflow-y-auto p-6 md:p-10 scrollbar-hide">
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
                            )}
                        </div>

                        {/* COLUMN 3: RIGHT CART (Responsive Drawer) */}
                        {currentView === View.POS && (
                            <>
                                {/* Mobile Overlay Backdrop */}
                                {isCartOpen && (
                                    <div 
                                        className="fixed inset-0 bg-black/50 z-40 xl:hidden backdrop-blur-sm"
                                        onClick={() => setIsCartOpen(false)}
                                    />
                                )}

                                <div className={`
                                    fixed inset-y-0 right-0 z-50 w-full md:max-w-md bg-[var(--cart-bg)] shadow-2xl transition-transform duration-300 ease-in-out
                                    ${isCartOpen ? 'translate-x-0' : 'translate-x-full'}
                                    xl:translate-x-0 xl:static xl:w-[400px] xl:block xl:shadow-2xl xl:z-10
                                    border-l border-gray-200 dark:border-gray-800
                                    flex flex-col h-full
                                `}>
                                    {/* Mobile Header for Drawer */}
                                    <div className="xl:hidden flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700 bg-[var(--cart-bg)]">
                                        <h2 className="text-lg font-bold text-[var(--text-dark)] flex items-center gap-2">
                                            <ShoppingBag size={20} /> Carrito
                                        </h2>
                                        <button 
                                            onClick={() => setIsCartOpen(false)}
                                            className="p-2 bg-gray-200 dark:bg-gray-700 rounded-full text-gray-600 dark:text-gray-300"
                                        >
                                            <X size={20} />
                                        </button>
                                    </div>

                                    <div className="p-5 flex flex-col h-full overflow-hidden">
                                        
                                        {/* Customer Selector */}
                                        <div className="mb-6 flex-shrink-0">
                                            {!selectedCustomer ? (
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <Users className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                    <CustomerSearch customers={allCustomers} onSelectCustomer={handleSelectCustomer} onCreateNew={handleCreateNewCustomer} />
                                                </div>
                                            ) : (
                                                <div className="bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 flex justify-between items-center shadow-sm">
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-[var(--text-dark)] truncate">{selectedCustomer.name}</p>
                                                        <div className="flex items-center gap-1 text-xs text-[var(--primary-color)] font-bold">
                                                            <span>🏅</span>
                                                            <span>{selectedCustomer.stamps} Sellos</span>
                                                        </div>
                                                    </div>
                                                    <button onClick={() => setSelectedCustomer(null)} className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0">
                                                        <LogOut size={16} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>

                                        <h2 className="text-xl font-bold text-[var(--text-dark)] mb-4 flex items-center gap-2 hidden xl:flex">
                                            <ShoppingBag className="h-5 w-5" />
                                            Orden Actual
                                        </h2>

                                        {/* Cart Items List */}
                                        <div className="flex-grow overflow-y-auto space-y-3 mb-4 pr-1 scrollbar-hide">
                                            {cart.length === 0 ? (
                                                <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-50">
                                                    <ShoppingBag size={48} strokeWidth={1} className="mb-2" />
                                                    <p>El carrito está vacío</p>
                                                </div>
                                            ) : (
                                                cart.map((item) => (
                                                    <div key={item.cartId} className="bg-white dark:bg-gray-800 p-2 rounded-xl flex items-center gap-3 shadow-sm border border-transparent hover:border-[var(--primary-color)] transition-all group">
                                                        <img src={item.imagen_url} alt="" className="w-12 h-12 rounded-lg object-cover bg-gray-100" />
                                                        <div className="flex-grow min-w-0">
                                                            <h4 className="font-bold text-[var(--text-dark)] text-sm truncate">{item.nombre}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <p className="text-[var(--primary-color)] font-bold text-sm">{formatCurrency(item.precio * item.quantity)}</p>
                                                                {item.isRedeemed && <span className="text-[10px] bg-green-100 text-green-700 px-1.5 rounded-full font-bold">FREE</span>}
                                                            </div>
                                                        </div>
                                                        
                                                        {/* Quantity Controls */}
                                                        <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                                                            <button 
                                                                onClick={() => updateQuantity(item.cartId, -1)}
                                                                className="p-1 text-gray-500 hover:text-red-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 rounded transition-colors"
                                                            >
                                                                <Minus size={14} />
                                                            </button>
                                                            <span className="text-xs font-bold text-gray-700 dark:text-gray-200 min-w-[16px] text-center">
                                                                {item.quantity}
                                                            </span>
                                                            <button 
                                                                onClick={() => updateQuantity(item.cartId, 1)}
                                                                className="p-1 text-gray-500 hover:text-green-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-600 rounded transition-colors"
                                                            >
                                                                <Plus size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>

                                        {/* Footer Actions */}
                                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
                                            <div className="flex justify-between items-center mb-2 text-gray-500 dark:text-gray-400">
                                                <span>Subtotal</span>
                                                <span className="font-medium">{formatCurrency(cartTotal)}</span>
                                            </div>
                                            <div className="flex justify-between items-center mb-6">
                                                <span className="text-xl font-bold text-[var(--text-dark)]">Total</span>
                                                <span className="text-3xl font-bold text-[var(--primary-color)]">{formatCurrency(cartTotal)}</span>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <button 
                                                    onClick={handleSavePending}
                                                    className="py-3.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm flex items-center justify-center gap-2"
                                                >
                                                    <PauseCircle size={16} />
                                                    Pendiente
                                                </button>
                                                <button 
                                                    disabled={cart.length === 0}
                                                    onClick={handleOpenPayment}
                                                    className={`py-3.5 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95 text-sm flex justify-center items-center gap-2
                                                    ${cart.length === 0 ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed' : 'bg-[var(--primary-color)] hover:brightness-110'}`}
                                                >
                                                    <span>Pagar</span>
                                                    <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                  </main>

                  {/* FAB: Floating Action Button for Mobile Cart (Visible only < xl) */}
                  {currentView === View.POS && !isCartOpen && (
                    <button 
                        onClick={() => setIsCartOpen(true)}
                        className="xl:hidden fixed bottom-6 right-6 z-40 bg-[var(--primary-color)] text-white p-4 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform animate-bounce-in"
                    >
                        <ShoppingBag size={24} />
                        {cart.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-[var(--main-bg)]">
                                {cart.reduce((acc, item) => acc + item.quantity, 0)}
                            </span>
                        )}
                        <span className="font-bold text-sm ml-1">{formatCurrency(cartTotal)}</span>
                    </button>
                  )}

                  {/* Modals Layer */}
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

                  {/* Pending Orders Modal */}
                  <PendingOrdersModal 
                    isOpen={isPendingOrdersModalOpen}
                    orders={pendingOrders}
                    onClose={() => setIsPendingOrdersModalOpen(false)}
                    onResume={handleResumeOrder}
                    onDelete={handleDeletePendingOrder}
                  />
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