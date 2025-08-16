/**
 * SessionLogger.js - Logování do souboru pro debugging
 * Vytváří session.log který se přepíše při každé nové session
 */

export class SessionLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 1000; // Limit pro memory
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.hasAutoDownloaded = false; // Flag pro jednorázové automatické stažení
        
        this.init();
    }
    
    generateSessionId() {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const random = Math.random().toString(36).substr(2, 6);
        return `${timestamp}_${random}`;
    }
    
    init() {
        // Přepsat původní console metody
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug,
            info: console.info
        };
        
        // Wrapper pro console metody
        console.log = (...args) => {
            this.addLog('LOG', args);
            this.originalConsole.log(...args);
        };
        
        console.warn = (...args) => {
            this.addLog('WARN', args);
            this.originalConsole.warn(...args);
        };
        
        console.error = (...args) => {
            this.addLog('ERROR', args);
            this.originalConsole.error(...args);
        };
        
        console.debug = (...args) => {
            this.addLog('DEBUG', args);
            this.originalConsole.debug(...args);
        };
        
        console.info = (...args) => {
            this.addLog('INFO', args);
            this.originalConsole.info(...args);
        };
        
        // Zachytit unhandled errors
        window.addEventListener('error', (event) => {
            this.addLog('UNCAUGHT_ERROR', [
                `${event.filename}:${event.lineno}:${event.colno}`,
                event.error?.stack || event.message
            ]);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.addLog('UNHANDLED_REJECTION', [event.reason]);
        });
        
        this.addLog('SYSTEM', [`Session started: ${this.sessionId}`]);
        
        // Auto-save každých 5 sekund
        setInterval(() => {
            this.saveToFile();
        }, 5000);
        
        // Save při unload
        window.addEventListener('beforeunload', () => {
            this.saveToFile();
        });
    }
    
    addLog(level, args) {
        const timestamp = new Date().toISOString();
        const relativeTime = Date.now() - this.startTime;
        
        const logEntry = {
            timestamp,
            relativeTime,
            level,
            message: args.map(arg => {
                if (typeof arg === 'object') {
                    try {
                        return JSON.stringify(arg, null, 2);
                    } catch (e) {
                        return String(arg);
                    }
                }
                return String(arg);
            }).join(' ')
        };
        
        this.logs.push(logEntry);
        
        // Trim logs pokud je příliš mnoho
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }
    }
    
    saveToFile() {
        if (this.logs.length === 0) return;
        
        const logContent = this.logs.map(log => 
            `[${log.timestamp}] [+${log.relativeTime}ms] [${log.level}] ${log.message}`
        ).join('\n');
        
        const fullContent = `=== Game Session Log ===
Session ID: ${this.sessionId}
Started: ${new Date(this.startTime).toISOString()}
Logs Count: ${this.logs.length}

${logContent}

=== End of Log ===`;
        
        // Vytvoř blob a stáhni
        const blob = new Blob([fullContent], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        // Pokud existuje starý link, odstraň ho
        const existingLink = document.getElementById('session-log-link');
        if (existingLink) {
            existingLink.remove();
        }
        
        // Vytvořit nový link pro stažení
        const a = document.createElement('a');
        a.id = 'session-log-link';
        a.href = url;
        a.download = 'session.log';
        a.style.display = 'none';
        document.body.appendChild(a);
        
        // Pro debug - můžeme automaticky stáhnout při kritické chybě
        if (this.shouldAutoDownload()) {
            a.click();
        }
        
        // Cleanup URL po chvíli
        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 10000);
    }
    
    shouldAutoDownload() {
        // Stáhnout automaticky jen jednou při první kritické chybě
        if (this.hasAutoDownloaded) {
            return false;
        }
        
        // Auto stažení při kritických chybách
        const recentLogs = this.logs.slice(-10);
        const hasError = recentLogs.some(log => 
            log.level === 'UNCAUGHT_ERROR' || 
            log.level === 'UNHANDLED_REJECTION' ||
            log.message.includes('undefined is not an object') ||
            log.message.includes('Cannot read property') ||
            log.message.includes('TypeError')
        );
        
        if (hasError) {
            this.hasAutoDownloaded = true; // Označit, že jsme už stáhli
            console.warn('[SessionLogger] Automatické stažení logu kvůli chybě (pouze jednou)');
        }
        
        return hasError;
    }
    
    // Public API pro manuální logování
    logBossAbility(boss, ability, params) {
        this.addLog('BOSS_ABILITY', [`Boss: ${boss.id}, Ability: ${ability}`, params]);
    }
    
    logVFXCall(effectId, x, y, params) {
        this.addLog('VFX_CALL', [`Effect: ${effectId}, Position: (${x}, ${y})`, params]);
    }
    
    logSystemEvent(system, event, data) {
        this.addLog('SYSTEM_EVENT', [`${system}: ${event}`, data]);
    }
    
    // Manuální stažení logu
    downloadLog() {
        this.saveToFile();
        const link = document.getElementById('session-log-link');
        if (link) {
            link.click();
        }
    }
    
    // Vyčisti logger při restartu
    restart() {
        this.logs = [];
        this.sessionId = this.generateSessionId();
        this.startTime = Date.now();
        this.addLog('SYSTEM', [`Session restarted: ${this.sessionId}`]);
    }
    
    destroy() {
        // Restore původní console
        if (this.originalConsole) {
            console.log = this.originalConsole.log;
            console.warn = this.originalConsole.warn;
            console.error = this.originalConsole.error;
            console.debug = this.originalConsole.debug;
            console.info = this.originalConsole.info;
        }
        
        this.saveToFile();
    }
}

// Singleton instance
let sessionLogger = null;

export function initSessionLogger() {
    if (!sessionLogger) {
        sessionLogger = new SessionLogger();
        
        // Global access pro debugging
        window.__sessionLogger = sessionLogger;
        window.__downloadLog = () => sessionLogger.downloadLog();
        
        console.log('[SessionLogger] Initialized - use __downloadLog() to download session.log');
    }
    return sessionLogger;
}

export function getSessionLogger() {
    return sessionLogger;
}

export default SessionLogger;