import { TokenType } from './TokenTypes.js';
import { SourceLocation, CompilerError } from './CompilerErrors.js'; // перенесем типы ошибок в один служебный файл

export class Token {
  constructor(type, value, loc) {
    this.type = type;   // Числовой код из TokenType
    this.value = value; // Значение (число или строка)
    this.loc = loc;     // Объект SourceLocation
  }
}

// Карта быстрого сопоставления с типами токенов
const constantMap = {
  '%pi':   TokenType.MATH_PI,
  '%e':    TokenType.MATH_E,
  '%phi':  TokenType.MATH_PHI,
  '%inf':  TokenType.MATH_INF,
  '%nan':  TokenType.MATH_NAN
};

// ============================================================================
// 1. КОНСТАНТЫ И КЛАССЫ СИМВОЛОВ (Инициализируются 1 раз при старте приложения)
// ============================================================================
const C_UNKNOWN  = 0;
const C_SPACE    = 1; 
const C_DIGIT    = 2; 
const C_ALPHA    = 3; 
const C_OPERATOR = 4; 
const C_QUOTE    = 5; 
const C_PERCENT  = 6; 

const asciiMap = new Uint8Array(128);

// Заполняем пробелы ASCII (табуляция 9, перевод строки 10, в.таб 11, ф.фид 12, возврат каретки 13, пробел 32)
for (let c of ['\t', '\n', '\v', '\f', '\r', ' ']) {
  asciiMap[c] = C_SPACE;
}

// Заполняем цифры (0-9)
for (let c = 48; c <= 57; c++) {
  asciiMap[c] = C_DIGIT;
}

// Заполняем буквы ASCII (A-Z) и (a-z)
for (let c = 65; c <= 90; c++) asciiMap[c] = C_ALPHA;
for (let c = 97; c <= 122; c++) asciiMap[c] = C_ALPHA;
asciiMap[95] = C_ALPHA; // Подчёркивание '_'

// Заполняем спец-символы
asciiMap[34] = C_QUOTE;   // Кавычка "
asciiMap[39] = C_QUOTE;   // Кавычка '
asciiMap[37] = C_PERCENT; // Процент %

// Операторы фиксированной длины (+, -, *, /, =, (, ), ;, $, , , ^)
for (let c of ['+', '-', '*', '/', '=', '(', ')', ';', '$', ',' , '^']) {
  asciiMap[c] = C_OPERATOR;
}

// Полный список пробельных кодовых точек Юникода (категория \p{Zs} + C# NEL + BOM)
const UNICODE_SPACES = new Int32Array([
  0x0009, 0x000A, 0x000B, 0x000C, 0x000D,
  0x0020, 0x0085, 0x00A0, 0x1680, 
  0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 
  0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF
]);

// Интервалы букв Юникода (\p{L})
const UNICODE_LETTERS = new Int32Array([
  0x00C0, 0x00D6, 0x00D8, 0x00F6, 0x00F8, 0x02AF,
  0x0370, 0x037D, 0x037F, 0x03FF,
  0x0400, 0x04FF, 0x0500, 0x052F,
  0x0531, 0x0556, 0x0561, 0x0588,
  0x05D0, 0x05EA,
  0x0620, 0x064A,
  0x4E00, 0x9FFF,
  0xAC00, 0xD7A3
]);

// Вспомогательные функции бинарного поиска
function isUnicodeSpace(code) {
  let low = 0, high = UNICODE_SPACES.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const val = UNICODE_SPACES[mid];
    if (val === code) return true;
    if (val < code) low = mid + 1;
    else high = mid - 1;
  }
  return false;
}

function isUnicodeLetter(code) {
  let low = 0, high = (UNICODE_LETTERS.length >> 1) - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const i = mid << 1;
    if (code >= UNICODE_LETTERS[i] && code <= UNICODE_LETTERS[i + 1]) return true;
    if (code < UNICODE_LETTERS[i]) high = mid - 1;
    else low = mid + 1;
  }
  return false;
}

