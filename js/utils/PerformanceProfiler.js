/**
 * PerformanceProfiler - měří execution times Core systémů
 * 
 * Umožňuje sledovat výkonnost jednotlivých systémů v real-time
 * pro optimalizaci a debugging performance bottlenecků.
 */

export class PerformanceProfiler {
    constructor() {
        this.enabled = false;
        this.measurements = new Map();
        this.averages = new Map();
        this.sampleSize = 60; // průměr z posledních 60 měření
        
        // Inicializace pro známé Core systémy
        const systems = [
            'ProjectileSystem',
            'LootSystem', 
            'AISystem',
            'BossSystem',
            'PowerUpSystem',
            'CollisionSystem',
            'SpawnSystem',
            'AudioSystem',
            'AnalyticsManager'
        ];
        
        systems.forEach(system => {
            this.measurements.set(system, []);
            this.averages.set(system, 0);
        });
        
        // Automaticky zapnout pokud je localStorage flag
        try {
            if (window.localStorage.getItem('perfProfiler') === 'true') {
                this.enabled = true;
            }
        } catch (_) {}
    }
    
    /**
     * Začít měření systému
     * @param {string} systemName - název systému
     * @returns {number} timestamp pro endMeasurement
     */
    startMeasurement(systemName) {
        if (!this.enabled) return null;
        return performance.now();
    }
    
    /**
     * Ukončit měření systému
     * @param {string} systemName - název systému
     * @param {number} startTime - timestamp z startMeasurement
     */
    endMeasurement(systemName, startTime) {
        if (!this.enabled || startTime === null) return;
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // Uložit měření
        let measurements = this.measurements.get(systemName);
        if (!measurements) {
            measurements = [];
            this.measurements.set(systemName, measurements);
        }
        
        measurements.push(executionTime);
        
        // Udržet pouze posledních N měření
        if (measurements.length > this.sampleSize) {
            measurements.shift();
        }
        
        // Přepočítat průměr
        const average = measurements.reduce((sum, time) => sum + time, 0) / measurements.length;
        this.averages.set(systemName, average);
    }
    
    /**
     * Wrapper pro automatické měření funkce
     * @param {string} systemName - název systému
     * @param {Function} fn - funkce k změření
     * @returns {*} výsledek funkce
     */
    measure(systemName, fn) {
        const startTime = this.startMeasurement(systemName);
        try {
            const result = fn();
            this.endMeasurement(systemName, startTime);
            return result;
        } catch (error) {
            this.endMeasurement(systemName, startTime);
            throw error;
        }
    }
    
    /**
     * Async wrapper pro automatické měření
     * @param {string} systemName - název systému
     * @param {Function} fn - async funkce k změření
     * @returns {Promise<*>} výsledek funkce
     */
    async measureAsync(systemName, fn) {
        const startTime = this.startMeasurement(systemName);
        try {
            const result = await fn();
            this.endMeasurement(systemName, startTime);
            return result;
        } catch (error) {
            this.endMeasurement(systemName, startTime);
            throw error;
        }
    }
    
    /**
     * Získat aktuální statistiky pro DebugOverlay
     * @returns {{enabled: boolean, times: Object<string,string>, total: string}}
     */
    getStats() {
        const stats = {
            enabled: this.enabled,
            times: {},
            total: '0.00'
        };
        
        if (!this.enabled) {
            return stats;
        }
        
        let totalTime = 0;
        
        this.averages.forEach((average, systemName) => {
            if (average > 0) {
                const roundedTime = average.toFixed(2);
                stats.times[systemName] = roundedTime;
                totalTime += average;
            }
        });
        
        stats.total = totalTime.toFixed(2);
        return stats;
    }
    
    /**
     * Reset všech měření
     */
    reset() {
        this.measurements.forEach(measurements => measurements.length = 0);
        this.averages.forEach((_, key) => this.averages.set(key, 0));
    }
    
    /**
     * Zapnout/vypnout profiling
     * @param {boolean} enabled
     */
    setEnabled(enabled) {
        this.enabled = enabled;
        if (enabled) {
            this.reset();
        }
        
        // Synchronizovat s localStorage
        try {
            window.localStorage.setItem('perfProfiler', enabled.toString());
        } catch (_) {}
    }
    
    /**
     * Získat detailní report pro debugging
     * @returns {Object} detailní statistiky
     */
    getDetailedReport() {
        const report = {
            enabled: this.enabled,
            sampleSize: this.sampleSize,
            systems: {}
        };
        
        this.measurements.forEach((measurements, systemName) => {
            const average = this.averages.get(systemName) || 0;
            const min = measurements.length > 0 ? Math.min(...measurements) : 0;
            const max = measurements.length > 0 ? Math.max(...measurements) : 0;
            
            report.systems[systemName] = {
                average: Number(average.toFixed(3)),
                min: Number(min.toFixed(3)),
                max: Number(max.toFixed(3)),
                samples: measurements.length,
                lastMeasurements: measurements.slice(-10) // posledních 10 měření
            };
        });
        
        return report;
    }
}