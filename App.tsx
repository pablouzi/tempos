import React, { useState, useEffect, useMemo } from 'react';
import { Product, CartItem, Customer } from './types';
import { getProducts, getIngredients, processSale, deleteProduct, getUserRole, getCustomers, createCustomer } from './services/firebaseService';
import InventoryTable from './components/InventoryTable';
import AddProductForm from './components/AddProductForm';
import EditProductModal from './components/EditProductModal';
import SalesDashboard from './components/SalesDashboard';
import ProductManagement from './components/ProductManagement';
import Login from './components/Login';
import ProductCard from './components/ProductCard'; 
import CustomerList from './components/CustomerList'; 
import CustomerSearch from './components/CustomerSearch'; // Import new component
import { auth } from './firebaseConfig';
import { onAuthStateChanged, signOut } from 'firebase/auth';

enum View {
  POS = 'POS',
  ADMIN = 'ADMIN',
  ADD_PRODUCT = 'ADD_PRODUCT',
  SALES_HISTORY = 'SALES_HISTORY',
  CUSTOMERS = 'CUSTOMERS'
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(amount);
};

const TAG_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  'vegan': { label: 'Vegano', icon: '🌿', color: 'bg-green-100 text-green-800 border-green-200' },
  'gluten_free': { label: 'Sin Gluten', icon: '🚫🌾', color: 'bg-orange-100 text-orange-800 border-orange-200' },
  'sugar_free': { label: 'Sin Azúcar', icon: '🚫🍬', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  'lactose_free': { label: 'Sin Lactosa', icon: '🥛', color: 'bg-indigo-100 text-indigo-800 border-indigo-200' }
};

