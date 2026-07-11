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
    if (typeof value !== 'number') {
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
  // АРИФМЕТИЧЕСКИЕ МЕТОДЫ ЭКЗЕМПЛЯРА (Instance Methods)
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

  // ==========================================
  // МЕТОДЫ СРАВНЕНИЯ (Equality)
  // ==========================================

  /**
   * Строгое математическое равенство
   * @param {ComplexNumber|number} other 
   * @returns {boolean}
   */
  equals(other) {
    if (!(other instanceof RealNumber)) return false;
    if (typeof other === 'number') return this.#value === other;
    return this.#value === other.value;
  }  

  // ==========================================
  // ЭКСПАНСИЯ: СТЕПЕНИ, КОРНИ, ЛОГАРИФМЫ (Instance)
  // ==========================================

  exp()  { return new RealNumber(Math.exp(this.#value)); }

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
  
  /**
   * Вычисление корня n-й степени. По умолчанию n = 2 (квадратный корень)
   * @param {number|RealNumber} nParam - степень корня
   */
  sqrt(nParam = 2) {
    const n = nParam instanceof RealNumber ? nParam.value : nParam;

    if (n === 0) {
      throw new RangeError("[RealNumber Error]: Корень 0-й степени математически не определен.");
    }

    // Вычисляем чистую экспоненту степени: корень n-й степени — это степень (1 / n)
    const expValue = 1 / n;

    // ОПТИМИЗАЦИЯ 1: Если expValue === 0.5 (значит n === 2), это КВАДРАТНЫЙ КОРЕНЬ
    if (expValue === 0.5) {
      if (this.#value >= 0) {
        return new RealNumber(Math.sqrt(this.#value));
      }
      // Фазовый переход для отрицательных чисел при квадратном корне
      return new ComplexNumber(0, Math.sqrt(Math.abs(this.#value)));
    }

    // ОПТИМИЗАЦИЯ 2: Если expValue === 1 (значит n === 1), корень 1-й степени равен самому числу
    if (expValue === 1) {
      return this;
    }

    // ОПТИМИЗАЦИЯ 3: Если expValue === 2 (значит n === 0.5), это ВОЗВЕДЕНИЕ В КВАДРАТ
    if (expValue === 2) {
      return new RealNumber(this.#value * this.#value);
    }

    // ОБЩИЙ СЛУЧАЙ ДЛЯ ВСЕХ ОСТАЛЬНЫХ СТЕПЕНЕЙ КОРНЯ (n = 3, 4, ...)
    // Передаем объект степени в ваш точный метод точного возведения в степень
    return this.accuratePow(new RealNumber(expValue));
  }
  
  /**
   * Интеллектуальный натуральный логарифм ln(x)
   */
  log() {
    // 1. Для строго положительных чисел считаем стандартно
    if (this.#value > 0) {
      return new RealNumber(Math.log(this.#value));
    }

    // 2. ИСПРАВЛЕНО: Для нуля возвращаем объект со значением -Infinity
    if (this.#value === 0) {
      return new RealNumber(-Infinity);
    }

    // 3. Для отрицательных уходим в комплексную плоскость: ln(|x|) + i * pi
    const realPart = Math.log(Math.abs(this.#value));
    const imagPart = Math.PI;
    
    return new ComplexNumber(realPart, imagPart);
  }

  /**
   * Интеллектуальный десятичный логарифм lg(x)
   */
  log10() {
    if (this.#value > 0) {
      return new RealNumber(Math.log10(this.#value));
    }

    // 2. ИСПРАВЛЕНО: lg(0) = -Infinity
    if (this.#value === 0) {
      return new RealNumber(-Infinity);
    }

    // 3. Для отрицательных переходим через комплексный натуральный логарифм: ln(x) / ln(10)
    const complexLn = this.log(); // Получаем ComplexNumber
    const ln10 = Math.log(10);
    
    return new ComplexNumber(complexLn.real / ln10, complexLn.imaginary / ln10);
  }

  /**
   * Интеллектуальный логарифм по произвольному основанию Log(value, base)
   */
  logBase(other) {
    const baseVal = other instanceof RealNumber ? other.value : other;

        // Точка неопределенности: log0(0) = NaN
    if (this.#value === 0 && baseVal === 0) {
      return new RealNumber(NaN);
    }

    // 1. Если само значение равно 0, результат в любом хорошем основании равен -Infinity
    if (this.#value === 0) {
      if (baseVal > 1) return new RealNumber(-Infinity);
      if (baseVal > 0 && baseVal < 1) return new RealNumber(Infinity); // log_{0.5}(0) = +Infinity
    }

    // 2. Проверка сингулярностей основания логарифма
    if (baseVal <= 0 || baseVal === 1) {
      // Если основание проблемное, полностью делегируем вычисления в комплексное поле
      const complexBase = new ComplexNumber(baseVal, 0);
      const complexValue = new ComplexNumber(this.#value, 0);
      return complexValue.logBase(complexBase);
    }

    // 3. Если основание корректно (base > 0, base != 1), а значение отрицательное
    if (this.#value < 0) {
      const complexLnValue = this.log(); // Наш комплексный ln(x)
      const lnBase = Math.log(baseVal);
      
      return new ComplexNumber(complexLnValue.real / lnBase, complexLnValue.imaginary / lnBase);
    }

    // 4. Идеальный стандартный случай
    const result = Math.log(this.#value) / Math.log(baseVal);
    return new RealNumber(result);
  }

  // ==========================================
  // ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ (Instance)
  // ==========================================

  sin()  { return new RealNumber(Math.sin(this.#value)); }
  cos()  { return new RealNumber(Math.cos(this.#value)); }
  tan()  { return new RealNumber(Math.tan(this.#value)); }

  // ==========================================
  // ГИПЕРБОЛИЧЕСКИЕ ФУНКЦИИ (Instance)
  // ==========================================

  sinh() { return new RealNumber(Math.sinh(this.#value)); }

  cosh() { return new RealNumber(Math.cosh(this.#value)); }

  tanh() { return new RealNumber(Math.tanh(this.#value)); }

  // #region ОБРАТНЫЕ ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ
  // ==========================================
  // ОБРАТНЫЕ ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ (Instance)
  // ==========================================
 
   /**
   * Интеллектуальный Арксинус
   */
  arcsin() {
    // 1. Стандартный вещественный случай
    if (Math.abs(this.#value) <= 1) {
      return new RealNumber(Math.asin(this.#value));
    }

    // 2. Фазовый переход на комплексную плоскость для |x| > 1
    const x = this.#value;
    const sign = x > 0 ? 1 : -1;
    
    // Вещественная часть строго равна +pi/2 или -pi/2
    const realPart = (Math.PI / 2) * sign;
    // Мнимая часть рассчитывается через натуральный логарифм
    const imagPart = -sign * Math.log(Math.abs(x) + Math.sqrt(x * x - 1));

    return new ComplexNumber(realPart, imagPart);
  }

  /**
   * Интеллектуальный Ареасинус (Гиперболический арксинус)
   * Функция определена на всей вещественной оси (-inf; +inf), поэтому всегда возвращает RealNumber
   */
  arcsinh() {
    // Математическая формула: arcsinh(x) = ln(x + sqrt(x^2 + 1))
    // Используем Math.asinh для максимальной скорости встроенного движка V8
    return new RealNumber(Math.asinh(this.#value));
  }
   
   /**
   * Интеллектуальный Арккосинус с фазовым переходом (|x| > 1)
   */
  arccos() {
    const x = this.#value;

    // 1. Стандартный вещественный случай
    if (Math.abs(x) <= 1) {
      return new RealNumber(Math.acos(x));
    }

    // 2. Фазовый переход для x > 1 (вещественная часть становится строго 0)
    if (x > 1) {
      const imagPart = -Math.log(x + Math.sqrt(x * x - 1));
      return new ComplexNumber(0, imagPart);
    }

    // 3. Фазовый переход для x < -1 (вещественная часть становится строго PI)
    // Симметричный разрез плоскости
    const imagPart = Math.log(Math.abs(x) + Math.sqrt(x * x - 1));
    return new ComplexNumber(Math.PI, imagPart);
  }

  /**
   * Интеллектуальный Арекосинус (Гиперболический арккосинус)
   * Область определения в вещественном поле: [1; +inf)
   */
  arccosh() {
     const x = this.#value;

    // 1. Стандартный вещественный случай (x >= 1)
    if (x >= 1) {
      return new RealNumber(Math.acosh(x));
    }

    // 2. Фазовый переход на мнимую ось в интервале [-1; 1)
    // Сюда идеально попадает ваш кейс x = -0.5
    if (x > -1) {
      const imagPart = Math.acos(x); // Для -0.5 это даст ровно 2.094395... (2*pi/3)
      return new ComplexNumber(0, imagPart);
    }

    // 3. Фазовый переход для чисел строго левее критической точки (x <= -1)
    // Вот теперь под корнем гарантированно положительное число (например, для -2: 4 - 1 = 3)
    const realPart = Math.log(Math.abs(x) + Math.sqrt(x * x - 1));
    return new ComplexNumber(realPart, Math.PI);
  } 

  /**
   * Интеллектуальный Арктангенс
   * В вещественном поле определен на всей оси, фазовых переходов нет
   */
  arctan() {
    return new RealNumber(Math.atan(this.#value));
  }

  /**
   * Интеллектуальный Аретангенс (Гиперболический арктангенс)
   * Область определения в вещественном поле строго (-1; 1)
   */
  arctanh() {
    const x = this.#value;

    // 1. Точки сингулярности (Асимптоты): arctanh(1) = +Infinity, arctanh(-1) = -Infinity
    if (x === 1) return new RealNumber(Infinity);
    if (x === -1) return new RealNumber(-Infinity);

    // 2. Стандартный вещественный случай (-1 < x < 1)
    if (Math.abs(x) < 1) {
      return new RealNumber(Math.atanh(x));
    }

    // 3. Фазовый переход для x > 1
    if (x > 1) {
      const realPart = 0.5 * Math.log((x + 1) / (x - 1));
      return new ComplexNumber(realPart, -Math.PI / 2);
    }

    // 4. Фазовый переход для x < -1
    // Знаменатель и числитель меняются местами, чтобы под логарифмом было положительное число
    const realPart = 0.5 * Math.log((1 + x) / (1 - x));
    return new ComplexNumber(realPart, Math.PI / 2);
  }  
  // #endregion

  // ==========================================
  // ВЕКТОРНАЯ ГЕОМЕТРИЯ (Скалярное и Векторное произведение)
  // ==========================================

  dot(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция невозможна с типом ${other.constructor.name}.`);
    }
    return new RealNumber(this.#value * other.value);
  }

  cross(other) {
    if (!(other instanceof RealNumber)) {
      throw new TypeError(`[RealNumber]: Операция невозможна с типом ${other.constructor.name}.`);
    }
    return new RealNumber(0);
  }

  // ==========================================
  // МЕТОДЫ ВЫВОДА ФОРМАТА
  // ==========================================

  /**
   * Возвращает чистую строку TeX
   */
  toRawTeX(locale = new Intl.NumberFormat().resolvedOptions().locale) {
    return `${Math.abs(this.#value) < MathType.EPSILON ? 0 : MathType.formatNumberToTeX(this.#value, locale)}`;
  }

  /**
   * Стандартный строковый вывод
   */
  toString() {
    return `${Math.abs(this.#value) < MathType.EPSILON ? 0 : this.#value}`;
  }
}