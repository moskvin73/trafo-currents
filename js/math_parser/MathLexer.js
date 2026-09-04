import { TokenType } from './TokenTypes.js';
import { SourceLocation, CompilerError } from './CompilerErrors.js';


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
  'not': TokenType.RW_NOT,
  'and': TokenType.RW_AND,
  'or': TokenType.RW_OR,
  'xor': TokenType.RW_XOR,
  'if': TokenType.RW_IF,
  'else': TokenType.RW_ELSE,
  'while': TokenType.RW_WHILE,
  'do': TokenType.RW_DO,
  'for': TokenType.RW_FOR,
  'return': TokenType.RW_RETUTN,
  'break': TokenType.RW_BREAK,
  'continue': TokenType.RW_CONTINUE,
  'bool': TokenType.RW_BOOL,
  'real': TokenType.RW_REAL,
  'complex': TokenType.RW_COMPLEX,
  'matrix': TokenType.RW_MATRIX,
  'is': TokenType.RW_IS,
  'mod': TokenType.RW_MOD,
  'error': TokenType.RW_ERROR,
};

export const dictionaryReservedWordsMap = Object.keys(reservedWordsMap);

/**
 * Превращает невидимые, управляющие или битые символы в строку вида U+XXXX,
 * а понятные печатные символы оставляет в исходном виде.
 */
function formatBadChar(str) {
  if (!str) return 'EOF';

  // Получаем полный Unicode код (учитывает суррогатные пары)
  const codePoint = str.codePointAt(0);
  const firstCode = str.charCodeAt(0);

  // 1. Проверяем на РЕАЛЬНО СЛОМАННЫЕ суррогаты.
  // Если первый юнит в диапазоне суррогатов, но codePoint вернул то же самое значение,
  // значит, у этого суррогата нет пары (строка оборвана).
  const isBrokenSurrogate = 
    (firstCode >= 0xD800 && firstCode <= 0xDFFF) && (codePoint === firstCode);

  // 2. Проверяем управляющие символы ASCII (<= 32), исключая пробел (32), 
  // если пробел вам нужно оставить печатным.
  const isControlAscii = (codePoint < 32); 

  // 3. Другие спецсимволы (NEL, BOM, REPLACEMENT)
  const isSpecialInvisible = 
    codePoint === 133 || 
    codePoint === 12 || 
    codePoint === 0xFEFF || 
    codePoint === 0xFFFD;

  // 4. Одиночные невидимые разделители. 
  // ВАЖНО: проверяем длину строки. Если ZWJ идет внутри длинного эмодзи (строка > 2-3 юнитов), 
  // мы его не считаем плохим, чтобы не ломать составные эмодзи.
  const isIsolatedSeparator = 
    str.length <= 2 && (
      (codePoint >= 0x200B && codePoint <= 0x200D) || 
      (codePoint >= 0x2028 && codePoint <= 0x2029)
    );

  const isInvisibleOrBroken = isBrokenSurrogate || isControlAscii || isSpecialInvisible || isIsolatedSeparator;

  if (isInvisibleOrBroken) {
    // Форматируем в U+XXXX (или U+XXXXX для больших кодов)
    const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
    return `U+${hex}`;
  }

  // Возвращаем символ как есть (целиком, включая ZWJ последовательности)
  return str;  
}

// ============================================================================
// 1. КОНСТАНТЫ И КЛАССЫ СИМВОЛОВ (Инициализируются 1 раз при старте приложения)
// ============================================================================
const C_UNKNOWN  = 0;
const C_SPACE    = 1;
const C_NEWLINE  = 2; 
const C_DIGIT    = 3; 
const C_ALPHA    = 4; 
const C_OPERATOR = 5; 
const C_QUOTE    = 6; 
const C_PERCENT  = 7;

const asciiMap = new Uint8Array(128);

// Заполняем пробелы ASCII (табуляция 9, в.таб 11, пробел 32)
for (let c of ['\t', '\v', ' ']) {
  asciiMap[c.charCodeAt(0)] = C_SPACE;
}

