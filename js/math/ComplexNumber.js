import MathType from './MathType.js';

/**
 * Класс для работы с комплексными числами (a + bi).
 * Ориентирован на стандарты C++ и C#. Поддерживается всеми современными браузерами.
 */
export default class ComplexNumber extends MathType {
  // Приватные поля для инкапсуляции (защита от прямого изменения)
  #real;
  #imaginary;

  /**
   * Создает экземпляр комплексного числа.
   * @param {number} real - Действительная часть (Re)
   * @param {number} imaginary - Мнимая часть (Im)
   */
  constructor(real = 0, imaginary = 0) {
    super();
    this.#validateNumber(real, 'constructor (real)');
    this.#validateNumber(imaginary, 'constructor (imaginary)');
    this.#real = real;
    this.#imaginary = imaginary;
  }

  // ==========================================
  // ВНУТРЕННЯЯ ВАЛИДАЦИЯ
  // ==========================================
  
  #validateNumber(value, context) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new TypeError(`[ComplexNumber]: Аргумент в "${context}" должен быть валидным числом.`);
    }
  }

  #validateComplex(instance, context) {
    if (!(instance instanceof ComplexNumber)) {
      throw new TypeError(`[ComplexNumber]: Аргумент в "${context}" должен быть экземпляром класса ComplexNumber.`);
    }
  }

  // ==========================================
  // ГЕТТЕРЫ И СЕТТЕРЫ (Свойства)
  // ==========================================

  get real() {
    return this.#real;
  }

  set real(value) {
    this.#validateNumber(value, 'set real');
    this.#real = value;
  }

  get imaginary() {
    return this.#imaginary;
  }

  set imaginary(value) {
    this.#validateNumber(value, 'set imaginary');
    this.#imaginary = value;
  }

  // Модуль комплексного числа (r)
  get magnitude() {
    return Math.hypot(this.#real, this.#imaginary);
  }

  // Аргумент комплексного числа (угол фи в радианах от -PI до PI)
  get phase() {
    return Math.atan2(this.#imaginary, this.#real);
  }

  // Сопряженное число (a - bi)
  get conjugate() {
    return new ComplexNumber(this.#real, -this.#imaginary);
  }

  // ==========================================
  // МЕТОДЫ ФОРМАТИРОВАНИЯ И ВЫВОДА
  // ==========================================

  /**
   * Внутренний метод для фильтрации микро-ошибок округления JS.
   * Если число безумно близко к нулю (меньше 1e-15), возвращает чистый 0.
   */
  #cleanRound(value) {
    // 1e-15 — это стандартный порог точности для double precision
    return Math.abs(value) < 1e-15 ? 0 : value;
  }

  /**
   * Реализация базового метода: возвращает TeX БЕЗ знаков доллара
   */
  toRawTeX(locale = new Intl.NumberFormat().resolvedOptions().locale) {
    const r = this.#cleanRound(this.#real);
    const i = this.#cleanRound(this.#imaginary);

    // Сокращенный хелпер для форматирования частей числа через локаль
    const f = (num) => MathType.formatNumberToTeX(num, locale);

    // Если мнимой части нет, выводим только действительную
    if (i === 0) return f(r);

    const sign = i > 0 ? '+' : '-';
    const absI = Math.abs(i);
    
    // Формируем мнимую часть: просто "j" или "j\cdotФОРМАТ_ЧИСЛА"
    const jPart = absI === 1 ? 'j' : `j\\cdot${f(absI)}`;

    // Если действительная часть равна 0, знак "+" опускается, а "-" выводится перед "j"
    if (r === 0) {
      return i > 0 ? jPart : `-${jPart}`;
    }

    // Полная форма: "действительная [знак] мнимая"
    return `${f(r)} ${sign} ${jPart}`;
  }  

  /**
   * Стандартный вывод в формате строки "a + bi" с очисткой от погрешностей
   * @returns {string}
   */
  toString() {
    const r = this.#cleanRound(this.#real);
    const i = this.#cleanRound(this.#imaginary);

    if (i === 0) return `${r}`;
    if (r === 0) return `${i}i`;
    
    const sign = i > 0 ? '+' : '-';
    return `${r} ${sign} ${Math.abs(i)}i`;
  }

  // ==========================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ПРИВЕДЕНИЯ ТИПОВ
  // ==========================================

  /**
   * Приводит переданный аргумент (число или ComplexNumber) к типу ComplexNumber.
   * Позволяет методам прозрачно работать и со скалярами, и с комплексными числами.
   * @param {ComplexNumber|number} value 
   * @returns {ComplexNumber}
   */
  static #from(value) {
    if (value instanceof ComplexNumber) return value;
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return new ComplexNumber(value, 0);
    }
    throw new TypeError(`[ComplexNumber]: Невозможно привести аргумент к комплексному числу.`);
  }

  // ==========================================
  // АРИФМЕТИЧЕСКИЕ МЕТОДЫ ЭКЗЕМПЛЯРА (Instance Methods)
  // ==========================================

  /**
   * Реализация унарного минуса для комплексного числа
   */
  negate() {
    return new ComplexNumber(-this.real, -this.imaginary);
  } 

  /**
   * Сложение: (a + bi) + (c + di) = (a + c) + (b + d)i
   * @param {ComplexNumber|number} other 
   * @returns {ComplexNumber} Новый экземпляр
   */
  add(other) {
    try {
      const o = ComplexNumber.#from(other);
      return new ComplexNumber(this.#real + o.real, this.#imaginary + o.imaginary);
    } catch (e) {
      throw new TypeError(`[ComplexNumber]: Ошибка в методе .add(). ${e.message}`);
    }
  }

  /**
   * Вычитание: (a + bi) - (c + di) = (a - c) + (b - d)i
   * @param {ComplexNumber|number} other 
   * @returns {ComplexNumber} Новый экземпляр
   */
  subtract(other) {
    try {
      const o = ComplexNumber.#from(other);
      return new ComplexNumber(this.#real - o.real, this.#imaginary - o.imaginary);
    } catch (e) {
      throw new TypeError(`[ComplexNumber]: Ошибка в методе .subtract(). ${e.message}`);
    }
  }

  /**
   * Умножение: (a + bi) * (c + di) = (ac - bd) + (bc + ad)i
   * @param {ComplexNumber|number} other 
   * @returns {ComplexNumber} Новый экземпляр
   */
  multiply(other) {
    try {
      const o = ComplexNumber.#from(other);
      const r = this.#real * o.real - this.#imaginary * o.imaginary;
      const i = this.#imaginary * o.real + this.#real * o.imaginary;
      return new ComplexNumber(r, i);
    } catch (e) {
      throw new TypeError(`[ComplexNumber]: Ошибка в методе .multiply(). ${e.message}`);
    }
  }

  /**
   * Деление: (a + bi) / (c + di)
   * @param {ComplexNumber|number} other 
   * @returns {ComplexNumber} Новый экземпляр
   */
  divide(other) {
    try {
      const o = ComplexNumber.#from(other);
      const denominator = o.real * o.real + o.imaginary * o.imaginary;
      
      if (denominator === 0) {
        throw new RangeError("Деление на ноль (модуль делителя равен 0).");
      }

      const r = (this.#real * o.real + this.#imaginary * o.imaginary) / denominator;
      const i = (this.#imaginary * o.real - this.#real * o.imaginary) / denominator;
      return new ComplexNumber(r, i);
    } catch (e) {
      throw new TypeError(`[ComplexNumber]: Ошибка в методе .divide(). ${e.message}`);
    }
  }

  // ==========================================
  // МЕТОДЫ СРАВНЕНИЯ (Equality)
  // ==========================================

  /**
   * Строгое математическое равенство действительных и мнимых частей
   * @param {ComplexNumber|number} other 
   * @returns {boolean}
   */
  equals(other) {
    try {
      const o = ComplexNumber.#from(other);
      return this.#real === o.real && this.#imaginary === o.imaginary;
    } catch {
      return false; // Если тип не приводимый, числа заведомо не равны
    }
  }

  // ==========================================
  // СТАТИЧЕСКИЕ МЕТОДЫ (Static Methods как в C#)
  // ==========================================

  static add(left, right) {
    return ComplexNumber.#from(left).add(right);
  }

  static subtract(left, right) {
    return ComplexNumber.#from(left).subtract(right);
  }

  static multiply(left, right) {
    return ComplexNumber.#from(left).multiply(right);
  }

  static divide(left, right) {
    return ComplexNumber.#from(left).divide(right);
  }

  static equals(left, right) {
    return ComplexNumber.#from(left).equals(right);
  }
 
 // ==========================================
  // ЭКСПАНСИЯ: СТЕПЕНИ, КОРНИ, ЛОГАРИФМЫ (Instance)
  // ==========================================

  /**
   * Экспонента комплексного числа: e^(a + bi) = e^a * (cos(b) + i*sin(b))
   * @returns {ComplexNumber}
   */
  exp() {
    try {
      const expReal = Math.exp(this.#real);
      return new ComplexNumber(
        expReal * Math.cos(this.#imaginary),
        expReal * Math.sin(this.#imaginary)
      );
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .exp(). ${e.message}`);
    }
  }

  /**
   * Натуральный логарифм: ln(z) = ln(|z|) + i * arg(z)
   * @returns {ComplexNumber}
   */
  log() {
    try {
      if (this.#real === 0 && this.#imaginary === 0) {
        throw new RangeError("Логарифм нуля не определен.");
      }
      return new ComplexNumber(Math.log(this.magnitude), this.phase);
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .log(). ${e.message}`);
    }
  }

  /**
   * Квадратный корень комплексного числа (главное значение)
   * @returns {ComplexNumber}
   */
  sqrt() {
    try {
      const r = this.magnitude;
      // Используем стабильные формулы для исключения потери точности
      const realPart = Math.sqrt((r + this.#real) / 2);
      const imagPart = Math.sign(this.#imaginary || 1) * Math.sqrt((r - this.#real) / 2);
      return new ComplexNumber(realPart, imagPart);
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .sqrt(). ${e.message}`);
    }
  }

  /**
   * Возведение комплексного числа в степень другого числа (комплексного или вещественного)
   * Формула: z^w = exp(w * log(z))
   * @param {ComplexNumber|number} power - Степень
   * @returns {ComplexNumber}
   */
  pow(power) {
    try {
      if (this.#real === 0 && this.#imaginary === 0) {
        if (power === 0) return new ComplexNumber(1, 0); // 0^0 принято считать 1
        return new ComplexNumber(0, 0);
      }
      
      const p = ComplexNumber.#from(power);
      // z^w = exp(w * log(z))
      return this.log().multiply(p).exp();
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .pow(). ${e.message}`);
    }
  }

  accuratePow(other) {
    const p = ComplexNumber.#from(other);

    const EPSILON = 1e-15; 

    // Проверяем компоненты на "квази-вещественность" и "квази-целостность"
    const isBaseQuasiReal = Math.abs(this.#imaginary) < EPSILON;
    const isExpQuasiReal = Math.abs(other.imaginary) < EPSILON;
    const isExpQuasiInteger = Math.abs(other.imaginary) < EPSILON && Math.abs(other.real - Math.round(other.real)) < EPSILON;

    // --- СЛУЧАЙ 1: ОСНОВАНИЕ НА ВЕЩЕСТВЕННОЙ ОСИ (Обсудили на прошлом шаге) ---
    if (isBaseQuasiReal && isExpQuasiReal) {
      const b = this.real;
      const e = other.real;

      if (b < 0 && !Number.isInteger(e)) {
        const rational = MathType.toRational(Math.abs(e), EPSILON);
        if (rational.den % 2 !== 0) {
          const magnitudeResult = Math.pow(Math.abs(b), e);
          const sign = (rational.num % 2 === 0) ? 1 : -1;
          return new ComplexNumber(sign * magnitudeResult, 0);
        }
      }
      
      if (b > 0 || Number.isInteger(e)) {
        return new ComplexNumber(Math.pow(b, e), 0);
      }
    }

    // --- СЛУЧАЙ 2: ЧИСТО МНИМОЕ ОСНОВАНИЕ И ЦЕЛАЯ СТЕПЕНЬ (Наш новый случай) ---
    const isBaseQuasiImag = Math.abs(this.real) < EPSILON;
    
    if (isBaseQuasiImag && isExpQuasiInteger) {
      const y = this.imag;          // Получаем чистую мнимую часть (например, 2 из 2i)
      const n = Math.round(other.real); // Округляем до ближайшего честного целого

      // Находим чистый модуль возведения в степень
      const magnitude = Math.pow(Math.abs(y), n);
      
      // Определяем знак, если исходная мнимая часть была отрицательной (например, -2i)
      const signY = (y < 0 && n % 2 !== 0) ? -1 : 1;
      const finalMagnitude = magnitude * signY;

      // Анализируем остаток от деления степени на 4 для точного позиционирования на осях
      const mod = ((n % 4) + 4) % 4; // Корректная обработка отрицательных степеней

      switch (mod) {
        case 0: // i^0 = 1 -> Результат строго на вещественной оси
          return new ComplexNumber(finalMagnitude, 0);
        case 1: // i^1 = i -> Результат строго на мнимой оси
          return new ComplexNumber(0, finalMagnitude);
        case 2: // i^2 = -1 -> Результат строго на вещественной оси
          return new ComplexNumber(-finalMagnitude, 0);
        case 3: // i^3 = -i -> Результат строго на мнимой оси
          return new ComplexNumber(0, -finalMagnitude);
      }
    }

    // --- ОБЩИЙ СЛУЧАЙ ДЛЯ СЛОЖНЫХ КОМПЛЕКСНЫХ ЧИСЕЛ ---
    // Если число лежит вне осей (например, 2 + 3i), считаем через канонический логарифм
    return this.log().multiply(other).exp();    
  }

  // ==========================================
  // СТАТИЧЕСКИЕ АНАЛОГИ (Static)
  // ==========================================

  static exp(value) {
    return ComplexNumber.#from(value).exp();
  }

  static log(value) {
    return ComplexNumber.#from(value).log();
  }

  static sqrt(value) {
    return ComplexNumber.#from(value).sqrt();
  }

  static pow(base, power) {
    return ComplexNumber.#from(base).pow(power);
  }

  // ==========================================
  // ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ (Instance)
  // ==========================================

  /**
   * Синус комплексного числа: sin(z) = sin(a)*cosh(b) + i * cos(a)*sinh(b)
   * @returns {ComplexNumber}
   */
  sin() {
    try {
      const a = this.#real;
      const b = this.#imaginary;
      return new ComplexNumber(
        Math.sin(a) * Math.cosh(b),
        Math.cos(a) * Math.sinh(b)
      );
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .sin(). ${e.message}`);
    }
  }

  /**
   * Косинус комплексного числа: cos(z) = cos(a)*cosh(b) - i * sin(a)*sinh(b)
   * @returns {ComplexNumber}
   */
  cos() {
    try {
      const a = this.#real;
      const b = this.#imaginary;
      return new ComplexNumber(
        Math.cos(a) * Math.cosh(b),
        -Math.sin(a) * Math.sinh(b)
      );
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .cos(). ${e.message}`);
    }
  }

  /**
   * Тангенс комплексного числа: tan(z) = sin(z) / cos(z)
   * @returns {ComplexNumber}
   */
  tan() {
    try {
      return this.sin().divide(this.cos());
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .tan(). ${e.message}`);
    }
  }

  // ==========================================
  // ГИПЕРБОЛИЧЕСКИЕ ФУНКЦИИ (Instance)
  // ==========================================

  /**
   * Гиперболический синус: sinh(z) = sinh(a)*cos(b) + i * cosh(a)*sin(b)
   * @returns {ComplexNumber}
   */
  sinh() {
    try {
      const a = this.#real;
      const b = this.#imaginary;
      return new ComplexNumber(
        Math.sinh(a) * Math.cos(b),
        Math.cosh(a) * Math.sin(b)
      );
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .sinh(). ${e.message}`);
    }
  }

  /**
   * Гиперболический косинус: cosh(z) = cosh(a)*cos(b) + i * sinh(a)*sin(b)
   * @returns {ComplexNumber}
   */
  cosh() {
    try {
      const a = this.#real;
      const b = this.#imaginary;
      return new ComplexNumber(
        Math.cosh(a) * Math.cos(b),
        Math.sinh(a) * Math.sin(b)
      );
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .cosh(). ${e.message}`);
    }
  }

  /**
   * Гиперболический тангенс: tanh(z) = sinh(z) / cosh(z)
   * @returns {ComplexNumber}
   */
  tanh() {
    try {
      return this.sinh().divide(this.cosh());
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .tanh(). ${e.message}`);
    }
  }

  // ==========================================
  // ВЕКТОРНАЯ ГЕОМЕТРИЯ (Скалярное и Векторное произведение)
  // ==========================================

  /**
   * Скалярное произведение двух чисел (векторов): (a*c + b*d)
   * Определяет сонаправленность векторов и проекцию.
   * @param {ComplexNumber|number} other 
   * @returns {number} Возвращает скаляр (вещественное число)
   */
  dot(other) {
    try {
      const o = ComplexNumber.#from(other);
      return this.#real * o.real + this.#imaginary * o.imaginary;
    } catch (e) {
      throw new TypeError(`[ComplexNumber]: Ошибка в методе .dot(). ${e.message}`);
    }
  }

  /**
   * Модуль косого (векторного) произведения на плоскости: (a*d - b*c)
   * Равен площади параллелограмма, построенного на этих двух векторах.
   * Знак определяет направление поворота (ориентацию).
   * @param {ComplexNumber|number} other 
   * @returns {number} Возвращает скаляр (вещественное число)
   */
  cross(other) {
    try {
      const o = ComplexNumber.#from(other);
      return this.#real * o.imaginary - this.#imaginary * o.real;
    } catch (e) {
      throw new TypeError(`[ComplexNumber]: Ошибка в методе .cross(). ${e.message}`);
    }
  }

  // ==========================================
  // СТАТИЧЕСКИЕ АНАЛОГИ (Static)
  // ==========================================

  static sin(value) { return ComplexNumber.#from(value).sin(); }
  static cos(value) { return ComplexNumber.#from(value).cos(); }
  static tan(value) { return ComplexNumber.#from(value).tan(); }
  
  static sinh(value) { return ComplexNumber.#from(value).sinh(); }
  static cosh(value) { return ComplexNumber.#from(value).cosh(); }
  static tanh(value) { return ComplexNumber.#from(value).tanh(); }

  static dot(left, right) { return ComplexNumber.#from(left).dot(right); }
  static cross(left, right) { return ComplexNumber.#from(left).cross(right); }  
}
