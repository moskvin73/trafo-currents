import { TokenType } from './TokenTypes.js';
import { SourceLocation, CompilerError } from './CompilerErrors.js'; // перенесем типы ошибок в один служебный файл


// Карта быстрого сопоставления с типами токенов
const reservedWordsMap = { 
  '%pi':   TokenType.MATH_PI,
  '%e':    TokenType.MATH_E,
  '%phi':  TokenType.MATH_PHI,
  '%inf':  TokenType.MATH_INF,
  '%nan':  TokenType.MATH_NAN,
  'print': TokenType.RW_PRINT,
  'true': TokenType.RW_TRUE,
  'false': TokenType.RW_FALSE,
  'plot_init': TokenType.RW_PLOT_INIT,
  'plot_config': TokenType.RW_PLOT_CONFIG,
  'plot_layer': TokenType.RW_PLOT_LAYER,
  'plot_vector': TokenType.RW_PLOT_VECTOR,
  'plot_chord': TokenType.RW_PLOT_CHORD,
  'let': TokenType.RW_LET,
};

// const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

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
for (let c of ['+', '-', '*', '/', '=', '(', ')', ';', '$', ',' , '^', '[', ']', '{', '}']) {
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
    this.currentLine = baseLine;
    this.lineStartIdx = 0;

    // Внутреннее состояние ПОСЛЕДНЕГО успешно прочитанного тонена
    this.tokenStart = 0;
    this.tokenEnd = 0;
    this.tokenStartLine = 0;
    this.tokenStartLineIdx = 0;
    this.tokenEndLine = 0;
    this.tokenEndLineIdx = 0;
    
    // Сюда сохраняем распарсенное число, чтобы parseFloat не вызывать дважды
    this.tokenNumberValue = 0; 

    this._segmenter = typeof Intl.Segmenter !== 'undefined' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  }

  // ============================================================================
  // ПУБЛИЧНЫЕ МЕТОДЫ ПОЛУЧЕНИЯ ДАННЫХ ПО ТРЕБОВАНИЮ
  // ============================================================================

  /** Возвращает строковое значение текущего токена (имя переменной, текст строки) */
  stringValue() {
    return this.source.slice(this.tokenStart, this.tokenEnd);
  }

  /** Возвращает готовое числовое значение (для TokenType.NUMBER / TokenType.COMPLEX_NUMBER) */
  numberValue() {
    return this.tokenNumberValue;
  }

  /** Создает и возвращает легковесный объект локации для AST дерева */
  createLocation() {
    return new SourceLocation(
      this,
      this.tokenStart,
      this.tokenEnd,
      this.tokenStartLine,
      this.tokenStartLineIdx,
      this.tokenEndLine,
      this.tokenEndLineIdx
    );
  } 

  /** Вспомогательный метод подсчета визуальных графем Юникода */
  countGraphemes(fromIndex, toIndex) {
    if (fromIndex >= toIndex) return 1;
    const subStr = this.source.slice(fromIndex, toIndex);
    let count = 1;
    if (this._segmenter) {
      for (const _ of this._segmenter.segment(subStr)) count++;
    } else {
      let curr = 0;
      while (curr < subStr.length) {
        const code = subStr.charCodeAt(curr);
        if (code >= 0xD800 && code <= 0xDBFF && curr + 1 < subStr.length && subStr.charCodeAt(curr + 1) >= 0xDC00 && subStr.charCodeAt(curr + 1) <= 0xDFFF) {
          count++; curr += 2; continue;
        }
        count++; curr++;
      }
    }
    return count;
  }

  #readCodePointAndAdvance() {
    if (this.i >= this.source.length) return null;
    const cp = this.source.codePointAt(this.i);
    const code = this.source.charCodeAt(this.i);

    if (code === 10 || code === 8232 || code === 8233 || code === 133 || code === 12) {
      this.currentLine++; this.i++; this.lineStartIdx = this.i; return code;
    }
    if (code === 13) {
      this.currentLine++; this.i++;
      if (this.i < this.source.length && this.source.charCodeAt(this.i) === 10) this.i++;
      this.lineStartIdx = this.i; return code;
    }
    if (code >= 0xD800 && code <= 0xDBFF && this.i + 1 < this.source.length && this.source.charCodeAt(this.i + 1) >= 0xDC00 && this.source.charCodeAt(this.i + 1) <= 0xDFFF) {
      this.i += 2; return cp;
    }
    this.i++; return code;
  }

  // ============================================================================
  // ОСНОВНОЙ ЦИКЛ: СКОРОСТЬ ВЫШЕ В РАЗЫ, НУЛЬ АЛЛОКАЦИЙ ПРИ УСПЕШНОМ ПАРСИНГЕ
  // ============================================================================
  next() {
    const src = this.source;
    const len = src.length;

    while (this.i < len) {
      const code = src.codePointAt(this.i);
      const charClass = code < 128 ? asciiMap[code] : C_UNKNOWN;

      // Фиксируем стартовые метки
      const startIdx = this.i;
      const startLine = this.currentLine;
      const startLineIdx = this.lineStartIdx;

      if (code < 128) {
        switch (charClass) {
          case C_SPACE: {
            this.#readCodePointAndAdvance();
            continue;
          }

          case C_OPERATOR: {
            // Комментарии //
            if (code === 47 && src.charCodeAt(this.i + 1) === 47) {
              this.#readCodePointAndAdvance(); this.#readCodePointAndAdvance();
              while (this.i < len) {
                const next = src.charCodeAt(this.i);
                if (next === 10 || next === 13 || next === 8232 || next === 8233 || next === 133 || next === 12) break;
                this.#readCodePointAndAdvance();
              }
              continue;
            }

            // Вспомогательная функция для записи состояния оператора
            const commitOperator = (type, shiftCount) => {
              for (let s = 0; s < shiftCount; s++) this.#readCodePointAndAdvance();
              this.tokenStart = startIdx;
              this.tokenEnd = this.i;
              this.tokenStartLine = startLine;
              this.tokenStartLineIdx = startLineIdx;
              this.tokenEndLine = this.currentLine;
              this.tokenEndLineIdx = this.lineStartIdx;
              return type;
            };

            // Степень **
            if (code === 42 && src.charCodeAt(this.i + 1) === 42) return commitOperator(TokenType.POW, 2);

            let type;
            if (code === 43) type = TokenType.PLUS;
            else if (code === 45) type = TokenType.MINUS;
            else if (code === 47) type = TokenType.DIV;
            else if (code === 61) type = TokenType.ASSIGN;
            else if (code === 40) type = TokenType.LPAREN;
            else if (code === 41) type = TokenType.RPAREN;
            else if (code === 91) type = TokenType.LSQUARE;
            else if (code === 93) type = TokenType.RSQUARE;
            else if (code === 59) type = TokenType.SEMICOLON;
            else if (code === 36) type = TokenType.SILENT;
            else if (code === 44) type = TokenType.COMMA;
            else if (code === 94) type = TokenType.POW;
            else if (code === 42) type = TokenType.MUL;

            return commitOperator(type, 1);
          }

          case C_QUOTE: {
            const quote = code;
            this.#readCodePointAndAdvance();
            while (this.i < len && src.charCodeAt(this.i) !== quote) this.#readCodePointAndAdvance();

            this.tokenStart = startIdx + 1; // Пропускаем открывающую кавычку
            this.tokenEnd = this.i;
            this.tokenStartLine = startLine;
            this.tokenStartLineIdx = startLineIdx;

            if (this.i >= len) {
              const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
              this.errors.push(new CompilerError(`Незакрытая текстовая строка`, errLoc));
              this.tokenEndLine = this.currentLine;
              this.tokenEndLineIdx = this.lineStartIdx;
              return TokenType.TEXT_BLOCK;
            }
            this.#readCodePointAndAdvance(); // закрывающая кавычка
            this.tokenEndLine = this.currentLine;
            this.tokenEndLineIdx = this.lineStartIdx;
            return TokenType.TEXT_BLOCK;
          }

          case C_PERCENT: { // %pi, %e
            this.#readCodePointAndAdvance();
            while (this.i < len) {
              const next = src.charCodeAt(this.i);
              if ((next >= 65 && next <= 90) || (next >= 97 && next <= 122)) this.#readCodePointAndAdvance();
              else break;
            }
            this.tokenStart = startIdx;
            this.tokenEnd = this.i;
            this.tokenStartLine = startLine;
            this.tokenStartLineIdx = startLineIdx;
            this.tokenEndLine = this.currentLine;
            this.tokenEndLineIdx = this.lineStartIdx;

            const constName = src.slice(startIdx, this.i);
            const matchedType = reservedWordsMap[constName];
            if (matchedType) return matchedType; // Возвращает числовой ID из карты констант

            const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
            this.errors.push(new CompilerError(`Неизвестная математическая константа "${constName}"`, errLoc));
            continue;
          }
          case C_DIGIT: {
            while (this.i < len) {
              const next = src.charCodeAt(this.i);
              if (next === 46 || (next >= 48 && next <= 57)) {
                this.#readCodePointAndAdvance();
              } else {
                break;
              }
            }
            
            // Проверяем научную (экспоненциальную) нотацию: e/E
            if (this.i < len) {
              const next = src.charCodeAt(this.i);
              if (next === 101 || next === 69) {
                let look = this.i + 1;
                let hasSign = false;
                if (look < len && (src.charCodeAt(look) === 43 || src.charCodeAt(look) === 45)) { 
                  look++; 
                  hasSign = true; 
                }
                if (look < len && src.charCodeAt(look) >= 48 && src.charCodeAt(look) <= 57) {
                  this.#readCodePointAndAdvance(); // поглотили e/E
                  if (hasSign) this.#readCodePointAndAdvance(); // поглотили +/-
                  while (this.i < len && src.charCodeAt(this.i) >= 48 && src.charCodeAt(this.i) <= 57) {
                    this.#readCodePointAndAdvance();
                  }
                }
              }
            }

            this.tokenStart = startIdx;
            this.tokenEnd = this.i;
            this.tokenStartLine = startLine;
            this.tokenStartLineIdx = startLineIdx;
            this.tokenEndLine = this.currentLine;
            this.tokenEndLineIdx = this.lineStartIdx;

            // Извлекаем подстроку и парсим число в примитив ровно один раз
            this.tokenNumberValue = parseFloat(src.slice(startIdx, this.i)) || 0;

            // Мгновенная склейка комплексных чисел прямо на уровне лексем (105 = 'i')
            if (this.i < len && src.charCodeAt(this.i) === 105) { 
              this.#readCodePointAndAdvance();
              this.tokenEnd = this.i; // Расширяем правую границу токена, включая 'i'
              return TokenType.COMPLEX_NUMBER;
            }
            return TokenType.NUMBER;
          }

          case C_ALPHA: { // Идентификаторы (начало с ASCII-буквы)
            this.#readCodePointAndAdvance();
            while (this.i < len) {
              const next = src.charCodeAt(this.i);
              // Разрешаем латиницу, цифры и подчёркивание
              if ((next >= 65 && next <= 90) || (next >= 97 && next <= 122) || (next >= 48 && next <= 57) || next === 95) {
                this.#readCodePointAndAdvance();
              } else if (next > 127) {
                // Если слово началось с латиницы, но продолжилось Юникод-буквами/числами
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
            this.tokenStart = startIdx;
            this.tokenEnd = this.i;
            this.tokenStartLine = startLine;
            this.tokenStartLineIdx = startLineIdx;
            this.tokenEndLine = this.currentLine;
            this.tokenEndLineIdx = this.lineStartIdx;

            const idLength = this.i - startIdx;
            if (idLength > 1 && idLength < 20) {
              const text = src.slice(startIdx, this.i);
              const matchedType = reservedWordsMap[text];
              if (matchedType !== undefined) {
                return matchedType;
              }
            }
            return TokenType.VARIABLE;
          }

          default: { // Неизвестный или запрещённый ASCII-символ (например, '\', '#', '`')
            this.#readCodePointAndAdvance();
            const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
            this.errors.push(new CompilerError(`Неизвестный ASCII символ "${formatBadChar(src.slice(startIdx, this.i))}"`, errLoc));
            continue; // Идем искать следующий полезный токен
          }
        }
      } else {
        // --- 2. ТОЧНАЯ ЮНИКОД-ДОРОЖКА (Кодовые точки >= 128) ---
        
        // Проверяем полнокровные пробельные символы Юникода (\p{Zs} и др.)
        if (isUnicodeSpace(code)) { 
          this.#readCodePointAndAdvance(); 
          continue; 
        }

        // Переменные, начавшиеся сразу с Юникод-букв (кириллица, корейский и т.д.)
        if (isUnicodeLetter(code)) {
          this.#readCodePointAndAdvance();
          while (this.i < len) {
            const nextCp = src.codePointAt(this.i);
            const isAsciiPart = nextCp < 128 && (asciiMap[nextCp] === C_ALPHA || asciiMap[nextCp] === C_DIGIT);
            
            if (isAsciiPart || isUnicodeLetter(nextCp) || isUnicodeNumber(nextCp)) {
              this.#readCodePointAndAdvance();
            } else {
              break;
            }
          }
          this.tokenStart = startIdx;
          this.tokenEnd = this.i;
          this.tokenStartLine = startLine;
          this.tokenStartLineIdx = startLineIdx;
          this.tokenEndLine = this.currentLine;
          this.tokenEndLineIdx = this.lineStartIdx;
          return TokenType.VARIABLE;
        }

        // ОБРАБОТКА НЕИЗВЕСТНЫХ СЛОЖНЫХ СИМВОЛОВ И СОСТАВНЫХ ЭМОДЗИ
        let graphemeLength = 1;
        if (this._segmenter) {
          // Вычисляем физическую UTF-16 длину первой цельной графемы
          const firstGrapheme = this._segmenter.segment(src.slice(startIdx)).containing(0);
          if (firstGrapheme) {
            graphemeLength = firstGrapheme.segment.length;
          }
        } else {
          // Запасной вариант (fallback): если сегментера нет, безопасно шагаем по суррогатным парам
          if (code >= 0xD800 && code <= 0xDBFF && startIdx + 1 < len) {
            if (src.charCodeAt(startIdx + 1) >= 0xDC00 && src.charCodeAt(startIdx + 1) <= 0xDFFF) {
              graphemeLength = 2;
            }
          }
        }

        // Поглощаем всю сложную ошибку (флаг, цвет кожи, семья) целиком, сохраняя счетчики строк
        for (let step = 0; step < graphemeLength; step++) {
          this.#readCodePointAndAdvance();
        }

        const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
        this.errors.push(new CompilerError(`Неизвестный символ "${formatBadChar(src.slice(startIdx, this.i))}"`, errLoc));
        continue;
      }
    }

    // Достигли конца файла (EOF)
    this.tokenStart = this.i; 
    this.tokenEnd = this.i;
    this.tokenStartLine = this.currentLine; 
    this.tokenStartLineIdx = this.lineStartIdx;
    this.tokenEndLine = this.currentLine; 
    this.tokenEndLineIdx = this.lineStartIdx;
    return TokenType.EOF;
  }
}		  
