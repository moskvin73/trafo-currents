import MathType from './MathType.js';
import RealNumber from './RealNumber.js';

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
    if (typeof value !== 'number') {
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
    // Защита: если одна из компонент NaN, возвращаем чистый (NaN, NaN)
    if (Number.isNaN(this.#real) || Number.isNaN(this.#imaginary)) {
      return new ComplexNumber(NaN, NaN);
    }
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
    if (Number.isNaN(value) || !isFinite(value)) return value;
    
    if (Math.abs(value) < MathType.EPSILON) {
      // Проверяем исходный знак числа, чтобы вернуть -0 или +0
      return (1 / value === -Infinity) ? -0 : 0;
    }
    return value;
  }

  /**
   * Реализация базового метода: возвращает TeX БЕЗ знаков доллара
   */
  toRawTeX(locale = new Intl.NumberFormat().resolvedOptions().locale) {
    // Если число полностью сломано, возвращаем строку NaN
    if (Number.isNaN(this.#real) || Number.isNaN(this.#imaginary)) return 'NaN';

    const r = this.#cleanRound(this.#real);
    const i = this.#cleanRound(this.#imaginary);

    // Хелпер для проверки, является ли число положительным/отрицательным нулем
    const isNegativeZero = (num) => num === 0 && (1 / num === -Infinity);

    const f = (num) => MathType.formatNumberToTeX(num, locale);

    // Мнимой части нет вообще (и она не является -0, который важен для отображения)
    if (i === 0 && !isNegativeZero(i)) return f(r);

    // Определяем знак перед мнимой частью
    // Если i < 0 или i является отрицательным нулем (-0), то знак минус
    const isNeg = i < 0 || isNegativeZero(i);
    const sign = isNeg ? '-' : '+';
    const absI = Math.abs(i); // Math.abs(-0) дает 0
    
    // Формируем мнимую часть: просто "j" или "j\cdotФОРМАТ_ЧИСЛА"
    const jPart = absI === 1 ? 'j' : `j\\cdot${f(absI)}`;

    // Если действительная часть равна 0 (и не -0), выводим только мнимую
    if (r === 0 && !isNegativeZero(r)) {
      return isNeg ? `-${jPart}` : jPart;
    }

    // Полная форма: "действительная [знак] мнимая"
    return `${f(r)} ${sign} ${jPart}`;
  }  

  /**
   * Стандартный вывод в формате строки "a + bi" с очисткой от погрешностей
   * @returns {string}
   */
  toString() {
    if (Number.isNaN(this.#real) || Number.isNaN(this.#imaginary)) return 'NaN';

    const r = this.#cleanRound(this.#real);
    const i = this.#cleanRound(this.#imaginary);
    
    const isNegativeZero = (num) => num === 0 && (1 / num === -Infinity);

    if (i === 0 && !isNegativeZero(i)) return `${r}`;
    
    const isNeg = i < 0 || isNegativeZero(i);
    if (r === 0 && !isNegativeZero(r)) {
      return isNeg ? `-${Math.abs(i)}i` : `${i}i`;
    }
    
    const sign = isNeg ? '-' : '+';
    return `${r} ${sign} ${Math.abs(i)}i`;
  }

  // ==========================================
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ПРИВЕДЕНИЯ ТИПОВ
  // ==========================================

  // Универсальная таблица приведения по имени типа
  static #converters = new Map([
    ['ComplexNumber', (val) => val],
    ['number',        (val) => new ComplexNumber(val, 0)],
    ['RealNumber',    (val) => new ComplexNumber(val.value, 0)]
    // Перспектива: легко добавить новые типы прямо по их имени:
    // ['BigInt',     (val) => new ComplexNumber(Number(val), 0)],
    // ['Vector2D',   (val) => new ComplexNumber(val.x, val.y)]
  ]);

  /** 
   * Приводит переданный аргумент (число или ComplexNumber) к типу ComplexNumber.
   * Позволяет методам прозрачно работать и со скалярами, и с комплексными числами.
   * @param {ComplexNumber|number|RealNumber} value 
   * @returns {ComplexNumber}
   */
  static #from(value) {
    // 1. Защита от null/undefined, чтобы безопасно читать свойства
    if (value === null || value === undefined) {
      throw new TypeError(`[ComplexNumber]: Невозможно привести ${value} к комплексному числу.`);
    }

    // 2. Определяем имя типа (строку) для поиска в Map
    const typeKey = typeof value === 'object' ? value.constructor.name : typeof value;

    // 3. Ищем конвертер в таблице
    const convert = this.#converters.get(typeKey);

    // 4. Если типа нет в таблице — сразу выбрасываем ошибку
    if (!convert) {
      throw new TypeError(`[ComplexNumber]: Тип "${typeKey}" не поддерживается для приведения.`);
    }

    // 5. Вызываем конвертер
    const result = convert(value);

    // 6. Финальная валидация (проверяем, что на выходе валидный инстанс и внутри нет NaN)
    if (result instanceof ComplexNumber) {// && !Number.isNaN(result.real) && !Number.isNaN(result.imag)) {
      return result;
    }

    throw new TypeError(`[ComplexNumber]: Ошибка валидации приведения для типа "${typeKey}".`);
  }

  // #region АРИФМЕТИЧЕСКИЕ МЕТОДЫ
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
   * Возвращает обратную величину комплексного числа (1 / z).
   * Полностью соответствует стандартам IEEE 754 и ISO C99.
   * @returns {ComplexNumber} Новое комплексное число.
   */
  inverse() {
    const x = this.#real;
    const y = this.#imaginary;

    // 0. ПРЕДОХРАНИТЕЛЬ: Если хотя бы одна компонента NaN, строго возвращаем (NaN, NaN)
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return new ComplexNumber(NaN, NaN);
    }    

    // 1. Быстрая проверка на чистый ноль (модуль = 0)
    // 2. Быстрая проверка на бесконечности
    // Для пограничных состояний перенаправляем вызов в наш пуленепробиваемый .divide(),
    // чтобы гарантировать идеальное распределение знаков бесконечностей и нулей на разрезах фазы.
    if ((x === 0 && y === 0) || !isFinite(x) || !isFinite(y)) {
      return new ComplexNumber(1, 0).divide(this);
    }

    // 3. Высокопроизводительный алгоритм Смита для обычных конечных чисел
    // Защищает от ложного переполнения (overflow) при больших координатах
    if (Math.abs(x) >= Math.abs(y)) {
      const ratio = y / x;
      const denominator = x + y * ratio;
      return new ComplexNumber(1 / denominator, -ratio / denominator);
    } else {
      const ratio = x / y;
      const denominator = y + x * ratio;
      return new ComplexNumber(ratio / denominator, -1 / denominator);
    }
  }

  /**
   * Сложение: (a + bi) + (c + di) = (a + c) + (b + d)i
   * @param {ComplexNumber|number} other 
   * @returns {ComplexNumber} Новый экземпляр
   */
  add(other) {
    try {
      const o = ComplexNumber.#from(other);
      
      const r1 = this.#real;
      const i1 = this.#imaginary;
      const r2 = o.real;
      const i2 = o.imaginary;

      // 1. Изоляция NaN: если хоть одна компонента NaN, весь результат становится (NaN, NaN)
      if (Number.isNaN(r1) || Number.isNaN(i1) || Number.isNaN(r2) || Number.isNaN(i2)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 2. Считаем базовые компоненты
      const realResult = r1 + r2;
      const imagResult = i1 + i2;

      // 3. Проверка на конфликт бесконечностей (Infinity - Infinity)
      // Если в процессе сложения где-то получился NaN, сбрасываем в (NaN, NaN) весь объект
      if (Number.isNaN(realResult) || Number.isNaN(imagResult)) {
        return new ComplexNumber(NaN, NaN);
      }

      return new ComplexNumber(realResult, imagResult);
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
      
      const r1 = this.#real;
      const i1 = this.#imaginary;
      const r2 = o.real;
      const i2 = o.imaginary;

      // 1. Изоляция NaN: если хоть одна входная компонента NaN, весь результат становится (NaN, NaN)
      if (Number.isNaN(r1) || Number.isNaN(i1) || Number.isNaN(r2) || Number.isNaN(i2)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 2. Считаем базовые компоненты вычитания
      const realResult = r1 - r2;
      const imagResult = i1 - i2;

      // 3. Проверка на конфликт бесконечностей (например, Infinity - Infinity)
      // Если в процессе вычитания где-то сгенерировался NaN, сбрасываем в (NaN, NaN) весь объект
      if (Number.isNaN(realResult) || Number.isNaN(imagResult)) {
        return new ComplexNumber(NaN, NaN);
      }

      return new ComplexNumber(realResult, imagResult);
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
      // 0. Строгое приведение типов через вашу фабрику
      const o = ComplexNumber.#from(other);

      const a = this.#real;
      const b = this.#imaginary;
      const c = o.real;
      const d = o.imaginary;

      // 1. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 2. Рассчитываем базовые произведения по стандартной формуле
      let ac = a * c;
      let bd = b * d;
      let bc = b * c;
      let ad = a * d;

      let r = ac - bd;
      let i = bc + ad;

      // 3. ОБРАБОТКА БЕСКОНЕЧНОСТЕЙ (Устраняем ложные NaN по стандарту ISO C99)
      // Если в процессе умножения получился NaN (например, из-за операции 0 * Infinity),
      // но при этом изначально хотя бы ОДНО число было бесконечным — результат ОБЯЗАН быть бесконечным!
      if (Number.isNaN(r) || Number.isNaN(i)) {
        const isThisInf = !isFinite(a) || !isFinite(b);
        const isOtherInf = !isFinite(c) || !isFinite(d);

        if (isThisInf || isOtherInf) {
          // Если мы умножаем бесконечность на ноль (или NaN), стандарт ISO C99 требует
          // превратить все неопределенные промежуточные произведения (NaN) в чистые нули,
          // чтобы они не уничтожили знаки доминирующих бесконечностей.
          ac = Number.isNaN(ac) ? 0 : ac;
          bd = Number.isNaN(bd) ? 0 : bd;
          bc = Number.isNaN(bc) ? 0 : bc;
          ad = Number.isNaN(ad) ? 0 : ad;

          // Пересчитываем компоненты со сброшенными NaN
          r = ac - bd;
          i = bc + ad;

          // Направляем бесконечности строго по знакам, исключая "полу-конечные" состояния
          // Результатом умножения бесконечного вектора всегда является бесконечный вектор
          const getSign = (val) => (val === 0 ? (1 / val === -Infinity ? -1 : 1) : Math.sign(val));
          
          // Финальное распределение знаков направленных бесконечностей
          const finalR = !isFinite(r) ? r : (getSign(r) * Infinity);
          const finalI = !isFinite(i) ? i : (getSign(i) * Infinity);

          return new ComplexNumber(finalR, finalI);
        }

        // Если бесконечностей на входе не было, значит NaN легитимен (например, операции с NaN)
        return new ComplexNumber(NaN, NaN);
      }

      // 4. Обычный расчет для конечных чисел
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
      
      const x1 = this.#real;
      const y1 = this.#imaginary;
      const x2 = o.real;
      const y2 = o.imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(x1) || Number.isNaN(y1) || Number.isNaN(x2) || Number.isNaN(y2)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 1. Обработка деления на чистый ноль (модуль делителя = 0)
      if (x2 === 0 && y2 === 0) {
        if (x1 === 0 && y1 === 0) {
          return new ComplexNumber(NaN, NaN);
        }
        
        // Правильное извлечение знака в IEEE 754 (с учётом -0)
        const getSign = (val) => (val === 0 ? (1 / val === -Infinity ? -1 : 1) : Math.sign(val));
        
        const sX1 = getSign(x1);
        const sY1 = getSign(y1);
        const sX2 = getSign(x2);
        const sY2 = getSign(sY2); // Исправлено: берем знак y2, а не рекурсию знака

        // Каноническое раскрытие знаков бесконечностей при делении на комплексный ноль
        // Формула знака Re: sign(x1)*sign(x2) + sign(y1)*sign(y2)
        // Но так как это бесконечность, мы проверяем перекрестные знаки в чистом виде
        const signR = sX1 * sX2 + sY1 * sY2;
        const signI = sY1 * sX2 - sX1 * sY2;

        // Если знаки сбалансировались в 0 (например, Inf - Inf), берем знак доминирующей компоненты,
        // либо, по стандарту, если делили на чистый вещественный ноль (y2 === 0), то:
        const r = (x1 * x2 + y1 * y2) >= 0 ? Infinity : -Infinity;
        const i = (y1 * x2 - x1 * y2) >= 0 ? Infinity : -Infinity;
        
        // Для тригонометрии самый надежный промышленный способ на JS:
        // Если делим на комплексный ноль, обе компоненты улетают в бесконечность,
        // но знаки должны строго подчиняться функции getSign, минуя баг сложения нулей JS:
        const finalR = (sX1 * sX2 >= 0) ? Infinity : -Infinity;
        const finalI = (sY1 * sX2 >= 0) ? Infinity : -Infinity;

        // Однако, если одна из частей делимого была чистым нулем, 
        // стандарт требует точного распределения знаков:
        const realSign = (x1 * x2 + y1 * y2) >= 0 || Object.is(x1 * x2 + y1 * y2, 0) ? 1 : -1;
        const imagSign = (y1 * x2 - x1 * y2) >= 0 || Object.is(y1 * x2 - x1 * y2, 0) ? 1 : -1;

        return new ComplexNumber(
          (x1 === 0 && y1 === 0) ? NaN : (realSign > 0 ? Infinity : -Infinity),
          (x1 === 0 && y1 === 0) ? NaN : (imagSign > 0 ? Infinity : -Infinity)
        );
      }

      // 2. Обработка бесконечностей в делителе (теперь здесь гарантированно нет NaN)
      if (!isFinite(x2) || !isFinite(y2)) {
        if (!isFinite(x1) || !isFinite(y1)) {
          return new ComplexNumber(NaN, NaN);
        }
        return new ComplexNumber(0, -0);
      }

      // 3. Безопасный алгоритм Смита для обычных чисел
      if (Math.abs(x2) >= Math.abs(y2)) {
        const ratio = y2 / x2;
        const denominator = x2 + y2 * ratio;
        
        const r = (x1 + y1 * ratio) / denominator;
        const i = (y1 - x1 * ratio) / denominator;
        return new ComplexNumber(r, i);
      } else {
        const ratio = x2 / y2;
        const denominator = y2 + x2 * ratio;
        
        const r = (x1 * ratio + y1) / denominator;
        const i = (y1 * ratio - x1) / denominator;
        return new ComplexNumber(r, i);
      }

    } catch (e) {
      throw new TypeError(`[ComplexNumber]: Ошибка в методе .divide(). ${e.message}`);
    }
  }

  // #endregion

  // #region МЕТОДЫ СРАВНЕНИЯ
  // ==========================================
  // МЕТОДЫ СРАВНЕНИЯ (Equality)
  // ==========================================

  /**
   * Строгое математическое равенство (IEEE 754 / ISO C99)
   * Учитывает знаки нулей (-0) для правильного определения комплексных разрезов
   * и корректно распознает идентичность NaN при юнит-тестировании.
   * @param {ComplexNumber|number} other 
   * @returns {boolean}
   */
  equals(other) {
    try {
      const o = ComplexNumber.#from(other);
      
      // Object.is идеально подходит для математических ядер:
      // 1. Object.is(0, -0) -> false (критично для комплексных разрезов фазы)
      // 2. Object.is(NaN, NaN) -> true (необходимо для стабильности юнит-тестов)
      return Object.is(this.#real, o.real) && Object.is(this.#imaginary, o.imaginary);
    } catch {
      return false; // Если тип не приводимый, числа заведомо не равны
    }
  }
  // #endregion

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
      const x = this.#real;
      const y = this.#imaginary;

      // 1. КРИТИЧЕСКИЙ ПЕРЕХВАТ ПО ISO C99: вещественная часть равна минус бесконечности.
      // e^(-Infinity + i*Infinity) обязано давать комплексный ноль!
      // Этот блок ДОЛЖЕН стоять выше любых тригонометрических расчетов, чтобы 0 перевесил NaN.
      if (x === -Infinity) {
        // Знак нуля в строгой физике может зависеть от знаков cos/sin, 
        // но для стабильности тригонометрических сеток возвращаем чистый (0, 0)
        return new ComplexNumber(0, 0);
      }

      // 2. ПРЕДОХРАНИТЕЛЬ NaN: Если одна из компонент NaN — строго возвращаем (NaN, NaN)
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 3. Пограничный случай: реальная часть равна плюс бесконечности (взрывной рост модуля)
      if (x === Infinity) {
        if (y === 0) return new ComplexNumber(Infinity, 0);
        if (!isFinite(y)) return new ComplexNumber(Infinity, NaN); // Фаза бесконечна при бесконечном модуле
        
        const c = Math.cos(y);
        const s = Math.sin(y);
        return new ComplexNumber(
          c === 0 ? 0 : (c > 0 ? Infinity : -Infinity),
          s === 0 ? 0 : (s > 0 ? Infinity : -Infinity)
        );
      }

      // 4. Пограничный случай: реальная часть конечна, а мнимая — бесконечна
      if (!isFinite(y)) {
        // exp(конечное + i*Infinity) не имеет математического смысла, так как угол бесконечен
        return new ComplexNumber(NaN, NaN);
      }

      // 5. Стандартный расчёт для обычных конечных чисел
      const expReal = Math.exp(x);
      return new ComplexNumber(
        expReal * Math.cos(y),
        expReal * Math.sin(y)
      );

    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .exp(). ${e.message}`);
    }
  }

  /**
   * ИНТЕЛЛЕКТУАЛЬНЫЙ НАТУРАЛЬНЫЙ ЛОГАРИФМ Комплексного Числа
   */
  log() {
 
    try {
      const x = this.#real;
      const y = this.#imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return new ComplexNumber(NaN, NaN);
      }

      // Хелпер для проверки отрицательного нуля (-0)
      const isNegZero = (num) => num === 0 && (1 / num === -Infinity);
      // Хелпер для получения знака (-1 или 1), включая -0
      const getSign = (num) => (isNegZero(num) || num < 0 ? -1 : 1);

      // 1. Обработка сингулярности чистого нуля (учитываем знаки для фазы)
      if (x === 0 && y === 0) {
        // ln(0) = -Infinity + i * atan2(y, x)
        // Знак мнимой части нуля определяет угол (0, PI, -PI или PI/2)
        return new ComplexNumber(-Infinity, Math.atan2(y, x));
      }

      // 2. Интеллектуальная фильтрация осей (с жестким сохранением знаков)
      const isQuasiReal = Math.abs(y) < MathType.EPSILON;
      const isQuasiImag = Math.abs(x) < MathType.EPSILON;

      // Если число очень близко к вещественной оси, мы подтягиваем угол к 0 или ±PI,
      // но ОБЯЗАТЕЛЬНО сохраняем знак исходной мнимой части!
      let angle;
      if (isQuasiReal) {
        if (x > 0) {
          // Угол близок к 0. Знак мнимой части определяет +0 или -0
          angle = isNegZero(y) || y < 0 ? -0 : 0;
        } else {
          // Угол близок к PI. Если пришли снизу (y < 0), то угол -PI, иначе +PI
          angle = isNegZero(y) || y < 0 ? -Math.PI : Math.PI;
        }
      } else if (isQuasiImag) {
        // Чисто мнимая ось: строго ±PI/2
        angle = y > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        // Обычное комплексное число
        angle = Math.atan2(y, x);
      }

      // 3. Вычисление модуля |z| с защитой от переполнения
      const r = Math.hypot(x, y);
      
      // Если модуль безумно близок к 1, вещественная часть ln(1) строго зануляется
      let realPart = Math.abs(r - 1) < MathType.EPSILON ? 0 : Math.log(r);

      return new ComplexNumber(realPart, angle);

    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .log(). ${e.message}`);
    }
   
    /*// 1. Проверяем положение числа на осях координат
    const isQuasiReal = Math.abs(this.#imaginary) < MathType.EPSILON;
    const isQuasiImag = Math.abs(this.#real) < MathType.EPSILON;

    const x = isQuasiImag ? 0 : this.#real;
    const y = isQuasiReal ? 0 : this.#imaginary; 

    // 2. Обработка сингулярности нуля: ln(0) = -Infinity + 0i
    if (x === 0 && y === 0) {
      return new ComplexNumber(-Infinity, 0);
    }

    // 3. Вычисляем модуль |z| и аргумент arg(z)
    // Используем hypot для защиты от переполнения при возведении в квадрат больших чисел
    const r = Math.hypot(x, y); 
    const angle = Math.atan2(y, x);

    let realPart = Math.log(r);
    let imagPart = angle;

    // 4. Симметрия и фильтрация погрешностей (как в accuratePow)
    // Если число квази-вещественное и ПОЛОЖИТЕЛЬНОЕ (например, 5 + 1e-16i) -> arg(z) должен быть строго 0
    if (isQuasiReal && x > 0) imagPart = 0;
    
    // Если число квази-вещественное и ОТРИЦАТЕЛЬНОЕ (например, -5 + 1e-16i) -> arg(z) строго PI
    if (isQuasiReal && x < 0) imagPart = Math.PI;

    // Если число чисто мнимое ПОЛОЖИТЕЛЬНОЕ (0 + 2i) -> arg(z) строго PI/2
    if (isQuasiImag && y > 0) imagPart = Math.PI / 2;

    // Если число чисто мнимое ОТРИЦАТЕЛЬНОЕ (0 - 2i) -> arg(z) строго -PI/2
    if (isQuasiImag && y < 0) imagPart = -Math.PI / 2;

    // Если модуль равен единице (|z| = 1), то вещественная часть ln(1) = 0
    if (Math.abs(r - 1) < MathType.EPSILON) realPart = 0;

    return new ComplexNumber(realPart, imagPart);*/
  }

  /**
   * ДЕСЯТИЧНЫЙ ЛОГАРИФМ Комплексного Числа
   */
  log10() {
    // Вызываем наш защищенный интеллектуальный логарифм
    const complexLn = this.log();

    // Math.LN10 — встроенная константа JavaScript, равная примерно 2.302585092994046
    return new ComplexNumber(
      complexLn.real / Math.LN10, 
      complexLn.imaginary / Math.LN10
    );
  }

  /**
   * ЛОГАРИФМ ПО ПРОИЗВОЛЬНОМУ КОМПЛЕКСНОМУ ОСНОВАНИЮ Log(value, base)
   */
  logBase(other) {
    try {
      const base = ComplexNumber.#from(other);

      // 0. Вычисляем защищенные интеллектуальные логарифмы
      const lnValue = this.log();
      const lnBase = base.log();

      // 1. ИЗОЛЯЦИЯ NaN: Если на этапе логарифмирования получился NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(lnValue.real) || Number.isNaN(lnValue.imaginary) || 
          Number.isNaN(lnBase.real) || Number.isNaN(lnBase.imaginary)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 2. ДЕЛЕНИЕ ЧЕРЕЗ СТАНДАРТИЗИРОВАННЫЙ МЕТОД КЛАССА
      // Метод .divide() сам применит алгоритм Смита, корректно обработает деление на ноль (lnBase = 0)
      // без вызова RangeError, и правильно разрулит деление бесконечностей (Inf / Inf -> NaN)
      const result = lnValue.divide(lnBase);

      // 3. Интеллектуальная посадка результата на оси координат с сохранением знаков нулей (-0)
      let realPart = result.real;
      let imagPart = result.imaginary;

      if (Math.abs(realPart) < MathType.EPSILON) {
        realPart = (1 / realPart === -Infinity) ? -0 : 0;
      }
      if (Math.abs(imagPart) < MathType.EPSILON) {
        imagPart = (1 / imagPart === -Infinity) ? -0 : 0;
      }

      return new ComplexNumber(realPart, imagPart);

    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .logBase(). ${e.message}`);
    }
    /*const base = ComplexNumber.#from(other);

    const lnValue = this.log();
    const lnBase = base.log();

    // Защита от деления на ln(1) = 0
    if (Math.abs(lnBase.real) < MathType.EPSILON && Math.abs(lnBase.imaginary) < MathType.EPSILON) {
      throw new RangeError("[ComplexNumber Error]: Основание комплексного логарифма не может быть равно 1.");
    }

    const a = lnValue.real;
    const b = lnValue.imaginary;
    const c = lnBase.real;
    const d = lnBase.imaginary;

    const denominator = c * c + d * d;
    
    // Если само основание устремилось в бесконечность
    if (!isFinite(denominator)) {
      return new ComplexNumber(0, 0);
    }

    // --- ВЫЧИСЛЕНИЕ ЧИСЛИТЕЛЕЙ С ЗАЩИТОЙ ОТ ИНЖЕНЕРНЫХ НЕОПРЕДЕЛЕННОСТЕЙ ---
    
    // Формула вещественного числителя: a * c + b * d
    let realNumerator = a * c + b * d;
    if (isNaN(realNumerator)) {
      // Если получили NaN, значит сработало правило (0 * Infinity). 
      // Заменяем неопределенные компоненты на строгие математические нули.
      const part1 = (a === 0 || c === 0) ? 0 : a * c;
      const part2 = (b === 0 || d === 0) ? 0 : b * d;
      realNumerator = part1 + part2;
    }

    // Формула мнимого числителя: b * c - a * d
    let imagNumerator = b * c - a * d;
    if (isNaN(imagNumerator)) {
      const part1 = (b === 0 || c === 0) ? 0 : b * c;
      const part2 = (a === 0 || d === 0) ? 0 : a * d;
      imagNumerator = part1 - part2;
    }

    // Финальный расчет комплексных компонент
    const realPart = realNumerator / denominator;
    const imagPart = imagNumerator / denominator;

    // Фильтруем микро-погрешности плавающей точки для идеальной посадки на оси
    const finalReal = Math.abs(realPart) < MathType.EPSILON ? 0 : realPart;
    const finalImag = Math.abs(imagPart) < MathType.EPSILON ? 0 : imagPart;

    return new ComplexNumber(finalReal, finalImag);*/
  }

  /**
   * Вычисление комплексного корня n-й степени (Главное значение)
   * @param {number|RealNumber|ComplexNumber} nParam - степень корня
   */
  sqrt(nParam = 2) {
    try {
      // Единая стандартизированная точка приведения типов на перспективу
      const nComplex = ComplexNumber.#from(nParam);
      
      const x = this.#real;
      const y = this.#imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если число или степень повреждены, строго возвращаем (NaN, NaN)
      if (Number.isNaN(x) || Number.isNaN(y) || 
          Number.isNaN(nComplex.real) || Number.isNaN(nComplex.imaginary)) {
        return new ComplexNumber(NaN, NaN);
      }

      // Проверяем, является ли степень корня квази-вещественной
      const isNReal = Math.abs(nComplex.imaginary) < MathType.EPSILON;
      const nRealValue = nComplex.real;

      // 1. ОПТИМИЗАЦИЯ ДЛЯ САМОГО ВАЖНОГО СЛУЧАЯ: КВАДРАТНЫЙ КОРЕНЬ (n === 2)
      // Строго следует стандарту ISO C99 (Приложение G) для комплексного sqrt
      if (isNReal && nRealValue === 2) {
        // Корень от чистого нуля возвращает исходный ноль с сохранением знаков
        if (x === 0 && y === 0) {
          return new ComplexNumber(0, y); 
        }

        // Обработка бесконечностей (устраняем Infinity - Infinity -> NaN)
        if (!isFinite(x) || !isFinite(y)) {
          if (y === Infinity || y === -Infinity) {
            return new ComplexNumber(Infinity, y); // Мнимая бесконечность перевешивает
          }
          if (x === -Infinity) {
            return new ComplexNumber(0, y >= 0 ? Infinity : -Infinity);
          }
          if (x === Infinity) {
            return new ComplexNumber(Infinity, y >= 0 ? 0 : -0);
          }
        }

        // Канонический алгоритм, устойчивый к знакам разрезов (-0)
        const r = Math.hypot(x, y);
        let resReal, resImag;

        if (x >= 0) {
          resReal = Math.sqrt(0.5 * (r + x));
          resImag = y / (2 * resReal); // Автоматически сохраняет знак y, даже если y === -0
        } else {
          resImag = y >= 0 || (y === 0 && 1 / y === Infinity) ? Math.sqrt(0.5 * (r - x)) : -Math.sqrt(0.5 * (r - x));
          resReal = y / (2 * resImag);
        }

        // Интеллектуальная фильтрация микро-погрешностей без уничтожения знаков нулей
        if (Math.abs(resReal) < MathType.EPSILON) resReal = (1 / resReal === -Infinity) ? -0 : 0;
        if (Math.abs(resImag) < MathType.EPSILON) resImag = (1 / resImag === -Infinity) ? -0 : 0;

        return new ComplexNumber(resReal, resImag);
      }

      // 2. БЫСТРЫЕ ПУТИ ДЛЯ ДРУГИХ ВЕЩЕСТВЕННЫХ СТЕПЕНЕЙ КОРНЯ
      if (isNReal) {
        if (nRealValue === 0) return new ComplexNumber(NaN, NaN); // Корень 0-й степени не определен
        if (nRealValue === 1) return this;                        // Корень 1-й степени равен числу
      }

      // 3. ОБЩИЙ СЛУЧАЙ ДЛЯ СЛОЖНЫХ СТЕПЕНЕЙ КОРНЯ ЧЕРЕЗ БЕЗОПАСНЫЙ .divide()
      // Вычисляем экспоненту степени как 1 / nComplex
      const exponent = new ComplexNumber(1, 0).divide(nComplex);

      // Отправляем вычисление в точный pow
      return this.accuratePow(exponent);

    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .sqrt(). ${e.message}`);
    }  
    /*let n = nParam;
    if (nParam instanceof ComplexNumber) {
      n = Math.abs(nParam.imaginary) < MathType.EPSILON ? nParam.real : nParam;
    } else if (nParam instanceof RealNumber) {
      n = nParam.value;
    }

    // Проверка на деление на ноль
    if (n === 0 || (typeof n === 'object' && n.real === 0 && n.imaginary === 0)) {
      throw new RangeError("[ComplexNumber Error]: Корень 0-й степени математически не определен.");
    }

    // 1. ВЫЧИСЛЯЕМ КОМПЛЕКСНУЮ ЭКСПОНЕНТУ СТЕПЕНИ ( 1 / n )
    let expReal, expImag;
    if (typeof n === 'number') {
      expReal = 1 / n;
      expImag = 0;
    } else {
      // Комплексное деление: 1 / (c + di)
      const c = n.real;
      const d = n.imaginary;
      const denom = c * c + d * d;
      expReal = c / denom;
      expImag = -d / denom;
    }

    // 2. СТРОИМ ОПТИМИЗАЦИИ ВОКРУГ ВЕЩЕСТВЕННОЙ ЧАСТИ ЭКСПОНЕНТЫ
    const isExpPureReal = Math.abs(expImag) < MathType.EPSILON;

    if (isExpPureReal) {
      // ОПТИМИЗАЦИЯ 1: Экспонента равна 0.5 (n = 2) -> КВАДРАТНЫЙ КОРЕНЬ
      if (Math.abs(expReal - 0.5) < MathType.EPSILON) {
        const isQuasiReal = Math.abs(this.#imaginary) < MathType.EPSILON;
        const isQuasiImag = Math.abs(this.#real) < MathType.EPSILON;

        const x = isQuasiImag ? 0 : this.#real;
        const y = isQuasiReal ? 0 : this.#imaginary;

        if (x === 0 && y === 0) return new ComplexNumber(0, 0);

        if (y === 0) {
          if (x > 0) return new ComplexNumber(Math.sqrt(x), 0);
          return new ComplexNumber(0, Math.sqrt(Math.abs(x)));
        }

        if (x === 0) {
          const component = Math.sqrt(Math.abs(y) / 2);
          return y > 0 ? new ComplexNumber(component, component) : new ComplexNumber(component, -component);
        }

        const r = Math.hypot(x, y);
        const resReal = Math.sqrt((r + x) / 2);
        const resImag = Math.sqrt((r - x) / 2);
        const sign = y >= 0 ? 1 : -1;

        return new ComplexNumber(
          Math.abs(resReal) < MathType.EPSILON ? 0 : resReal,
          Math.abs(resImag * sign) < MathType.EPSILON ? 0 : resImag * sign
        );
      }

      // ОПТИМИЗАЦИЯ 2: Экспонента равна 1 (n = 1) -> Корень 1-й степени равен числу
      if (Math.abs(expReal - 1) < MathType.EPSILON) {
        return this;
      }

      // ОПТИМИЗАЦИЯ 3: Экспонента равна 2 (n = 0.5) -> ВЫЧИСЛЕНИЕ КВАДРАТА ЧИСЛА
      if (Math.abs(expReal - 2) < MathType.EPSILON) {
        // (x + iy)^2 = (x^2 - y^2) + i * (2xy)
        return new ComplexNumber(
          this.#real * this.#real - this.#imaginary * this.#imaginary,
          2 * this.#real * this.#imaginary
        );
      }
    }

    // 3. ОБЩИЙ СЛУЧАЙ ДЛЯ СЛОЖНЫХ СТЕПЕНЕЙ КОРНЯ
    // Создаем объект экспоненты и отправляем в точный accuratePow
    const complexExponent = new ComplexNumber(expReal, expImag);
    return this.accuratePow(complexExponent);*/
  }

  /**
   * Возведение комплексного числа в степень другого числа (комплексного или вещественного)
   * Формула: z^w = exp(w * log(z))
   * @param {ComplexNumber|number} power - Степень
   * @returns {ComplexNumber}
   */
  pow(power) { return this.accuratePow(other); }

  accuratePow(other) { 
    try {
      // 0. Строгое приведение типов через единую фабрику
      const p = ComplexNumber.#from(other);

      const x = this.#real;
      const y = this.#imaginary;
      const ex = p.real;
      const ey = p.imaginary;

      // 1. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго изолируем ошибку
      if (Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(ex) || Number.isNaN(ey)) {
        return new ComplexNumber(NaN, NaN);
      }

      // Проверяем компоненты очищенного объекта p на "квази-вещественность" и "квази-целостность"
      const isBaseQuasiReal = Math.abs(y) < MathType.EPSILON;
      const isExpQuasiReal = Math.abs(ey) < MathType.EPSILON;
      const isExpQuasiInteger = isExpQuasiReal && Math.abs(ex - Math.round(ex)) < MathType.EPSILON;

      // --- СЛУЧАЙ 1: ОСНОВАНИЕ И СТЕПЕНЬ НА ВЕЩЕСТВЕННОЙ ОСИ ---
      if (isBaseQuasiReal && isExpQuasiReal) {
        if (x < 0 && !Number.isInteger(ex)) {
          const rational = MathType.toRational(Math.abs(ex), MathType.EPSILON);
          if (rational.den % 2 !== 0) {
            const magnitudeResult = Math.pow(Math.abs(x), ex);
            const sign = (rational.num % 2 === 0) ? 1 : -1;
            return new ComplexNumber(sign * magnitudeResult, 0);
          }
        }
        
        if (x > 0 || Number.isInteger(ex)) {
          // Защита: Math.pow(0, отрицательное число) дает Infinity. 
          // Результат должен лежать строго на оси, сохраняя знак нуля в мнимой части, если нужно.
          return new ComplexNumber(Math.pow(x, ex), 0);
        }
      }

      // --- СЛУЧАЙ 2: ЧИСТО МНИМОЕ ОСНОВАНИЕ И ЦЕЛАЯ СТЕПЕНЬ ---
      const isBaseQuasiImag = Math.abs(x) < MathType.EPSILON;
      
      if (isBaseQuasiImag && isExpQuasiInteger) {
        const n = Math.round(ex);

        // Находим чистый модуль возведения в степень
        const magnitude = Math.pow(Math.abs(y), n);
        
        // Определяем знак, если исходная мнимая часть была отрицательной
        const signY = (y < 0 && n % 2 !== 0) ? -1 : 1;
        const finalMagnitude = magnitude * signY;

        // Анализируем остаток от деления степени на 4 для точного позиционирования на осях
        const mod = ((n % 4) + 4) % 4; // Корректная обработка отрицательных степеней

        switch (mod) {
          case 0: // i^0 = 1
            return new ComplexNumber(finalMagnitude, 0);
          case 1: // i^1 = i
            return new ComplexNumber(0, finalMagnitude);
          case 2: // i^2 = -1
            return new ComplexNumber(-finalMagnitude, 0);
          case 3: // i^3 = -i
            return new ComplexNumber(0, -finalMagnitude);
        }
      }

      // --- ОБЩИЙ СЛУЧАЙ ДЛЯ СЛОЖНЫХ КОМПЛЕКСНЫХ ЧИСЕЛ ЧЕРЕЗ БЕЗОПАСНЫЕ МЕТОДЫ КЛАССА ---
      // Вызываем защищенный .log(), затем .multiply() (который мы сейчас проверим) и защищенный .exp()
      return this.log().multiply(p).exp();

    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .accuratePow(). ${e.message}`);
    }    
   /* const p = ComplexNumber.#from(other);

    // Проверяем компоненты на "квази-вещественность" и "квази-целостность"
    const isBaseQuasiReal = Math.abs(this.#imaginary) < MathType.EPSILON;
    const isExpQuasiReal = Math.abs(other.imaginary) < MathType.EPSILON;
    const isExpQuasiInteger = Math.abs(other.imaginary) < MathType.EPSILON && Math.abs(other.real - Math.round(other.real)) < MathType.EPSILON;

    // --- СЛУЧАЙ 1: ОСНОВАНИЕ НА ВЕЩЕСТВЕННОЙ ОСИ (Обсудили на прошлом шаге) ---
    if (isBaseQuasiReal && isExpQuasiReal) {
      const b = this.real;
      const e = other.real;

      if (b < 0 && !Number.isInteger(e)) {
        const rational = MathType.toRational(Math.abs(e), MathType.EPSILON);
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
    const isBaseQuasiImag = Math.abs(this.real) < MathType.EPSILON;
    
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
    return this.log().multiply(other).exp(); */
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

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return new ComplexNumber(NaN, NaN);
      }

      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const chb = Math.cosh(b);
      const shb = Math.sinh(b);

      // 1. Защита от неопределенности (0 * Infinity) на мнимых бесконечностях
      // Если sa или ca равны 0, а chb/shb равны Infinity, заменяем NaN на правильный нуль
      let r = sa * chb;
      if (Number.isNaN(r) && sa === 0 && !isFinite(chb)) {
        // Удерживаем 0, знак зависит от sa (включая -0)
        r = (1 / sa === -Infinity) ? -0 : 0; 
      }

      let i = ca * shb;
      if (Number.isNaN(i) && ca === 0 && !isFinite(shb)) {
        i = (1 / ca === -Infinity) ? -0 : 0;
      }

      return new ComplexNumber(r, i);
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

      // 0. ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return new ComplexNumber(NaN, NaN);
      }

      const sa = Math.sin(a);
      const ca = Math.cos(a);
      const chb = Math.cosh(b);
      const shb = Math.sinh(b);

      // 1. Защита от неопределенности (0 * Infinity) на мнимых бесконечностях
      let r = ca * chb;
      if (Number.isNaN(r) && ca === 0 && !isFinite(chb)) {
        r = (1 / ca === -Infinity) ? -0 : 0;
      }

      let i = -sa * shb;
      if (Number.isNaN(i) && sa === 0 && !isFinite(shb)) {
        // Учитываем унарный минус перед произведением для знака нуля
        const signSa = (1 / sa === -Infinity) ? -1 : 1;
        const signShb = shb === -Infinity ? -1 : 1;
        i = (signSa * signShb > 0) ? -0 : 0;
      }

      return new ComplexNumber(r, i);
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
      // ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(this.#real) || Number.isNaN(this.#imaginary)) {
        return new ComplexNumber(NaN, NaN);
      }
      // Полностью полагаемся на пуленепробиваемый .divide() класса
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

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return new ComplexNumber(NaN, NaN);
      }

      const sha = Math.sinh(a);
      const cha = Math.cosh(a);
      const cb = Math.cos(b);
      const sb = Math.sin(b);

      // 1. Защита от неопределенности (0 * Infinity) на вещественных бесконечностях
      // Если cb или sb равны 0, а sha/cha равны Infinity, заменяем NaN на правильный нуль
      let r = sha * cb;
      if (Number.isNaN(r) && cb === 0 && !isFinite(sha)) {
        r = (1 / cb === -Infinity) ? -0 : 0; 
      }

      let i = cha * sb;
      if (Number.isNaN(i) && sb === 0 && !isFinite(cha)) {
        i = (1 / sb === -Infinity) ? -0 : 0;
      }

      return new ComplexNumber(r, i);
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

      // 0. ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(a) || Number.isNaN(b)) {
        return new ComplexNumber(NaN, NaN);
      }

      const sha = Math.sinh(a);
      const cha = Math.cosh(a);
      const cb = Math.cos(b);
      const sb = Math.sin(b);

      // 1. Защита от неопределенности (0 * Infinity) на вещественных бесконечностях
      let r = cha * cb;
      if (Number.isNaN(r) && cb === 0 && !isFinite(cha)) {
        r = (1 / cb === -Infinity) ? -0 : 0;
      }

      let i = sha * sb;
      if (Number.isNaN(i) && sb === 0 && !isFinite(sha)) {
        i = (1 / sb === -Infinity) ? -0 : 0;
      }

      return new ComplexNumber(r, i);
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
      // ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(this.#real) || Number.isNaN(this.#imaginary)) {
        return new ComplexNumber(NaN, NaN);
      }
      // Полностью полагаемся на пуленепробиваемый .divide() класса
      return this.sinh().divide(this.cosh());
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .tanh(). ${e.message}`);
    }
  }

  // #region ОБРАТНЫЕ ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ
  // ==========================================
  // ОБРАТНЫЕ ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ (Instance)
  // ==========================================

  /**
   * Комплексный Ареасинус (Главное значение)
   */
  arcsinh() {
     try {
      const x = this.#real;
      const y = this.#imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 1. Пограничный случай ISO C99: Вещественная бесконечность (устраняем Infinity - Infinity -> NaN)
      if (!isFinite(x) && isFinite(y)) {
        // arcsinh(±Infinity + i*y) = ±Infinity + i * 0 (знак мнимого нуля совпадает со знаком y)
        const signY = (y === 0 && 1 / y === -Infinity) || y < 0 ? -0 : 0;
        return new ComplexNumber(x, signY);
      }

      // 2. Использование безопасных методов класса для вычисления формулы ln(z + sqrt(z^2 + 1))
      // z^2
      const zSquare = this.multiply(this);
      
      // z^2 + 1 (используем пуленепробиваемый .add)
      const zSquarePlusOne = zSquare.add(new ComplexNumber(1, 0));
      
      // sqrt(z^2 + 1)
      const sqrtPart = zSquarePlusOne.sqrt();
      
      // z + sqrt(z^2 + 1)
      const sumPart = this.add(sqrtPart);
      
      // ln(...)
      return sumPart.log();
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .arcsinh(). ${e.message}`);
    }
  }

   /**
   * Комплексный Арксинус (Главное значение)
   */
  arcsin() {
    try {
      // 0. ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(this.#real) || Number.isNaN(this.#imaginary)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 1. Умножаем на мнимую единицу 'i': i * (x + iy) = -y + ix
      const iTimesZ = new ComplexNumber(-this.#imaginary, this.#real);
      
      // 2. Вычисляем arcsinh(i * z)
      const arcsinhResult = iTimesZ.arcsinh();
      
      // 3. Умножаем результат на '-i': -i * (R + Ii) = I - Ri
      let finalReal = arcsinhResult.imaginary;
      let finalImag = -arcsinhResult.real;

      // 4. Интеллектуальная посадка на оси с жестким сохранением знаков нулей (-0)
      if (Math.abs(finalReal) < MathType.EPSILON) {
        finalReal = (1 / finalReal === -Infinity) ? -0 : 0;
      }
      if (Math.abs(finalImag) < MathType.EPSILON) {
        finalImag = (1 / finalImag === -Infinity) ? -0 : 0;
      }

      return new ComplexNumber(finalReal, finalImag);
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .arcsin(). ${e.message}`);
    }
  }

  /**
   * Комплексный Арккосинус (Главное значение)
   */
  arccos() {
    try {
      const x = this.#real;
      const y = this.#imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 1. Вычисляем 1 - z^2 через безопасные методы класса
      const zSquare = this.multiply(this);
      const oneMinusZSquare = new ComplexNumber(1, 0).subtract(zSquare);

      // 2. Вычисляем sqrt(1 - z^2)
      const sqrtPart = oneMinusZSquare.sqrt();

      // 3. Умножаем корень на i: i * (R + Ii) = -I + Ri
      const iTimesSqrt = new ComplexNumber(-sqrtPart.imaginary, sqrtPart.real);

      // 4. Складываем: z + i * sqrt(1 - z^2) через безопасный метод класса
      const sumPart = this.add(iTimesSqrt);

      // 5. Берем комплексный натуральный логарифм
      const lnResult = sumPart.log();

      // 6. Умножаем финальный результат на -i: -i * (R + Ii) = I - Ri
      let finalReal = lnResult.imaginary;
      let finalImag = -lnResult.real;

      // 7. Интеллектуальная посадка на оси с жестким сохранением знаков нулей (-0)
      if (Math.abs(finalReal) < MathType.EPSILON) {
        finalReal = (1 / finalReal === -Infinity) ? -0 : 0;
      }
      if (Math.abs(finalImag) < MathType.EPSILON) {
        finalImag = (1 / finalImag === -Infinity) ? -0 : 0;
      }

      return new ComplexNumber(finalReal, finalImag);
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .arccos(). ${e.message}`);
    }
  }

  /**
   * Комплексный Арекосинус (Главное значение)
   */
  arccosh() {
    try {
      const x = this.#real;
      const y = this.#imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 1. Вычисляем (z - 1) и (z + 1) через безопасные методы
      const zMinusOne = this.subtract(new ComplexNumber(1, 0));
      const zPlusOne = this.add(new ComplexNumber(1, 0));

      // 2. Извлекаем корни (раздельно по Кэхану для правильных листов Римана)
      const sqrt1 = zMinusOne.sqrt();
      const sqrt2 = zPlusOne.sqrt();

      // 3. Перемножаем корни через безопасный .multiply()
      const sqrtProduct = sqrt1.multiply(sqrt2);

      // 4. Складываем с исходным комплексным числом z
      const sumPart = this.add(sqrtProduct);

      // 5. Возвращаем логарифм от полученной суммы
      return sumPart.log();
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .arccosh(). ${e.message}`);
    }
  }  

   /**
   * Комплексный Аретангенс (Главное значение)
   */
  arctanh() {
    try {
      const x = this.#real;
      const y = this.#imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем (NaN, NaN)
      if (Number.isNaN(x) || Number.isNaN(y)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 1. Пограничный случай ISO C99: Вещественные бесконечности (устраняем Infinity / Infinity -> NaN)
      if (!isFinite(x) && isFinite(y)) {
        // arctanh(±Infinity + i*y) = 0 + i * pi/2 (знак мнимой части совпадает со знаком y)
        // Если y === 0, знак сохраняется (включая -0)
        const signY = (y === 0 && 1 / y === -Infinity) || y < 0 ? -0 : 0;
        const imagPart = signY < 0 || isNegativeZero(signY) ? -Math.PI / 2 : Math.PI / 2;
        return new ComplexNumber(0, imagPart);
      }
      
      const isNegativeZero = (num) => num === 0 && (1 / num === -Infinity);

      // 2. Вычисляем (1 + z) и (1 - z) через безопасные методы класса
      const one = new ComplexNumber(1, 0);
      const num = one.add(this);
      const denom = one.subtract(this);

      // 3. Комплексное деление через пуленепробиваемый метод Смита
      // Если denom равен 0 (точки z = ±1), метод .divide() сам сгенерирует правильные направленные бесконечности
      const divResult = num.divide(denom);

      // 4. Берем комплексный натуральный логарифм от результата деления
      const lnResult = divResult.log();

      // 5. Умножаем на 0.5 (просто делим компоненты пополам)
      return new ComplexNumber(lnResult.real * 0.5, lnResult.imaginary * 0.5);

    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .arctanh(). ${e.message}`);
    }
  }

  /**
   * Комплексный Арктангенс (Главное значение)
   */
  arctan() {
    try {
      // 0. ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(this.#real) || Number.isNaN(this.#imaginary)) {
        return new ComplexNumber(NaN, NaN);
      }

      // 1. Умножаем исходное число на 'i': i * (x + iy) = -y + ix
      const iTimesZ = new ComplexNumber(-this.#imaginary, this.#real);
      
      // 2. Вычисляем комплексный аретангенс
      const arctanhResult = iTimesZ.arctanh();
      
      // 3. Умножаем результат на '-i': -i * (R + Ii) = I - Ri
      let finalReal = arctanhResult.imaginary;
      let finalImag = -arctanhResult.real;

      // 4. Интеллектуальная посадка на оси с жестким сохранением знаков нулей (-0)
      if (Math.abs(finalReal) < MathType.EPSILON) {
        finalReal = (1 / finalReal === -Infinity) ? -0 : 0;
      }
      if (Math.abs(finalImag) < MathType.EPSILON) {
        finalImag = (1 / finalImag === -Infinity) ? -0 : 0;
      }

      return new ComplexNumber(finalReal, finalImag);
    } catch (e) {
      throw new Error(`[ComplexNumber]: Ошибка в методе .arctan(). ${e.message}`);
    }
  } 
  // #endregion

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
      
      const a = this.#real;
      const b = this.#imaginary;
      const c = o.real;
      const d = o.imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем примитив NaN
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) {
        return NaN;
      }

      // 1. Защита от неопределенности (0 * Infinity) при ортогональных бесконечностях
      let part1 = a * c;
      if (Number.isNaN(part1) && (a === 0 || c === 0)) {
        part1 = 0; // Перекрестное зануление ортогональных осей
      }

      let part2 = b * d;
      if (Number.isNaN(part2) && (b === 0 || d === 0)) {
        part2 = 0;
      }

      return part1 + part2;
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

      const a = this.#real;
      const b = this.#imaginary;
      const c = o.real;
      const d = o.imaginary;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(a) || Number.isNaN(b) || Number.isNaN(c) || Number.isNaN(d)) {
        return NaN;
      }

      // 1. Защита от неопределенности (0 * Infinity)
      let part1 = a * d;
      if (Number.isNaN(part1) && (a === 0 || d === 0)) {
        part1 = 0;
      }

      let part2 = b * c;
      if (Number.isNaN(part2) && (b === 0 || c === 0)) {
        part2 = 0;
      }

      return part1 - part2;
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
