import MathType from './MathType.js';
import ComplexNumber from './ComplexNumber.js';

/**
 * Класс для работы с чисто вещественными числами.
 * Защищает вычисления от комплексных ошибок округления.
 */
export default class RealNumber extends MathType {
  // Приватное поле для хранения вещественного значения
  #value;

  /**
   * @param {number} value - Вещественное число
   */
  constructor(value) {
    super();
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new TypeError('[RealNumber]: Значение аргумента должно быть валидным числом.');
    }
    this.#value = value;
  }

  /**
   * Геттер для получения значения примитива
   */
  get value() {
    return this.#value;
  }

  // ==========================================
  // НИЗКОУРОВНЕВАЯ АРИФМЕТИКА (Однородные типы)
  // ==========================================

  /**
   * Реализация унарного минуса для вещественного числа
   */
  negate() {
    return new RealNumber(-this.value);
  }

  /**
   * Внутренний метод сложения двух вещественных чисел
   */
  add(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция сложения невозможна с типом ${other.constructor.name}. Требуется семантическое приведение типов.`);
    }
    return new RealNumber(this.#value + other.value);
  }

  /**
   * Внутренний метод вычитания двух вещественных чисел
   */
  subtract(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция вычитания невозможна с типом ${other.constructor.name}.`);
    }
    return new RealNumber(this.#value - other.value);
  }

  /**
   * Внутренний метод умножения двух вещественных чисел
   */
  multiply(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция умножения невозможна с типом ${other.constructor.name}.`);
    }
    return new RealNumber(this.#value * other.value);
  }

  /**
   * Внутренний метод деления двух вещественных чисел
   */
  divide(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция деления невозможна с типом ${other.constructor.name}.`);
    }
    if (other.value === 0) {
      throw new RangeError("[RealNumber]: Деление на вещественный ноль.");
    }
    return new RealNumber(this.#value / other.value);
  }

  /**
   * Внутренний метод возведения в степень
   */
  pow(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция возведения в степень невозможна с типом ${other.constructor.name}.`);
    }
    
    // ВАЖНО: Если мы пытаемся возвести отрицательное вещественное число 
    // в дробную степень (например, (-4)^0.5), вещественного ответа не существует.
    // Класс сигнализирует об этом ошибкой, чтобы парсер перевёл вычисление в комплексное поле.
    if (this.#value < 0 && !Number.isInteger(other.value)) {
      throw new RangeError("[RealNumber]: Невозможно возвести отрицательное число в дробную степень в вещественном поле.");
    }
    
    return new RealNumber(Math.pow(this.#value, other.value));
  }


  accuratePow(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция возведения в степень невозможна с типом ${other.constructor.name}.`);
    }

      const b = this.#value;
      const e = other.value;

      if (b > 0) return new RealNumber(Math.pow(b, e));
      if (b === 0) return e === 0 ? new RealNumber(1) : new RealNumber(0);
      if (Number.isInteger(e)) return new RealNumber(Math.pow(b, e));

      // --- ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ ДЛЯ ОТРИЦАТЕЛЬНЫХ ОСНОВАНИЙ (b < 0) ---
      // Шаг 1: Пытаемся восстановить точную дробь из степени e
      const rational = MathType.toRational(Math.abs(e));
      
      // Шаг 2: Проверяем, является ли знаменатель (q) НЕЧЕТНЫМ
      if (rational.den % 2 !== 0) {
        // Математически существует строго вещественный корень!
        // Вычисляем корень из модуля числа, а затем восстанавливаем знак
        const magnitudeResult = Math.pow(Math.abs(b), e);
        
        // Знаменатель нечетный, знак зависит от числителя:
        // Если числитель четный (например, 2/3), минус исчезает: (-1)^(2/3) = 1
        // Если числитель нечетный (например, 1/3), минус сохраняется: (-1)^(1/3) = -1
        const sign = (rational.num % 2 === 0) ? 1 : -1;
        
        return new RealNumber(sign * magnitudeResult);
      }

      // Если знаменатель четный (например, 1/2, то есть sqrt(-1)), вещественного корня нет.
      // Вот теперь со спокойной совестью уходим в комплексную плоскость на главный лист.
      const complexBase = new ComplexNumber(b, 0);
      const complexExp = new ComplexNumber(e, 0);
      return complexBase.accuratePow(complexExp);
  }

  // ==========================================
  // ВЕЩЕСТВЕННЫЕ МАТЕМАТИЧЕСКИЕ ФУНКЦИИ
  // ==========================================

  sin()  { return new RealNumber(Math.sin(this.#value)); }
  cos()  { return new RealNumber(Math.cos(this.#value)); }
  tan()  { return new RealNumber(Math.tan(this.#value)); }
  exp()  { return new RealNumber(Math.exp(this.#value)); }
  
  sqrt() {
    if (this.#value < 0) {
      throw new RangeError("[RealNumber]: Квадратный корень из отрицательного числа не существует в вещественном поле.");
    }
    return new RealNumber(Math.sqrt(this.#value));
  }
  
  log() {
    if (this.#value <= 0) {
      throw new RangeError("[RealNumber]: Натуральный логарифм нуля или отрицательного числа не существует в вещественном поле.");
    }
    return new RealNumber(Math.log(this.#value));
  }

  log10() {
    if (this.#value <= 0) {
      throw new RangeError("[RealNumber]: Натуральный логарифм нуля или отрицательного числа не существует в вещественном поле.");
    }
    return new RealNumber(Math.log10(this.#value));
  }

  // ==========================================
  // МЕТОДЫ ВЫВОДА ФОРМАТА
  // ==========================================

  /**
   * Возвращает чистую строку TeX
   */
  toRawTeX(locale = new Intl.NumberFormat().resolvedOptions().locale) {
    return `${Math.abs(this.#value) < 1e-15 ? 0 : MathType.formatNumberToTeX(this.#value, locale)}`;
  }

  /**
   * Стандартный строковый вывод
   */
  toString() {
    return `${Math.abs(this.#value) < 1e-15 ? 0 : this.#value}`;
  }
}