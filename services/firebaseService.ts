import {
  collection,
  getDocs,
  getDoc,
  doc,
  runTransaction,
  serverTimestamp,
  addDoc,
  writeBatch,
  deleteDoc,
  updateDoc,
  query,
  orderBy,
  where,
  Timestamp,
  limit
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Product, Ingredient, CartItem, Sale, Customer, PaymentMethod, CashSession } from "../types";
import { getCurrentWeather } from "./weatherService"; // Import weather service

const COLLECTION_PRODUCTS = "productos";
const COLLECTION_INGREDIENTS = "insumos";
const COLLECTION_SALES = "ventas";
const COLLECTION_USERS = "users";
const COLLECTION_CUSTOMERS = "customers";
const COLLECTION_CASH_SESSIONS = "cash_sessions";

// --- Auth & Roles ---

export const getUserRole = async (uid: string): Promise<'admin' | 'cajero' | null> => {
  try {
    const userDoc = await getDoc(doc(db, COLLECTION_USERS, uid));
    if (userDoc.exists()) {
      return userDoc.data().role as 'admin' | 'cajero';
    }
    return null;
  } catch (error) {
    console.error("Error fetching user role:", error);
    return null;
  }
};

// --- Fetch Data ---

export const getProducts = async (): Promise<Product[]> => {
  const querySnapshot = await getDocs(collection(db, COLLECTION_PRODUCTS));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product));
};

export const getIngredients = async (): Promise<Ingredient[]> => {
  const querySnapshot = await getDocs(collection(db, COLLECTION_INGREDIENTS));
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ingredient));
};

export const getSalesHistory = async (): Promise<Sale[]> => {
  try {
    const salesRef = collection(db, COLLECTION_SALES);
    // Order by date descending (newest first)
    const q = query(salesRef, orderBy("fecha", "desc"));
    const querySnapshot = await getDocs(q);

    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        status: data.status || 'completed' // Default legacy sales to completed
      } as Sale;
    });
  } catch (error) {
    console.error("Error fetching sales history:", error);
    throw error;
  }
};

// NEW: Get Sales by Date Range for Daily Report
export const getSalesByDateRange = async (startDate: Date, endDate: Date): Promise<Sale[]> => {
  try {
    const salesRef = collection(db, COLLECTION_SALES);
    const q = query(
      salesRef,
      where("fecha", ">=", startDate),
      where("fecha", "<=", endDate),
      orderBy("fecha", "desc")
    );

    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        status: data.status || 'completed'
      } as Sale;
    });
  } catch (error) {
    console.error("Error fetching sales by date range:", error);
    throw error;
  }
};

// --- CASH REGISTER (ARQUEO) SERVICES ---

export const getActiveCashSession = async (): Promise<CashSession | null> => {
  try {
    // Find a session that is 'open'
    // Note: In a real multi-POS system, filter by device ID or User ID if needed.
    // For now, we assume one global register per store logic.
    const q = query(collection(db, COLLECTION_CASH_SESSIONS), where("status", "==", "open"), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0];
      return { id: docData.id, ...docData.data() } as CashSession;
    }
    return null;
  } catch (e) {
    console.error("Error checking active session", e);
    return null;
  }
};

export const openCashSession = async (initialBalance: number, userId: string) => {
  // Verify no open session exists
  const active = await getActiveCashSession();
  if (active) throw new Error("Ya existe una caja abierta.");

  const sessionData = {
    openedBy: userId,
    openTime: serverTimestamp(),
    closeTime: null,
    initialBalance: initialBalance,
    expectedCash: initialBalance,
    salesCash: 0,
    salesCard: 0,
    salesOther: 0,
    actualCash: null,
    difference: null,
    status: 'open'
  };

  await addDoc(collection(db, COLLECTION_CASH_SESSIONS), sessionData);
};

