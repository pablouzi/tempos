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
  Timestamp
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { Product, Ingredient, CartItem, Sale, Customer } from "../types";

const COLLECTION_PRODUCTS = "productos";
const COLLECTION_INGREDIENTS = "insumos";
const COLLECTION_SALES = "ventas";
const COLLECTION_USERS = "users";
const COLLECTION_CUSTOMERS = "customers";

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
    lastVisit: serverTimestamp()
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

export const batchImportCustomers = async (customers: {name: string, phone: string}[]) => {
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
          lastVisit: serverTimestamp()
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

export const processSale = async (cartItems: CartItem[], total: number, customerId?: string) => {
  if (cartItems.length === 0) throw new Error("El carrito está vacío.");

  try {
    await runTransaction(db, async (transaction) => {
      // 1. Calculate ingredients
      const requiredIngredients: Record<string, number> = {};

      cartItems.forEach(item => {
        if (item.receta && Array.isArray(item.receta)) {
          item.receta.forEach(recipeItem => {
            if (!requiredIngredients[recipeItem.idInsumo]) {
              requiredIngredients[recipeItem.idInsumo] = 0;
            }
            requiredIngredients[recipeItem.idInsumo] += recipeItem.cantidadRequerida;
          });
        }
      });

      // 2. Read Stock
      const ingredientIds = Object.keys(requiredIngredients);
      const ingredientDocs: Record<string, any> = {};

      for (const id of ingredientIds) {
        const sfDocRef = doc(db, COLLECTION_INGREDIENTS, id);
        const sfDoc = await transaction.get(sfDocRef);
        if (!sfDoc.exists()) {
          throw new Error(`Insumo con ID ${id} no existe.`);
        }
        ingredientDocs[id] = sfDoc;
      }

      // 2b. Customer Logic (STAMPS)
      let customerRef;
      let stampsEarned = 0;
      let stampsSpent = 0;

      if (customerId) {
        customerRef = doc(db, COLLECTION_CUSTOMERS, customerId);
        const cDoc = await transaction.get(customerRef);
        
        if (cDoc.exists()) {
            const currentStamps = cDoc.data().stamps || 0;
            
            // Calculate Earned: Product givesStamp = true AND is NOT redeemed (paid > 0)
            cartItems.forEach(item => {
                if (item.givesStamp && !item.isRedeemed) {
                    stampsEarned += 1;
                }
                if (item.isRedeemed) {
                    stampsSpent += 10; // 10 stamps cost per free drink
                }
            });

            const finalStamps = currentStamps + stampsEarned - stampsSpent;

            if (finalStamps < 0) {
                throw new Error("Error de validación: El cliente no tiene suficientes sellos para este canje.");
            }

            transaction.update(customerRef, {
                stamps: finalStamps,
                lastVisit: serverTimestamp()
            });
        }
      }

      // 3. Check availability
      for (const id of ingredientIds) {
        const currentStock = ingredientDocs[id].data().stock;
        const required = requiredIngredients[id];
        const ingredientName = ingredientDocs[id].data().nombre;

        if (currentStock < required) {
          throw new Error(`Stock insuficiente: ${ingredientName}. Requerido: ${required}, Disponible: ${currentStock}`);
        }
      }

      // 4. Deduct Stock
      for (const id of ingredientIds) {
        const sfDocRef = doc(db, COLLECTION_INGREDIENTS, id);
        const newStock = ingredientDocs[id].data().stock - requiredIngredients[id];
        transaction.update(sfDocRef, { stock: newStock });
      }

      // 6. Create Sale Record
      const groupedItems = cartItems.reduce((acc, item) => {
        // We group by name AND redemption status. A redeemed latte is different from a paid latte.
        const key = `${item.nombre}_${item.isRedeemed ? 'free' : 'paid'}`;
        const existing = acc.find(i => `${i.nombre}_${i.isRedeemed ? 'free' : 'paid'}` === key);
        
        if (existing) {
          existing.cantidad += 1;
        } else {
          acc.push({ 
            nombre: item.nombre, 
            precio: item.precio, 
            cantidad: 1,
            isRedeemed: item.isRedeemed || false
          });
        }
        return acc;
      }, [] as { nombre: string, precio: number, cantidad: number, isRedeemed: boolean }[]);

      const saleRef = doc(collection(db, COLLECTION_SALES));
      const saleData: any = {
        fecha: serverTimestamp(),
        total: total,
        items: groupedItems,
        status: 'completed'
      };

      if (customerId) {
          saleData.customerId = customerId;
          saleData.stampsEarned = stampsEarned;
          saleData.stampsSpent = stampsSpent;
      }

      transaction.set(saleRef, saleData);
    });
    
    return true; // Success
  } catch (e: any) {
    console.error("Transaction failed: ", e);
    throw e; // Propagate error to UI
  }
};

// --- VOID LOGIC ---

// 1. Request Void (Cashier)
export const requestVoidSale = async (saleId: string, reason: string) => {
  const saleRef = doc(db, COLLECTION_SALES, saleId);
  await updateDoc(saleRef, {
    status: 'pending_void',
    voidReason: reason
  });
};

// 2. Reject Void (Admin) - reverts to completed
export const rejectVoidSale = async (saleId: string) => {
  const saleRef = doc(db, COLLECTION_SALES, saleId);
  await updateDoc(saleRef, {
    status: 'completed',
    voidReason: null // Optional: clear reason or keep history
  });
};

// 3. Approve Void & Restore Stock (Admin)
export const approveVoidSale = async (sale: Sale) => {
  if (!sale.id) throw new Error("Sale ID is missing");

  try {
    const productsSnapshot = await getDocs(collection(db, COLLECTION_PRODUCTS));
    const productMap: Record<string, Product> = {};
    productsSnapshot.docs.forEach(doc => {
      const p = doc.data() as Product;
      productMap[p.nombre] = { ...p, id: doc.id };
    });

    await runTransaction(db, async (transaction) => {
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
              const currentStamps = custSnap.data().stamps || 0;
              const earned = sale.stampsEarned || 0;
              const spent = sale.stampsSpent || 0;
              
              // Reverse: Remove earned, Give back spent
              // New = Current - Earned + Spent
              const newStamps = Math.max(0, currentStamps - earned + spent);
              transaction.update(custRef, { stamps: newStamps });
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
      transaction.update(saleRef, { status: 'voided' });
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
    batch.set(coffeeRef, { nombre: "Café en Grano", unidad: "gr", stock: 5000, stockMinimo: 1000 });

    const milkRef = doc(collection(db, COLLECTION_INGREDIENTS));
    batch.set(milkRef, { nombre: "Leche Entera", unidad: "ml", stock: 10000, stockMinimo: 2000 });
    
    const sugarRef = doc(collection(db, COLLECTION_INGREDIENTS));
    batch.set(sugarRef, { nombre: "Azúcar", unidad: "gr", stock: 2000, stockMinimo: 500 });

    const cupRef = doc(collection(db, COLLECTION_INGREDIENTS));
    batch.set(cupRef, { nombre: "Vaso Desechable", unidad: "unid", stock: 100, stockMinimo: 50 });

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
        receta: []
    });
    
    await batch.commit();
};