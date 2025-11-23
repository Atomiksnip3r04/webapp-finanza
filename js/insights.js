/**
 * Smart Insights & Predictions Engine
 * Genera insights automatici, detect anomalie, e predizioni future
 */

class InsightsEngine {
    constructor() {
        this.insightHistory = [];
    }

    /**
     * Genera tutti gli insights per il periodo corrente
     */
    generateInsights(transactions, balance, budgets = [], loans = []) {
        const insights = [];

        // Spending trend insights
        insights.push(...this.analyzespendingTrends(transactions));

        // Budget insights
        insights.push(...this.analyzeBudgets(transactions, budgets));

        // Anomaly detection
        insights.push(...this.detectAnomalies(transactions));

        // Balance insights
        insights.push(...this.analyzeBalance(balance, transactions));

        // Loan insights
        insights.push(...this.analyzeLoans(loans));

        // Sort by priority
        insights.sort((a, b) => {
            const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        this.insightHistory = insights;
        return insights;
    }

    /**
     * Analizza trend di spesa
     */
    analyzespendingTrends(transactions) {
        const insights = [];
        const thisMonth = this.getMonthTransactions(transactions, 0);
        const lastMonth = this.getMonthTransactions(transactions, 1);

        const thisMonthSpending = thisMonth.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
        const lastMonthSpending = lastMonth.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);

        if (lastMonthSpending > 0) {
            const percentChange = ((thisMonthSpending - lastMonthSpending) / lastMonthSpending) * 100;

            if (Math.abs(percentChange) > 20) {
                insights.push({
                    type: 'trend',
                    priority: percentChange > 0 ? 'high' : 'medium',
                    icon: percentChange > 0 ? '📈' : '📉',
                    title: percentChange > 0 ? 'Spese in Aumento' : 'Spese in Calo',
                    message: `Le tue spese sono ${percentChange > 0 ? 'aumentate' : 'diminuite'} del ${Math.abs(percentChange).toFixed(0)}% rispetto al mese scorso`,
                    value: percentChange,
                    actionable: percentChange > 0
                });
            }
        }

        // Category-specific trends
        const categoryComparison = this.compareCategorySpending(thisMonth, lastMonth);
        for (const [category, change] of Object.entries(categoryComparison)) {
            if (Math.abs(change) > 40) {
                insights.push({
                    type: 'category-trend',
                    priority: 'medium',
                    icon: '📊',
                    title: `Spese ${category}`,
                    message: `Le spese in "${category}" sono ${change > 0 ? 'aumentate' : 'diminuite'} del ${Math.abs(change).toFixed(0)}%`,
                    value: change
                });
            }
        }

        return insights;
    }

    /**
     * Analizza budget
     */
    analyzeBudgets(transactions, budgets) {
        const insights = [];
        if (!budgets || budgets.length === 0) return insights;

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        for (const budget of budgets) {
            if (budget.month === currentMonth && budget.year === currentYear) {
                const spent = transactions
                    .filter(t =>
                        t.type === 'out' &&
                        t.category === budget.category &&
                        new Date(t.timestamp).getMonth() === currentMonth
                    )
                    .reduce((sum, t) => sum + t.amount, 0);

                const percentage = (spent / budget.amount) * 100;

                if (percentage < 70) {
                    insights.push({
                        type: 'budget-success',
                        priority: 'low',
                        icon: '✅',
                        title: 'Budget Rispettato',
                        message: `Ottimo! Sei sotto budget del ${(100 - percentage).toFixed(0)}% in "${budget.category}"`,
                        value: percentage
                    });
                }
            }
        }

        return insights;
    }

    /**
     * Detect anomalie nelle spese
     */
    detectAnomalies(transactions) {
        const insights = [];
        const last30Days = this.getTransactionsLastNDays(transactions, 30);
        const expenses = last30Days.filter(t => t.type === 'out');

        if (expenses.length < 5) return insights;

        // Calculate average and standard deviation
        const amounts = expenses.map(t => t.amount);
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const stdDev = Math.sqrt(amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length);

        // Find outliers (more than 2 std deviations from mean)
        const outliers = expenses.filter(t => Math.abs(t.amount - avg) > 2 * stdDev);

        for (const outlier of outliers.slice(0, 2)) { // Max 2 anomalie
            insights.push({
                type: 'anomaly',
                priority: 'high',
                icon: '⚠️',
                title: 'Spesa Anomala Rilevata',
                message: `Spesa insolita di €${outlier.amount.toFixed(2)} in "${outlier.desc}" (media: €${avg.toFixed(2)})`,
                transaction: outlier
            });
        }

        return insights;
    }

    /**
     * Analizza balance
     */
    analyzeBalance(balance, transactions) {
        const insights = [];
        const avgMonthlyExpenses = this.getAverageMonthlyExpenses(transactions);

        // Low balance warning
        if (balance < avgMonthlyExpenses * 0.5) {
            insights.push({
                type: 'balance-warning',
                priority: 'critical',
                icon: '🚨',
                title: 'Balance Basso',
                message: `Il tuo balance (€${balance.toFixed(2)}) copre meno di metà mese di spese medie`,
                actionable: true
            });
        }

        // Positive balance insight
        if (balance > avgMonthlyExpenses * 3) {
            insights.push({
                type: 'balance-positive',
                priority: 'low',
                icon: '💰',
                title: 'Ottima Posizione Finanziaria',
                message: `Hai un fondo che copre ${(balance / avgMonthlyExpenses).toFixed(1)} mesi di spese!`,
                actionable: false
            });
        }

        return insights;
    }

    /**
     * Analizza prestiti
     */
    analyzeLoans(loans) {
        const insights = [];
        const activeLoans = loans.filter(l => l.repaidAmount < l.originalAmount);

        if (activeLoans.length > 2) {
            const totalDebt = activeLoans.reduce((sum, l) => sum + (l.originalAmount - l.repaidAmount), 0);
            insights.push({
                type: 'loan-warning',
                priority: 'medium',
                icon: '💳',
                title: 'Prestiti Multipli Attivi',
                message: `Hai ${activeLoans.length} prestiti attivi per un totale di €${totalDebt.toFixed(2)}`,
                actionable: true
            });
        }

        return insights;
    }

    /**
     * Predici balance futuro
     */
    predictBalance(transactions, currentBalance, months = 3) {
        const avgMonthlyIncome = this.getAverageMonthlyIncome(transactions);
        const avgMonthlyExpenses = this.getAverageMonthlyExpenses(transactions);
        const monthlyNet = avgMonthlyIncome - avgMonthlyExpenses;

        const predictions = [];
        let balance = currentBalance;

        for (let i = 1; i <= months; i++) {
            balance += monthlyNet;
            predictions.push({
                month: i,
                predictedBalance: balance,
                monthlyNet: monthlyNet
            });
        }

        // Best/worst case scenarios (±20%)
        const bestCase = predictions.map(p => ({
            ...p,
            predictedBalance: p.predictedBalance + (monthlyNet * 0.2 * p.month)
        }));

        const worstCase = predictions.map(p => ({
            ...p,
            predictedBalance: p.predictedBalance - (monthlyNet * 0.2 * p.month)
        }));

        return {
            base: predictions,
            best: bestCase,
            worst: worstCase,
            avgMonthlyNet: monthlyNet
        };
    }

    // Helper methods
    getMonthTransactions(transactions, monthsAgo) {
        const date = new Date();
        date.setMonth(date.getMonth() - monthsAgo);
        const month = date.getMonth();
        const year = date.getFullYear();

        return transactions.filter(t => {
            const tDate = new Date(t.timestamp || t.date);
            return tDate.getMonth() === month && tDate.getFullYear() === year;
        });
    }

    getTransactionsLastNDays(transactions, days) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        return transactions.filter(t => new Date(t.timestamp || t.date) >= cutoff);
    }

    compareCategorySpending(thisMonth, lastMonth) {
        const comparison = {};
        const categories = new Set([
            ...thisMonth.map(t => t.category),
            ...lastMonth.map(t => t.category)
        ]);

        for (const category of categories) {
            const thisSpent = thisMonth.filter(t => t.category === category && t.type === 'out')
                .reduce((s, t) => s + t.amount, 0);
            const lastSpent = lastMonth.filter(t => t.category === category && t.type === 'out')
                .reduce((s, t) => s + t.amount, 0);

            if (lastSpent > 0) {
                comparison[category] = ((thisSpent - lastSpent) / lastSpent) * 100;
            }
        }

        return comparison;
    }

    getAverageMonthlyIncome(transactions) {
        const last90 = this.getTransactionsLastNDays(transactions, 90);
        const income = last90.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
        return (income / 90) * 30;
    }

    getAverageMonthlyExpenses(transactions) {
        const last90 = this.getTransactionsLastNDays(transactions, 90);
        const expenses = last90.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
        return (expenses / 90) * 30;
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.insightsEngine = new InsightsEngine();
    console.log('[Insights] Engine initialized');
}
