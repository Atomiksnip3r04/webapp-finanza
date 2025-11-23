// Sync Manager - Gestione sincronizzazione avanzata con JSONbin.io
// Retry logic, conflict resolution, sync differenziale

class SyncManager {
    constructor(binId, apiKey) {
        this.binId = binId;
        this.apiKey = apiKey;
        this.baseUrl = 'https://api.jsonbin.io/v3/b';
        this.syncInterval = null;
        this.isSyncing = false;
        this.lastSyncHash = null;
        this.retryAttempts = 0;
        this.maxRetries = 3;
        this.retryDelay = 2000; // ms
    }

    // Avvia sync automatico periodico
    startAutoSync(intervalMinutes = 5) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(() => {
            this.syncData();
        }, intervalMinutes * 60 * 1000);

        console.log(`[Sync] Auto-sync started (every ${intervalMinutes} min)`);
    }

    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('[Sync] Auto-sync stopped');
        }
    }

    // Load dati dal cloud
    async loadFromCloud() {
        try {
            const response = await this.fetchWithRetry(
                `${this.baseUrl}/${this.binId}/latest`,
                {
                    method: 'GET',
                    headers: {
                        'X-Master-Key': this.apiKey,
                        'X-Bin-Meta': 'false'
                    }
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.lastSyncHash = this.hashData(data);

            console.log('[Sync] Data loaded from cloud');
            return data;
        } catch (error) {
            console.error('[Sync] Load failed:', error);
            throw error;
        }
    }

    // Salva dati sul cloud
    async saveToCloud(data) {
        if (this.isSyncing) {
            console.warn('[Sync] Already syncing, skipping...');
            return false;
        }

        this.isSyncing = true;

        try {
            // Aggiungi metadata di sync
            const payload = {
                ...data,
                _meta: {
                    lastSync: new Date().toISOString(),
                    version: '1.0.0',
                    device: navigator.userAgent.substring(0, 50)
                }
            };

            const response = await this.fetchWithRetry(
                `${this.baseUrl}/${this.binId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': this.apiKey
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            this.lastSyncHash = this.hashData(data);
            this.retryAttempts = 0;

            console.log('[Sync] Data saved to cloud');
            return true;
        } catch (error) {
            console.error('[Sync] Save failed:', error);

            // Aggiungi alla sync queue per retry
            if (dbManager.isReady) {
                await dbManager.addToSyncQueue({
                    type: 'save',
                    data: data,
                    error: error.message
                });
            }

            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    // Sync bidirezionale con conflict resolution
    async syncData(localData) {
        if (this.isSyncing) {
            console.warn('[Sync] Already syncing');
            return { success: false, reason: 'already_syncing' };
        }

        this.isSyncing = true;

        try {
            // 1. Carica dati dal cloud
            const cloudData = await this.loadFromCloud();

            // 2. Confronta hash per vedere se ci sono modifiche
            const localHash = this.hashData(localData);
            const cloudHash = this.hashData(cloudData);

            if (localHash === cloudHash) {
                console.log('[Sync] No changes detected');
                return { success: true, action: 'no_changes' };
            }

            // 3. Determina quale versione è più recente
            const localTimestamp = localData._meta?.lastSync || 0;
            const cloudTimestamp = cloudData._meta?.lastSync || 0;

            if (localTimestamp > cloudTimestamp) {
                // Local è più recente, salva sul cloud
                await this.saveToCloud(localData);
                return { success: true, action: 'uploaded' };
            } else if (cloudTimestamp > localTimestamp) {
                // Cloud è più recente, usa cloud data
                return { success: true, action: 'downloaded', data: cloudData };
            } else {
                // Stessi timestamp, possibile conflitto
                const merged = this.mergeData(localData, cloudData);
                await this.saveToCloud(merged);
                return { success: true, action: 'merged', data: merged };
            }
        } catch (error) {
            console.error('[Sync] Sync failed:', error);
            return { success: false, error: error.message };
        } finally {
            this.isSyncing = false;
        }
    }

    // Merge intelligente dei dati (last-write-wins per array items)
    mergeData(local, cloud) {
        const merged = { ...cloud };

        // Merge transazioni (use more recent based on timestamp)
        if (local.manualTransactions && cloud.manualTransactions) {
            merged.manualTransactions = this.mergeArrays(
                local.manualTransactions,
                cloud.manualTransactions,
                'id'
            );
        }

        // Merge loans
        if (local.activeLoans && cloud.activeLoans) {
            merged.activeLoans = this.mergeArrays(
                local.activeLoans,
                cloud.activeLoans,
                'id'
            );
        }

        // Merge incomes
        if (local.futureIncomes && cloud.futureIncomes) {
            merged.futureIncomes = this.mergeArrays(
                local.futureIncomes,
                cloud.futureIncomes,
                'desc' // usa desc come key per incomes
            );
        }

        // Use most recent balance
        if (local.currentBalance !== undefined) {
            merged.currentBalance = local.currentBalance;
        }

        console.log('[Sync] Data merged');
        return merged;
    }

    // Helper per merge array con deduplicazione
    mergeArrays(arr1, arr2, key) {
        const map = new Map();

        [...arr1, ...arr2].forEach(item => {
            const itemKey = item[key];
            if (!map.has(itemKey) || item.timestamp > map.get(itemKey).timestamp) {
                map.set(itemKey, item);
            }
        });

        return Array.from(map.values());
    }

    // Hash semplice per change detection
    hashData(data) {
        const str = JSON.stringify(data);
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    // Fetch con retry exponential backoff
    async fetchWithRetry(url, options, attempt = 1) {
        try {
            const response = await fetch(url, options);

            // Se 5xx, retry
            if (response.status >= 500 && attempt < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(`[Sync] Retry ${attempt}/${this.maxRetries} in ${delay}ms`);
                await this.sleep(delay);
                return this.fetchWithRetry(url, options, attempt + 1);
            }

            return response;
        } catch (error) {
            if (attempt < this.maxRetries) {
                const delay = this.retryDelay * Math.pow(2, attempt - 1);
                console.log(`[Sync] Network error, retry ${attempt}/${this.maxRetries} in ${delay}ms`);
                await this.sleep(delay);
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Process sync queue (operazioni pending offline)
    async processSyncQueue() {
        if (!dbManager.isReady) return;

        const pending = await dbManager.getPendingSyncOperations();

        if (pending.length === 0) {
            return;
        }

        console.log(`[Sync] Processing ${pending.length} pending operations`);

        for (const operation of pending) {
            try {
                if (operation.type === 'save') {
                    await this.saveToCloud(operation.data);
                }

                await dbManager.markAsSynced(operation.id);
            } catch (error) {
                console.error('[Sync] Failed to process operation:', operation.id, error);
            }
        }

        // Cleanup
        await dbManager.clearSyncedOperations();
    }

    // Check connessione
    async checkConnection() {
        try {
            const response = await fetch('https://api.jsonbin.io/v3/b', {
                method: 'HEAD',
                headers: { 'X-Master-Key': this.apiKey }
            });
            return response.ok;
        } catch {
            return false;
        }
    }
}
