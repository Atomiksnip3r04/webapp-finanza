// Recurring - Sistema gestione transazioni ricorrenti

class RecurringManager {
    constructor() {
        this.recurrings = [];
        this.loadRecurrings();
    }

    // Crea nuova ricorrenza
    createRecurring(data) {
        const recurring = {
            id: generateId(),
            desc: data.desc,
            amount: parseFloat(data.amount),
            type: data.type, // 'in' or 'out'
            category: data.category || 'other',
            frequency: data.frequency, // 'daily', 'weekly', 'monthly', 'yearly'
            dayOfWeek: data.dayOfWeek, // 0-6 per weekly
            dayOfMonth: data.dayOfMonth, // 1-31 per monthly
            startDate: data.startDate || new Date().toISOString(),
            endDate: data.endDate || null,
            active: true,
            lastExecuted: null,
            nextExecution: this.calculateNextExecution(data),
            createdAt: new Date().toISOString()
        };

        this.recurrings.push(recurring);
        this.saveRecurrings();

        return recurring;
    }

    // Calcola prossima esecuzione
    calculateNextExecution(recurring, from = new Date()) {
        const date = new Date(from);
        date.setHours(0, 0, 0, 0);

        switch (recurring.frequency) {
            case 'daily':
                date.setDate(date.getDate() + 1);
                break;

            case 'weekly':
                const targetDay = recurring.dayOfWeek || 1;
                const currentDay = date.getDay();
                const daysToAdd = (targetDay - currentDay + 7) % 7 || 7;
                date.setDate(date.getDate() + daysToAdd);
                break;

            case 'monthly':
                const targetDayOfMonth = recurring.dayOfMonth || 1;
                date.setMonth(date.getMonth() + 1);
                date.setDate(Math.min(targetDayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
                break;

            case 'yearly':
                date.setFullYear(date.getFullYear() + 1);
                break;
        }

        return date.toISOString();
    }

    // Update ricorrenza
    updateRecurring(id, updates) {
        const index = this.recurrings.findIndex(r => r.id === id);
        if (index !== -1) {
            this.recurrings[index] = { ...this.recurrings[index], ...updates };

            // Ricalcola next execution se cambiati parametri
            if (updates.frequency || updates.dayOfWeek || updates.dayOfMonth) {
                this.recurrings[index].nextExecution = this.calculateNextExecution(this.recurrings[index]);
            }

            this.saveRecurrings();
            return this.recurrings[index];
        }
        return null;
    }

    // Delete ricorrenza
    deleteRecurring(id) {
        this.recurrings = this.recurrings.filter(r => r.id !== id);
        this.saveRecurrings();
    }

    // Toggle active status
    toggleRecurring(id) {
        const recurring = this.recurrings.find(r => r.id === id);
        if (recurring) {
            recurring.active = !recurring.active;
            this.saveRecurrings();
            return recurring;
        }
        return null;
    }

    // Get ricorrenze attive
    getActiveRecurrings() {
        return this.recurrings.filter(r => r.active);
    }

    // Get ricorrenze da eseguire oggi
    getDueRecurrings() {
        const now = new Date();
        now.setHours(23, 59, 59, 999);

        return this.recurrings.filter(r =>
            r.active &&
            new Date(r.nextExecution) <= now
        );
    }

    // Esegui ricorrenza (crea transazione)
    executeRecurring(id, createTransaction) {
        const recurring = this.recurrings.find(r => r.id === id);
        if (!recurring) return null;

        // Crea transazione
        const transaction = {
            desc: recurring.desc,
            amount: recurring.amount,
            type: recurring.type,
            category: recurring.category,
            date: new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }),
            timestamp: new Date().toISOString(),
            recurring: true,
            recurringId: recurring.id
        };

        // Callback per creare transazione nell'app
        if (createTransaction) {
            createTransaction(transaction);
        }

        // Update last executed e next execution
        recurring.lastExecuted = new Date().toISOString();
        recurring.nextExecution = this.calculateNextExecution(recurring, new Date());

        this.saveRecurrings();

        return transaction;
    }

    // Auto-process ricorrenze scadute
    processAllDue(createTransaction) {
        const due = this.getDueRecurrings();
        const executed = [];

        due.forEach(recurring => {
            const trans = this.executeRecurring(recurring.id, createTransaction);
            if (trans) {
                executed.push(trans);
            }
        });

        return executed;
    }

    // Get previsioni prossimi N giorni
    getForecast(days = 30) {
        const forecast = [];
        const now = new Date();
        const endDate = new Date(now);
        endDate.setDate(endDate.getDate() + days);

        this.getActiveRecurrings().forEach(recurring => {
            let nextDate = new Date(recurring.nextExecution);

            while (nextDate <= endDate) {
                forecast.push({
                    date: nextDate.toISOString(),
                    recurring,
                    amount: recurring.amount,
                    type: recurring.type
                });

                nextDate = new Date(this.calculateNextExecution(recurring, nextDate));
            }
        });

        return forecast.sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    // Calcola impatto ricorrenze sul balance futuro
    calculateFutureImpact(days = 30) {
        const forecast = this.getForecast(days);

        let totalIncome = 0;
        let totalExpense = 0;

        forecast.forEach(item => {
            if (item.type === 'in') {
                totalIncome += item.amount;
            } else {
                totalExpense += item.amount;
            }
        });

        return {
            totalIncome,
            totalExpense,
            netImpact: totalIncome - totalExpense,
            items: forecast.length
        };
    }

    // Save
    saveRecurrings() {
        storage.set('recurrings', this.recurrings);
    }

    // Load
    loadRecurrings() {
        this.recurrings = storage.get('recurrings', []);
    }

    // Get frequency label
    getFrequencyLabel(frequency) {
        const labels = {
            daily: 'Giornaliera',
            weekly: 'Settimanale',
            monthly: 'Mensile',
            yearly: 'Annuale'
        };
        return labels[frequency] || frequency;
    }
}

// Singleton
const recurringManager = new RecurringManager();

// Auto-check ricorrenze al caricamento
if (typeof window !== 'undefined') {
    window.addEventListener('load', () => {
        // Check dopo 2 secondi per dare tempo all'app di caricare
        setTimeout(() => {
            const due = recurringManager.getDueRecurrings();
            if (due.length > 0) {
                console.log(`[Recurring] ${due.length} ricorrenze da processare`);
            }
        }, 2000);
    });
}
