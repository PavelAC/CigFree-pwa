import { Injectable, inject } from '@angular/core';
import { Firestore, collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, DocumentData, WithFieldValue, DocumentReference, deleteDoc } from '@angular/fire/firestore';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { OfflineService } from './offline.service';

interface OfflineOperation {
  id: string;
  operation: () => Promise<void>;
  timestamp: number;
  collectionPath: string;
  type: 'create' | 'update' | 'delete';
  data?: any;
}

@Injectable({
  providedIn: 'root'
})
export class FirestoreService {
  private firestore = inject(Firestore);
  private offlineOperations = new BehaviorSubject<OfflineOperation[]>([]);
  public offlineOperations$ = this.offlineOperations.asObservable();

  
  // Track if we're currently processing operations
  private isProcessing = false;
  
  // Local cache to improve performance and offline reads
  private documentCache = new Map<string, { data: any, timestamp: number }>();
  
  constructor(private offlineService: OfflineService) {
    // Process pending operations when back online
    this.offlineService.isOnline$.subscribe(async isOnline => {
      if (isOnline && !this.isProcessing) {
        await this.processPendingOperations();
      }
    });
    
    // Load any saved operations from localStorage
    this.loadSavedOperations();
  }
  
  // Create a document with offline support
  async createDocument<T extends WithFieldValue<DocumentData>>(collectionPath: string, data: T): Promise<string | null> {
    try {
      // Check if online by getting the current value of the Observable
      const isOnline = await firstValueFrom(this.offlineService.isOnline$);
      
      if (isOnline) {
        // If online, create directly
        const docRef = await addDoc(collection(this.firestore, collectionPath), data as WithFieldValue<DocumentData>);
        
        // Cache the document for offline access
        this.cacheDocument(`${collectionPath}/${docRef.id}`, data);
        
        return docRef.id;
      } else {
        // If offline, generate temp ID and queue
        const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        const operation: OfflineOperation = {
          id: tempId,
          operation: async () => {
            // When we're back online, create the actual document
            const docRef = await addDoc(collection(this.firestore, collectionPath), data);
            console.log(`Created document with ID: ${docRef.id}`);
            
            // Update any references to the tempId with the real ID
            // (This would need to be implemented based on your app's needs)
          },
          timestamp: Date.now(),
          collectionPath,
          type: 'create',
          data // Store the data for potential conflict resolution
        };
        
        this.queueOperation(operation);
        
        // Cache the document locally for read access while offline
        this.cacheDocument(`${collectionPath}/${tempId}`, data);
        
        return tempId;
      }
    } catch (error) {
      console.error('Error creating document:', error);
      return null;
    }
  }
  
  
  // Update a document with offline support
  async updateDocument<T extends DocumentData>(collectionPath: string, docId: string, data: Partial<T>): Promise<boolean> {
    const docPath = `${collectionPath}/${docId}`;
    
    try {
      // Check if online
      const isOnline = await firstValueFrom(this.offlineService.isOnline$);
      
      if (isOnline) {
        // If online, update directly
        await setDoc(doc(this.firestore, collectionPath, docId), data, { merge: true });
        
        // Update cache with the latest data
        await this.refreshCache(docPath);
        
        return true;
      } else {
        // If offline, queue update
        const operation: OfflineOperation = {
          id: docId,
          operation: async () => {
            // When back online, get latest version first to prevent overwrites
            try {
              const latestDoc = await getDoc(doc(this.firestore, collectionPath, docId));
              if (latestDoc.exists()) {
                // Merge with the latest data to prevent lost updates
                const mergedData = { ...latestDoc.data(), ...data };
                await setDoc(doc(this.firestore, collectionPath, docId), mergedData, { merge: true });
              } else {
                // Document no longer exists, create it
                await setDoc(doc(this.firestore, collectionPath, docId) as DocumentReference<T>, data as WithFieldValue<T>);
              }
              console.log(`Updated document: ${docId}`);
            } catch (err) {
              console.error(`Error updating document ${docId} after coming online:`, err);
              throw err; // Rethrow to trigger re-queue
            }
          },
          timestamp: Date.now(),
          collectionPath,
          type: 'update',
          data
        };
        
        this.queueOperation(operation);
        
        // Update local cache immediately for offline read
        this.updateCache(docPath, data);
        
        return true;
      }
    } catch (error) {
      console.error('Error updating document:', error);
      return false;
    }
  }


