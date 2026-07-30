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

  // СЕРИАЛИЗАЦИЯ: Превращаем живую локацию в безопасный плоский JSON
  // Мы принудительно вычисляем колонки прямо в этот момент!
  toJSON() {
    return {
      locType: "IndependentLoc", // Метка для десериализации
      start: this.start,
      end: this.end,
      line: this.line,
      startLineIdx: this.startLineIdx,
      endLine: this.endLine,
      endLineIdx: this.endLineIdx,
      column: this.column,       // Лексер один раз считает графемы прямо перед сохранением
      endColumn: this.endColumn
    };  
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
    // Если это создание в рантайме из живой локации
    if (location instanceof SourceLocation) {
      this.start = location.start;
      this.end = location.end;
      this.line = location.line;
      this.startLineIdx = location.startLineIdx;
      this.endLine = location.endLine;
      this.endLineIdx = location.endLineIdx;
      this.column = location.column;
      this.endColumn = location.endColumn;
    } 
    // Если это восстановление из сырого JSON (конструктор для фабрики)
    else {
      this.start = location.start;
      this.end = location.end;
      this.line = location.line;
      this.startLineIdx = location.startLineIdx;
      this.endLine = location.endLine;
      this.endLineIdx = location.endLineIdx;
      this.column = location.column;
      this.endColumn = location.endColumn;
    }    
  }

  // Сериализация уже оторванной локации (если сохраняем повторно)
  toJSON() {
    return {
      locType: "IndependentLoc",
      start: this.start,
      end: this.end,
      line: this.line,
      startLineIdx: this.startLineIdx,
      endLine: this.endLine,
      endLineIdx: this.endLineIdx,
      column: this.column,
      endColumn: this.endColumn
    };
  }

  isInLine() { return this._startLine === this._endLine; }

  toString() {
    return `строка ${this.line}, позиция ${this.column}`;
  }  
}

export function restoreLocation(locData) {
  if (!locData) return null;
  
  if (locData.locType === "IndependentLoc") {
    return new IndependentSourceLocation(locData); // Передаем сырой объект в конструктор
  }
  
  return null;
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
