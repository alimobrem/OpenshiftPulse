/**
 * LogParser - Auto-detecting log line parser
 * Supports JSON, logfmt, and plain text formats
 */

export interface ParsedLogLine {
  raw: string;
  timestamp?: Date;
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'unknown';
  message: string;
  fields?: Record<string, string>;
  format: 'json' | 'logfmt' | 'plain';
}

export type LogFormat = 'json' | 'logfmt' | 'plain';

/**
 * Detect the predominant log format from a sample of lines
 */
export function detectLogFormat(lines: string[]): LogFormat {
  if (lines.length === 0) return 'plain';

  let jsonCount = 0;
  let logfmtCount = 0;

  // Sample up to first 100 lines
  const sample = lines.slice(0, Math.min(100, lines.length));

  for (const line of sample) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Check for JSON (starts with { and valid JSON)
    if (trimmed.startsWith('{')) {
      try {
        JSON.parse(trimmed);
        jsonCount++;
        continue;
      } catch {
        // Not JSON
      }
    }

    // Check for logfmt (contains key=value patterns)
    if (/\w+=[^\s]+/.test(trimmed)) {
      logfmtCount++;
    }
  }

  // If >50% are JSON, it's JSON format
  if (jsonCount > sample.length * 0.5) return 'json';

  // If >30% are logfmt, it's logfmt format
  if (logfmtCount > sample.length * 0.3) return 'logfmt';

  return 'plain';
}

/**
 * Parse a single log line, auto-detecting format
 */
export function parseLogLine(line: string, detectedFormat?: LogFormat): ParsedLogLine {
  const raw = line;
  let stripped = line;

  // K8s API adds RFC3339Nano timestamp prefix when timestamps=true
  // Format: 2024-01-15T10:04:23.441234567Z <actual log message>
  const k8sTimestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+Z)\s+(.*)/);
  let k8sTimestamp: Date | undefined;

  if (k8sTimestampMatch) {
    k8sTimestamp = new Date(k8sTimestampMatch[1]);
    stripped = k8sTimestampMatch[2];
  }

  const format = detectedFormat || detectLogFormat([stripped]);

  // Try JSON parsing
  if (format === 'json' || stripped.trim().startsWith('{')) {
    try {
      const parsed = parseJSONLine(stripped);
      if (parsed) {
        return {
          ...parsed,
          raw,
          timestamp: parsed.timestamp || k8sTimestamp,
        };
      }
    } catch {
      // Fall through to plain
    }
  }

  // Try logfmt parsing
  if (format === 'logfmt' && /\w+=[^\s]+/.test(stripped)) {
    const parsed = parseLogfmtLine(stripped);
    return {
      ...parsed,
      raw,
      timestamp: parsed.timestamp || k8sTimestamp,
    };
  }

  // Plain text parsing
  const parsed = parsePlainLine(stripped);
  return {
    ...parsed,
    raw,
    timestamp: parsed.timestamp || k8sTimestamp,
  };
}

/**
 * Parse JSON log line
 */
function parseJSONLine(line: string): ParsedLogLine | null {
  try {
    const obj = JSON.parse(line);

    // Extract timestamp from common fields
    const timestampValue = obj.ts || obj.time || obj.timestamp || obj['@timestamp'];
    let timestamp: Date | undefined;
    if (timestampValue) {
      timestamp = new Date(timestampValue);
    }

    // Extract level from common fields
    const levelValue = (obj.level || obj.severity || obj.lvl || '').toString().toLowerCase();
    const level = normalizeLevel(levelValue);

    // Extract message from common fields
    const message = obj.msg || obj.message || obj.log || line;

    // Extract all other fields
    const fields: Record<string, string> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (!['ts', 'time', 'timestamp', '@timestamp', 'level', 'severity', 'lvl', 'msg', 'message', 'log'].includes(key)) {
        fields[key] = typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    }

    return {
      raw: line,
      timestamp,
      level,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      fields: Object.keys(fields).length > 0 ? fields : undefined,
      format: 'json',
    };
  } catch {
    return null;
  }
}

/**
 * Parse logfmt line (key=value pairs)
 */
function parseLogfmtLine(line: string): ParsedLogLine {
  const fields: Record<string, string> = {};

  // Simple logfmt parser: split by whitespace, extract key=value
  const pairs = line.match(/(\w+)=("[^"]*"|[^\s]+)/g) || [];

  for (const pair of pairs) {
    const [key, ...valueParts] = pair.split('=');
    let value = valueParts.join('=');
    // Remove quotes
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }
    fields[key] = value;
  }

  // Extract timestamp
  const timestampValue = fields.ts || fields.time || fields.timestamp;
  let timestamp: Date | undefined;
  if (timestampValue) {
    timestamp = new Date(timestampValue);
  }

  // Extract level
  const levelValue = (fields.level || fields.lvl || '').toLowerCase();
  const level = normalizeLevel(levelValue);

  // Extract message
  const message = fields.msg || fields.message || line;

  return {
    raw: line,
    timestamp,
    level,
    message,
    fields: Object.keys(fields).length > 0 ? fields : undefined,
    format: 'logfmt',
  };
}

/**
 * Parse plain text line with simple heuristics
 */
function parsePlainLine(line: string): ParsedLogLine {
  let level: ParsedLogLine['level'] = 'unknown';

  // Try to detect level from common prefixes
  const levelPatterns = [
    { regex: /\b(FATAL|CRIT|CRITICAL)\b/i, level: 'fatal' as const },
    { regex: /\b(ERROR|ERR|ERRO|FAILURE|FAILED)\b/i, level: 'error' as const },
    { regex: /\b(WARN|WARNING)\b/i, level: 'warn' as const },
    { regex: /\b(DEBUG|TRACE|DBG)\b/i, level: 'debug' as const },
    { regex: /\b(INFO|INF)\b/i, level: 'info' as const },
    // K8s single-char level indicators: I0315, E0315, W0315
    { regex: /^[IWEF]\d{4}\s/, level: 'info' as const },
  ];

  for (const { regex, level: detectedLevel } of levelPatterns) {
    if (regex.test(line)) {
      level = detectedLevel;
      // Special handling for K8s single-char indicators
      if (/^I\d{4}/.test(line)) level = 'info';
      else if (/^W\d{4}/.test(line)) level = 'warn';
      else if (/^E\d{4}/.test(line)) level = 'error';
      else if (/^F\d{4}/.test(line)) level = 'fatal';
      break;
    }
  }

  return {
    raw: line,
    level,
    message: line,
    format: 'plain',
  };
}

/**
 * Normalize level string to standard values
 */
function normalizeLevel(levelStr: string): ParsedLogLine['level'] {
  const lower = levelStr.toLowerCase();

  if (['fatal', 'crit', 'critical', 'panic'].includes(lower)) return 'fatal';
  if (['error', 'err', 'erro', 'failure', 'failed'].includes(lower)) return 'error';
  if (['warn', 'warning'].includes(lower)) return 'warn';
  if (['debug', 'trace', 'dbg'].includes(lower)) return 'debug';
  if (['info', 'information', 'inf'].includes(lower)) return 'info';

  return 'unknown';
}
