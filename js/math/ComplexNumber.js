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
    return Math.abs(value) < MathType.EPSILON ? 0 : value;
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
    if (result instanceof ComplexNumber && !Number.isNaN(result.real) && !Number.isNaN(result.imag)) {
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
   * При z = 0 возвращает ComplexNumber с компонентами Infinity/NaN.
   * @returns {ComplexNumber} Новое комплексное число.
   */
  inverse() {
    const x = this.#real;
    const y = this.#imaginary;

    // 0. ПРЕДОХРАНИТЕЛЬ: Если хотя бы одна компонента NaN, возвращаем (NaN, NaN)
    if (Number.isNaN(x) || Number.isNaN(y)) {
      return new ComplexNumber(NaN, NaN);
    }    

    // 1. Быстрая проверка на чистый ноль (чтобы выдать чистую бесконечность)
    if (x === 0 && y === 0) {
      return new ComplexNumber(Infinity, -0); 
    }

    // 2. Быстрая проверка: если хотя бы одна компонента уже бесконечность
    if (!isFinite(x) || !isFinite(y)) {
      // В комплексном анализе 1 / Infinity всегда дает комплексный ноль.
      // Знаки нуля сохраняют направление (правило знака мнимого нуля)
      return new ComplexNumber(
        (Math.abs(x) === Infinity) ? Math.sign(x) * 0 : 0,
        (Math.abs(y) === Infinity) ? -Math.sign(y) * 0 : -0
      );
    }

    // 3. Стандартный алгоритм Смита для обычных чисел (защита от NaN и переполнения)
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
        
        // При делении на ноль компоненты уходят в бесконечность, знаки определяются перекрёстно
        const r = (x1 * x2 + y1 * y2) >= 0 ? Infinity : -Infinity;
        const i = (y1 * x2 - x1 * y2) >= 0 ? Infinity : -Infinity;
        return new ComplexNumber(r, i);
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
   * ИНТЕЛЛЕКТУАЛЬНЫЙ НАТУРАЛЬНЫЙ ЛОГАРИФМ Комплексного Числа
   */
  log() {
    // 1. Проверяем положение числа на осях координат
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

    return new ComplexNumber(realPart, imagPart);
  }

  /**
   * ДЕСЯТИЧНЫЙ ЛОГАРИФМ Комплексного Числа
   */
  log10() {
    // Формула: lg(z) = ln(z) / ln(10)
    // Операция деления комплексного числа на вещественную константу ln(10)
    const complexLn = this.log();
    const ln10 = Math.log(10);

    return new ComplexNumber(complexLn.real / ln10, complexLn.imaginary / ln10);
  }

  /**
   * ЛОГАРИФМ ПО ПРОИЗВОЛЬНОМУ КОМПЛЕКСНОМУ ОСНОВАНИЮ Log(value, base)
   */
  logBase(other) {
    const base = ComplexNumber.#from(other);

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

    return new ComplexNumber(finalReal, finalImag);
  }

  /**
   * Вычисление комплексного корня n-й степени (Главное значение)
   * @param {number|RealNumber|ComplexNumber} nParam - степень корня
   */
  sqrt(nParam = 2) {
    let n = nParam;
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
    return this.accuratePow(complexExponent);
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

  // #region ОБРАТНЫЕ ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ
  // ==========================================
  // ОБРАТНЫЕ ТРИГОНОМЕТРИЧЕСКИЕ ФУНКЦИИ (Instance)
  // ==========================================

  /**
   * Комплексный Ареасинус (Главное значение)
   */
  arcsinh() {
    // Формула: ln(z + sqrt(z^2 + 1))
    
    // 1. z^2
    const zSquare = this.multiply(this);
    
    // 2. z^2 + 1
    const zSquarePlusOne = new ComplexNumber(zSquare.real + 1, zSquare.imaginary);
    
    // 3. sqrt(z^2 + 1) — вызываем наш точный метод с фильтрацией осей
    const sqrtPart = zSquarePlusOne.sqrt();
    
    // 4. z + sqrt(z^2 + 1)
    const sumPart = new ComplexNumber(this.real + sqrtPart.real, this.imaginary + sqrtPart.imaginary);
    
    // 5. ln(...) — вызываем наш точный комплексный логарифм
    return sumPart.log();
  }

   /**
   * Комплексный Арксинус (Главное значение)
   */
  arcsin() {
    // Формула: arcsin(z) = -i * arcsinh(i * z)
    
    // 1. Умножаем исходное число на мнимую единицу 'i': i * (x + iy) = -y + ix
    const iTimesZ = new ComplexNumber(-this.imaginary, this.real);
    
    // 2. Вычисляем arcsinh(i * z)
    const arcsinhResult = iTimesZ.arcsinh();
    
    // 3. Умножаем результат на '-i': -i * (R + Ii) = I - Ri
    // Вещественной частью становится мнимая часть, а мнимой — минус вещественная
    const finalReal = arcsinhResult.imaginary;
    const finalImag = -arcsinhResult.real;

    // Дополнительная фильтрация микро-погрешностей для идеальной посадки на оси
    return new ComplexNumber(
      Math.abs(finalReal) < MathType.EPSILON ? 0 : finalReal,
      Math.abs(finalImag) < MathType.EPSILON ? 0 : finalImag
    );
  }

  /**
   * Комплексный Арккосинус (Главное значение)
   */
  arccos() {
    // 1. Вычисляем 1 - z^2
    const zSquare = this.multiply(this);
    const oneMinusZSquare = new ComplexNumber(1 - zSquare.real, -zSquare.imaginary);

    // 2. Вычисляем sqrt(1 - z^2) с учетом EPSILON
    const sqrtPart = oneMinusZSquare.sqrt();

    // 3. Умножаем корень на i: i * (R + Ii) = -I + Ri
    const iTimesSqrt = new ComplexNumber(-sqrtPart.imaginary, sqrtPart.real);

    // 4. Складываем: z + i * sqrt(1 - z^2)
    const sumPart = new ComplexNumber(this.real + iTimesSqrt.real, this.imaginary + iTimesSqrt.imaginary);

    // 5. Берем комплексный натуральный логарифм
    const lnResult = sumPart.log();

    // 6. Умножаем финальный результат на -i: -i * (R + Ii) = I - Ri
    const finalReal = lnResult.imaginary;
    const finalImag = -lnResult.real;

    return new ComplexNumber(
      Math.abs(finalReal) < MathType.EPSILON ? 0 : finalReal,
      Math.abs(finalImag) < MathType.EPSILON ? 0 : finalImag
    );
  }

  /**
   * Комплексный Арекосинус (Главное значение)
   */
  arccosh() {
    // Формула: ln(z + sqrt(z - 1) * sqrt(z + 1))
    // Раздельное извлечение корней гарантирует правильный выбор листов Римановой поверхности
    const zMinusOne = new ComplexNumber(this.real - 1, this.imaginary);
    const zPlusOne = new ComplexNumber(this.real + 1, this.imaginary);

    const sqrt1 = zMinusOne.sqrt();
    const sqrt2 = zPlusOne.sqrt();

    // Перемножаем корни
    const sqrtProduct = sqrt1.multiply(sqrt2);

    // Складываем с исходным комплексным числом z
    const sumPart = new ComplexNumber(this.real + sqrtProduct.real, this.imaginary + sqrtProduct.imaginary);

    // Возвращаем логарифм от полученной суммы
    return sumPart.log();
  }  

   /**
   * Комплексный Аретангенс (Главное значение)
   */
  arctanh() {
    const EPSILON = MathType.EPSILON;
    
    // Сингулярности: деление на ноль
    if (Math.abs(this.imaginary) < EPSILON && (Math.abs(this.real - 1) < EPSILON || Math.abs(this.real + 1) < EPSILON)) {
      return new ComplexNumber(this.real > 0 ? Infinity : -Infinity, 0);
    }

    // 1. Вычисляем (1 + z) и (1 - z)
    const num = new ComplexNumber(1 + this.real, this.imaginary);
    const denom = new ComplexNumber(1 - this.real, -this.imaginary);

    // 2. Комплексное деление: (1 + z) / (1 - z)
    // Используем формулу: (ac + bd)/denom + i*(bc - ad)/denom
    const dPrice = denom.real * denom.real + denom.imaginary * denom.imaginary;
    const divResult = new ComplexNumber(
      (num.real * denom.real + num.imaginary * denom.imaginary) / dPrice,
      (num.imaginary * denom.real - num.real * denom.imaginary) / dPrice
    );

    // 3. Берем комплексный логарифм от результата деления
    const lnResult = divResult.log();

    // 4. Умножаем на 0.5 (просто делим компоненты пополам)
    return new ComplexNumber(lnResult.real * 0.5, lnResult.imaginary * 0.5);
  }

  /**
   * Комплексный Арктангенс (Главное значение)
   */
  arctan() {
    // Формула: arctan(z) = -i * arctanh(i * z)
    
    // 1. Умножаем исходное число на 'i': i * (x + iy) = -y + ix
    const iTimesZ = new ComplexNumber(-this.imaginary, this.real);
    
    // 2. Вычисляем комплексный аретангенс
    const arctanhResult = iTimesZ.arctanh();
    
    // 3. Умножаем результат на '-i': -i * (R + Ii) = I - Ri
    const finalReal = arctanhResult.imaginary;
    const finalImag = -arctanhResult.real;

    return new ComplexNumber(
      Math.abs(finalReal) < MathType.EPSILON ? 0 : finalReal,
      Math.abs(finalImag) < MathType.EPSILON ? 0 : finalImag
    );
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
