// Data Models
export interface Ingredient {
  id: string;
  nombre: string; // e.g., "Café en Grano"
  unidad: string; // e.g., "g", "ml"
  stock: number;
  stockMinimo?: number; // Threshold for low stock alert
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
  receta: RecipeItem[];
  tags?: string[]; // e.g., ['vegan', 'gluten_free']
  descripcion?: string; // e.g., "Leche de almendras y stevia"
  givesStamp?: boolean; // New: Does this product grant a loyalty stamp?
}

export interface CartItem extends Product {
  cartId: string; // Unique ID for the item in cart
  isRedeemed?: boolean; // New: Is this item being claimed for free?
  originalPrice?: number; // To restore price if un-redeemed
}

export type SaleStatus = 'completed' | 'pending_void' | 'voided';

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
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // Unique identifier for search
  points: number; // Legacy, kept for compatibility or secondary system
  stamps: number; // New: Current stamp balance
  lastVisit: any; // Firestore Timestamp
}

// Global declaration for SweetAlert2 (loaded via CDN)
declare global {
  interface Window {
    Swal: any;
  }
}