export const closeCashSession = async (sessionId: string, actualCash: number) => {
  const ref = doc(db, COLLECTION_CASH_SESSIONS, sessionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Sesión no encontrada");

  const data = snap.data() as CashSession;
  const expected = data.expectedCash;
  const diff = actualCash - expected;

  await updateDoc(ref, {
    status: 'closed',
    closeTime: serverTimestamp(),
    actualCash: actualCash,
    difference: diff
  });
};

export const getCashSessionsHistory = async (): Promise<CashSession[]> => {
  const q = query(collection(db, COLLECTION_CASH_SESSIONS), orderBy("openTime", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as CashSession));
};


// --- Customer Loyalty Services ---

export const getCustomerByPhone = async (phone: string): Promise<Customer | null> => {
  try {
    const q = query(collection(db, COLLECTION_CUSTOMERS), where("phone", "==", phone));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0];
      const data = docData.data();
      return {
        id: docData.id,
        ...data,
        stamps: data.stamps || 0 // Ensure stamps exists
      } as Customer;
    }
    return null;
  } catch (error) {
    console.error("Error finding customer:", error);
    return null;
  }
};

export const getCustomers = async (): Promise<Customer[]> => {
  try {
    // Order by stamps descending to see top customers first
    const q = query(collection(db, COLLECTION_CUSTOMERS), orderBy("stamps", "desc"));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        stamps: data.stamps || 0
      } as Customer;
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    throw error;
  }
};

export const createCustomer = async (name: string, phone: string): Promise<Customer> => {
  // Check if phone exists first to avoid duplicates
  const existing = await getCustomerByPhone(phone);
  if (existing) throw new Error("El teléfono ya está registrado.");

  const newCustomerData = {
    name,
    phone,
    points: 0,
    stamps: 0, // Init stamps
    lastVisit: serverTimestamp(),
    totalPurchases: 0,
    totalSpent: 0
  };

  const docRef = await addDoc(collection(db, COLLECTION_CUSTOMERS), newCustomerData);
  return { id: docRef.id, ...newCustomerData } as unknown as Customer;
};

export const updateCustomerPoints = async (customerId: string, pointsToAdd: number) => {
  // Legacy function kept if needed, but logic is moving to processSale
  const ref = doc(db, COLLECTION_CUSTOMERS, customerId);
  await updateDoc(ref, {
    points: pointsToAdd // This logic seems incorrect in original file (was setting, not adding), but ignored for new stamp logic
  });
};

export const updateCustomer = async (id: string, data: Partial<Customer>) => {
  try {
    const ref = doc(db, COLLECTION_CUSTOMERS, id);
    await updateDoc(ref, data);
  } catch (e) {
    console.error("Error updating customer:", e);
    throw e;
  }
};

export const deleteCustomer = async (id: string) => {
  try {
    const ref = doc(db, COLLECTION_CUSTOMERS, id);
    await deleteDoc(ref);
  } catch (e) {
    console.error("Error deleting customer:", e);
    throw e;
  }
};

export const batchImportCustomers = async (customers: { name: string, phone: string }[]) => {
  const CHUNK_SIZE = 450;
  const chunks = [];

  for (let i = 0; i < customers.length; i += CHUNK_SIZE) {
    chunks.push(customers.slice(i, i + CHUNK_SIZE));
  }

  try {
    for (const chunk of chunks) {
      const batch = writeBatch(db);
      chunk.forEach(c => {
        const ref = doc(collection(db, COLLECTION_CUSTOMERS));
        batch.set(ref, {
          name: c.name,
          phone: c.phone,
          points: 0,
          stamps: 0,
          lastVisit: serverTimestamp(),
          totalPurchases: 0,
          totalSpent: 0
        });
      });
      await batch.commit();
    }
  } catch (e) {
    console.error("Error batch importing:", e);
    throw e;
  }
};

// --- CRUD Operations (Delete & Update) ---

export const deleteProduct = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_PRODUCTS, id));
};

export const updateProduct = async (id: string, data: Partial<Product>) => {
  await updateDoc(doc(db, COLLECTION_PRODUCTS, id), data);
};

