import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp, 
  limit 
} from "firebase/firestore";
import { db } from "../firebaseConfig";
import { LogEntry } from "../types";

const COLLECTION_LOGS = "system_logs";

export const logError = async (errorMsg: string, context: string, metadata?: any) => {
  try {
    const logData = {
      message: errorMsg,
      context: context,
      timestamp: serverTimestamp(),
      deviceInfo: navigator.userAgent,
      syncStatus: navigator.onLine ? 'online' : 'offline',
      metadata: metadata ? JSON.stringify(metadata) : null
    };

    // This addDoc works even if offline (queues in Firestore SDK)
    await addDoc(collection(db, COLLECTION_LOGS), logData);
    console.warn(`[RemoteLog]: ${context} - ${errorMsg}`);
  } catch (e) {
    // If logging fails (e.g., severe db issue), fallback to console
    console.error("Critical: Failed to log error remotely", e);
  }
};

export const getSystemLogs = async (): Promise<LogEntry[]> => {
  try {
    // Get last 100 logs
    const q = query(
      collection(db, COLLECTION_LOGS), 
      orderBy("timestamp", "desc"), 
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LogEntry));
  } catch (e) {
    console.error("Error fetching logs", e);
    return [];
  }
};