const UNICODE_NUMBERS = new Int32Array([
  0x00B2, 0x00B3, 0x00B9, 0x00B9, // ² , ³ , ¹
  0x0660, 0x0669,                 // Арабские цифры (٠-٩)
  0x06F0, 0x06F9,                 // Персидские цифры
  0x2150, 0x2189,                 // Дроби и старые римские числа (¼, ½, Ⅰ, Ⅱ...)
  0x2460, 0x249F,                 // Цифры в кружочках (①, ②...)
  0x3007, 0x3007,                 // Иероглифический ноль (〇)
  0xFF10, 0xFF19                  // Полноширинные цифры (０-９)
]);

function isUnicodeNumber(code) {
  let low = 0, high = (UNICODE_NUMBERS.length >> 1) - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const i = mid << 1;
    if (code >= UNICODE_NUMBERS[i] && code <= UNICODE_NUMBERS[i + 1]) return true;
    if (code < UNICODE_NUMBERS[i]) high = mid - 1;
    else low = mid + 1;
  }
  return false;
}

export class MathLexer { 
  constructor(input, errors, baseLine = 1, baseColumn = 1) {
    this.chars = Array.from(input);
    this.errors = errors;
    this.i = 0;
    this.currentLine = baseLine;
    this.currentColumn = baseColumn;
  }

  /*constructor(input, errors, baseLine = 1, baseColumn = 1) {
    this.source = input; // Работаем с нативной строкой! Никаких Array.from
    this.errors = errors;
    this.i = 0;
    this.currentLine = baseLine;
    this.currentColumn = baseColumn;
  }*/

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

  #readCodePointAndAdvance() {
    if (this.i >= this.source.length) return null;

    const cp = this.source.codePointAt(this.i);
    const code = this.source.charCodeAt(this.i);

    // Обработка переводов строк (счетчик строк)
    if (code === 10 || code === 8232 || code === 8233 || code === 133 || code === 12) { // \n, \u2028, \u2029, NEL, FF
      this.currentLine++;
      this.currentColumn = 1;
      this.i++;
      return code;
    }
    if (code === 13) { // \r
      this.currentLine++;
      this.currentColumn = 1;
      this.i++;
      if (this.i < this.source.length && this.source.charCodeAt(this.i) === 10) { // \r\n
        this.i++;
      }
      return code;
    }

    // Проверяем, является ли символ валидной суррогатной парой (занимает 2 индекса)
    // High surrogate: 0xD800 - 0xDBFF. Low surrogate: 0xDC00 - 0xDFFF
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (this.i + 1 < this.source.length) {
        const nextCode = this.source.charCodeAt(this.i + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          // Пара валидна!
          this.currentColumn++; // Визуально символ один
          this.i += 2;          // В строке занимает 2 позиции
          return cp;
        }
      }
      // Если нижнего суррогата нет — пара БИТАЯ.
      // Обрабатываем верхний суррогат как одиночный ошибочный символ!
      this.currentColumn++;
      this.i++;
      return code;
    }

    // Обычный ASCII или BMP Юникод символ (1 индекс)
    this.currentColumn++;
    this.i++;
    return code;
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

      if (char === '%') {
        this.#advanceChar(); // Поглощаем символ '%'
        let constName = '%';

        // Считываем все идущие подряд латинские буквы (идентификатор константы)
        while (this.i < this.chars.length && /[a-zA-Z]/.test(this.chars[this.i])) {
          constName += this.#advanceChar();
        }

        const matchedType = constantMap[constName];

        if (matchedType) {
          return {
            type: matchedType,
            value: constName,
            loc: startLoc // Использует ваш метод генерации координат
          };
        }

        // Если после % идет неизвестное имя или пустота, фиксируем ошибку компиляции
        this.errors.push(new CompilerError(`Неизвестная математическая константа "${constName}"`, startLoc));
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
      if (char === ',') { this.#advanceChar(); return new Token(TokenType.COMMA, ',', startLoc); }

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