// Заполняем пробелы ASCII (перевод строки 10, ф.фид 12, возврат каретки 13)
for (let c of ['\n', '\r', '\f']) {
  asciiMap[c.charCodeAt(0)] = C_NEWLINE;
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
for (let c of ['+', '-', '*', '/', '=', '(', ')', ';', '$', ',' , '^', '[', ']', '{', '}', '!', '<', '>']) {
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

function isUnicodeNewLine(code) {
  return (code === 8232 || code === 8233 || code === 133);
}
// \p{Mn} или \p{Mc}
function isUnicodeMnOrMc(code) {
  return /[\p{Mn}\p{Mc}]/u.test(String.fromCodePoint(code));
}

export function calcSubstrGraphemes(text, start, end, chars_tab = 4, segmenter = null) {
  // Защита от выхода за границы и пустых диапазонов
  if (!text || start >= end || start < 0) return 1; 
  
  let visualLength = 0;

  if (!segmenter) {
    segmenter = typeof Intl.Segmenter !== 'undefined' 
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) 
      : null;
  }

  const combiningMarksRegex = /\p{Mn}|\p{Mc}/gu;

  if (segmenter) {
    // Вырезаем кусок только для сегментера, так как Intl.Segmenter работает со строкой.
    // Но это всё равно быстрее, чем делать substring во внешнем цикле для всего приложения.
    const subStr = text.slice(start, end);
    
    for (const segmentInfo of segmenter.segment(subStr)) {
      const char = segmentInfo.segment;
      if (char === '\t') {
        visualLength += chars_tab - (visualLength % chars_tab);
        continue;
      }

      const codePoints = [...char];
      const cleanCodePoints = codePoints.filter(cp => !combiningMarksRegex.test(cp));
      visualLength += cleanCodePoints.length || 1;
    }
  } else {
    // Полный отказ от выделения памяти: работаем напрямую с индексами буфера
    let curr = start;
    while (curr < end) {
      const char = text[curr];
      
      if (char === '\t') {
        visualLength += chars_tab - (visualLength % chars_tab);
        curr++;
        continue;
      }

      const code = text.charCodeAt(curr);
      let isSurrogate = false;
      
      // Проверяем суррогатную пару в пределах [start, end)
      if (code >= 0xD800 && code <= 0xDBFF && curr + 1 < end) {
        const nextCode = text.charCodeAt(curr + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          isSurrogate = true;
        }
      }

      // Пропускаем комбинируемые символы (модификаторы диакритики)
      // Если это не диакритика — учитываем длину
      if (!combiningMarksRegex.test(char)) {
        visualLength += 1; 
      }

      curr += isSurrogate ? 2 : 1;
    }
  }
  return visualLength || 1;
}

/** Метод подсчета визуальных графем Юникода */
export function calcLineGraphemes(line,  chars_tab = 4, segmenter = null) {
  if (!line || line.length === 0) return 1; // Для пустой строки позиций 0

  let visualLength = 0;

  if (!segmenter) {
    segmenter = typeof Intl.Segmenter !== 'undefined' 
      ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) 
      : null;
  }

  // Регулярное выражение для поиска комбинируемых символов (диакритики)
  const combiningMarksRegex = /\p{Mn}|\p{Mc}/gu;

  if (segmenter) {
    for (const segmentInfo of segmenter.segment(line)) {
      const char = segmentInfo.segment;

      if (char === '\t') {
        visualLength += chars_tab - (visualLength % chars_tab);
        continue;
      }

      // 1. Разбиваем графему на массив Code Points (учитывает суррогатные пары)
      const codePoints = [...char]; 
      
      // 2. Фильтруем (удаляем) из неё все комбинируемые символы (диакритику)
      const cleanCodePoints = codePoints.filter(cp => !combiningMarksRegex.test(cp));

      // 3. Если после очистки что-то осталось, прибавляем количество кодовых точек
      // Если осталась пустышка (например, строка состояла только из диакритики), берем минимум 1
      visualLength += cleanCodePoints.length || 1;
    }
  } else {
    // Фолбек для старых сред
    let curr = 0;
    while (curr < line.length) {
      const char = line[curr];
      if (char === '\t') {
        visualLength += chars_tab - (visualLength % chars_tab);
        curr++;
        continue;
      }

      const code = line.charCodeAt(curr);
      let isSurrogate = false;

      if (code >= 0xD800 && code <= 0xDBFF && curr + 1 < line.length) {
        const nextCode = line.charCodeAt(curr + 1);
        if (nextCode >= 0xDC00 && nextCode <= 0xDFFF) {
          isSurrogate = true;
        }
      }

      // Извлекаем текущий полный Code Point (2 или 4 байта)
      const fullChar = isSurrogate ? line.substr(curr, 2) : line[curr];
      
      // Проверяем, не является ли он комбинируемым символом
      if (!combiningMarksRegex.test(fullChar)) {
        visualLength++;
      }

      curr += isSurrogate ? 2 : 1;
    }
  }
  return visualLength + 1;  
}

