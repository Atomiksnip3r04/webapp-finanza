// Analytics - Sistema tracking e statistiche finanziarie

class AnalyticsManager {
    constructor() {
        this.cache = new Map();
    }

    // Statistiche mensili
    getMonthlyStats(transactions, month = new Date()) {
        const cacheKey = `monthly_${month.getMonth()}_${month.getFullYear()}`;

        if (this.cache.has(cacheKey)) {
            return this.cache.get(cacheKey);
        }

        const bounds = getMonthBounds(month);
        const monthTrans = transactions.filter(t =>
            isDateInRange(t.timestamp || t.date, bounds.start, bounds.end)
        );

        const stats = {
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
            transactionCount: monthTrans.length,
            avgExpense: 0,
            avgIncome: 0,
            categories: {},
            dailyData: []
        };

        monthTrans.forEach(trans => {
            const amount = parseFloat(trans.amount);

            if (trans.type === 'in') {
                stats.totalIncome += amount;
            } else {
                stats.totalExpense += amount;
            }

            // Per categoria
            const cat = trans.category || 'other';
            if (!stats.categories[cat]) {
                stats.categories[cat] = { income: 0, expense: 0, count: 0 };
            }

            if (trans.type === 'in') {
                stats.categories[cat].income += amount;
            } else {
                stats.categories[cat].expense += amount;
            }
            stats.categories[cat].count++;
        });

        stats.balance = stats.totalIncome - stats.totalExpense;
        stats.avgExpense = monthTrans.filter(t => t.type === 'out').length > 0
            ? stats.totalExpense / monthTrans.filter(t => t.type === 'out').length
            : 0;
        stats.avgIncome = monthTrans.filter(t => t.type === 'in').length > 0
            ? stats.totalIncome / monthTrans.filter(t => t.type === 'in').length
            : 0;

        this.cache.set(cacheKey, stats);
        return stats;
    }

    // Trend ultimi N mesi
    getTrend(transactions, months = 6) {
        const trend = [];
        const now = new Date();

        for (let i = months - 1; i >= 0; i--) {
            const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const stats = this.getMonthlyStats(transactions, month);

            trend.push({
                month: formatDate(month, 'it-IT', { month: 'short', year: 'numeric' }),
                income: stats.totalIncome,
                expense: stats.totalExpense,
                balance: stats.balance
            });
        }

        return trend;
    }

    // Saving rate
    getSavingRate(transactions, month = new Date()) {
        const stats = this.getMonthlyStats(transactions, month);

        if (stats.totalIncome === 0) return 0;

        return ((stats.totalIncome - stats.totalExpense) / stats.totalIncome) * 100;
    }

    // Previsione prossimo mese basata su media
    getForecast(transactions) {
        const last3Months = this.getTrend(transactions, 3);

        const avgIncome = last3Months.reduce((sum, m) => sum + m.income, 0) / 3;
        const avgExpense = last3Months.reduce((sum, m) => sum + m.expense, 0) / 3;

        return {
            expectedIncome: avgIncome,
            expectedExpense: avgExpense,
            expectedBalance: avgIncome - avgExpense
        };
    }

    // Export dati CSV
    exportCSV(transactions) {
        const headers = ['Data', 'Tipo', 'Categoria', 'Descrizione', 'Importo'];
        const rows = transactions.map(t => [
            formatDate(t.timestamp || t.date),
            t.type === 'in' ? 'Entrata' : 'Uscita',
            t.category || 'other',
            t.desc,
            t.amount
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csv;
    }

    // Export JSON
    exportJSON(data) {
        return JSON.stringify(data, null, 2);
    }

    // Prepara dati per Chart.js
    prepareChartData(transactions, type = 'monthly') {
        if (type === 'monthly') {
            const trend = this.getTrend(transactions, 6);

            return {
                labels: trend.map(m => m.month),
                datasets: [
                    {
                        label: 'Entrate',
                        data: trend.map(m => m.income),
                        backgroundColor: 'rgba(34, 197, 94, 0.2)',
                        borderColor: 'rgba(34, 197, 94, 1)',
                        borderWidth: 2,
                        tension: 0.4
                    },
                    {
                        label: 'Uscite',
                        data: trend.map(m => m.expense),
                        backgroundColor: 'rgba(239, 68, 68, 0.2)',
                        borderColor: 'rgba(239, 68, 68, 1)',
                        borderWidth: 2,
                        tension: 0.4
                    }
                ]
            };
        }

        if (type === 'category') {
            const stats = this.getMonthlyStats(transactions);
            const categories = Object.entries(stats.categories)
                .sort((a, b) => b[1].expense - a[1].expense)
                .slice(0, 6);

            return {
                labels: categories.map(([id]) => categoryManager.getCategory(id)?.name || id),
                datasets: [{
                    label: 'Spese per Categoria',
                    data: categories.map(([, data]) => data.expense),
                    backgroundColor: categories.map(([id]) => categoryManager.getCategory(id)?.color || '#64748b'),
                    borderWidth: 0
                }]
            };
        }

        return null;
    }

    // Anomalie - spese inusuali
    detectAnomalies(transactions, threshold = 2) {
        const expenses = transactions.filter(t => t.type === 'out');

        if (expenses.length < 5) return [];

        const amounts = expenses.map(t => t.amount);
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(
            amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length
        );

        return expenses.filter(t =>
            Math.abs(t.amount - avg) > threshold * stdDev
        );
    }

    // Clear cache
    clearCache() {
        this.cache.clear();
    }
}

// Singleton
const analyticsManager = new AnalyticsManager();
