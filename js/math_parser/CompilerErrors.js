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

  isInLine() { return this._startLine === this._endLine; }

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

export class IndependentSourceLocation {
  constructor(location) {
    // Проверяем, что передан именно объект класса SourceLocation
    if (!(location instanceof SourceLocation)) {
      throw new TypeError("Ожидался объект класса SourceLocation");
    }

    this.start = location.start;
    this.end = location.end;
    this._startLine = location._startLine;
    this.startLineIdx = location.startLineIdx;
    this._endLine = location._endLine;
    this.endLineIdx = location.endLineIdx;
    this.column = location.column;
    this.endColumn = location.endColumn;
  }

  isInLine() { return this._startLine === this._endLine; }
}

/**
 * Класс, описывающий структуру лексической или синтаксической ошибки.
 */
export class CompilerError {
  constructor(message, location, severity = 'error') {
    this.message = message;   // Текст ошибки
    this.severity = severity; // Важность (error / warning)

    // Проверяем тип локации и инициализируемthis.location
    if (location instanceof IndependentSourceLocation) {
      this.location = location;
    } else if (location instanceof SourceLocation) {
      this.location = new IndependentSourceLocation(location);
    } else {
      throw new TypeError(
        "Параметр location должен быть экземпляром SourceLocation или IndependentSourceLocation"
      );
    }    
  }

  toString() {
    if (this.location.isInLine())
      return `[${this.severity.toUpperCase()}] ${this.message} (строка ${this.location.line}, позиция ${this.location.column}:${this.location.endColumn})`;
    else
      return `[${this.severity.toUpperCase()}] ${this.message} (строка ${this.location.line}, позиция ${this.location.column}:строка ${this.location.endLine}, позиция ${this.location.endColumn})`;
  }
}