export class MathLexer {
  constructor(input, errors, baseLine = 1, include_trivia = false) {
    this.source = input;
    this.errors = errors;
    this.i = 0;
    this.currentLine = baseLine;
    this.lineStartIdx = 0;
    this.include_trivia = typeof include_trivia === 'boolean' ? include_trivia : false;

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
    this.chars_tab = 4;
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
    return calcSubstrGraphemes(this.source, fromIndex, toIndex, this.chars_tab, this._segmenter);
    //const subStr = this.source.slice(fromIndex, toIndex);
    //return calcLineGraphemes(subStr, this.chars_tab, this._segmenter);
  }

  #readCodePointAndAdvance() {
    if (this.i >= this.source.length) return null;
    const cp = this.source.codePointAt(this.i);
    const code = this.source.charCodeAt(this.i);

    /*if (code === 10 || code === 8232 || code === 8233 || code === 133 || code === 12) {
      this.currentLine++; this.i++; this.lineStartIdx = this.i; return code;
    }
    if (code === 13) {
      this.currentLine++; this.i++;
      if (this.i < this.source.length && this.source.charCodeAt(this.i) === 10) this.i++;
      this.lineStartIdx = this.i; return code;
    }*/
    if (code >= 0xD800 && code <= 0xDBFF && 
        this.i + 1 < this.source.length && 
        this.source.charCodeAt(this.i + 1) >= 0xDC00 && 
        this.source.charCodeAt(this.i + 1) <= 0xDFFF) {
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
            if (this.include_trivia) {
               while (true)
               {
                  const code = src.codePointAt(this.i);
                  const isSpace = code < 128 
                      ? asciiMap[code] === C_SPACE 
                      : isUnicodeSpace(code);
                  if (!isSpace) break;
                  this.#readCodePointAndAdvance();
              }
              this.tokenStart = startIdx;
              this.tokenEnd = this.i;
              this.tokenStartLine = startLine;
              this.tokenStartLineIdx = startLineIdx;
              this.tokenEndLine = this.currentLine;
              this.tokenEndLineIdx = this.lineStartIdx;
              return TokenType.SPACES;
            }                         
            continue;
          }

          case C_NEWLINE: {
            this.currentLine++; this.i++;
            if (code === 13) {
              if (this.i < this.source.length && this.source.charCodeAt(this.i) === 10) this.i++;
            }
            this.lineStartIdx = this.i;
            if (this.include_trivia) {
              this.tokenStart = startIdx;
              this.tokenEnd = this.i;
              this.tokenStartLine = startLine;
              this.tokenStartLineIdx = startLineIdx;
              this.tokenEndLine = this.currentLine;
              this.tokenEndLineIdx = this.lineStartIdx;
              return TokenType.NL;
            } else continue;
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
              if (this.include_trivia) {
                this.tokenStart = startIdx;
                this.tokenEnd = this.i;
                this.tokenStartLine = startLine;
                this.tokenStartLineIdx = startLineIdx;
                this.tokenEndLine = this.currentLine;
                this.tokenEndLineIdx = this.lineStartIdx;
                return TokenType.COMMENT;
              }
              else continue;
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
            // <=
            if (code === 60 && src.charCodeAt(this.i + 1) === 61) return commitOperator(TokenType.LTE, 2);
            // ==
            if (code === 61 && src.charCodeAt(this.i + 1) === 61) return commitOperator(TokenType.EQU, 2);
            // !=
            if (code === 33 && src.charCodeAt(this.i + 1) === 61) return commitOperator(TokenType.NOT_EQU, 2);
            // >=
            if (code === 62 && src.charCodeAt(this.i + 1) === 61) return commitOperator(TokenType.GTE, 2);

            let type;
            if (code === 43) type = TokenType.PLUS;
            else if (code === 33) type = TokenType.RW_NOT;
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
            else if (code === 123) type = TokenType.LBRACE;
            else if (code === 125) type = TokenType.RBRACE;
            else if (code === 60) type = TokenType.LT;
            else if (code === 62) type = TokenType.GT;

            return commitOperator(type, 1);
          }

