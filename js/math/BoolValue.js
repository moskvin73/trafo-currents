import MathType from './MathType.js';

/**
 * Класс-обертка для логического типа данных (Boolean) в математическом движке.
 * Наследуется от базового класса типов MathType.
 * @extends MathType
 */
export default class BoolValue extends MathType {

  static typeId = Symbol.for('Math.BoolValue');  
   /**
   * Создает экземпляр логического значения.
   * @param {boolean|BoolValue} jsValue - Только нативный boolean или другой экземпляр BoolValue.
   * @throws {TypeError} Если передан аргумент неверного типа.
   */
    constructor(jsValue) {
        super();
        // Проверяем: это нативный true/false?
        const isNativeBool = typeof jsValue === 'boolean';
        
        // Проверяем: это уже существующий объект нашего класса BoolValue?
        const isBoolValueInstance = jsValue instanceof BoolValue;

        // СТРОГОЕ ОГРАНИЧЕНИЕ: если ни то, ни другое — кидаем TypeError
        if (!isNativeBool && !isBoolValueInstance) {
            throw new TypeError(
            `[BoolValue]: Неверный тип аргумента. Ожидался нативный boolean или BoolValue, получено: ${typeof jsValue}`
        );}
    
        // Безопасно сохраняем чистое значение true/false
        this.value = isBoolValueInstance ? jsValue.value : jsValue; 
    }
   
  toRawTeX(settings, locale = new Intl.NumberFormat().resolvedOptions().locale) {
    throw new Error(`[MathType]: Метод toRawTeX() не реализован в классе ${this.constructor.name}`);
  }

  toString(settings) {
    return String(this.value);
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