/**
 * Базовый класс для всех математических типов данных (Комплексные числа, Матрицы и т.д.).
 * Гарантирует единообразие вывода в текстовом и TeX форматах.
 */
export default class MathType {

  // 1e-15 — это стандартный порог точности для double precision
  static get EPSILON() { return 1e-15; }
  
  constructor() {
    if (this.constructor === MathType) {
      throw new TypeError("[MathType]: Нельзя создать экземпляр абстрактного базового класса.");
    }
  }

  /**
   * Возвращает чистое TeX/LaTeX представление объекта (БЕЗ знаков $ или $$).
   * Этот метод будет использоваться внутри дерева парсера (AST) для сборки сложных формул.
   * @returns {string}
   */
  toRawTeX(settings, locale = new Intl.NumberFormat().resolvedOptions().locale) {
    throw new Error(`[MathType]: Метод toRawTeX() не реализован в классе ${this.constructor.name}`);
  }

  /**
   * Возвращает стандартное текстовое представление объекта.
   * @returns {string}
   */
  toString(settings) {
    throw new Error(`[MathType]: Метод toString() не реализован в классе ${this.constructor.name}`);
  }

  /**
   * Вспомогательный метод для полной TeX-обёртки (для обратной совместимости).
   * @param {string} displayMode - 'inline' ($...$) или 'block' ($$...$$)
   * @returns {string}
   */
  toTeX(settings, displayMode = 'inline', locale = new Intl.NumberFormat().resolvedOptions().locale) {
    const raw = this.toRawTeX(settings, locale);
    return displayMode === 'block' ? `$$${raw}$$` : `$${raw}$`;
  }

  // ==========================================
  // АБСТРАКТНАЯ БАЗОВАЯ АРИФМЕТИКА
  // ==========================================

  add(other) {
    throw new Error(`[MathType]: Метод add() не реализован в классе ${this.constructor.name}`);
  }

  subtract(other) {
    throw new Error(`[MathType]: Метод subtract() не реализован в классе ${this.constructor.name}`);
  }

  multiply(other) {
    throw new Error(`[MathType]: Метод multiply() не реализован в классе ${this.constructor.name}`);
  }

  divide(other) {
    throw new Error(`[MathType]: Метод divide() не реализован в классе ${this.constructor.name}`);
  }

  pow(other) {
    throw new Error(`[MathType]: Метод pow() не реализован в классе ${this.constructor.name}`);
  }
   
   /**
   * Возвращает новый математический объект с инвертированным знаком.
   * @returns {MathType}
   */
  negate() {
    throw new Error(`[MathType]: Метод negate() не реализован в классе ${this.constructor.name}`);
  }

  /**
   * Преобразует число в формат TeX с учетом системной локали и научной нотации.
   * Обрабатывает особые случаи: NaN и бесконечности.
   * Если мантисса равна 1 или -1, опускает её, оставляя только 10^p или -10^p.
   * @param {number} num - Исходное число для форматирования.
   * @param {string} [locale] - Код локали (по умолчанию определяется автоматически).
   * @returns {string} Строка в формате TeX.
   */
  static formatNumberToTeX(num, settings, locale = new Intl.NumberFormat().resolvedOptions().locale) {
    // 1. Обработка NaN (Not a Number) с подсветкой красным цветом
    if (Number.isNaN(num)) {
      return '\\color{red}{\\text{NaN}}';
    }

    // 2. Обработка бесконечностей (Infinity / -Infinity)
    if (num === Infinity) {
      return '\\infty';
    }
    if (num === -Infinity) {
      return '-\\infty';
    }

    // 3. Определение системного десятичного разделителя
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1.1);
    const separator = parts.find(part => part.type === 'decimal')?.value || '.';

    let str;
    if (settings && typeof settings.precision === 'number') {
      // Ограничиваем диапазон от 0 до 100, так как toFixed() принимает строго этот интервал
      const precision = Math.max(0, Math.min(100, settings.precision));
      return num.toFixed(precision);
    }
    else str = num.toString();

    //const str = num.toString();
    const eIndex = str.indexOf('e');
    const localize = (val) => val.replace('.', separator);

    // 4. Обычное число (включая 0, -0, целые и простые дроби)
    if (eIndex === -1) {
      return localize(str);
    }

    // 5. Разбираем научную нотацию (например, 1e+5 или -2.5e-4)
    const mantissa = str.slice(0, eIndex);
    let exponent = str.slice(eIndex + 1);

    if (exponent.startsWith('+')) {
      exponent = exponent.slice(1);
    }

    // Сокращаем запись, если мантисса равна 1 или -1
    if (mantissa === '1') {
      return `10^{${exponent}}`;
    }
    if (mantissa === '-1') {
      return `-10^{${exponent}}`;
    }

    // Стандартный вывод для остальных мантисс
    return `${localize(mantissa)}\\cdot10^{${exponent}}`;
  }

  // Вспомогательный метод: раскладывает десятичное число в точную дробь p/q
  static toRational(val, tolerance = 1e-15) {
    let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
    let b = val;
    do {
      let a = Math.floor(b);
      let aux = h1; h1 = a * h1 + h2; h2 = aux;
      aux = k1; k1 = a * k1 + k2; k2 = aux;
      b = 1 / (b - a);
    } while (Math.abs(val - h1 / k1) > val * tolerance);

    return { num: h1, den: k1 }; // num - числитель (p), den - знаменатель (q)
  }

  /**
   * Универсальный статический фабричный метод приведения типов.
   * Наследуется всеми классами (ComplexNumber, RealNumber) автоматически.
   */
  static from(value) {
    // Получаем имя текущего класса-наследника для красивых ошибок (например, "ComplexNumber" или "RealNumber")
    const currentClassName = this.name;

    if (value === null || value === undefined) {
      throw new TypeError(`[${currentClassName}]: Невозможно привести ${value} к типу ${currentClassName}.`);
    }

    // 1. Извлекаем ключ: для объектов — ссылка на класс-конструктор, для примитивов — typeof строка
    const typeKey = typeof value === 'object' ? value.constructor : typeof value;

    // 2. Ищем таблицу конвертеров текущего класса-наследника через полиморфный контекст 'this'
    const convertersMap = this.converters;

    if (!convertersMap) {
      throw new Error(`[${currentClassName}]: В классе-наследнике не определена таблица конвертеров "static converters".`);
    }

    // 3. Ищем конвертер в таблице наследника
    const convert = convertersMap.get(typeKey);

    if (!convert) {
      const typeName = typeof value === 'object' ? value.constructor.name : typeof value;
      throw new TypeError(`[${currentClassName}]: Тип "${typeName}" не поддерживается для приведения.`);
    }

    // 4. Вызываем конвертер и сразу возвращаем результат
    return convert(value);
  }  
}