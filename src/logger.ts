type LogLevel = "INFO" | "WARN" | "ERROR";
type LogValue = string | number | boolean | null | undefined;
type LogFields = Record<string, LogValue>;

const SAFE_VALUE_PATTERN = /^[A-Za-z0-9._:/@+-]+$/;

function formatValue(value: Exclude<LogValue, undefined>): string {
  if (typeof value === "string") {
    return SAFE_VALUE_PATTERN.test(value) ? value : JSON.stringify(value);
  }

  if (value === null) {
    return "null";
  }

  return String(value);
}

export function formatLogLine(level: LogLevel, component: string, event: string, fields: LogFields = {}) {
  const parts = [level, component, event];

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      continue;
    }

    parts.push(`${key}=${formatValue(value)}`);
  }

  return parts.join(" ");
}

function writeLog(level: LogLevel, component: string, event: string, fields?: LogFields) {
  const line = formatLogLine(level, component, event, fields);

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export function logInfo(component: string, event: string, fields?: LogFields) {
  writeLog("INFO", component, event, fields);
}

export function logWarn(component: string, event: string, fields?: LogFields) {
  writeLog("WARN", component, event, fields);
}

export function logError(component: string, event: string, fields?: LogFields) {
  writeLog("ERROR", component, event, fields);
}
