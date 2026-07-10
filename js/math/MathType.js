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

   /**
   * Возвращает новый математический объект с инвертированным знаком.
   * @returns {MathType}
   */
  negate() {
    throw new Error(`[MathType]: Метод negate() не реализован в классе ${this.constructor.name}`);
  } 
}