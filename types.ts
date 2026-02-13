// Data Models
export interface Ingredient {
  id: string;
  nombre: string; // e.g., "Café en Grano"
  unidad: string; // e.g., "g", "ml"
  stock: number;
  stockMinimo?: number; // Threshold for low stock alerta
  costoPorUnidad?: number; // New: Cost per unit (e.g., cost of 1g of coffee)
}

export interface RecipeItem {
  idInsumo: string;
  cantidadRequerida: number;
}

export interface Product {
  id: string;
  nombre: string;
  precio: number;
  imagen_url: string;
  category?: string; // New: Category for filtering (e.g., "Cafetería", "Pastelería")
  receta: RecipeItem[];
  tags?: string[]; // e.g., ['vegan', 'gluten_free']
  descripcion?: string; // e.g., "Leche de almendras y stevia"
  givesStamp?: boolean; // New: Does this product grant a loyalty stamp?
  costoCompra?: number; // New: Direct cost for resale items (no recipe)
}

export interface CartItem extends Product {
  cartId: string; // Unique ID for the item in cart
  isRedeemed?: boolean; // New: Is this item being claimed for free?
  originalPrice?: number; // To restore price if un-redeemed
}

// New Interface for Pending Orders (Fiados/Pendientes)
export interface PendingOrder {
  id: string;
  customer?: Customer | null;
  items: CartItem[];
  total: number;
  timestamp: string; // ISO String for storage compatibility
  status: 'pending';
}

export type SaleStatus = 'completed' | 'pending_void' | 'voided';

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'otro';

export interface WeatherSnapshot {
  temp: number;
  condition: string; // Human readable description
  code: number; // WMO code
  category: 'Lluvioso' | 'Nublado' | 'Despejado' | 'Normal'; // Business Category
}

export interface Sale {
  id?: string;
  fecha: any; // Firestore Timestamp
  total: number;
  items: {
    nombre: string;
    precio: number;
    cantidad: number;
    isRedeemed?: boolean; // Track in history if it was free
  }[];
  customerId?: string; // Optional: Linked customer
  pointsEarned?: number; // Kept for legacy compatibility
  stampsEarned?: number; // New: Stamps earned in this sale
  stampsSpent?: number; // New: Stamps used in this sale
  
  status?: SaleStatus;
  voidReason?: string;
  voidRequestedBy?: string; // User email/id who requested
  voidProcessedBy?: string; // Admin email/id who approved/rejected
  
  weatherSnapshot?: WeatherSnapshot; // New: Weather at time of sale
  costoTotal?: number; // New: COGS (Cost of Goods Sold) for this transaction
  
  // Payment Details
  paymentMethod?: PaymentMethod;
  amountReceived?: number; // Solo si es efectivo
  change?: number; // Vuelto entregado
}

export interface CashSession {
  id: string;
  openedBy: string; // User ID or Name
  openTime: any; // Timestamp
  closeTime: any | null; // Timestamp
  initialBalance: number; // Base cash
  expectedCash: number; // System calculated (Base + Sales)
  salesCash: number; // Total sold in cash during session
  salesCard: number; // Total sold in card
  salesOther: number; // Total sold in other
  actualCash: number | null; // Counted by cashier
  difference: number | null; // Actual - Expected
  status: 'open' | 'closed';
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // Unique identifier for search
  points: number; // Legacy, kept for compatibility or secondary system
  stamps: number; // New: Current stamp balance
  lastVisit: any; // Firestore Timestamp
}

export interface LogEntry {
  id: string;
  message: string;
  context: string; // e.g., 'Venta', 'Login'
  timestamp: any; // Firestore Timestamp
  deviceInfo: string;
  syncStatus: 'online' | 'offline';
  metadata?: string; // JSON string for extra data
}

// Global declaration for SweetAlert2 (loaded via CDN)
declare global {
  interface Window {
    Swal: any;
  }
}