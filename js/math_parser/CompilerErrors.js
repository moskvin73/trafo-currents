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
  constructor(line, column, index) {
    this.line = line;
    this.column = column;
    this.index = index;
  }

  toString() {
    return `строка ${this.line}, позиция ${this.column}`;
  }
}
