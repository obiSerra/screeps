/**
 * Error Tracking Module
 * Centralized error logging with rate limiting, Memory persistence, and statistics.
 * Prevents console spam while maintaining debugging visibility.
 */

const CONFIG = require("./config");

const errorTracker = {
    /**
     * Configuration for error tracking
     */
    config: {
        maxErrorsPerType: 5,           // Max errors logged per type per window
        rateLimitWindow: 50,           // Ticks in rate limiting window
        maxStoredErrors: 10,           // Max errors kept in Memory
        enableConsoleLogging: true,    // Toggle console output
        criticalThreshold: 10,         // Errors per 100 ticks to consider critical
    },

    /**
     * Initialize error tracking in Memory
     */
    init: function() {
        if (!Memory.errors) {
            Memory.errors = {
                recentErrors: [],
                statistics: {},
                lastCleanup: Game.time
            };
        }
        
        // Clean up old rate limit data periodically (every 100 ticks)
        if (Game.time - Memory.errors.lastCleanup > 100) {
            this.cleanupRateLimitData();
            Memory.errors.lastCleanup = Game.time;
        }
    },

    /**
     * Log an error with context and severity
     * @param {Error|string} error - The error object or message
     * @param {Object} context - Additional context (module, function, room, creep, etc.)
     * @param {string} severity - 'CRITICAL', 'ERROR', 'WARNING', or 'INFO'
     */
    logError: function(error, context = {}, severity = 'ERROR') {
        this.init();

        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorStack = error instanceof Error ? error.stack : null;
        const errorType = this.getErrorType(context);
        
        // Check rate limiting
        if (!this.shouldLogError(errorType)) {
            return; // Skip logging due to rate limit
        }

        // Create error record
        const errorRecord = {
            tick: Game.time,
            severity: severity,
            message: errorMessage,
            stack: errorStack,
            context: context,
            type: errorType
        };

        // Store in Memory (keep only most recent errors)
        Memory.errors.recentErrors.unshift(errorRecord);
        if (Memory.errors.recentErrors.length > this.config.maxStoredErrors) {
            Memory.errors.recentErrors = Memory.errors.recentErrors.slice(0, this.config.maxStoredErrors);
        }

        // Update statistics
        this.updateStatistics(errorType, severity);

        // Console logging (if enabled)
        if (this.config.enableConsoleLogging) {
            this.logToConsole(errorRecord);
        }

        // Check for critical error rates
        this.checkCriticalThreshold();
    },

    /**
     * Generate error type identifier for rate limiting
     */
    getErrorType: function(context) {
        const parts = [];
        if (context.module) parts.push(context.module);
        if (context.function) parts.push(context.function);
        if (context.room) parts.push(context.room);
        return parts.join(':') || 'unknown';
    },

    /**
     * Check if error should be logged based on rate limiting
     */
    shouldLogError: function(errorType) {
        if (!Memory.errors.rateLimits) {
            Memory.errors.rateLimits = {};
        }

        const currentWindow = Math.floor(Game.time / this.config.rateLimitWindow);
        
        if (!Memory.errors.rateLimits[errorType]) {
            Memory.errors.rateLimits[errorType] = {
                window: currentWindow,
                count: 0
            };
        }

        const rateLimit = Memory.errors.rateLimits[errorType];

        // Reset counter if we're in a new window
        if (rateLimit.window !== currentWindow) {
            rateLimit.window = currentWindow;
            rateLimit.count = 0;
        }

        // Check if we're under the limit
        if (rateLimit.count < this.config.maxErrorsPerType) {
            rateLimit.count++;
            return true;
        }

        // Rate limited - only log a single "suppressed" message at the limit
        if (rateLimit.count === this.config.maxErrorsPerType) {
            rateLimit.count++;
            if (this.config.enableConsoleLogging) {
                console.log(`⚠️ [ErrorTracker] Rate limit reached for ${errorType} - suppressing further errors this window`);
            }
        }

        return false;
    },

    /**
     * Update error statistics
     */
    updateStatistics: function(errorType, severity) {
        if (!Memory.errors.statistics[errorType]) {
            Memory.errors.statistics[errorType] = {
                total: 0,
                bySeverity: {},
                firstSeen: Game.time,
                lastSeen: Game.time
            };
        }

        const stats = Memory.errors.statistics[errorType];
        stats.total++;
        stats.lastSeen = Game.time;
        stats.bySeverity[severity] = (stats.bySeverity[severity] || 0) + 1;
    },

    /**
     * Log error to console with formatting
     */
    logToConsole: function(errorRecord) {
        const icon = this.getSeverityIcon(errorRecord.severity);
        const contextStr = this.formatContext(errorRecord.context);
        
        console.log(`${icon} [${errorRecord.severity}] ${errorRecord.message}${contextStr}`);
        
        // Log stack trace for CRITICAL and ERROR severities
        if (errorRecord.stack && (errorRecord.severity === 'CRITICAL' || errorRecord.severity === 'ERROR')) {
            console.log(errorRecord.stack);
        }
    },

    /**
     * Get icon for severity level
     */
    getSeverityIcon: function(severity) {
        const icons = {
            'CRITICAL': '🔴',
            'ERROR': '❌',
            'WARNING': '⚠️',
            'INFO': 'ℹ️'
        };
        return icons[severity] || '❓';
    },

    /**
     * Format context object for display
     */
    formatContext: function(context) {
        if (!context || Object.keys(context).length === 0) {
            return '';
        }
        
        const parts = [];
        if (context.module) parts.push(`module=${context.module}`);
        if (context.function) parts.push(`fn=${context.function}`);
        if (context.room) parts.push(`room=${context.room}`);
        if (context.creep) parts.push(`creep=${context.creep}`);
        if (context.role) parts.push(`role=${context.role}`);
        
        return parts.length > 0 ? ` [${parts.join(', ')}]` : '';
    },

    /**
     * Check if error rate has crossed critical threshold
     */
    checkCriticalThreshold: function() {
        const recentErrors = Memory.errors.recentErrors || [];
        const last100Ticks = recentErrors.filter(e => Game.time - e.tick <= 100);
        
        if (last100Ticks.length >= this.config.criticalThreshold) {
            // Send critical alert (using Game.notify in production)
            if (this.config.enableConsoleLogging) {
                console.log(`🚨 [ErrorTracker] CRITICAL: ${last100Ticks.length} errors in last 100 ticks`);
            }
            // Note: Uncomment for production use
            // Game.notify(`Critical error rate: ${last100Ticks.length} errors in last 100 ticks`, 60);
        }
    },

    /**
     * Clean up old rate limit data
     */
    cleanupRateLimitData: function() {
        if (!Memory.errors.rateLimits) return;
        
        const currentWindow = Math.floor(Game.time / this.config.rateLimitWindow);
        
        // Remove rate limits from windows that are more than 10 windows old
        for (const errorType in Memory.errors.rateLimits) {
            const rateLimit = Memory.errors.rateLimits[errorType];
            if (currentWindow - rateLimit.window > 10) {
                delete Memory.errors.rateLimits[errorType];
            }
        }
    },

    /**
     * Get error statistics for all error types
     */
    getStatistics: function() {
        this.init();
        return Memory.errors.statistics || {};
    },

    /**
     * Get recent errors (last N errors)
     */
    getRecentErrors: function(count = 10) {
        this.init();
        return (Memory.errors.recentErrors || []).slice(0, count);
    },

    /**
     * Clear all error data (use for testing or manual cleanup)
     */
    clear: function() {
        Memory.errors = {
            recentErrors: [],
            statistics: {},
            lastCleanup: Game.time
        };
        console.log('✅ [ErrorTracker] Error data cleared');
    },

    /**
     * Get summary report of current error state
     */
    getSummary: function() {
        this.init();
        
        const stats = Memory.errors.statistics || {};
        const recentErrors = Memory.errors.recentErrors || [];
        const last100Ticks = recentErrors.filter(e => Game.time - e.tick <= 100);
        
        return {
            totalErrorTypes: Object.keys(stats).length,
            totalErrorsAllTime: Object.values(stats).reduce((sum, s) => sum + s.total, 0),
            errorsLast100Ticks: last100Ticks.length,
            mostRecentError: recentErrors[0] || null,
            topErrorTypes: Object.entries(stats)
                .sort((a, b) => b[1].total - a[1].total)
                .slice(0, 5)
                .map(([type, stat]) => ({type, count: stat.total}))
        };
    }
};

module.exports = errorTracker;