  async deleteDocument(collectionPath: string, docId: string): Promise<boolean> {
    const docPath = `${collectionPath}/${docId}`;
    
    try {
      // Check if online
      const isOnline = await firstValueFrom(this.offlineService.isOnline$);
      
      if (isOnline) {
        // If online, delete directly
        await deleteDoc(doc(this.firestore, collectionPath, docId));
        
        // Remove from cache
        this.documentCache.delete(docPath);
        
        return true;
      } else {
        // If offline, queue deletion
        const operation: OfflineOperation = {
          id: docId,
          operation: async () => {
            await deleteDoc(doc(this.firestore, collectionPath, docId));
            console.log(`Deleted document: ${docId}`);
          },
          timestamp: Date.now(),
          collectionPath,
          type: 'delete'
        };
        
        this.queueOperation(operation);
        
        // Mark as deleted in cache
        this.documentCache.set(docPath, { 
          data: { _isDeleted: true }, 
          timestamp: Date.now() 
        });
        
        return true;
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      return false;
    }
  }
  
  // Queue an operation for later execution
  async getDocument<T>(collectionPath: string, docId: string): Promise<T | null> {
    const docPath = `${collectionPath}/${docId}`;
    
    try {
      // Check if online
      const isOnline = await firstValueFrom(this.offlineService.isOnline$);
      
      if (isOnline) {
        // If online, get from Firestore
        const docRef = doc(this.firestore, collectionPath, docId);
        const docSnap = await getDoc(docRef);
        
        if (!docSnap.exists()) {
          this.documentCache.delete(docPath);
          return null;
        }
        
        const data = docSnap.data() as T;
        
        // Update cache
        this.cacheDocument(docPath, data);
        
        return data;
      } else {
        // If offline, try to get from cache first
        const cachedDoc = this.documentCache.get(docPath);
        
        if (cachedDoc) {
          // Check if marked as deleted
          if (cachedDoc.data._isDeleted) {
            return null;
          }
          return cachedDoc.data as T;
        }
        
        // If not in cache, try Firestore (it might work if persistence is enabled)
        try {
          const docRef = doc(this.firestore, collectionPath, docId);
          const docSnap = await getDoc(docRef);
          
          if (!docSnap.exists()) return null;
          
          const data = docSnap.data() as T;
          this.cacheDocument(docPath, data);
          return data;
        } catch (err) {
          // Truly offline with no cached data
          console.log(`Document ${docId} not available offline and not in cache`);
          return null;
        }
      }
    } catch (error) {
      console.error(`Error getting document ${docId}:`, error);
      
      // Try cache as fallback in case of error
      const cachedDoc = this.documentCache.get(docPath);
      return cachedDoc ? cachedDoc.data as T : null;
    }
  }

  async queryDocuments<T>(
    collectionPath: string, 
    conditions: Array<{ field: string, operator: string, value: any }>
  ): Promise<T[]> {
    try {
      // Check if online
      const isOnline = await firstValueFrom(this.offlineService.isOnline$);
      
      // Build the query
      let q = query(collection(this.firestore, collectionPath));
      
      // Add query conditions
      for (const condition of conditions) {
        q = query(q, where(condition.field, condition.operator as any, condition.value));
      }
      
      if (isOnline) {
        // If online, query Firestore
        const querySnapshot = await getDocs(q);
        
        const results: T[] = [];
        querySnapshot.forEach(doc => {
          const data = doc.data() as T;
          results.push(data);
          
          // Cache each document
          this.cacheDocument(`${collectionPath}/${doc.id}`, data);
        });
        
        return results;
      } else {
        // If offline, try to use cached data to fulfill query
        // This is a simplified implementation and may not work for complex queries
        const cachedResults: T[] = [];
        
        // Filter cached documents that match the collection
        for (const [path, entry] of this.documentCache.entries()) {
          if (path.startsWith(`${collectionPath}/`) && !entry.data._isDeleted) {
            let matches = true;
            
            // Check if document matches all conditions
            for (const condition of conditions) {
              const fieldValue = entry.data[condition.field];
              
              // Simple operators check
              switch (condition.operator) {
                case '==':
                  if (fieldValue !== condition.value) matches = false;
                  break;
                case '>':
                  if (fieldValue <= condition.value) matches = false;
                  break;
                case '>=':
                  if (fieldValue < condition.value) matches = false;
                  break;
                case '<':
                  if (fieldValue >= condition.value) matches = false;
                  break;
                case '<=':
                  if (fieldValue > condition.value) matches = false;
                  break;
                case '!=':
                  if (fieldValue === condition.value) matches = false;
                  break;
                // Add other operators as needed
              }
              
              if (!matches) break;
            }
            
            if (matches) {
              cachedResults.push(entry.data as T);
            }
          }
        }
        
        // If we found cached results, return them
        if (cachedResults.length > 0) {
          return cachedResults;
        }
        
        // If no cached results, try Firestore (might work with persistence)
        try {
          const querySnapshot = await getDocs(q);
          
          const results: T[] = [];
          querySnapshot.forEach(doc => {
            results.push(doc.data() as T);
          });
          
          return results;
        } catch (err) {
          console.log('Offline query failed, no cached results available');
          return [];
        }
      }
    } catch (error) {
      console.error('Error querying documents:', error);
      return [];
    }
  }
  
  /**
   * Queue an operation for later execution
   */
  private queueOperation(operation: OfflineOperation): void {
    const currentOps = this.offlineOperations.value;
    const updatedOps = [...currentOps, operation];
    
    this.offlineOperations.next(updatedOps);
    this.saveOperations(updatedOps);
    
    console.log(`Operation queued: ${operation.type} for ${operation.collectionPath}`);
  }
  
  /**
   * Process all pending operations
   */
  private async processPendingOperations(): Promise<void> {
    if (this.isProcessing) return;
    
    const operations = this.offlineOperations.value;
    
    if (operations.length === 0) return;
    
    console.log(`Processing ${operations.length} offline operations...`);
    this.isProcessing = true;
    
    try {
      // Clear the queue first to avoid duplicates
      this.offlineOperations.next([]);
      this.saveOperations([]);
      
      // Process each operation in order (oldest first)
      const sortedOperations = [...operations].sort((a, b) => a.timestamp - b.timestamp);
      
      for (const op of sortedOperations) {
        try {
          await op.operation();
        } catch (error) {
          console.error(`Failed to process operation ${op.type} for ${op.collectionPath}:`, error);
          // Re-queue failed operations
          this.queueOperation(op);
        }
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  // Save operations to IndexedDB for persistence across refreshes
  private saveOperations(operations: OfflineOperation[]): void {
    try {
      localStorage.setItem('offlineOperations', JSON.stringify(operations));
    } catch (error) {
      console.error('Error saving offline operations:', error);
    }
  }
  
  // Load saved operations from IndexedDB
  private loadSavedOperations(): void {
    try {
      const savedOps = localStorage.getItem('offlineOperations');
      if (savedOps) {
        const operations = JSON.parse(savedOps) as OfflineOperation[];
        this.offlineOperations.next(operations);
        console.log(`Loaded ${operations.length} saved offline operations`);
      }
    } catch (error) {
      console.error('Error loading offline operations:', error);
    }
  }
  
  /**
   * Cache a document for offline access
   */
  private cacheDocument(path: string, data: any): void {
    this.documentCache.set(path, {
      data,
      timestamp: Date.now()
    });
    
    // Persist cache to localStorage
    this.persistCache();
  }
  
  /**
   * Update a cached document with partial data
   */
  private updateCache(path: string, partialData: any): void {
    const existing = this.documentCache.get(path);
    
    if (existing) {
      // Merge with existing data
      this.documentCache.set(path, {
        data: { ...existing.data, ...partialData },
        timestamp: Date.now()
      });
    } else {
      // No existing data, just set the partial data
      this.documentCache.set(path, {
        data: partialData,
        timestamp: Date.now()
      });
    }
    
    // Persist cache to localStorage
    this.persistCache();
  }
  
  /**
   * Refresh cache with the latest data from Firestore
   */
  private async refreshCache(path: string): Promise<void> {
    const [collectionPath, docId] = path.split('/');
    
    try {
      const docRef = doc(this.firestore, collectionPath, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        this.cacheDocument(path, docSnap.data());
      } else {
        this.documentCache.delete(path);
      }
      
      // Persist cache to localStorage
      this.persistCache();
    } catch (error) {
      console.error(`Error refreshing cache for ${path}:`, error);
    }
  }
  
  /**
   * Persist the document cache to localStorage
   */
  private persistCache(): void {
    try {
      // Convert map to array of entries for serialization
      const cacheEntries = Array.from(this.documentCache.entries());
      localStorage.setItem('documentCache', JSON.stringify(cacheEntries));
    } catch (error) {
      console.error('Error persisting document cache:', error);
      
      // If localStorage is full, clear old entries
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        this.pruneCache();
      }
    }
  }
  
  /**
   * Load the document cache from localStorage
   */
  private loadCache(): void {
    try {
      const cachedData = localStorage.getItem('documentCache');
      if (cachedData) {
        const entries = JSON.parse(cachedData) as [string, { data: any, timestamp: number }][];
        this.documentCache = new Map(entries);
      }
    } catch (error) {
      console.error('Error loading document cache:', error);
    }
  }
  
  /**
   * Prune old entries from cache when storage is full
   */
  private pruneCache(): void {
    // Get all entries sorted by timestamp (oldest first)
    const entries = Array.from(this.documentCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove the oldest 25% of entries
    const entriesToRemove = Math.ceil(entries.length * 0.25);
    
    for (let i = 0; i < entriesToRemove; i++) {
      if (entries[i]) {
        this.documentCache.delete(entries[i][0]);
      }
    }
    
    console.log(`Pruned ${entriesToRemove} entries from cache due to storage constraints`);
    
    // Try to persist again
    this.persistCache();
  }
  
  /**
   * Clear all cached data and offline operations
   */
  public clearOfflineData(): void {
    this.documentCache.clear();
    this.offlineOperations.next([]);
    localStorage.removeItem('documentCache');
    localStorage.removeItem('offlineOperations');
    console.log('Cleared all offline data');
  }
}