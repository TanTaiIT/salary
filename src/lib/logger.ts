// Log dạng JSON mỗi dòng, dễ đọc bằng công cụ log của server/cloud.
const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 } as const;
export type LogLevel = keyof typeof LEVELS;
type Extra = Record<string, unknown>;

export interface Logger {
  debug(msg: string, extra?: Extra): void;
  info(msg: string, extra?: Extra): void;
  warn(msg: string, extra?: Extra): void;
  error(msg: string, extra?: Extra): void;
}

function serialize(extra: Extra | undefined): Extra | undefined {
  if (!extra) return undefined;
  const out: Extra = {};
  for (const [k, v] of Object.entries(extra)) {
    out[k] = v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v;
  }
  return out;
}

export function createLogger(level: LogLevel, write: (line: string) => void = (l) => process.stdout.write(l + '\n')): Logger {
  const min = LEVELS[level];
  const log = (lvl: LogLevel) => (msg: string, extra?: Extra) => {
    if (LEVELS[lvl] < min) return;
    write(JSON.stringify({ level: lvl, time: new Date().toISOString(), msg, ...serialize(extra) }));
  };
  return { debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}

export const silentLogger: Logger = { debug() {}, info() {}, warn() {}, error() {} };
