import MathType from './MathType.js';

/**
 * Класс-обертка для логического типа данных (Boolean) в математическом движке.
 * Наследуется от базового класса типов MathType.
 * @extends MathType
 */
export default class BoolValue extends MathType {

  static typeId = Symbol.for('Math.BoolValue');  

  // Приватное поле для хранения вещественного значения
  #value;

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
        this.#value = isBoolValueInstance ? jsValue.#value : jsValue; 
    }
   
    get isBoolValue() { return true; }

    /**
     * Геттер для получения значения примитива
     */
    get value() {
        return this.#value;
    }
   
    toRawTeX(settings, locale = new Intl.NumberFormat().resolvedOptions().locale) { return `\\mathrm{${this.#value}}` }

    toString(settings) { return String(this.#value); }
  
  // ==========================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ПРИВЕДЕНИЯ ТИПОВ
  // ==========================================

  // Переменная для кэширования таблицы конвертеров
  static #localConverters = new Map([
    [Symbol.for('Math.BoolValue'), (val) => val],
    ['bool',                       (val) => new BoolValue(val)],
  ]);

  static get converters() { return BoolValue.#localConverters; }

  // ==========================================
  // МЕТОДЫ СРАВНЕНИЯ (Equality)
  // ==========================================

  /**
   * Строгое равенство
   * @param {BoolValue|boolean} other 
   * @returns {boolean}
   */
  equals(other) {
    try {
      return this.#value === BoolValue.from(other).#value;
    } catch {
      return false; // Если тип не приводимый, числа заведомо не равны
    }
  }

  // ==========================================
  // ОСНОВНЫЕ ЛОГИЧЕСКИЕ ОПЕРАЦИИ (СТРОКОВЫЕ КОМАНДЫ)
  // ==========================================

  /**
   * Логическое НЕ (Инверсия).
   * Команда: 'not' или оператор '!'
   * @returns {BoolValue} Инвертированное значение.
   */
  not() { return new BoolValue(!this.#value); }

  /**
   * Логическое И (Конъюнкция).
   * Команда: 'and' или оператор '&&'
   * @param {*} other - Второе значение (автоматически приводится к BoolValue).
   * @returns {BoolValue} Результат операции И.
   */
  and(other) {
   const right = BoolValue.from(other).value;
    return new BoolValue(this.#value && rightBool);
  }

  /**
   * Логическое ИЛИ (Дизъюнкция).
   * Команда: 'or' или оператор '||'
   * @param {*} other - Второе значение (автоматически приводится к BoolValue).
   * @returns {BoolValue} Результат операции ИЛИ.
   */
  or(other) {
   const right = BoolValue.from(other).value;
    return new BoolValue(this.#value || rightBool);
  }

  /**
   * Исключающее ИЛИ (XOR).
   * Команда: 'xor'
   * @param {*} other - Второе значение.
   * @returns {BoolValue} Результат операции XOR.
   */
  xor(other) {
   const right = BoolValue.from(other).value;
    return new BoolValue(this.#value !== rightBool);
  }

  // ==========================================
  // ОПЕРАЦИИ ОТНОШЕНИЯ (Relational Operators)
  // ==========================================

  eq(other) {
   const right = BoolValue.from(other).value;
    return this.#value === rightBool; 
  }

  not_eq(other) {
   const right = BoolValue.from(other).value;
    return this.#value !== rightBool; 
  }

  /**
   * Операция "Меньше" (<). false (0) меньше, чем true (1).
   * @param {*} other - Значение для сравнения.
   * @returns {boolean}
   */
  lt(other) {
   const right = BoolValue.from(other).value;
    return this.#value < rightBool; 
  }

  /**
   * Операция "Больше" (>). true (1) больше, чем false (0).
   * @param {*} other - Значение для сравнения.
   * @returns {boolean}
   */
  gt(other) {
   const right = BoolValue.from(other).value;
    return this.#value > rightBool; 
  }

  /**
   * Операция "Меньше или равно" (<=).
   * @param {*} other - Значение для сравнения.
   * @returns {boolean}
   */
  lte(other) { 
   const right = BoolValue.from(other).value;
    return this.#value <= rightBool; 
   }

  /**
   * Операция "Больше или равно" (>=).
   * @param {*} other - Значение для сравнения.
   * @returns {boolean}
   */
  gte(other) {
   const right = BoolValue.from(other).value;
    return this.#value >= rightBool; 
  }  
}