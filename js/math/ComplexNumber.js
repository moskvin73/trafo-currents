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
   * Стандартный вывод в формате строки "a + bi"
   * @returns {string}
   */
  toString() {
    if (this.#imaginary === 0) return `${this.#real}`;
    if (this.#real === 0) return `${this.#imaginary}i`;
    const sign = this.#imaginary > 0 ? '+' : '-';
    return `${this.#real} ${sign} ${Math.abs(this.#imaginary)}i`;
  }

  /**
   * Вывод формулы в формате LaTeX
   * @param {string} displayMode - Режим отображения: 'inline' ($...$) или 'block' ($$...$$)
   * @returns {string}
   */
  toTeX(displayMode = 'inline') {
    if (displayMode !== 'inline' && displayMode !== 'block') {
      throw new IllegalArgumentError('[ComplexNumber]: Метод toTeX принимает только "inline" или "block".');
    }
    
    let tex = '';
    if (this.#imaginary === 0) {
      tex = `${this.#real}`;
    } else if (this.#real === 0) {
      tex = `${this.#imaginary}i`;
    } else {
      const sign = this.#imaginary > 0 ? '+' : '-';
      tex = `${this.#real} ${sign} ${Math.abs(this.#imaginary)}i`;
    }

    return displayMode === 'block' ? `$$${tex}$$` : `$${tex}$`;
  }

  /**
   * Вывод формулы в стандарте MathML для отображения в браузерах
   * @param {boolean} isBlock - Обернуть ли в блочный контейнер (display="block")
   * @returns {string}
   */
  toMathML(isBlock = false) {
    const displayAttr = isBlock ? ' display="block"' : '';
    let content = '';

    if (this.#imaginary === 0) {
      content = `<mn>${this.#real}</mn>`;
    } else if (this.#real === 0) {
      content = `<mn>${this.#imaginary}</mn><mi>i</mi>`;
    } else {
      const sign = this.#imaginary > 0 ? '+' : '-';
      content = `
        <mn>${this.#real}</mn>
        <mo>${sign}</mo>
        <mn>${Math.abs(this.#imaginary)}</mn>
        <mi>i</mi>
      `.replace(/\s+/g, ' ').trim(); // очистка лишних пробелов для красоты
    }

    return `<math${displayAttr}>${content}</math>`;
  }

  // ==========================================
  // МЕСТО ДЛЯ БУДУЩИХ МЕТОДОВ (Алгебра, Тригонометрия)
  // ==========================================
  // Сюда мы будем последовательно внедрять add, sub, mul, div, pow, exp, sin, cos, sinh и т.д.
}
