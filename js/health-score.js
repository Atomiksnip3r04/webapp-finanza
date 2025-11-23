/**
 * Financial Health Score Calculator
 * Calcola un punteggio 0-100 della salute finanziaria basato su 5 metriche
 */

class HealthScoreCalculator {
    constructor() {
        this.weights = {
            savingRate: 30,      // % entrate risparmiate
            debtRatio: 25,       // prestiti/entrate ratio
            budgetAdherence: 20, // rispetto budget
            emergencyFund: 15,   // balance vs 3 mesi spese
            consistency: 10      // regolarità entrate
        };
    }

    /**
     * Calcola il punteggio completo
     */
    calculateScore(transactions, balance, budgets = [], loans = []) {
        const metrics = {
            savingRate: this.calculateSavingRate(transactions),
            debtRatio: this.calculateDebtRatio(transactions, loans),
            budgetAdherence: this.calculateBudgetAdherence(transactions, budgets),
            emergencyFund: this.calculateEmergencyFund(transactions, balance),
            consistency: this.calculateConsistency(transactions)
        };

        // Calculate weighted score
        let totalScore = 0;
        for (const [key, value] of Object.entries(metrics)) {
            totalScore += value.score * (this.weights[key] / 100);
        }

        return {
            totalScore: Math.round(totalScore),
            metrics,
            grade: this.getGrade(totalScore),
            recommendations: this.getRecommendations(metrics)
        };
    }