export const addInsumo = async (data: Omit<Ingredient, 'id'>) => {
  await addDoc(collection(db, COLLECTION_INGREDIENTS), data);
};

export const deleteIngredient = async (id: string) => {
  await deleteDoc(doc(db, COLLECTION_INGREDIENTS, id));
};

export const updateIngredient = async (id: string, data: Partial<Ingredient>) => {
  await updateDoc(doc(db, COLLECTION_INGREDIENTS, id), data);
};

// --- Transactional Sale Logic ---

interface ProcessSaleOptions {
  cartItems: CartItem[];
  total: number;
  customerId?: string;
  paymentMethod: PaymentMethod;
  amountReceived?: number;
  change?: number;
}

export const processSale = async ({ cartItems, total, customerId, paymentMethod, amountReceived, change }: ProcessSaleOptions) => {
  if (cartItems.length === 0) throw new Error("El carrito está vacío.");

  // Fetch weather asynchronously
  let weatherSnapshot = undefined;
  try {
    weatherSnapshot = await getCurrentWeather();
  } catch (e) {
    console.warn("Could not fetch weather for sale", e);
  }

  // --- 1. DATA GATHERING (Read Phase) ---
  // To use Promise.all for writes, we first need to read current states to calculate updates.
  // This replaces the strict "runTransaction" read-lock, accepting a small race-condition risk for speed.

  // 1a. Identify ingredients needed
  const requiredIngredients: Record<string, number> = {};
  const uniqueIngIds = new Set<string>();
  cartItems.forEach(item => {
    if (item.receta) item.receta.forEach(r => uniqueIngIds.add(r.idInsumo));
  });
  const ingredientIds = Array.from(uniqueIngIds);

  // 1b. Check Active Session
  const sessionQ = query(collection(db, COLLECTION_CASH_SESSIONS), where("status", "==", "open"), limit(1));

  // Parallel Reads: Ingredients, Session, Customer (if applicable)
  const readPromises: Promise<any>[] = [
    getDocs(sessionQ),
    ...ingredientIds.map(id => getDoc(doc(db, COLLECTION_INGREDIENTS, id)))
  ];

  if (customerId) {
    readPromises.push(getDoc(doc(db, COLLECTION_CUSTOMERS, customerId)));
  }

  const results = await Promise.all(readPromises);

  const sessionSnap = results[0];
  const ingredientSnaps = results.slice(1, 1 + ingredientIds.length);
  const customerSnap = customerId ? results[results.length - 1] : null;

  // Validation
  if (sessionSnap.empty) throw new Error("No hay una caja abierta. Por favor abre turno antes de vender.");
  const sessionDoc = sessionSnap.docs[0];

  // Inventory Map & Cost Calculation
  const ingredientDocs: Record<string, any> = {};
  ingredientSnaps.forEach((snap: any) => {
    if (snap.exists()) ingredientDocs[snap.id] = snap;
  });

  let totalTransactionCost = 0;

  // Compute needs & costs
  cartItems.forEach(item => {
    let itemCost = 0;
    const qty = item.quantity || 1;

    if (item.receta && item.receta.length > 0) {
      item.receta.forEach(recipeItem => {
        if (!requiredIngredients[recipeItem.idInsumo]) requiredIngredients[recipeItem.idInsumo] = 0;
        requiredIngredients[recipeItem.idInsumo] += (recipeItem.cantidadRequerida * qty);

        const ingData = ingredientDocs[recipeItem.idInsumo]?.data();
        if (ingData) {
          itemCost += ((ingData.costoPorUnidad || 0) * recipeItem.cantidadRequerida);
        }
      });
    } else {
      itemCost = item.costoCompra || 0;
    }
    totalTransactionCost += (itemCost * qty);
  });

  // --- 2. EXECUTION (Write Phase - Parallel) ---
  const writePromises: Promise<any>[] = [];

  // A. Inventory Updates
  ingredientIds.forEach(id => {
    const snap = ingredientDocs[id];
    if (snap) {
      const currentStock = snap.data().stock;
      const needed = requiredIngredients[id];
      // We apply the deduction blindly here for speed, assuming the read state is close enough
      writePromises.push(updateDoc(doc(db, COLLECTION_INGREDIENTS, id), {
        stock: currentStock - needed
      }));
    }
  });

  // B. Customer Update (Stamps, Purchases, Spent)
  let stampsEarned = 0;
  let stampsSpent = 0;
  if (customerId && customerSnap && customerSnap.exists()) {
    const custData = customerSnap.data();
    const currentStamps = custData.stamps || 0;
    const currentPurchases = custData.totalPurchases || 0;
    const currentSpent = custData.totalSpent || 0;

    cartItems.forEach(item => {
      const qty = item.quantity || 1;
      if (item.givesStamp && !item.isRedeemed) stampsEarned += (1 * qty);
      if (item.isRedeemed) stampsSpent += (10 * qty);
    });
    const finalStamps = currentStamps + stampsEarned - stampsSpent;

    // Validation check before writing
    if (finalStamps < 0) throw new Error("Sellos insuficientes (Validado en backend).");

    writePromises.push(updateDoc(doc(db, COLLECTION_CUSTOMERS, customerId), {
      stamps: finalStamps,
      lastVisit: serverTimestamp(),
      totalPurchases: currentPurchases + 1,
      totalSpent: currentSpent + total
    }));
  }

  // C. Cash Session Update
  const currentSess = sessionDoc.data();
  const sessionUpdates: any = {};
  if (paymentMethod === 'efectivo') {
    sessionUpdates.salesCash = (currentSess.salesCash || 0) + total;
    sessionUpdates.expectedCash = (currentSess.expectedCash || 0) + total;
  } else if (paymentMethod === 'tarjeta') {
    sessionUpdates.salesCard = (currentSess.salesCard || 0) + total;
  } else {
    sessionUpdates.salesOther = (currentSess.salesOther || 0) + total;
  }
  writePromises.push(updateDoc(sessionDoc.ref, sessionUpdates));

  // D. Create Sale Record
  // Group items by unique combination (name + redeemed status) for cleaner history,
  // although frontend now sends them grouped. We re-reduce just in case to be safe/consistent.
  const groupedItems = cartItems.reduce((acc, item) => {
    const key = `${item.nombre}_${item.isRedeemed ? 'free' : 'paid'}`;
    const existing = acc.find(i => `${i.nombre}_${i.isRedeemed ? 'free' : 'paid'}` === key);
    const qty = item.quantity || 1;

    if (existing) {
      existing.cantidad += qty;
    } else {
      acc.push({
        nombre: item.nombre,
        precio: item.precio,
        cantidad: qty,
        isRedeemed: item.isRedeemed || false
      });
    }
    return acc;
  }, [] as { nombre: string, precio: number, cantidad: number, isRedeemed: boolean }[]);

  const saleData: any = {
    fecha: serverTimestamp(),
    total: total,
    costoTotal: totalTransactionCost,
    items: groupedItems,
    status: 'completed',
    paymentMethod: paymentMethod
  };
  if (paymentMethod === 'efectivo') {
    saleData.amountReceived = amountReceived;
    saleData.change = change;
  }
  if (customerId) {
    saleData.customerId = customerId;
    saleData.stampsEarned = stampsEarned;
    saleData.stampsSpent = stampsSpent;
  }
  if (weatherSnapshot) {
    saleData.weatherSnapshot = weatherSnapshot;
  }

  // Add Sale Creation to promises
  writePromises.push(addDoc(collection(db, COLLECTION_SALES), saleData));

  // EXECUTE ALL WRITES IN PARALLEL
  await Promise.all(writePromises);

  return true;
};

