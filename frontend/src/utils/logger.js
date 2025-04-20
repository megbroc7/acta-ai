/**
 * Logger utility for the Acta AI frontend application
 * Provides structured logging with different log levels
 * and sends logs to a centralized logging endpoint
 */

// Configuration for the logger
const config = {
  // Minimum log level to record (debug, info, warn, error)
  minLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  
  // Whether to output logs to console in development
  consoleOutput: process.env.NODE_ENV !== 'production',
  
  // Whether to send logs to backend logging endpoint
  remoteLogging: process.env.NODE_ENV === 'production',
  
  // Endpoint for remote logging
  loggingEndpoint: '/api/logs',
  
  // Buffer size before flushing logs to server
  bufferSize: 10,
  
  // Application name
  appName: 'acta-ai-frontend'
};

// Log levels with their priorities
const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

// Buffer to store logs before sending to server
let logBuffer = [];
let flushTimeout = null;

/**
 * Log formatter to create structured log entries
 * 
 * @param {string} level - Log level (debug, info, warn, error)
 * @param {string} message - Log message
 * @param {Object} data - Additional data to include in the log
 * @returns {Object} Structured log object
 */
const formatLog = (level, message, data = {}) => {
  // Generate a unique identifier for the log
  const logId = Math.random().toString(36).substring(2, 15);
  
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    logger: config.appName,
    // Include user info if available
    userId: localStorage.getItem('userId') || null,
    // Include session info
    sessionId: sessionStorage.getItem('sessionId') || null,
    // Include any additional data
    ...data,
    // Include browser/environment info
    environment: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      referrer: document.referrer,
      url: window.location.href,
    },
    // Add unique log identifier
    logId
  };
};

/**
 * Send logs to the backend logging endpoint
 */
const sendLogsToServer = async () => {
  if (!config.remoteLogging || logBuffer.length === 0) return;
  
  const logsToSend = [...logBuffer];
  logBuffer = [];
  
  try {
    await fetch(config.loggingEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-ID': Math.random().toString(36).substring(2, 15)
      },
      body: JSON.stringify({ logs: logsToSend }),
    });
  } catch (error) {
    // Avoid infinite loop by not logging this error
    if (config.consoleOutput) {
      console.error('Failed to send logs to server:', error);
    }
  }
};

/**
 * Schedule log buffer flush to server
 */
const scheduleFlush = () => {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }
  
  flushTimeout = setTimeout(() => {
    sendLogsToServer();
    flushTimeout = null;
  }, 5000); // Flush after 5 seconds of inactivity
};

/**
 * Log entry point for different log levels
 * 
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} data - Additional data
 */
const log = (level, message, data = {}) => {
  // Check if this log level should be recorded
  if (LOG_LEVELS[level] < LOG_LEVELS[config.minLevel]) {
    return;
  }
  
  const logEntry = formatLog(level, message, data);
  
  // Output to console in development
  if (config.consoleOutput) {
    switch (level) {
      case 'debug':
        console.debug(message, logEntry);
        break;
      case 'info':
        console.info(message, logEntry);
        break;
      case 'warn':
        console.warn(message, logEntry);
        break;
      case 'error':
        console.error(message, logEntry);
        break;
      default:
        console.log(message, logEntry);
    }
  }
  
  // Add to buffer for server sending
  if (config.remoteLogging) {
    logBuffer.push(logEntry);
    
    // If buffer is full, send immediately
    if (logBuffer.length >= config.bufferSize) {
      sendLogsToServer();
    } else {
      scheduleFlush();
    }
  }
  
  return logEntry;
};

/**
 * Set up global error handlers to capture unhandled errors
 */
const setupErrorHandlers = () => {
  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled Promise Rejection', {
      error: event.reason ? event.reason.toString() : 'Unknown error',
      stack: event.reason && event.reason.stack
    });
  });
  
  // Capture uncaught exceptions
  window.addEventListener('error', (event) => {
    logger.error('Uncaught Exception', {
      error: event.message,
      source: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      stack: event.error && event.error.stack
    });
    
    // Force immediate flush of logs for critical errors
    sendLogsToServer();
    
    return false; // Let the error propagate after logging
  });
};

// Public API
const logger = {
  debug: (message, data) => log('debug', message, data),
  info: (message, data) => log('info', message, data),
  warn: (message, data) => log('warn', message, data),
  error: (message, data) => log('error', message, data),
  
  // Configure the logger
  configure: (userConfig) => {
    Object.assign(config, userConfig);
  },
  
  // Force flush logs to server
  flush: () => sendLogsToServer(),
  
  // Initialize logger with global error handlers
  init: () => {
    setupErrorHandlers();
    
    // Generate a session ID if not already present
    if (!sessionStorage.getItem('sessionId')) {
      sessionStorage.setItem('sessionId', Math.random().toString(36).substring(2, 15));
    }
    
    logger.info('Logger initialized', { config });
  }
};

export default logger; 