    /**
     * Calcola Saving Rate (0-30 punti)
     * % delle entrate che vengono risparmiate
     */
    calculateSavingRate(transactions) {
        const last30Days = this.getTransactionsLastNDays(transactions, 30);
        const income = last30Days.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0);
        const expenses = last30Days.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);

        if (income === 0) {
            return { score: 0, value: 0, status: 'bad', message: 'Nessuna entrata registrata' };
        }

        const saved = income - expenses;
        const savingRate = (saved / income) * 100;

        let score = 0;
        let status = 'bad';
        if (savingRate >= 20) { score = 30; status = 'excellent'; }
        else if (savingRate >= 15) { score = 25; status = 'good'; }
        else if (savingRate >= 10) { score = 20; status = 'fair'; }
        else if (savingRate >= 5) { score = 15; status = 'poor'; }
        else if (savingRate > 0) { score = 10; status = 'bad'; }

        return {
            score,
            value: savingRate,
            status,
            message: `Stai risparmiando il ${savingRate.toFixed(1)}% delle tue entrate`
        };
    }

    /**
     * Calcola Debt Ratio (0-25 punti)
     * Rapporto prestiti attivi / entrate mensili
     */
    calculateDebtRatio(transactions, loans) {
        const monthlyIncome = this.getAverageMonthlyIncome(transactions);
        const activeDebt = loans.reduce((sum, l) => sum + (l.originalAmount - l.repaidAmount), 0);

        if (monthlyIncome === 0) {
            return { score: 0, value: 0, status: 'unknown', message: 'Nessuna entrata registrata' };
        }

        const debtRatio = (activeDebt / monthlyIncome) * 100;

        let score = 25;
        let status = 'excellent';
        if (debtRatio === 0) { score = 25; status = 'excellent'; }
        else if (debtRatio < 30) { score = 20; status = 'good'; }
        else if (debtRatio < 50) { score = 15; status = 'fair'; }
        else if (debtRatio < 100) { score = 10; status = 'poor'; }
        else { score = 5; status = 'bad'; }

        return {
            score,
            value: debtRatio,
            activeDebt,
            status,
            message: debtRatio === 0 ? 'Nessun debito attivo' : `Debito pari al ${debtRatio.toFixed(0)}% delle entrate mensili`
        };
    }

    /**
     * Calcola Budget Adherence (0-20 punti)
     * Quanto bene si rispettano i budget impostati
     */
    calculateBudgetAdherence(transactions, budgets) {
        if (!budgets || budgets.length === 0) {
            return { score: 10, value: 0, status: 'unknown', message: 'Nessun budget impostato' };
        }

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let totalBudget = 0;
        let totalSpent = 0;
        let budgetsRespected = 0;

        for (const budget of budgets) {
            if (budget.month === currentMonth && budget.year === currentYear) {
                const categoryTransactions = transactions.filter(t =>
                    t.type === 'out' &&
                    t.category === budget.category &&
                    new Date(t.timestamp).getMonth() === currentMonth &&
                    new Date(t.timestamp).getFullYear() === currentYear
                );

                const spent = categoryTransactions.reduce((sum, t) => sum + t.amount, 0);
                totalBudget += budget.amount;
                totalSpent += spent;

                if (spent <= budget.amount) budgetsRespected++;
            }
        }

        const adherenceRate = budgets.length > 0 ? (budgetsRespected / budgets.length) * 100 : 0;

        let score = 0;
        let status = 'bad';
        if (adherenceRate >= 90) { score = 20; status = 'excellent'; }
        else if (adherenceRate >= 70) { score = 16; status = 'good'; }
        else if (adherenceRate >= 50) { score = 12; status = 'fair'; }
        else if (adherenceRate >= 30) { score = 8; status = 'poor'; }
        else { score = 4; status = 'bad'; }

        return {
            score,
            value: adherenceRate,
            budgetsRespected,
            totalBudgets: budgets.length,
            status,
            message: `Rispettati ${budgetsRespected} su ${budgets.length} budget (${adherenceRate.toFixed(0)}%)`
        };
    }

    /**
     * Calcola Emergency Fund (0-15 punti)
     * Balance attuale vs 3 mesi di spese medie
     */
    calculateEmergencyFund(transactions, balance) {
        const avgMonthlyExpenses = this.getAverageMonthlyExpenses(transactions);
        const threeMonthsExpenses = avgMonthlyExpenses * 3;

        let score = 0;
        let status = 'bad';
        let months = balance / avgMonthlyExpenses;

        if (months >= 6) { score = 15; status = 'excellent'; }
        else if (months >= 3) { score = 12; status = 'good'; }
        else if (months >= 1) { score = 8; status = 'fair'; }
        else if (months >= 0.5) { score = 4; status = 'poor'; }
        else { score = 0; status = 'bad'; }

        return {
            score,
            value: months,
            threeMonthsExpenses,
            currentBalance: balance,
            status,
            message: `Fondo emergenza copre ${months.toFixed(1)} mesi di spese`
        };
    }

    /**
     * Calcola Consistency (0-10 punti)
     * Regolarità delle entrate
     */
    calculateConsistency(transactions) {
        const last90Days = this.getTransactionsLastNDays(transactions, 90);
        const incomeTransactions = last90Days.filter(t => t.type === 'in');

        if (incomeTransactions.length < 2) {
            return { score: 0, value: 0, status: 'unknown', message: 'Dati insufficienti' };
        }

        // Calculate standard deviation of income amounts
        const amounts = incomeTransactions.map(t => t.amount);
        const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
        const variance = amounts.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / amounts.length;
        const stdDev = Math.sqrt(variance);
        const coefficientOfVariation = (stdDev / avg) * 100;

        let score = 10;
        let status = 'excellent';
        if (coefficientOfVariation < 10) { score = 10; status = 'excellent'; }
        else if (coefficientOfVariation < 20) { score = 8; status = 'good'; }
        else if (coefficientOfVariation < 35) { score = 6; status = 'fair'; }
        else if (coefficientOfVariation < 50) { score = 4; status = 'poor'; }
        else { score = 2; status = 'bad'; }

        return {
            score,
            value: 100 - Math.min(coefficientOfVariation, 100),
            avgIncome: avg,
            consistency: coefficientOfVariation,
            status,
            message: `Entrate ${coefficientOfVariation < 20 ? 'regolari' : 'variabili'}`
        };
    }

    /**
     * Get grade based on score
     */
    getGrade(score) {
        if (score >= 85) return { letter: 'A+', label: 'Eccellente', color: 'green' };
        if (score >= 75) return { letter: 'A', label: 'Ottimo', color: 'green' };
        if (score >= 65) return { letter: 'B', label: 'Buono', color: 'lightgreen' };
        if (score >= 55) return { letter: 'C', label: 'Discreto', color: 'yellow' };
        if (score >= 45) return { letter: 'D', label: 'Sufficiente', color: 'orange' };
        return { letter: 'F', label: 'Scarso', color: 'red' };
    }

    /**
     * Get personalized recommendations
     */
    getRecommendations(metrics) {
        const recommendations = [];

        if (metrics.savingRate.status === 'bad' || metrics.savingRate.status === 'poor') {
            recommendations.push({
                priority: 'high',
                category: 'Risparmio',
                message: 'Cerca di risparmiare almeno il 10% delle tue entrate',
                action: 'Crea obiettivi di risparmio automatici'
            });
        }

        if (metrics.debtRatio.status === 'poor' || metrics.debtRatio.status === 'bad') {
            recommendations.push({
                priority: 'high',
                category: 'Debiti',
                message: 'Riduci i debiti attivi per migliorare la salute finanziaria',
                action: 'Pianifica rimborsi prestiti'
            });
        }

        if (metrics.budgetAdherence.status === 'unknown') {
            recommendations.push({
                priority: 'medium',
                category: 'Budget',
                message: 'Imposta budget mensili per controllare le spese',
                action: 'Crea budget per categorie principali'
            });
        }

        if (metrics.emergencyFund.status === 'bad' || metrics.emergencyFund.status === 'poor') {
            recommendations.push({
                priority: 'high',
                category: 'Fondo Emergenza',
                message: 'Costruisci un fondo emergenza di almeno 3 mesi di spese',
                action: 'Risparmia gradualmente per emergenze'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'low',
                category: 'Complimenti',
                message: 'La tua salute finanziaria è ottima!',
                action: 'Continua così e considera investimenti'
            });
        }

        return recommendations;
    }

    // Helper methods
    getTransactionsLastNDays(transactions, days) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - days);
        return transactions.filter(t => new Date(t.timestamp || t.date) >= cutoffDate);
    }

    getAverageMonthlyIncome(transactions) {
        const last90Days = this.getTransactionsLastNDays(transactions, 90);
        const income = last90Days.filter(t => t.type === 'in').reduce((sum, t) => sum + t.amount, 0);
        return (income / 90) * 30;
    }

    getAverageMonthlyExpenses(transactions) {
        const last90Days = this.getTransactionsLastNDays(transactions, 90);
        const expenses = last90Days.filter(t => t.type === 'out').reduce((sum, t) => sum + t.amount, 0);
        return (expenses / 90) * 30;
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.healthScoreCalculator = new HealthScoreCalculator();
    console.log('[HealthScore] Calculator initialized');
}
