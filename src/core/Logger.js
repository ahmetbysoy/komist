/**
 * Logger — Konsol + opsiyonel journal (ritüel geçmişi)
 * Seviyeler: debug, info, warn, error. `LEVEL` ile filtrelenir.
 */
export const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

let LEVEL = LOG_LEVELS.info;
let journal = [];       // son 100 kayıt
let onLog = null;       // UI aboneliği için

export function setLevel(level) { LEVEL = level; }

export function setOnLog(fn) { onLog = fn; }

function _log(level, tag, args) {
  if (level < LEVEL) return;
  const line = { level, tag, msg: args.map(String).join(' '), ts: Date.now() };
  journal.push(line);
  if (journal.length > 100) journal.shift();
  if (onLog) { try { onLog(line); } catch (_) {} }

  const prefix = `[${tag}]`;
  if (level === LOG_LEVELS.debug) console.debug(prefix, ...args);
  else if (level === LOG_LEVELS.warn) console.warn(prefix, ...args);
  else if (level === LOG_LEVELS.error) console.error(prefix, ...args);
  else console.log(prefix, ...args);
}

export const Logger = {
  debug: (tag, ...a) => _log(LOG_LEVELS.debug, tag, a),
  info: (tag, ...a) => _log(LOG_LEVELS.info, tag, a),
  warn: (tag, ...a) => _log(LOG_LEVELS.warn, tag, a),
  error: (tag, ...a) => _log(LOG_LEVELS.error, tag, a),
  getJournal: () => [...journal]
};

export default Logger;
