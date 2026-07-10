import { TokenType } from './TokenTypes.js';
import { SourceLocation, CompilerError } from './CompilerErrors.js'; // перенесем типы ошибок в один служебный файл

export class Token {
  constructor(type, value, loc) {
    this.type = type;   // Числовой код из TokenType
    this.value = value; // Значение (число или строка)
    this.loc = loc;     // Объект SourceLocation
  }
}

export class MathLexer {
  constructor(input, baseLine = 1, baseColumn = 1) {
    this.chars = Array.from(input);
    this.errors = [];
    this.i = 0;
    this.currentLine = baseLine;
    this.currentColumn = baseColumn;
  }

  #advanceChar() {
    if (this.i >= this.chars.length) return null;
    const char = this.chars[this.i];
    if (char === '\n' || char === '\r' || char === '\u2028' || char === '\u2029') {
      this.currentLine++;
      this.currentColumn = 1;
    } else {
      this.currentColumn++;
    }
    this.i++;
    return char;
  }

  #peekChar() {
    return this.i < this.chars.length ? this.chars[this.i] : null;
  }

  #peekNextChar() {
    return this.i + 1 < this.chars.length ? this.chars[this.i + 1] : null;
  }

  /**
   * Считывает и возвращает СЛЕДУЮЩИЙ единственный токен из потока (LL(1))
   */
  next() {
    while (this.i < this.chars.length) {
      let char = this.chars[this.i];
      let startLoc = new SourceLocation(this.currentLine, this.currentColumn, this.i);

      // 1. Пропускаем пробелы Юникода
      if (/\p{White_Space}/u.test(char)) {
        this.#advanceChar();
        continue;
      }

      // 2. Однострочные комментарии
      if (char === '/' && this.#peekNextChar() === '/') {
        this.#advanceChar(); this.#advanceChar(); // сожрали //
        let commentValue = '';
        while (this.i < this.chars.length && !/[\n\r\u2028\u2029]/.test(this.chars[this.i])) {
          commentValue += this.#advanceChar();
        }
        // В LL(1) парсере мы можем просто пропустить комментарий, 
        // сразу перейдя к поиску следующего полезного токена!
        continue;
      }

      // 3. Текстовые блоки "строка"
      if (char === '"' || char === "'") {
        const quote = this.#advanceChar();
        let textValue = '';
        while (this.i < this.chars.length && this.chars[this.i] !== quote) {
          textValue += this.#advanceChar();
        }
        if (this.i >= this.chars.length) {
          this.errors.push(new CompilerError(`Незакрытая текстовая строка`, startLoc));
          return new Token(TokenType.TEXT_BLOCK, textValue, startLoc);
        }
        this.#advanceChar(); // закрывающая кавычка
        return new Token(TokenType.TEXT_BLOCK, textValue, startLoc);
      }

      // 4. Математические операторы фиксированной длины
      if (char === '+') { this.#advanceChar(); return new Token(TokenType.PLUS, '+', startLoc); }
      if (char === '-') { this.#advanceChar(); return new Token(TokenType.MINUS, '-', startLoc); }
      if (char === '/') { this.#advanceChar(); return new Token(TokenType.DIV, '/', startLoc); }
      if (char === '=') { this.#advanceChar(); return new Token(TokenType.ASSIGN, '=', startLoc); }
      if (char === '(') { this.#advanceChar(); return new Token(TokenType.LPAREN, '(', startLoc); }
      if (char === ')') { this.#advanceChar(); return new Token(TokenType.RPAREN, ')', startLoc); }
      if (char === ';') { this.#advanceChar(); return new Token(TokenType.SEMICOLON, ';', startLoc); }
      if (char === '$') { this.#advanceChar(); return new Token(TokenType.SILENT, '$', startLoc); }

      // Степень (поддержка ^ и **)
      if (char === '^') { this.#advanceChar(); return new Token(TokenType.POW, '^', startLoc); }
      if (char === '*' && this.#peekNextChar() === '*') {
        this.#advanceChar(); this.#advanceChar();
        return new Token(TokenType.POW, '^', startLoc);
      }
      if (char === '*') { this.#advanceChar(); return new Token(TokenType.MUL, '*', startLoc); }

      // 5. Числа (Вещественные и Комплексные)
      if (/[0-9]/.test(char) || (char === '.' && /[0-9]/.test(this.#peekNextChar()))) {
        let numStr = '';
        while (this.i < this.chars.length && /[0-9.]/.test(this.chars[this.i])) {
          numStr += this.#advanceChar();
        }
        if ((numStr.match(/\./g) || []).length > 1) {
          this.errors.push(new CompilerError(`Неверный формат числа "${numStr}"`, startLoc));
        }
        const parsedVal = parseFloat(numStr) || 0;

        // Если за числом строго идет 'i' — склеиваем в COMPLEX_NUMBER прямо на уровне лексем!
        if (this.i < this.chars.length && this.chars[this.i] === 'i') {
          this.#advanceChar(); // поглотили 'i'
          return new Token(TokenType.COMPLEX_NUMBER, parsedVal, startLoc);
        }
        return new Token(TokenType.NUMBER, parsedVal, startLoc);
      }

      // 6. Идентификаторы (Функции и переменные)
      if (/[\p{L}_]/u.test(char)) {
        let idStr = '';
        while (this.i < this.chars.length && /[\p{L}\p{N}_]/u.test(this.chars[this.i])) {
          idStr += this.#advanceChar();
        }
        return new Token(TokenType.VARIABLE, idStr, startLoc);
      }

      // Мягкий отлов неизвестных символов
      this.errors.push(new CompilerError(`Неизвестный символ "${char}"`, startLoc));
      this.#advanceChar();
    }

    return new Token(TokenType.EOF, 'EOF', new SourceLocation(this.currentLine, this.currentColumn, this.i));
  }
}