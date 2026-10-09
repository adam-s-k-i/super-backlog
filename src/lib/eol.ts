// src/lib/eol.ts
/** Line ending to write into an existing file: CRLF when it already contains one, else LF. */
export function detectEol(text: string): '\r\n' | '\n' {
  return text.includes('\r\n') ? '\r\n' : '\n';
}
