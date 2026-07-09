
/**
 * Класс, описывающий структуру лексической или синтаксической ошибки.
 */
class CompilerError {
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
class SourceLocation {
  constructor(line, column, index) {
    this.line = line;
    this.column = column;
    this.index = index;
  }

  toString() {
    return `строка ${this.line}, позиция ${this.column}`;
  }
}

/**
 * Отзоустойчивый Лексер. Собирает ошибки в массив и продолжает работу.
 */
class MathLexer {
  /**
   * Разбирает текст на токены и возвращает объект с результатом и списком ошибок.
   * @param {string} input - Входной текст
   * @param {number} baseLine - Стартовый номер строки
   * @param {number} baseColumn - Стартовый номер колонки
   * @returns {{ tokens: Array, errors: CompilerError[] }}
   */
  static tokenize(input, baseLine = 1, baseColumn = 1) {
    const chars = Array.from(input);
    const tokens = [];
    const errors = []; // Сюда собираются все ошибки лексического анализа
    
    let i = 0;
    let currentLine = baseLine;
    let currentColumn = baseColumn;

    while (i < chars.length) {
      let char = chars[i];
      let startLocation = new SourceLocation(currentLine, currentColumn, i);

      const advance = (count = 1) => {
        for (let k = 0; k < count; k++) {
          if (i >= chars.length) break;
          if (chars[i] === '\n' || chars[i] === '\r' || chars[i] === '\u2028' || chars[i] === '\u2029') {
            currentLine++;
            currentColumn = 1;
          } else {
            currentColumn++;
          }
          i++;
        }
      };

      // 1. Пропускаем все виды Юникод-пробелов
      if (/\p{White_Space}/u.test(char)) {
        advance();
        continue;
      }

      // 2. Обработка комментариев (//)
      if (char === '/' && chars[i + 1] === '/') {
        let commentValue = '';
        advance(2);
        while (i < chars.length && !/[\n\r\u2028\u2029]/.test(chars[i])) {
          commentValue += chars[i];
          advance();
        }
        tokens.push({ type: 'COMMENT', value: commentValue.trim(), loc: startLocation });
        continue;
      }

      // 3. Обработка строк
      if (char === '"' || char === "'") {
        const quote = char;
        let textValue = '';
        advance();
        
        while (i < chars.length && chars[i] !== quote) {
          textValue += chars[i];
          advance();
        }
        
        if (i >= chars.length) {
          // Вместо throw фиксируем ошибку, но строку закрываем виртуально
          errors.push(new CompilerError(`Незакрытая текстовая строка`, startLocation));
          continue;
        }
        advance();
        tokens.push({ type: 'TEXT_BLOCK', value: textValue, loc: startLocation });
        continue;
      }

      // 4. Числа
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(chars[i + 1]))) {
        let numStr = '';
        while (i < chars.length && /[0-9.]/.test(chars[i])) {
          numStr += chars[i];
          advance();
        }
        
        if ((numStr.match(/\./g) || []).length > 1) {
          errors.push(new CompilerError(`Неверный формат числа "${numStr}" (слишком много точек)`, startLocation));
          // Записываем «битый» токен, чтобы парсер мог попытаться обработать его как число 0
          tokens.push({ type: 'NUMBER', value: parseFloat(numStr) || 0, loc: startLocation });
          continue;
        }
        tokens.push({ type: 'NUMBER', value: parseFloat(numStr), loc: startLocation });
        continue;
      }

      // 5. Идентификаторы (Буквы, функции, переменные)
      if (/[\p{L}_]/u.test(char)) {
        let idStr = '';
        while (i < chars.length && /[\p{L}\p{N}_]/u.test(chars[i])) {
          idStr += chars[i];
          advance();
        }

        if (idStr === 'i') {
          tokens.push({ type: 'IMAGINARY', value: 'i', loc: startLocation });
        } else if (['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'exp', 'log', 'sqrt', 'pow'].includes(idStr)) {
          tokens.push({ type: 'FUNCTION', value: idStr, loc: startLocation });
        } else {
          tokens.push({ type: 'VARIABLE', value: idStr, loc: startLocation });
        }
        continue;
      }

      if (char === '*' && chars[i + 1] === '*') {
        tokens.push({ type: 'OPERATOR', value: '^', loc: startLocation }); // превращаем ** в ^ для парсера
        advance(2);
        continue;
      }
      
      // 6. Математические операторы
      if (['+', '-', '*', '/', '^', '='].includes(char)) {
        tokens.push({ type: 'OPERATOR', value: char, loc: startLocation });
        advance();
        continue;
      }
      

      if (char === '(') {
        tokens.push({ type: 'LPAREN', value: '(', loc: startLocation });
        advance();
        continue;
      }

      if (char === ')') {
        tokens.push({ type: 'RPAREN', value: ')', loc: startLocation });
        advance();
        continue;
      }

      // КРИТИЧЕСКИЙ МОМЕНТ: Ловим неизвестный символ (например, смайлик ❌ или знак $)
      errors.push(new CompilerError(`Неизвестный символ или эмодзи "${char}" в коде`, startLocation));
      advance(); // Мягко шагаем дальше, не ломая цикл!
    }

    return { tokens, errors };
  }
}

export { MathLexer, SourceLocation, CompilerError };