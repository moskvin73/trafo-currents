import MathType from './MathType.js';

/**
 * Класс-обертка для логического типа данных (Boolean) в математическом движке.
 * Наследуется от базового класса типов MathType.
 * @extends MathType
 */
export default class BoolValue extends MathType {

  static typeId = Symbol.for('Math.BoolValue');  

    constructor(jsValue) {
        super();
        // Принудительно приводим к нативному true/false для безопасности
        this.value = !!jsValue; 
    }
   
  toRawTeX(settings, locale = new Intl.NumberFormat().resolvedOptions().locale) {
    throw new Error(`[MathType]: Метод toRawTeX() не реализован в классе ${this.constructor.name}`);
  }

  toString(settings) {
    throw new Error(`[MathType]: Метод toString() не реализован в классе ${this.constructor.name}`);
  }
  
  // ==========================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ПРИВЕДЕНИЯ ТИПОВ
  // ==========================================

  // Переменная для кэширования таблицы конвертеров
  static #localConverters = new Map([
    [Symbol.for('Math.BoolValue'), (val) => val],
    ['bool',                         (val) => new BoolValue(val)],
  ]);

  static get converters() { return BoolValue.#localConverters; }
}