// --- HELPER COMPONENT: Stamp Progress Bar ---
const StampProgress: React.FC<{ stamps: number }> = ({ stamps }) => {
  const currentCycle = Math.floor(stamps / 10);
  const progress = stamps % 10;
  const canRedeemCount = currentCycle; 

  return (
    <div className="mt-1 animate-fade-in">
        <div className="flex justify-between items-end mb-1">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Meta de Sellos</span>
            <span className="text-xs font-bold text-coffee-600">{progress}/10 ({stamps} total)</span>
        </div>
        <div className="flex gap-1 h-3 mb-2">
            {[...Array(10)].map((_, i) => (
                <div 
                    key={i} 
                    className={`flex-1 rounded-sm transition-all duration-500 ${i < progress ? 'bg-coffee-500' : 'bg-gray-200'}`}
                ></div>
            ))}
        </div>
        {canRedeemCount > 0 && (
             <div className="bg-yellow-50 border border-yellow-200 rounded p-2 flex items-center gap-2 text-yellow-800 text-xs font-bold animate-bounce">
                <span>🎁</span>
                <span>¡Premio Disponible! Tienes {canRedeemCount} canje(s).</span>
             </div>
        )}
    </div>
  );
};

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'cajero' | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [currentView, setCurrentView] = useState<View>(View.POS);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredientsMap, setIngredientsMap] = useState<Record<string, string>>({});
  const [cart, setCart] = useState<CartItem[]>([]); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);

  // --- Customer Loyalty State ---
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]); // Cache for search

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoadingAuth(true);
      if (currentUser) {
        setUser(currentUser);
        const role = await getUserRole(currentUser.uid);
        setUserRole(role);
        loadData();
      } else {
        setUser(null);
        setUserRole(null);
        setProducts([]);
      }
      setLoadingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  const loadData = async () => {
    try {
      // Load Customers along with Products and Ingredients
      const [productsData, ingredientsData, customersData] = await Promise.all([
        getProducts(),
        getIngredients(),
        getCustomers()
      ]);
      setProducts(productsData);
      setAllCustomers(customersData); // Cache customers

      const map: Record<string, string> = {};
      ingredientsData.forEach(ing => {
        map[ing.id] = ing.nombre;
      });
      setIngredientsMap(map);
    } catch (error: any) {
      console.error(error);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setCart([]);
    setSelectedCustomer(null);
  };

  // --- Cart Logic ---
  const addToCart = (product: Product) => {
    const newItem: CartItem = {
      ...product,
      cartId: Math.random().toString(36).substr(2, 9),
      originalPrice: product.precio,
      isRedeemed: false
    };
    setCart(prev => [...prev, newItem]);
  };

  const decreaseQuantity = (productId: string) => {
    // Find last item of this product
    const index = cart.map(item => item.id).lastIndexOf(productId);
    if (index > -1) {
      const newCart = [...cart];
      newCart.splice(index, 1);
      setCart(newCart);
    }
  };

  const removeProductFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.id !== productId));
  };

  // --- Redemption Logic ---
  const toggleRedeemItem = (cartId: string) => {
    if (!selectedCustomer) return;

    // Calculate how many stamps are currently used by *other* redeemed items
    const currentlyRedeemedCount = cart.filter(i => i.isRedeemed && i.cartId !== cartId).length;
    const itemToToggle = cart.find(i => i.cartId === cartId);
    
    if (!itemToToggle) return;

    if (!itemToToggle.isRedeemed) {
        // Trying to REDEEM
        // Check availability: (used + 1) * 10 <= totalStamps
        if ((currentlyRedeemedCount + 1) * 10 > selectedCustomer.stamps) {
            window.Swal.fire('Insuficientes Sellos', 'El cliente no tiene suficientes sellos para canjear otro producto.', 'warning');
            return;
        }
        
        // Apply Redeem
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                return { ...item, precio: 0, isRedeemed: true };
            }
            return item;
        }));

    } else {
        // Trying to UN-REDEEM (Restore Price)
        setCart(prev => prev.map(item => {
            if (item.cartId === cartId) {
                return { ...item, precio: item.originalPrice || 0, isRedeemed: false };
            }
            return item;
        }));
    }
  };

  // --- Customer Logic (Search & Create) ---
  
  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    // Reset redemptions to avoid stale state logic
    setCart(prev => prev.map(i => ({...i, precio: i.originalPrice || 0, isRedeemed: false})));
  };

  const handleCreateNewCustomer = async (query: string) => {
    // Determine if query looks like a phone number
    const isPhone = /^[0-9+]+$/.test(query);
    
    let name = '';
    let phone = '';

    if (isPhone) {
        phone = query;
        // Ask for Name
        const { value: inputName } = await window.Swal.fire({
            title: 'Nuevo Cliente',
            text: `Teléfono: ${phone}. Ingresa el nombre:`,
            input: 'text',
            inputPlaceholder: 'Nombre del cliente',
            showCancelButton: true
        });
        if (!inputName) return;
        name = inputName;
    } else {
        name = query;
        // Ask for Phone
        const { value: inputPhone } = await window.Swal.fire({
            title: 'Nuevo Cliente',
            text: `Nombre: ${name}. Ingresa el teléfono:`,
            input: 'tel',
            inputPlaceholder: '9 1234 5678',
            showCancelButton: true
        });
        if (!inputPhone) return;
        phone = inputPhone;
    }

    try {
        const newCustomer = await createCustomer(name, phone);
        // Update local cache
        setAllCustomers(prev => [...prev, newCustomer]);
        setSelectedCustomer(newCustomer);
        window.Swal.fire('Registrado', 'Cliente creado con éxito', 'success');
    } catch (e: any) {
        window.Swal.fire('Error', e.message, 'error');
    }
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.precio, 0);

    // Prepare Summary Message
    let confirmMsg = `Total a pagar: ${formatCurrency(total)}`;
    if (selectedCustomer) {
        const stampsEarned = cart.filter(i => i.givesStamp && !i.isRedeemed).length;
        const redeemedCount = cart.filter(i => i.isRedeemed).length;
        
        confirmMsg += `\n\nCliente: ${selectedCustomer.name}`;
        if (redeemedCount > 0) confirmMsg += `\n🎁 Canjes usados: ${redeemedCount} (-${redeemedCount*10} sellos)`;
        if (stampsEarned > 0) confirmMsg += `\n🏅 Ganará: +${stampsEarned} sellos`;
    }

    const result = await window.Swal.fire({
      title: '¿Confirmar venta?',
      text: confirmMsg,
      icon: 'question',
      showCancelButton: true,
      confirmButtonColor: '#16a34a',
      confirmButtonText: 'Sí, COBRAR'
    });

    if (result.isConfirmed) {
      setIsProcessing(true);
      try {
        await processSale(cart, total, selectedCustomer?.id);
        
        let msg = 'Venta registrada.';
        if (selectedCustomer) {
             const stampsEarned = cart.filter(i => i.givesStamp && !i.isRedeemed).length;
             const redeemedCount = cart.filter(i => i.isRedeemed).length;
             
             // Optimistic Update for UI
             const newStamps = selectedCustomer.stamps + stampsEarned - (redeemedCount * 10);
             
             // Update local state and AllCustomers cache
             const updatedCustomer = { ...selectedCustomer, stamps: newStamps };
             setSelectedCustomer(updatedCustomer);
             setAllCustomers(prev => prev.map(c => c.id === updatedCustomer.id ? updatedCustomer : c));
        }

        setCart([]);
        // Ideally, we keep the customer for consecutive sales, but maybe clear cart.
        
        window.Swal.fire('¡Venta Exitosa!', msg, 'success');
      } catch (error: any) {
        window.Swal.fire('Error', error.message, 'error');
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const result = await window.Swal.fire({
        title: '¿Eliminar Producto?',
        text: 'Se borrará permanentemente.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#dc2626',
        confirmButtonText: 'Sí, borrar'
    });

    if (result.isConfirmed) {
        try {
            await deleteProduct(id);
            window.Swal.fire('Eliminado', 'Producto borrado.', 'success');
            loadData();
        } catch (e: any) {
            window.Swal.fire('Error', e.message, 'error');
        }
    }
  };
  
  const cartTotal = cart.reduce((sum, item) => sum + item.precio, 0);
  const filteredProducts = products.filter(product => 
    product.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    setIsAddingNewProduct(false); 
  };

  const NavigationButton = ({ view, label, icon }: { view: View, label: string, icon: React.ReactNode }) => (
    <button 
      onClick={() => handleNavClick(view)}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all text-sm font-bold ${
        currentView === view 
          ? 'bg-white text-green-700 shadow-sm' 
          : 'text-green-100 hover:bg-green-700 hover:text-white'
      }`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );

  const renderPOS = () => (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)]">
      {/* Products Column */}
      <div className="lg:w-[70%] flex flex-col h-full overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4 shrink-0">
          <h2 className="text-2xl font-bold text-gray-800">
             Hola, {userRole === 'admin' ? 'Administrador' : 'Cajero'} 👋
          </h2>
          <div className="relative w-full sm:w-80 group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 group-focus-within:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-lg leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-shadow shadow-sm"
              placeholder="Buscar producto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-grow overflow-y-auto pr-2 pb-20 lg:pb-0">
            {filteredProducts.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-gray-500 bg-gray-50 rounded-xl">
                    <p className="text-lg font-medium">No hay coincidencias</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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

      {/* Cart Column */}
      <div className="lg:w-[30%] flex flex-col h-[40vh] lg:h-full fixed bottom-0 left-0 right-0 lg:static z-40 bg-white lg:bg-transparent shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.2)] lg:shadow-none">
        <div className="bg-white rounded-t-xl lg:rounded-xl shadow-xl flex flex-col h-full overflow-hidden border border-gray-100">
            
            {/* Customer Section */}
            <div className="bg-coffee-50 p-4 border-b border-gray-100">
                {!selectedCustomer ? (
                    <div className="space-y-2">
                        <CustomerSearch 
                            customers={allCustomers}
                            onSelectCustomer={handleSelectCustomer}
                            onCreateNew={handleCreateNewCustomer}
                        />
                    </div>
                ) : (
                    <div className="bg-white p-3 rounded border border-green-200 shadow-sm animate-fade-in relative">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-bold text-gray-800">{selectedCustomer.name}</p>
                                <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
                            </div>
                            <button onClick={() => { setSelectedCustomer(null); setCart(c => c.map(i => ({...i, isRedeemed:false, precio: i.originalPrice||0}))); }} className="text-gray-400 hover:text-red-500">
                                ✕
                            </button>
                        </div>
                        
                        {/* Stamp Progress Bar */}
                        <StampProgress stamps={selectedCustomer.stamps} />
                    </div>
                )}
            </div>

            <div className="p-3 border-b border-gray-100 flex justify-between items-center bg-gray-50 lg:bg-white">
                <h3 className="font-bold text-lg text-gray-800">Carrito</h3>
                <span className="bg-green-100 text-green-700 font-bold px-3 py-1 rounded-full text-xs">
                    {cart.length} ítems
                </span>
            </div>

            <div className="flex-grow overflow-y-auto p-4 space-y-4">
                {cart.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 opacity-60">
                        <p>Carrito vacío</p>
                    </div>
                ) : (
                    cart.map((item, index) => {
                        const canRedeem = selectedCustomer && selectedCustomer.stamps >= 10 && item.givesStamp;
                        // Determine if we can toggle this specific item based on available vs used stamps
                        const usedStamps = cart.filter(i => i.isRedeemed).length * 10;
                        const stampsAvailable = selectedCustomer ? selectedCustomer.stamps - usedStamps : 0;
                        const isRedeemableNow = !item.isRedeemed && stampsAvailable >= 10;

                        return (
                        <div key={item.cartId} className={`flex gap-3 items-center p-2 rounded-lg transition-colors ${item.isRedeemed ? 'bg-yellow-50 border border-yellow-200' : 'bg-transparent'}`}>
                            <img src={item.imagen_url} alt="" className="w-12 h-12 rounded object-cover border border-gray-100 flex-shrink-0" />
                            <div className="flex-grow min-w-0">
                                <p className="font-semibold text-gray-800 truncate text-sm">{item.nombre}</p>
                                <div className="flex items-center gap-2">
                                    <p className={`text-sm ${item.isRedeemed ? 'text-gray-400 line-through' : 'text-gray-500'}`}>
                                        {formatCurrency(item.originalPrice || item.precio)}
                                    </p>
                                    {item.isRedeemed && (
                                        <span className="text-xs font-bold text-green-600 bg-green-100 px-2 rounded-full">GRATIS</span>
                                    )}
                                </div>
                            </div>
                            
                            <div className="flex flex-col items-end gap-2">
                                {/* Redeem Button */}
                                {canRedeem && (
                                    <button 
                                        onClick={() => toggleRedeemItem(item.cartId)}
                                        disabled={!item.isRedeemed && !isRedeemableNow}
                                        className={`text-[10px] px-2 py-1 rounded border font-bold flex items-center gap-1 transition-all
                                        ${item.isRedeemed 
                                            ? 'bg-red-100 text-red-700 border-red-200 hover:bg-red-200' 
                                            : isRedeemableNow 
                                                ? 'bg-yellow-100 text-yellow-800 border-yellow-300 hover:bg-yellow-200' 
                                                : 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'}`}
                                        title={item.isRedeemed ? "Cancelar canje" : "Canjear por 10 sellos"}
                                    >
                                        {item.isRedeemed ? '❌ Quitar' : '🎁 Canjear'}
                                    </button>
                                )}
                                
                                <button 
                                    onClick={() => {
                                        // Remove specific item by cartId
                                        setCart(prev => prev.filter(i => i.cartId !== item.cartId));
                                    }} 
                                    className="text-xs text-red-400 hover:text-red-600"
                                >
                                    Eliminar
                                </button>
                            </div>
                        </div>
                    )})
                )}
            </div>

            <div className="p-5 border-t border-gray-100 bg-gray-50">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-gray-500 font-medium">Subtotal</span>
                    <span className="text-3xl font-bold text-gray-800">{formatCurrency(cartTotal)}</span>
                </div>
                {selectedCustomer && (
                    <div className="mb-4 text-right text-xs text-green-600 font-medium flex flex-col gap-1">
                        {cart.some(i => i.isRedeemed) && (
                            <span className="text-red-500">
                                Descontando {cart.filter(i => i.isRedeemed).length * 10} sellos
                            </span>
                        )}
                        <span className="text-coffee-600">
                             Ganarás +{cart.filter(i => i.givesStamp && !i.isRedeemed).length} sellos
                        </span>
                    </div>
                )}
                <button
                    disabled={cart.length === 0 || isProcessing}
                    onClick={handleCheckout}
                    className={`w-full py-3.5 rounded-lg font-bold text-lg shadow-lg transition-all flex justify-center items-center
                    ${cart.length === 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
                >
                    {isProcessing ? "Procesando..." : "COBRAR"}
                </button>
            </div>
        </div>
      </div>
    </div>
  );

  if (loadingAuth) {
    return <div className="h-screen flex items-center justify-center text-gray-500 font-medium">Cargando sistema...</div>;
  }

  if (!user) {
    return <Login onLoginSuccess={() => loadData()} />;
  }

  return (
    <div className="h-screen bg-gray-100 flex flex-col font-sans overflow-hidden">
      {/* Navbar */}
      <nav className="bg-gradient-to-r from-coffee-700 to-coffee-600 text-white shadow-lg z-50 flex-shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
             <div className="flex items-center gap-4">
                <div className="bg-white text-coffee-700 p-2 rounded-full shadow-inner font-bold text-lg h-10 w-10 flex items-center justify-center select-none">
                    ☕
                </div>
                <div>
                    <h1 className="text-xl font-bold tracking-tight leading-none">CaféPOS</h1>
                    <p className="text-[10px] text-coffee-200 uppercase tracking-widest font-semibold">{userRole === 'admin' ? 'Administrador' : 'Cajero'}</p>
                </div>
             </div>
             
             <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
                <NavigationButton 
                    view={View.POS} 
                    label="Venta"
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>}
                />
                
                {userRole === 'admin' && (
                    <>
                    <NavigationButton 
                        view={View.ADMIN} 
                        label="Inventario"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>}
                    />
                    <NavigationButton 
                        view={View.ADD_PRODUCT} 
                        label="Productos"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>}
                    />
                    <NavigationButton 
                        view={View.CUSTOMERS} 
                        label="Clientes"
                        icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>}
                    />
                    </>
                )}

                <NavigationButton 
                    view={View.SALES_HISTORY} 
                    label={userRole === 'admin' ? "Reportes" : "Historial"}
                    icon={<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>}
                />

                <div className="h-6 w-px bg-coffee-500 mx-2"></div>

                <button 
                    onClick={handleLogout}
                    className="bg-coffee-800 p-2 rounded-lg hover:bg-red-600 transition-colors text-white shadow-sm"
                    title="Cerrar Sesión"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                </button>
             </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow p-4 lg:p-6 overflow-hidden relative">
         <div className="max-w-7xl mx-auto h-full overflow-y-auto pr-2 pb-20 lg:pb-0 scrollbar-thin scrollbar-thumb-coffee-200 scrollbar-track-transparent">
            {currentView === View.POS && renderPOS()}
            
            {currentView === View.ADMIN && userRole === 'admin' && (
                <InventoryTable />
            )}

            {currentView === View.SALES_HISTORY && (
                <SalesDashboard userRole={userRole} />
            )}

            {currentView === View.CUSTOMERS && userRole === 'admin' && (
                <CustomerList />
            )}

            {currentView === View.ADD_PRODUCT && userRole === 'admin' && (
                isAddingNewProduct ? (
                     <AddProductForm 
                        onSuccess={() => { setIsAddingNewProduct(false); loadData(); }}
                        onCancel={() => setIsAddingNewProduct(false)}
                     />
                ) : (
                    <ProductManagement 
                        products={products}
                        onEdit={(p) => setEditingProduct(p)}
                        onDelete={handleDeleteProduct}
                        onAddNew={() => setIsAddingNewProduct(true)}
                    />
                )
            )}
         </div>
      </main>

      {/* Modals */}
      {editingProduct && (
        <EditProductModal 
            isOpen={!!editingProduct}
            product={editingProduct}
            onClose={() => setEditingProduct(null)}
            onSuccess={() => { setEditingProduct(null); loadData(); }}
        />
      )}
    </div>
  );
};

export default App;