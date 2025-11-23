// IndexedDB Manager per FUTURA SYNC
// Gestione persistenza locale con IndexedDB

const DB_NAME = 'FuturaSyncDB';
const DB_VERSION = 1;

class DatabaseManager {
    constructor() {
        this.db = null;
        this.isReady = false;
    }

    // Inizializza database
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('[DB] Error opening database:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                this.isReady = true;
                console.log('[DB] Database opened successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                console.log('[DB] Upgrading database...');
                const db = event.target.result;

                // Object Store per transazioni
                if (!db.objectStoreNames.contains('transactions')) {
                    const transactionStore = db.createObjectStore('transactions', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    transactionStore.createIndex('date', 'date', { unique: false });
                    transactionStore.createIndex('type', 'type', { unique: false });
                    transactionStore.createIndex('category', 'category', { unique: false });
                    transactionStore.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Object Store per prestiti
                if (!db.objectStoreNames.contains('loans')) {
                    const loanStore = db.createObjectStore('loans', { keyPath: 'id' });
                    loanStore.createIndex('debtor', 'debtor', { unique: false });
                    loanStore.createIndex('date', 'date', { unique: false });
                    loanStore.createIndex('status', 'status', { unique: false });
                }

                // Object Store per income futuri
                if (!db.objectStoreNames.contains('incomes')) {
                    const incomeStore = db.createObjectStore('incomes', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    incomeStore.createIndex('received', 'received', { unique: false });
                }

                // Object Store per ricorrenze
                if (!db.objectStoreNames.contains('recurring')) {
                    const recurringStore = db.createObjectStore('recurring', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    recurringStore.createIndex('active', 'active', { unique: false });
                    recurringStore.createIndex('nextDate', 'nextDate', { unique: false });
                }

                // Object Store per budget
                if (!db.objectStoreNames.contains('budgets')) {
                    const budgetStore = db.createObjectStore('budgets', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    budgetStore.createIndex('category', 'category', { unique: true });
                    budgetStore.createIndex('month', 'month', { unique: false });
                }

                // Object Store per settings
                if (!db.objectStoreNames.contains('settings')) {
                    db.createObjectStore('settings', { keyPath: 'key' });
                }

                // Object Store per sync queue (operazioni offline)
                if (!db.objectStoreNames.contains('syncQueue')) {
                    const syncStore = db.createObjectStore('syncQueue', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    syncStore.createIndex('timestamp', 'timestamp', { unique: false });
                    syncStore.createIndex('synced', 'synced', { unique: false });
                }

                console.log('[DB] Database upgraded successfully');
            };
        });
    }

    // Generic CRUD operations
    async add(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.add(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async get(storeName, key) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async getAll(storeName) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async update(storeName, data) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.put(data);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    async delete(storeName, key) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    async clear(storeName) {
        const transaction = this.db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        return new Promise((resolve, reject) => {
            const request = store.clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }

    // Query con indici
    async getByIndex(storeName, indexName, value) {
        const transaction = this.db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const index = store.index(indexName);

        return new Promise((resolve, reject) => {
            const request = index.getAll(value);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    // Backup completo del database
    async exportData() {
        const data = {};
        const storeNames = ['transactions', 'loans', 'incomes', 'recurring', 'budgets', 'settings'];

        for (const storeName of storeNames) {
            data[storeName] = await this.getAll(storeName);
        }

        return {
            version: DB_VERSION,
            timestamp: new Date().toISOString(),
            data: data
        };
    }

    // Restore da backup
    async importData(backup) {
        if (!backup.data) {
            throw new Error('Invalid backup format');
        }

        for (const storeName in backup.data) {
            await this.clear(storeName);

            for (const item of backup.data[storeName]) {
                await this.add(storeName, item);
            }
        }

        console.log('[DB] Data imported successfully');
    }

    // Settings helpers
    async getSetting(key, defaultValue = null) {
        const setting = await this.get('settings', key);
        return setting ? setting.value : defaultValue;
    }

    async setSetting(key, value) {
        return this.update('settings', { key, value });
    }

    // Sync queue helpers
    async addToSyncQueue(operation) {
        return this.add('syncQueue', {
            ...operation,
            timestamp: Date.now(),
            synced: false
        });
    }

    async getPendingSyncOperations() {
        return this.getByIndex('syncQueue', 'synced', false);
    }

    async markAsSynced(id) {
        const item = await this.get('syncQueue', id);
        if (item) {
            item.synced = true;
            item.syncedAt = Date.now();
            await this.update('syncQueue', item);
        }
    }

    async clearSyncedOperations() {
        const allOps = await this.getAll('syncQueue');
        const syncedOps = allOps.filter(op => op.synced);

        for (const op of syncedOps) {
            await this.delete('syncQueue', op.id);
        }
    }
}

// Export singleton instance
const dbManager = new DatabaseManager();

// Auto-init on load
if (typeof window !== 'undefined') {
    window.addEventListener('load', async () => {
        try {
            await dbManager.init();
            console.log('[DB] Database ready');
        } catch (error) {
            console.error('[DB] Failed to initialize:', error);
        }
    });
}
