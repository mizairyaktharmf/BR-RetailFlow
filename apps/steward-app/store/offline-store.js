/**
 * Offline Storage using IndexedDB
 * Stores data locally when offline and syncs when online
 */

import { openDB } from 'idb'

const DB_NAME = 'br-retailflow-steward'
const DB_VERSION = 1

// Store names
const STORES = {
  PENDING_INVENTORY: 'pending_inventory',
  PENDING_SALES: 'pending_sales',
  PENDING_RECEIPTS: 'pending_receipts',
  FLAVORS_CACHE: 'flavors_cache',
  USER_DATA: 'user_data',
}

/**
 * Initialize IndexedDB
 */
async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Pending inventory entries
      if (!db.objectStoreNames.contains(STORES.PENDING_INVENTORY)) {
        const store = db.createObjectStore(STORES.PENDING_INVENTORY, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('date', 'date')
        store.createIndex('synced', 'synced')
      }

      // Pending sales entries
      if (!db.objectStoreNames.contains(STORES.PENDING_SALES)) {
        const store = db.createObjectStore(STORES.PENDING_SALES, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('date', 'date')
        store.createIndex('synced', 'synced')
      }

      // Pending tub receipts
      if (!db.objectStoreNames.contains(STORES.PENDING_RECEIPTS)) {
        const store = db.createObjectStore(STORES.PENDING_RECEIPTS, {
          keyPath: 'id',
          autoIncrement: true,
        })
        store.createIndex('date', 'date')
        store.createIndex('synced', 'synced')
      }

      // Cached flavors list
      if (!db.objectStoreNames.contains(STORES.FLAVORS_CACHE)) {
        db.createObjectStore(STORES.FLAVORS_CACHE, {
          keyPath: 'id',
        })
      }

      // User data cache
      if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
        db.createObjectStore(STORES.USER_DATA, {
          keyPath: 'key',
        })
      }
    },
  })
}

/**
 * Offline Store Class
 */
class OfflineStore {
  constructor() {
    this.db = null
  }

  async getDB() {
    if (!this.db) {
      this.db = await initDB()
    }
    return this.db
  }

  // ============== INVENTORY ==============

  async saveInventoryEntry(entry) {
    const db = await this.getDB()
    return db.add(STORES.PENDING_INVENTORY, {
      ...entry,
      synced: false,
      createdAt: new Date().toISOString(),
    })
  }

  async getPendingInventoryEntries() {
    const db = await this.getDB()
    const index = db.transaction(STORES.PENDING_INVENTORY).store.index('synced')
    return index.getAll(false)
  }

  async markInventoryEntrySynced(id) {
    const db = await this.getDB()
    const entry = await db.get(STORES.PENDING_INVENTORY, id)
    if (entry) {
      entry.synced = true
      await db.put(STORES.PENDING_INVENTORY, entry)
    }
  }

  async clearSyncedInventoryEntries() {
    const db = await this.getDB()
    const tx = db.transaction(STORES.PENDING_INVENTORY, 'readwrite')
    const index = tx.store.index('synced')
    const synced = await index.getAllKeys(true)
    for (const key of synced) {
      await tx.store.delete(key)
    }
  }

  // ============== SALES ==============

  async saveSalesEntry(entry) {
    const db = await this.getDB()
    return db.add(STORES.PENDING_SALES, {
      ...entry,
      synced: false,
      createdAt: new Date().toISOString(),
    })
  }

  async getPendingSalesEntries() {
    const db = await this.getDB()
    const index = db.transaction(STORES.PENDING_SALES).store.index('synced')
    return index.getAll(false)
  }

  async markSalesEntrySynced(id) {
    const db = await this.getDB()
    const entry = await db.get(STORES.PENDING_SALES, id)
    if (entry) {
      entry.synced = true
      await db.put(STORES.PENDING_SALES, entry)
    }
  }

  // ============== TUB RECEIPTS ==============

  async saveTubReceipt(receipt) {
    const db = await this.getDB()
    return db.add(STORES.PENDING_RECEIPTS, {
      ...receipt,
      synced: false,
      createdAt: new Date().toISOString(),
    })
  }

  async getPendingTubReceipts() {
    const db = await this.getDB()
    const index = db.transaction(STORES.PENDING_RECEIPTS).store.index('synced')
    return index.getAll(false)
  }

  async markTubReceiptSynced(id) {
    const db = await this.getDB()
    const receipt = await db.get(STORES.PENDING_RECEIPTS, id)
    if (receipt) {
      receipt.synced = true
      await db.put(STORES.PENDING_RECEIPTS, receipt)
    }
  }

  // ============== FLAVORS CACHE ==============

  async cacheFlavors(flavors) {
    const db = await this.getDB()
    const tx = db.transaction(STORES.FLAVORS_CACHE, 'readwrite')
    await tx.store.clear()
    for (const flavor of flavors) {
      await tx.store.add(flavor)
    }
    await tx.done
  }

  async getCachedFlavors() {
    const db = await this.getDB()
    return db.getAll(STORES.FLAVORS_CACHE)
  }

  // ============== USER DATA ==============

  async saveUserData(key, value) {
    const db = await this.getDB()
    return db.put(STORES.USER_DATA, { key, value })
  }

  async getUserData(key) {
    const db = await this.getDB()
    const result = await db.get(STORES.USER_DATA, key)
    return result?.value
  }

  async clearUserData() {
    const db = await this.getDB()
    const tx = db.transaction(STORES.USER_DATA, 'readwrite')
    await tx.store.clear()
  }

  // ============== SYNC ==============

  async getPendingCount() {
    const db = await this.getDB()

    const inventoryIndex = db.transaction(STORES.PENDING_INVENTORY).store.index('synced')
    const inventoryCount = await inventoryIndex.count(false)

    const salesIndex = db.transaction(STORES.PENDING_SALES).store.index('synced')
    const salesCount = await salesIndex.count(false)

    const receiptsIndex = db.transaction(STORES.PENDING_RECEIPTS).store.index('synced')
    const receiptsCount = await receiptsIndex.count(false)

    return {
      inventory: inventoryCount,
      sales: salesCount,
      receipts: receiptsCount,
      total: inventoryCount + salesCount + receiptsCount,
    }
  }
}

export const offlineStore = new OfflineStore()
export default offlineStore
