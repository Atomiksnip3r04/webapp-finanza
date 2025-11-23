// Notifications - Sistema notifiche push e in-app

class NotificationManager {
    constructor() {
        this.permission = 'default';
        this.enabled = false;
        this.checkPermission();
    }

    // Check permission corrente
    checkPermission() {
        if ('Notification' in window) {
            this.permission = Notification.permission;
            this.enabled = this.permission === 'granted';
        }
    }

    // Richiedi permesso
    async requestPermission() {
        if (!('Notification' in window)) {
            console.warn('[Notifications] Not supported');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            this.permission = permission;
            this.enabled = permission === 'granted';

            if (this.enabled) {
                console.log('[Notifications] Permission granted');
                this.sendNotification('Notifiche Attive', {
                    body: 'Riceverai notifiche importanti per i tuoi budget e transazioni',
                    icon: '/icons/icon-192.png'
                });
            }

            return this.enabled;
        } catch (error) {
            console.error('[Notifications] Permission error:', error);
            return false;
        }
    }

    // Invia notifica
    sendNotification(title, options = {}) {
        if (!this.enabled) {
            console.log('[Notifications] Disabled:', title);
            return null;
        }

        const defaultOptions = {
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            vibrate: [200, 100, 200],
            ...options
        };

        try {
            const notification = new Notification(title, defaultOptions);

            notification.onclick = () => {
                window.focus();
                if (options.onClick) {
                    options.onClick();
                }
                notification.close();
            };

            return notification;
        } catch (error) {
            console.error('[Notifications] Send error:', error);
            return null;
        }
    }

    // Notifica budget warning
    notifyBudgetWarning(category, percentage) {
        const categoryName = categoryManager.getCategory(category)?.name || category;

        this.sendNotification('⚠️ Budget Alert', {
            body: `Budget "${categoryName}" raggiunto al ${Math.round(percentage)}%`,
            tag: `budget-${category}`,
            requireInteraction: true
        });
    }

    // Notifica budget superato
    notifyBudgetExceeded(category, overAmount) {
        const categoryName = categoryManager.getCategory(category)?.name || category;

        this.sendNotification('🚨 Budget Superato!', {
            body: `Hai superato il budget "${categoryName}" di €${overAmount.toFixed(2)}`,
            tag: `budget-exceeded-${category}`,
            requireInteraction: true
        });
    }

    // Notifica ricorrenza eseguita
    notifyRecurringExecuted(description, amount, type) {
        const emoji = type === 'in' ? '💰' : '💸';
        this.sendNotification(`${emoji} Ricorrenza Eseguita`, {
            body: `${description}: ${type === 'in' ? '+' : '-'}€${amount.toFixed(2)}`,
            tag: 'recurring-executed'
        });
    }

    // Notifica sync completato
    notifySyncComplete(success = true) {
        if (success) {
            this.sendNotification('☁️ Sync Completato', {
                body: 'I tuoi dati sono stati sincronizzati con successo',
                tag: 'sync-complete'
            });
        } else {
            this.sendNotification('⚠️ Sync Fallito', {
                body: 'Impossibile sincronizzare. Riproveremo automaticamente.',
                tag: 'sync-failed',
                requireInteraction: true
            });
        }
    }

    // Notifica saving goal raggiunto
    notifySavingGoal(goalName, amount) {
        this.sendNotification('🎉 Obiettivo Raggiunto!', {
            body: `Complimenti! Hai raggiunto "${goalName}" (€${amount.toFixed(2)})`,
            tag: 'goal-achieved',
            requireInteraction: true
        });
    }

    // Notifica reminder generico
    notifyReminder(message) {
        this.sendNotification('🔔 Promemoria', {
            body: message,
            tag: 'reminder'
        });
    }

    // Schedule notifica futura (usa setTimeout)
    scheduleNotification(title, options, delayMs) {
        setTimeout(() => {
            this.sendNotification(title, options);
        }, delayMs);
    }

    // Get impostazioni notifiche
    getSettings() {
        return storage.get('notification_settings', {
            budgetWarnings: true,
            budgetExceeded: true,
            recurring: true,
            sync: false,
            savingGoals: true,
            reminders: true
        });
    }

    // Save impostazioni
    saveSettings(settings) {
        storage.set('notification_settings', settings);
    }

    // Check se tipo notifica è abilitato
    isTypeEnabled(type) {
        const settings = this.getSettings();
        return settings[type] !== false;
    }

    // Smart send - controlla impostazioni prima di inviare
    smartSend(type, title, options) {
        if (!this.isTypeEnabled(type)) {
            return null;
        }
        return this.sendNotification(title, options);
    }
}

// Singleton
const notificationManager = new NotificationManager();

// Auto-request permission se non ancora fatto
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Aspetta qualche secondo prima di chiedere permesso
        // Per non essere troppo invadenti
        const hasAsked = storage.get('notification_permission_asked', false);

        if (!hasAsked && notificationManager.permission === 'default') {
            setTimeout(() => {
                // L'app può decidere quando chiamare requestPermission()
                console.log('[Notifications] Ready to request permission');
            }, 5000);
        }
    });
}