// --- VOID LOGIC ---

// 1. Request Void (Cashier)
export const requestVoidSale = async (saleId: string, reason: string, requestedBy: string) => {
  const saleRef = doc(db, COLLECTION_SALES, saleId);
  await updateDoc(saleRef, {
    status: 'pending_void',
    voidReason: reason,
    voidRequestedBy: requestedBy
  });
};

// 2. Reject Void (Admin) - reverts to completed
export const rejectVoidSale = async (saleId: string, processedBy: string) => {
  const saleRef = doc(db, COLLECTION_SALES, saleId);
  await updateDoc(saleRef, {
    status: 'completed',
    voidReason: null, // Optional: keep history if desired, but clearing makes UI cleaner
    voidProcessedBy: processedBy
  });
};

// 3. Approve Void & Restore Stock (Admin)
// This function now handles both "Approve Pending" and "Direct Void" scenarios
export const approveVoidSale = async (sale: Sale, processedBy: string, directReason?: string) => {
  if (!sale.id) throw new Error("Sale ID is missing");

  try {
    const productsSnapshot = await getDocs(collection(db, COLLECTION_PRODUCTS));
    const productMap: Record<string, Product> = {};
    productsSnapshot.docs.forEach(doc => {
      const p = doc.data() as Product;
      productMap[p.nombre] = { ...p, id: doc.id };
    });

    await runTransaction(db, async (transaction) => {
      // NOTE: Voiding does NOT automatically revert cash in the session logic here for simplicity.
      // Cash discrepancies are handled in session closing via manual count.

      // A. Calculate ingredients to restore
      const ingredientsToRestore: Record<string, number> = {};

      for (const item of sale.items) {
        const product = productMap[item.nombre];
        if (product && product.receta) {
          product.receta.forEach(rItem => {
            const totalRestore = rItem.cantidadRequerida * item.cantidad;
            ingredientsToRestore[rItem.idInsumo] = (ingredientsToRestore[rItem.idInsumo] || 0) + totalRestore;
          });
        }
      }

      // B. Read ALL Ingredient Docs
      const ingredientIds = Object.keys(ingredientsToRestore);
      const ingredientSnapshots: { id: string, snap: any, ref: any }[] = [];

      for (const id of ingredientIds) {
        const ingRef = doc(db, COLLECTION_INGREDIENTS, id);
        const snap = await transaction.get(ingRef);
        ingredientSnapshots.push({ id, snap, ref: ingRef });
      }

      // C. Handle Stamps Reversal
      if (sale.customerId) {
        const custRef = doc(db, COLLECTION_CUSTOMERS, sale.customerId);
        const custSnap = await transaction.get(custRef);
        if (custSnap.exists()) {
          const custData = custSnap.data();
          const currentStamps = custData.stamps || 0;
          const earned = sale.stampsEarned || 0;
          const spent = sale.stampsSpent || 0;

          // Reverse: Remove earned, Give back spent
          // Formula: New = Current - Earned + Spent
          const newStamps = Math.max(0, currentStamps - earned + spent);

          // Reverse purchases and spent
          const currentPurchases = custData.totalPurchases || 0;
          const currentSpent = custData.totalSpent || 0;
          const newPurchases = Math.max(0, currentPurchases - 1);
          const newSpent = Math.max(0, currentSpent - sale.total);

          transaction.update(custRef, {
            stamps: newStamps,
            totalPurchases: newPurchases,
            totalSpent: newSpent
          });
        }
      }

      // D. Restore Stock
      for (const { id, snap, ref } of ingredientSnapshots) {
        if (!snap.exists()) continue;
        const newStock = snap.data().stock + ingredientsToRestore[id];
        transaction.update(ref, { stock: newStock });
      }

      // E. Update Sale Status
      const saleRef = doc(db, COLLECTION_SALES, sale.id!);
      const updateData: any = {
        status: 'voided',
        voidProcessedBy: processedBy
      };

      // If direct void, save the reason
      if (directReason) {
        updateData.voidReason = directReason;
      }

      transaction.update(saleRef, updateData);
    });
  } catch (error) {
    console.error("Void transaction failed:", error);
    throw error;
  }
};


