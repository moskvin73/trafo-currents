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
        this.#value = isBoolValueInstance ? jsValue.value : jsValue; 
    }
   
    get isBoolValue() { return true; }

    /**
     * Геттер для получения значения примитива
     */
    get value() {
        return this.#value;
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
    ['bool',                       (val) => new BoolValue(val)],
  ]);

  static get converters() { return BoolValue.#localConverters; }

  // ==========================================
  // МЕТОДЫ СРАВНЕНИЯ (Equality)
  // ==========================================

  /**
   * Строгое математическое равенство (IEEE 754)
   * Корректно различает +0 и -0 для точных фазовых переходов 
   * и позволяет проверять идентичность NaN в юнит-тестах.
   * @param {BoolValue|oolean} other 
   * @returns {boolean}
   */
  equals(other) {
    try {
      return this.value === BoolValue.from(other).value;
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
  not() {
    return new BoolValue(!this.#value);
  }

  /**
   * Логическое И (Конъюнкция).
   * Команда: 'and' или оператор '&&'
   * @param {*} other - Второе значение (автоматически приводится к BoolValue).
   * @returns {BoolValue} Результат операции И.
   */
  and(other) {
    return new BoolValue(this.value && BoolValue.from(other).#value);
  }

  /**
   * Логическое ИЛИ (Дизъюнкция).
   * Команда: 'or' или оператор '||'
   * @param {*} other - Второе значение (автоматически приводится к BoolValue).
   * @returns {BoolValue} Результат операции ИЛИ.
   */
  or(other) {
    return new BoolValue(this.value || BoolValue.from(other).#value);
  }

  /**
   * Исключающее ИЛИ (XOR).
   * Команда: 'xor'
   * @param {*} other - Второе значение.
   * @returns {BoolValue} Результат операции XOR.
   */
  xor(other) {
    return new BoolValue(this.value !== BoolValue.from(other).#value);
  }
}