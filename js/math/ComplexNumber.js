/**
 * Класс для работы с комплексными числами (a + bi).
 * Ориентирован на стандарты C++ и C#. Поддерживается всеми современными браузерами.
 */
export default class ComplexNumber {
  // Приватные поля для инкапсуляции (защита от прямого изменения)
  #real;
  #imaginary;

  /**
   * Создает экземпляр комплексного числа.
   * @param {number} real - Действительная часть (Re)
   * @param {number} imaginary - Мнимая часть (Im)
   */
  constructor(real = 0, imaginary = 0) {
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

  /**
   * Вывод формулы в формате LaTeX с фильтрацией микро-ошибок
   * @param {string} displayMode - Режим отображения: 'inline' ($...$) или 'block' ($$...$$)
   * @returns {string}
   */
  toTeX(displayMode = 'inline') {
    if (displayMode !== 'inline' && displayMode !== 'block') {
      throw new Error('[ComplexNumber]: Метод toTeX принимает только "inline" или "block".');
    }
    
    const r = this.#cleanRound(this.#real);
    const i = this.#cleanRound(this.#imaginary);

    let tex = '';
    if (i === 0) {
      tex = `${r}`;
    } else if (r === 0) {
      tex = `${i}i`;
    } else {
      const sign = i > 0 ? '+' : '-';
      tex = `${r} ${sign} ${Math.abs(i)}i`;
    }

    return displayMode === 'block' ? `$$${tex}$$` : `$${tex}$`;
  }

  /**
   * Вывод формулы в стандарте MathML с фильтрацией микро-ошибок
   * @param {boolean} isBlock - Обернуть ли в блочный контейнер (display="block")
   * @returns {string}
   */
  toMathML(isBlock = false) {
    const displayAttr = isBlock ? ' display="block"' : '';
    const r = this.#cleanRound(this.#real);
    const i = this.#cleanRound(this.#imaginary);
    
    let content = '';

    if (i === 0) {
      content = `<mn>${r}</mn>`;
    } else if (r === 0) {
      content = `<mn>${i}</mn><mi>i</mi>`;
    } else {
      const sign = i > 0 ? '+' : '-';
      content = `
        <mn>${r}</mn>
        <mo>${sign}</mo>
        <mn>${Math.abs(i)}</mn>
        <mi>i</mi>
      `.replace(/\s+/g, ' ').trim();
    }

    return `<math${displayAttr}>${content}</math>`;
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
}
