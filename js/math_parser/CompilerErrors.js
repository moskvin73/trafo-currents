import { MathParser } from './MathParser.js';

/**
 * Класс, описывающий структуру лексической или синтаксической ошибки.
 */
export class CompilerError {
  constructor(message, location, severity = 'error') {
    this.message = message;   // Текст ошибки
    this.location = location; // Объект SourceLocation (строка, колонка)
    this.severity = severity; // Важность (error / warning)
  }

  toString() {
    return `[${this.severity.toUpperCase()}] ${this.message} (вкладка/строка ${this.location.line}, позиция ${this.location.column})`;
  }
}

/**
 * Класс, описывающий точную координату в исходном коде.
 */
export class SourceLocation {
  constructor(lexer, start, end, startLine, startLineIdx, endLine, endLineIdx) {
    this.lexer = lexer;
    this.start = start;
    this.end = end;
    this._startLine = startLine;
    this.startLineIdx = startLineIdx;
    this._endLine = endLine;
    this.endLineIdx = endLineIdx;
  }

  // Строки отдаются мгновенно за O(1)
  get line() { return this._startLine; }
  get endLine() { return this._endLine; }

  // Расчет колонок делегируется лексеру
  get column() {
    return this.lexer.countGraphemes(this.startLineIdx, this.start);
  }

  get endColumn() {
    return this.lexer.countGraphemes(this.endLineIdx, this.end);
  }

  toString() {
    return `строка ${this.line}, позиция ${this.column}`;
  }
}