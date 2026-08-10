/**
 * Result is the IPC boundary contract because renderer code must never depend on
 * Electron exception semantics. If thrown errors crossed this boundary directly,
 * later sensitive handlers could crash a workflow before writing the audit row
 * that explains what happened.
 */
export type Result<T> = OkResult<T> | ErrorResult;

export interface OkResult<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ErrorResult {
  readonly ok: false;
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
}

export function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

export function err(code: string, message: string): ErrorResult {
  return { ok: false, error: { code, message } };
}