// --- Inventory Management ---

export const addStock = async (ingredientId: string, amountToAdd: number) => {
  try {
    await runTransaction(db, async (transaction) => {
      const sfDocRef = doc(db, COLLECTION_INGREDIENTS, ingredientId);
      const sfDoc = await transaction.get(sfDocRef);
      if (!sfDoc.exists()) {
        throw new Error("Documento no existe!");
      }
      const newStock = sfDoc.data().stock + amountToAdd;
      transaction.update(sfDocRef, { stock: newStock });
    });
  } catch (e) {
    console.error("Error adding stock:", e);
    throw e;
  }
};

export const addProduct = async (productData: Omit<Product, 'id'>) => {
  try {
    await addDoc(collection(db, COLLECTION_PRODUCTS), productData);
  } catch (e) {
    console.error("Error creating product:", e);
    throw e;
  }
};

// --- Seeding Data ---
export const seedDatabase = async () => {
  const batch = writeBatch(db);

  // 1. Create Ingredients
  const coffeeRef = doc(collection(db, COLLECTION_INGREDIENTS));
  batch.set(coffeeRef, { nombre: "Café en Grano", unidad: "gr", stock: 5000, stockMinimo: 1000, costoPorUnidad: 15 }); // 15 CLP per gram

  const milkRef = doc(collection(db, COLLECTION_INGREDIENTS));
  batch.set(milkRef, { nombre: "Leche Entera", unidad: "ml", stock: 10000, stockMinimo: 2000, costoPorUnidad: 1.2 }); // 1200 CLP per liter

  const sugarRef = doc(collection(db, COLLECTION_INGREDIENTS));
  batch.set(sugarRef, { nombre: "Azúcar", unidad: "gr", stock: 2000, stockMinimo: 500, costoPorUnidad: 1 });

  const cupRef = doc(collection(db, COLLECTION_INGREDIENTS));
  batch.set(cupRef, { nombre: "Vaso Desechable", unidad: "unid", stock: 100, stockMinimo: 50, costoPorUnidad: 50 });

  // 2. Create Products
  const prod1Ref = doc(collection(db, COLLECTION_PRODUCTS));
  batch.set(prod1Ref, {
    nombre: "Espresso",
    precio: 2000,
    imagen_url: "https://picsum.photos/id/1060/200/200",
    givesStamp: true, // New stamp logic
    receta: [
      { idInsumo: coffeeRef.id, cantidadRequerida: 18 },
      { idInsumo: cupRef.id, cantidadRequerida: 1 }
    ]
  });

  const prod2Ref = doc(collection(db, COLLECTION_PRODUCTS));
  batch.set(prod2Ref, {
    nombre: "Latte",
    precio: 3500,
    imagen_url: "https://picsum.photos/id/63/200/200",
    givesStamp: true, // New stamp logic
    receta: [
      { idInsumo: coffeeRef.id, cantidadRequerida: 18 },
      { idInsumo: milkRef.id, cantidadRequerida: 200 },
      { idInsumo: cupRef.id, cantidadRequerida: 1 }
    ]
  });

  const prod3Ref = doc(collection(db, COLLECTION_PRODUCTS));
  batch.set(prod3Ref, {
    nombre: "Galleta Avena",
    precio: 1500,
    imagen_url: "https://picsum.photos/id/100/200/200",
    givesStamp: false, // Food does not give stamps
    receta: [],
    costoCompra: 600
  });

  await batch.commit();
};

