/**
 * Savings Goals Manager
 * Gestisce obiettivi di risparmio con tracking, proiezioni e auto-allocazione
 */

class SavingsGoalManager {
    constructor() {
        this.goals = [];
        this.autoAllocatePercentage = 10; // 10% delle entrate verso obiettivi
    }

    /**
     * Carica obiettivi da storage
     */
    async loadGoals() {
        try {
            if (typeof db !== 'undefined') {
                this.goals = await db.getAll('goals') || [];
            } else {
                const stored = localStorage.getItem('savings_goals');
                this.goals = stored ? JSON.parse(stored) : [];
            }
            console.log('[SavingsGoals] Loaded', this.goals.length, 'goals');
            return this.goals;
        } catch (error) {
            console.error('[SavingsGoals] Load error:', error);
            return [];
        }
    }

    /**
     * Salva obiettivi su storage
     */
    async saveGoals() {
        try {
            if (typeof db !== 'undefined') {
                // Save to IndexedDB
                for (const goal of this.goals) {
                    await db.put('goals', goal);
                }
            } else {
                localStorage.setItem('savings_goals', JSON.stringify(this.goals));
            }
            console.log('[SavingsGoals] Saved', this.goals.length, 'goals');
        } catch (error) {
            console.error('[SavingsGoals] Save error:', error);
        }
    }

    /**
     * Crea nuovo obiettivo di risparmio
     */
    createGoal(name, targetAmount, targetDate, category = 'general') {
        const goal = {
            id: generateId ? generateId() : Date.now(),
            name: name.trim(),
            targetAmount: parseFloat(targetAmount),
            targetDate: targetDate,
            currentAmount: 0,
            category: category,
            createdAt: new Date().toISOString(),
            completed: false,
            completedAt: null,
            contributions: []
        };

        this.goals.push(goal);
        this.saveGoals();

        console.log('[SavingsGoals] Created goal:', goal.name);
        return goal;
    }

    /**
     * Aggiungi contributo manuale a obiettivo
     */
    addContribution(goalId, amount, description = 'Contributo manuale') {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal) {
            console.error('[SavingsGoals] Goal not found:', goalId);
            return null;
        }

        const contribution = {
            id: generateId ? generateId() : Date.now(),
            amount: parseFloat(amount),
            description: description,
            date: new Date().toISOString()
        };

        goal.contributions.push(contribution);
        goal.currentAmount += contribution.amount;

        // Check if goal completed
        if (goal.currentAmount >= goal.targetAmount && !goal.completed) {
            goal.completed = true;
            goal.completedAt = new Date().toISOString();

            // Send notification
            if (typeof notificationManager !== 'undefined') {
                notificationManager.send({
                    title: '🎉 Obiettivo Raggiunto!',
                    body: `Hai completato l'obiettivo "${goal.name}"!`,
                    icon: 'icons/icon-192.png',
                    badge: 'icons/icon-192.png'
                });
            }

            console.log('[SavingsGoals] Goal completed:', goal.name);
        }

        this.saveGoals();
        return contribution;
    }

    /**
     * Auto-alloca percentuale di un'entrata verso obiettivi attivi
     */
    autoAllocateFromIncome(incomeAmount) {
        const activeGoals = this.getActiveGoals();
        if (activeGoals.length === 0) return [];

        const totalToAllocate = incomeAmount * (this.autoAllocatePercentage / 100);
        const perGoal = totalToAllocate / activeGoals.length;

        const allocations = [];
        for (const goal of activeGoals) {
            const contribution = this.addContribution(
                goal.id,
                perGoal,
                `Auto-allocazione ${this.autoAllocatePercentage}%`
            );
            allocations.push({ goalId: goal.id, amount: perGoal, contribution });
        }

        console.log('[SavingsGoals] Auto-allocated', totalToAllocate, 'to', activeGoals.length, 'goals');
        return allocations;
    }

    /**
     * Calcola proiezione completamento obiettivo
     */
    calculateProjection(goalId) {
        const goal = this.goals.find(g => g.id === goalId);
        if (!goal || goal.completed) return null;

        const remaining = goal.targetAmount - goal.currentAmount;
        const targetDate = new Date(goal.targetDate);
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((targetDate - now) / (1000 * 60 * 60 * 24)));

        // Calculate average contribution per day from history
        const contributions = goal.contributions;
        if (contributions.length === 0) {
            return {
                daysRemaining,
                requiredPerDay: remaining / Math.max(1, daysRemaining),
                requiredPerMonth: (remaining / Math.max(1, daysRemaining)) * 30,
                estimatedDate: null,
                onTrack: false
            };
        }

        const firstContribution = new Date(contributions[0].date);
        const daysSinceStart = Math.max(1, Math.ceil((now - firstContribution) / (1000 * 60 * 60 * 24)));
        const avgPerDay = goal.currentAmount / daysSinceStart;

        // Estimate completion date
        const daysToComplete = remaining / avgPerDay;
        const estimatedDate = new Date(now.getTime() + (daysToComplete * 24 * 60 * 60 * 1000));
        const onTrack = estimatedDate <= targetDate;

        return {
            daysRemaining,
            requiredPerDay: remaining / Math.max(1, daysRemaining),
            requiredPerMonth: (remaining / Math.max(1, daysRemaining)) * 30,
            avgPerDay,
            avgPerMonth: avgPerDay * 30,
            estimatedDate: estimatedDate.toISOString(),
            onTrack,
            progressPercent: (goal.currentAmount / goal.targetAmount) * 100
        };
    }

    /**
     * Get all goals
     */
    getAllGoals() {
        return this.goals;
    }

    /**
     * Get active (not completed) goals
     */
    getActiveGoals() {
        return this.goals.filter(g => !g.completed);
    }

    /**
     * Get completed goals
     */
    getCompletedGoals() {
        return this.goals.filter(g => g.completed);
    }

    /**
     * Get goal by ID
     */
    getGoal(goalId) {
        return this.goals.find(g => g.id === goalId);
    }

    /**
     * Delete goal
     */
    deleteGoal(goalId) {
        const index = this.goals.findIndex(g => g.id === goalId);
        if (index !== -1) {
            const deleted = this.goals.splice(index, 1)[0];
            this.saveGoals();
            console.log('[SavingsGoals] Deleted goal:', deleted.name);
            return deleted;
        }
        return null;
    }

    /**
     * Get total amount allocated to active goals
     */
    getTotalAllocated() {
        return this.getActiveGoals().reduce((sum, g) => sum + g.currentAmount, 0);
    }

    /**
     * Get total target of active goals
     */
    getTotalTarget() {
        return this.getActiveGoals().reduce((sum, g) => sum + g.targetAmount, 0);
    }

    /**
     * Get statistics
     */
    getStatistics() {
        const all = this.getAllGoals();
        const active = this.getActiveGoals();
        const completed = this.getCompletedGoals();

        return {
            total: all.length,
            active: active.length,
            completed: completed.length,
            totalAllocated: this.getTotalAllocated(),
            totalTarget: this.getTotalTarget(),
            completionRate: all.length > 0 ? (completed.length / all.length) * 100 : 0
        };
    }
}

// Initialize global instance
if (typeof window !== 'undefined') {
    window.savingsGoalManager = new SavingsGoalManager();
    console.log('[SavingsGoals] Manager initialized');
}
