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

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/**
 * Превращает невидимые, управляющие или битые символы в строку вида U+XXXX,
 * а понятные печатные символы оставляет в исходном виде.
 */
function formatBadChar(str) {
  if (!str) return 'EOF';

  // Если это одиночный разорванный суррогат, JS не сможет взять codePointAt корректно.
  // Поэтому сначала проверяем через обычный charCodeAt.
  const firstCode = str.charCodeAt(0);
  
  // Проверяем: разорванный верхний или нижний суррогат, 
  // либо управляющие символы ASCII (<= 32), включая таб, переводы строк, NEL (133), BOM (0xFEFF)
  // или официальный символ замены Unicode REPLACEMENT CHARACTER (0xFFFD)
  const isInvisibleOrBroken = 
    (firstCode <= 32) || 
    (firstCode >= 0xD800 && firstCode <= 0xDFFF) || 
    (firstCode === 133 || firstCode === 12 || firstCode === 0xFEFF || firstCode === 0xFFFD) ||
    (firstCode >= 0x200B && firstCode <= 0x200D) || // Невидимые разделители ZWSP, ZWNJ, ZWJ
    (firstCode >= 0x2028 && firstCode <= 0x2029);   // Разделители строк Юникода

  if (isInvisibleOrBroken) {
    // Форматируем код в красивый hex: U+XXXX
    const hex = firstCode.toString(16).toUpperCase().padStart(4, '0');
    return `U+${hex}`;
  }

  // Для сложных составных графем (например, эмодзи, у которых внутри есть ZWJ)
  // если они попали в ошибку, мы можем вывести их как есть, чтобы пользователь их узнал.
  return str;
}

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
  asciiMap[c.charCodeAt(0)] = C_SPACE;
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
  asciiMap[c.charCodeAt(0)] = C_OPERATOR;
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
  constructor(input, errors, baseLine = 1) {
    this.source = input; 
    this.errors = errors;
    this.i = 0;
    this.lineStartIdx = 0;
    this.currentLine = baseLine;
  }


  #readCodePointAndAdvance() {
    if (this.i >= this.source.length) return null;

    const cp = this.source.codePointAt(this.i);
    const code = this.source.charCodeAt(this.i);

    // Обработка переводов строк (счетчик строк)
    if (code === 10 || code === 8232 || code === 8233 || code === 133 || code === 12) { // \n, \u2028, \u2029, NEL, FF
      this.currentLine++;
      this.i++;
      this.lineStartIdx = this.i;
      return code;
    }
    if (code === 13) { // \r
      this.currentLine++;
      this.i++;
      if (this.i < this.source.length && this.source.charCodeAt(this.i) === 10) { // \r\n
        this.i++;
      }
      this.lineStartIdx = this.i;
      return code;
    }

    // Проверяем, является ли символ валидной суррогатной парой (занимает 2 индекса)
    // High surrogate: 0xD800 - 0xDBFF. Low surrogate: 0xDC00 - 0xDFFF
    if (code >= 0xD800 && code <= 0xDBFF) {
      if (this.i + 1 < this.source.length) {
        const nextCode = this.source.charCodeAt(this.i + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          // Пара валидна!
          this.i += 2;          // В строке занимает 2 позиции
          return cp;
        }
      }
      // Если нижнего суррогата нет — пара БИТАЯ.
      // Обрабатываем верхний суррогат как одиночный ошибочный символ!
      this.i++;
      return code;
    }

    // Обычный ASCII или BMP Юникод символ (1 индекс)
    this.i++;
    return code;
  }

  /**
   * Считывает и возвращает СЛЕДУЮЩИЙ единственный токен из потока (LL(1))
   */
  next() {
    const src = this.source;
    const len = src.length;

    while (this.i < len) {
      const code = src.codePointAt(this.i);
      const charClass = code < 128 ? asciiMap[code] : C_UNKNOWN;

      const startLine = this.currentLine;
      const startIndex = this.i;
      const startLineIdx = this.lineStartIdx;

      const createLoc = () => { 
      return new SourceLocation(this, 
          startIndex, 
          this.i, 
          startLine, 
          startLineIdx, 
          this.currentLine, 
          this.lineStartIdx
      );};

      // --- БЫСТРАЯ ASCII ДОРОЖКА ---
      if (code < 128) {
        switch (charClass) {
          case C_SPACE: {
            this.#readCodePointAndAdvance(); // Просто поглощаем пробел
            continue;
          }

          case C_OPERATOR: {
            // Комментарии //
            if (code === 47 && src.charCodeAt(this.i + 1) === 47) {
              this.#readCodePointAndAdvance(); this.#readCodePointAndAdvance();
              while (this.i < len) {
                const next = src.charCodeAt(this.i);
                if (next === 10 || next === 13 || next === 8232 || nextCode === 8233 || next === 133 || next === 12) break;
                this.#readCodePointAndAdvance();
              }
              continue;
            }
            // Степень **
            if (code === 42 && src.charCodeAt(this.i + 1) === 42) {
              this.#readCodePointAndAdvance(); this.#readCodePointAndAdvance();
              return new Token(TokenType.POW, '^', createLoc());
            }

            this.#readCodePointAndAdvance();
            let type;
            if (code === 43) type = TokenType.PLUS;
            else if (code === 45) type = TokenType.MINUS;
            else if (code === 47) type = TokenType.DIV;
            else if (code === 61) type = TokenType.ASSIGN;
            else if (code === 40) type = TokenType.LPAREN;
            else if (code === 41) type = TokenType.RPAREN;
            else if (code === 59) type = TokenType.SEMICOLON;
            else if (code === 36) type = TokenType.SILENT;
            else if (code === 44) type = TokenType.COMMA;
            else if (code === 94) type = TokenType.POW;
            else if (code === 42) type = TokenType.MUL;

            return new Token(type, String.fromCharCode(code), createLoc());
          }

          case C_QUOTE: {
            const quote = code;
            this.#readCodePointAndAdvance();
            const textStart = this.i;
            while (this.i < len && src.charCodeAt(this.i) !== quote) {
              this.#readCodePointAndAdvance();
            }
            const textValue = src.slice(textStart, this.i);
            const startLoc = createLoc();
            if (this.i >= len) {
              this.errors.push(new CompilerError(`Незакрытая текстовая строка`, startLoc));
              return new Token(TokenType.TEXT_BLOCK, textValue, startLoc);
            }
            this.#readCodePointAndAdvance();
            return new Token(TokenType.TEXT_BLOCK, textValue, startLoc);
          }

          case C_PERCENT: { // %pi, %e
            this.#readCodePointAndAdvance();
            const constStart = this.i;
            while (this.i < len) {
              const next = src.charCodeAt(this.i);
              if ((next >= 65 && next <= 90) || (next >= 97 && next <= 122)) this.#readCodePointAndAdvance();
              else break;
            }
            const constName = '%' + src.slice(constStart, this.i);
            const matchedType = constantMap[constName];
            const startLoc =  createLoc();
            if (matchedType) return { type: matchedType, value: constName, loc: startLoc };
            this.errors.push(new CompilerError(`Неизвестная математическая константа "${constName}"`, startLoc));
            continue;
          }

          case C_DIGIT: { // Числа + Экспонента
            const numStart = this.i;
            let dotCount = 0;
            while (this.i < len) {
              const next = src.charCodeAt(this.i);
              if (next === 46) { dotCount++; this.#readCodePointAndAdvance(); }
              else if (next >= 48 && next <= 57) this.#readCodePointAndAdvance();
              else break;
            }
            // Научная нотация e/E
            if (this.i < len) {
              const next = src.charCodeAt(this.i);
              if (next === 101 || next === 69) {
                let look = this.i + 1, hasSign = false;
                if (look < len && (src.charCodeAt(look) === 43 || src.charCodeAt(look) === 45)) { look++; hasSign = true; }
                if (look < len && src.charCodeAt(look) >= 48 && src.charCodeAt(look) <= 57) {
                  this.#readCodePointAndAdvance(); if (hasSign) this.#readCodePointAndAdvance();
                  while (this.i < len && src.charCodeAt(this.i) >= 48 && src.charCodeAt(this.i) <= 57) this.#readCodePointAndAdvance();
                }
              }
            }
            const numStr = src.slice(numStart, this.i);
            const startLoc =  createLoc();
            if (dotCount > 1) this.errors.push(new CompilerError(`Неверный формат числа "${numStr}"`, startLoc));
            const parsedVal = parseFloat(numStr) || 0;
            if (this.i < len && src.charCodeAt(this.i) === 105) { 
              this.#readCodePointAndAdvance(); 
              return new Token(TokenType.COMPLEX_NUMBER, parsedVal, startLoc);
            }
            return new Token(TokenType.NUMBER, parsedVal, startLoc);
          }

          case C_ALPHA: { // Идентификаторы (Латиница)
            const idStart = this.i;
            this.#readCodePointAndAdvance();
            while (this.i < len) {
              const next = src.charCodeAt(this.i);
              if ((next >= 65 && next <= 90) || (next >= 97 && next <= 122) || (next >= 48 && next <= 57) || next === 95) {
                this.#readCodePointAndAdvance();
              } else if (next > 127) {
                // Если идентификатор начался на ASCII, но продолжился Юникод буквой или Юникод числом
                const nextCp = src.codePointAt(this.i);
                if (isUnicodeLetter(nextCp) || isUnicodeNumber(nextCp)) {
                  this.#readCodePointAndAdvance();
                } else {
                  break;
                }
              } else {
                break;
              }
            }
            return new Token(TokenType.VARIABLE, src.slice(idStart, this.i),  createLoc());
          }
          default: {
            const currentPos = this.i;
            this.#readCodePointAndAdvance(); // ГАРАНТИРОВАННО сдвигаем курсор на 1 символ
            const badChar = src.slice(currentPos, this.i);
            const formattedChar = formatBadChar(badChar);
            this.errors.push(new CompilerError(
              `Неизвестный ASCII символ "${formattedChar}"`, 
               createLoc()
            ));
            continue; // Переходим к следующему символу
          }
        }
      } else {
        // --- ТОЧНАЯ ЮНИКОД ДОРОЖКА (code >= 128) ---
        if (isUnicodeSpace(code)) {
          this.#readCodePointAndAdvance();
          continue;
        }

        if (isUnicodeLetter(code)) {
          const idStart = this.i;
          this.#readCodePointAndAdvance();
          
          while (this.i < len) {
            const nextCp = src.codePointAt(this.i);
            
            // Внутри названия переменной разрешаем:
            // 1. ASCII буквы, ASCII цифры или подчёркивание
            // 2. Юникод-буквы (\p{L})
            // 3. Юникод-числа (\p{N})
            const isAsciiPart = nextCp < 128 && (asciiMap[nextCp] === C_ALPHA || asciiMap[nextCp] === C_DIGIT);
            
            if (isAsciiPart || isUnicodeLetter(nextCp) || isUnicodeNumber(nextCp)) {
              this.#readCodePointAndAdvance();
            } else {
              break;
            }
          }
          return new Token(TokenType.VARIABLE, src.slice(idStart, this.i), createLoc());
        }

        const currentPos = this.i;
        let graphemeLength = 1;

        // Если Intl.Segmenter доступен, берем длину ПЕРВОЙ полной графемы
        if (typeof Intl.Segmenter !== 'undefined') {
          if (!this._segmenter) {
            this._segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
          }
          // Сегментируем остаток строки и берем первый визуальный символ
          const segments = this._segmenter.segment(src.slice(currentPos));
          const firstGrapheme = segments.containing(0); 
          if (firstGrapheme) {
            graphemeLength = firstGrapheme.segment.length; // Физическая длина в UTF-16 ячейках
          }
        } else {
          // Fallback: если сегментера нет, аккуратно шагаем хотя бы по суррогатным парам
          if (code >= 0xD800 && code <= 0xDBFF && currentPos + 1 < len) {
            const nextCode = src.charCodeAt(currentPos + 1);
            if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
              graphemeLength = 2;
            }
          }
        }

        // Продвигаем курсор лексера сразу на всю длину сложного эмодзи/символа
        // При этом важно правильно обновить счетчики строк, если внутри графемы был перенос (маловероятно, но для безопасности)
        for (let step = 0; step < graphemeLength; step++) {
          const checkCode = src.charCodeAt(this.i);
          if (checkCode === 10 || checkCode === 13 || checkCode === 8232 || checkCode === 8233 || checkCode === 133 || checkCode === 12) {
            // Если это перевод строки (например, битый невидимый символ переноса), вызываем штатный метод
            this.#readCodePointAndAdvance();
          } else {
            // Для обычных внутренностей эмодзи просто сдвигаем физический индекс
            this.i++;
          }
        }
        const badChar = src.slice(currentPos, this.i);
        const formattedChar = formatBadChar(badChar);
        this.errors.push(new CompilerError(`Неизвестный символ "${formattedChar}"`, createLoc()));
      }
    }

    const loc = new SourceLocation(this, 
      this.i, this.i, 
      this.currentLine, this.lineStartIdx, 
      this.currentLine, this.lineStartIdx);
    return new Token(TokenType.EOF, 'EOF',  loc);
  }  

  /**
   * Подсчитывает количество визуальных символов (графем) между двумя индексами.
   * Безопасно обрабатывает суррогатные пары Юникода.
   */
  countGraphemes(fromIndex, toIndex) {
    if (fromIndex >= toIndex) return 1; // Колонки 1-based

    // 1. Вырезаем кусок строки от начала линии до нужной позиции
    const subStr = this.source.slice(fromIndex, toIndex);

    // 2. Используем итератор Intl.Segmenter
    // Мы не собираем массив через Array.from(), чтобы не плодить память. 
    // Мы просто линейно считаем количество итераций (графем) в цикле.
    let count = 1; // Стартуем с 1-й колонки
    for (const _ of graphemeSegmenter.segment(subStr)) {
      count++;
    }
    return count;
  }  
}