// --- DEMO DATA GENERATOR ---

export const generateDemoData = async () => {
  try {
    const [products, customers] = await Promise.all([
      getProducts(),
      getCustomers()
    ]);

    if (products.length === 0) throw new Error("Añade al menos un producto antes de generar datos.");

    const batch = writeBatch(db);
    let writeCount = 0;

    const now = new Date();
    const daysToGenerate = 7;

    for (let i = daysToGenerate; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);

      // Create Cash Session for the day
      const sessionRef = doc(collection(db, COLLECTION_CASH_SESSIONS));
      const openTime = new Date(date);
      openTime.setHours(9, 0, 0, 0);
      const closeTime = new Date(date);
      closeTime.setHours(21, 0, 0, 0);

      let dailySalesCash = 0;
      let dailySalesCard = 0;

      const numSales = Math.floor(Math.random() * 25) + 15; // 15 to 40 sales a day

      for (let j = 0; j < numSales; j++) {
        const saleTime = new Date(openTime.getTime() + Math.random() * (closeTime.getTime() - openTime.getTime()));
        const numItems = Math.floor(Math.random() * 3) + 1;
        const cartItems: any[] = [];
        let saleTotal = 0;
        let saleCostTotal = 0;
        let stampsEarned = 0;

        for (let k = 0; k < numItems; k++) {
          const product = products[Math.floor(Math.random() * products.length)];
          const qty = (Math.random() > 0.8) ? 2 : 1;

          cartItems.push({
            nombre: product.nombre,
            precio: product.precio,
            cantidad: qty,
            givesStamp: product.givesStamp || false,
            isRedeemed: false,
            category: product.category || 'General'
          });

          saleTotal += product.precio * qty;
          saleCostTotal += (product.precio * (Math.random() * 0.2 + 0.3)) * qty;
          if (product.givesStamp) stampsEarned += qty;
        }

        const isCash = Math.random() > 0.5;
        const paymentMethod = isCash ? 'efectivo' : 'tarjeta';

        if (isCash) dailySalesCash += saleTotal;
        else dailySalesCard += saleTotal;

        let customerId = undefined;
        if (customers.length > 0 && Math.random() > 0.6) {
          const randomCustomer = customers[Math.floor(Math.random() * customers.length)];
          customerId = randomCustomer.id;

          const custRef = doc(db, COLLECTION_CUSTOMERS, customerId);
          batch.update(custRef, {
            stamps: (randomCustomer.stamps || 0) + stampsEarned,
            totalPurchases: (randomCustomer.totalPurchases || 0) + 1,
            totalSpent: (randomCustomer.totalSpent || 0) + saleTotal,
            lastVisit: Timestamp.fromDate(saleTime)
          });
          writeCount++;
        }

        const saleRef = doc(collection(db, COLLECTION_SALES));
        const newSale: any = {
          fecha: Timestamp.fromDate(saleTime),
          total: saleTotal,
          items: cartItems,
          status: 'completed',
          paymentMethod,
          costoTotal: saleCostTotal,
          change: 0,
          stampsEarned: customerId ? stampsEarned : 0,
          stampsSpent: 0
        };

        if (isCash) newSale.amountReceived = saleTotal;
        if (customerId) newSale.customerId = customerId;

        batch.set(saleRef, newSale as Sale);
        writeCount++;

        if (writeCount > 400) {
          await batch.commit();
          writeCount = 0;
        }
      }

      const sessionData: CashSession = {
        id: sessionRef.id,
        openedBy: 'DemoUser',
        openTime: Timestamp.fromDate(openTime),
        closeTime: Timestamp.fromDate(closeTime),
        initialBalance: 50000,
        expectedCash: 50000 + dailySalesCash,
        salesCash: dailySalesCash,
        salesCard: dailySalesCard,
        salesOther: 0,
        actualCash: 50000 + dailySalesCash + (Math.floor(Math.random() * 1000) - 500),
        difference: 0,
        status: 'closed'
      };
      sessionData.difference = (sessionData.actualCash || 0) - sessionData.expectedCash;

      batch.set(sessionRef, sessionData);
      writeCount++;
    }

    if (writeCount > 0) {
      await batch.commit();
    }

    return true;
  } catch (e: any) {
    console.error("Demo Generation Error", e);
    throw new Error("No se pudo generar datos: " + e.message);
  }
};