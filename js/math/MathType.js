/**
 * Базовый класс для всех математических типов данных (Комплексные числа, Матрицы и т.д.).
 * Гарантирует единообразие вывода в текстовом и TeX форматах.
 */
export default class MathType {
  /**
   * Возвращает чистое TeX/LaTeX представление объекта (БЕЗ знаков $ или $$).
   * Этот метод будет использоваться внутри дерева парсера (AST) для сборки сложных формул.
   * @returns {string}
   */
  toRawTeX() {
    throw new Error(`[MathType]: Метод toRawTeX() не реализован в классе ${this.constructor.name}`);
  }

  /**
   * Возвращает стандартное текстовое представление объекта.
   * @returns {string}
   */
  toString() {
    throw new Error(`[MathType]: Метод toString() не реализован в классе ${this.constructor.name}`);
  }

  /**
   * Вспомогательный метод для полной TeX-обёртки (для обратной совместимости).
   * @param {string} displayMode - 'inline' ($...$) или 'block' ($$...$$)
   * @returns {string}
   */
  toTeX(displayMode = 'inline') {
    const raw = this.toRawTeX();
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
   * @param {number} num - Исходное число для форматирования.
   * @param {string} [locale] - Код локали (по умолчанию определяется автоматически).
   * @returns {string} Строка в формате TeX (например, "1,25" или "3,4\cdot10^{5}").
   */  
  static formatNumberToTeX(num, locale = new Intl.NumberFormat().resolvedOptions().locale) {
    // 1. Получаем разделитель для текущей локали системы
    const formatter = new Intl.NumberFormat(locale);
    const parts = formatter.formatToParts(1.1);
    const separator = parts.find(part => part.type === 'decimal')?.value || '.';

    // 2. Преобразуем число в строку
    const str = num.toString();
    const eIndex = str.indexOf('e');
    const localize = (val) => val.replace('.', separator);

    // 3. Форматируем обычное число
    if (eIndex === -1) {
      return localize(str);
    }

    // 4. Форматируем научную нотацию
    const mantissa = str.slice(0, eIndex);
    let exponent = str.slice(eIndex + 1);

    if (exponent.startsWith('+')) {
      exponent = exponent.slice(1);
    }

    return `${localize(mantissa)}\\cdot10^{${exponent}}`;
  }
}