          case C_QUOTE: {
            const quote = code;
            this.#readCodePointAndAdvance();
            let isUnterminated = false;
            while (this.i < len) {
              const next = src.charCodeAt(this.i);
              if (next === quote) break;
              if (next === 10 || next === 13 || next === 8232 || next === 8233 || next === 133 || next === 12)
              {
                isUnterminated = true;
                break;
              }
              this.#readCodePointAndAdvance();
            }

            // Заполняем координаты токена (общие для всех исходов)
            this.tokenStart = startIdx + 1; 
            this.tokenEnd = this.i;
            this.tokenStartLine = startLine;
            this.tokenStartLineIdx = startLineIdx;
            this.tokenEndLine = this.currentLine;
            this.tokenEndLineIdx = this.lineStartIdx;

            // Если строка не закрыта (из-за EOL или конца файла)
            if (isUnterminated || this.i >= len) {
                if (!this.include_trivia) {
                    const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
                    this.errors.push(new CompilerError(`Незакрытая текстовая строка`, errLoc));
                    return TokenType.TEXT_BLOCK;
                }
                return TokenType.ERROR_STR;
            }            
            this.#readCodePointAndAdvance(); // закрывающая кавычка
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

            if (this.include_trivia) {
              return TokenType.ERROR;
            }
            else {
              const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
              this.errors.push(new CompilerError(`Неизвестная математическая константа "${constName}"`, errLoc));
              continue;
            }
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
                if (isUnicodeLetter(nextCp) || isUnicodeNumber(nextCp) || isUnicodeMnOrMc(nextCp)) {
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
            if (this.include_trivia) {
                this.tokenStart = startIdx;
                this.tokenEnd = this.i;
                this.tokenStartLine = startLine;
                this.tokenStartLineIdx = startLineIdx;
                this.tokenEndLine = this.currentLine;
                this.tokenEndLineIdx = this.lineStartIdx;
                return TokenType.ERROR;
            }
            else {
              const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
              this.errors.push(new CompilerError(`Неизвестный ASCII символ "${formatBadChar(src.slice(startIdx, this.i))}"`, errLoc));
              continue; // Идем искать следующий полезный токен
            }
          }
        }
      } else {
        // --- 2. ТОЧНАЯ ЮНИКОД-ДОРОЖКА (Кодовые точки >= 128) ---
        if (isUnicodeNewLine(code)) {
          this.currentLine++; this.i++; this.lineStartIdx = this.i;
          if (this.include_trivia) {
            this.tokenStart = startIdx;
            this.tokenEnd = this.i;
            this.tokenStartLine = startLine;
            this.tokenStartLineIdx = startLineIdx;
            this.tokenEndLine = this.currentLine;
            this.tokenEndLineIdx = this.lineStartIdx;
            return TokenType.NL;
          } else continue;
        }

        // Проверяем полнокровные пробельные символы Юникода (\p{Zs} и др.)
        if (isUnicodeSpace(code)) { 
          this.#readCodePointAndAdvance();
          if (this.include_trivia) {
               while (true)
               {
                  const code = src.codePointAt(this.i);
                  const isSpace = code < 128 
                      ? asciiMap[code] === C_SPACE 
                      : isUnicodeSpace(code);
                  if (!isSpace) break;
                  this.#readCodePointAndAdvance();
              }
              this.tokenStart = startIdx;
              this.tokenEnd = this.i;
              this.tokenStartLine = startLine;
              this.tokenStartLineIdx = startLineIdx;
              this.tokenEndLine = this.currentLine;
              this.tokenEndLineIdx = this.lineStartIdx;
              return TokenType.SPACES;           
          } else continue; 
        }

        // Переменные, начавшиеся сразу с Юникод-букв (кириллица, корейский и т.д.)
        if (isUnicodeLetter(code)) {
          this.#readCodePointAndAdvance();
          while (this.i < len) {
            const nextCp = src.codePointAt(this.i);
            const isAsciiPart = nextCp < 128 && (asciiMap[nextCp] === C_ALPHA || asciiMap[nextCp] === C_DIGIT);
            
            if (isAsciiPart || isUnicodeLetter(nextCp) || isUnicodeNumber(nextCp) || isUnicodeMnOrMc(nextCp)) {
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
        /*for (let step = 0; step < graphemeLength; step++) {
          this.#readCodePointAndAdvance();
        }*/
        this.i += graphemeLength;
        if (this.include_trivia) {
            this.tokenStart = startIdx;
            this.tokenEnd = this.i;
            this.tokenStartLine = startLine;
            this.tokenStartLineIdx = startLineIdx;
            this.tokenEndLine = this.currentLine;
            this.tokenEndLineIdx = this.lineStartIdx;
            return TokenType.ERROR;
        } else {
          const errLoc = new SourceLocation(this, startIdx, this.i, startLine, startLineIdx, this.currentLine, this.lineStartIdx);
          this.errors.push(new CompilerError(`Неизвестный символ "${formatBadChar(src.slice(startIdx, this.i))}"`, errLoc));
          continue;
        }
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
