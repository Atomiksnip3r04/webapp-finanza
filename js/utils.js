// Utilities - Helper functions per performance e UX

// Debounce - riduce frequenza chiamate funzione
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Throttle - limita chiamate funzione
function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Format number con localizzazione
function formatCurrency(value, locale = 'it-IT', currency = 'EUR') {
    return new Intl.NumberFormat(locale, {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
    }).format(value);
}

// Format date
function formatDate(date, locale = 'it-IT', options = {}) {
    const defaultOptions = {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        ...options
    };
    return new Date(date).toLocaleDateString(locale, defaultOptions);
}

// Compress string (per ridurre dimensione sync)
function compressString(str) {
    // Simple encoding, non vera compressione
    return btoa(encodeURIComponent(str));
}

function decompressString(str) {
    return decodeURIComponent(atob(str));
}

// Generate unique ID
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

// Deep clone object
function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}

// Group array by key
function groupBy(array, key) {
    return array.reduce((result, item) => {
        const group = item[key];
        if (!result[group]) {
            result[group] = [];
        }
        result[group].push(item);
        return result;
    }, {});
}

// Sort array by key
function sortBy(array, key, descending = false) {
    return array.sort((a, b) => {
        const valA = a[key];
        const valB = b[key];
        if (valA < valB) return descending ? 1 : -1;
        if (valA > valB) return descending ? -1 : 1;
        return 0;
    });
}

// Calcola percentuale
function percentage(value, total) {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
}

// Clamp value tra min e max
function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

// Parse amount (gestisce virgola e punto)
function parseAmount(str) {
    if (typeof str === 'number') return str;
    const cleaned = str.toString().replace(/,/g, '.');
    return parseFloat(cleaned) || 0;
}

// Validate email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Get days between dates
function daysBetween(date1, date2) {
    const one = new Date(date1);
    const two = new Date(date2);
    const diff = Math.abs(two - one);
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Get start/end of month
function getMonthBounds(date = new Date()) {
    const start = new Date(date.getFullYear(), date.getMonth(), 1);
    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);
    return { start, end };
}

// Check if date is in range
function isDateInRange(date, start, end) {
    const d = new Date(date);
    return d >= start && d <= end;
}

// Simple storage helpers
const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch {
            return defaultValue;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    clear() {
        localStorage.clear();
    }
};

// Notify helpers
function showToast(message, type = 'info', duration = 3000) {
    // Implementazione semplice, può essere sostituita con libreria toast
    console.log(`[${type.toUpperCase()}] ${message}`);

    // Se supportate, usa notifications
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('FUTURA SYNC', {
            body: message,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png'
        });
    }
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Copiato negli appunti', 'success');
        return true;
    } catch {
        // Fallback
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast('Copiato negli appunti', 'success');
        return true;
    }
}

// Download file
function downloadFile(content, filename, type = 'text/plain') {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Virtual scroll helper
class VirtualScroller {
    constructor(container, itemHeight, renderItem) {
        this.container = container;
        this.itemHeight = itemHeight;
        this.renderItem = renderItem;
        this.visibleItems = [];
        this.allItems = [];
        this.scrollTop = 0;
        this.containerHeight = 0;
    }

    setItems(items) {
        this.allItems = items;
        this.render();
    }

    render() {
        this.containerHeight = this.container.clientHeight;
        const startIndex = Math.floor(this.scrollTop / this.itemHeight);
        const endIndex = Math.ceil((this.scrollTop + this.containerHeight) / this.itemHeight);

        this.visibleItems = this.allItems.slice(
            Math.max(0, startIndex - 5),
            Math.min(this.allItems.length, endIndex + 5)
        );

        // Trigger render callback
        this.renderItem(this.visibleItems, startIndex);
    }

    onScroll(scrollTop) {
        this.scrollTop = scrollTop;
        this.render();
    }
}
