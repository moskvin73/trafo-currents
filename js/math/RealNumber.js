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
  // ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ ПРИВЕДЕНИЯ ТИПОВ
  // ==========================================

  // Универсальная таблица приведения по имени типа
  static #converters = new Map([
    ['number',        (val) => new RealNumber(val)],
    [RealNumber,      (val) => val]
    // Перспектива: легко добавить новые типы прямо по их имени:
    // ['BigInt',     (val) => new ComplexNumber(Number(val), 0)],
    // ['Vector2D',   (val) => new ComplexNumber(val.x, val.y)]
  ]);

  /** 
   * Приводит переданный аргумент (число или ComplexNumber) к типу ComplexNumber.
   * Позволяет методам прозрачно работать и со скалярами, и с комплексными числами.
   * @param {number|RealNumber} value 
   * @returns {RealNumber}
   */
  static #from(value) {
    // 1. Защита от null/undefined, чтобы безопасно читать свойства
    if (value === null || value === undefined) {
      throw new TypeError(`[RealNumber]: Невозможно привести ${value} к комплексному числу.`);
    }

    // 2. Определяем имя типа (строку) для поиска в Map
    //const typeKey = typeof value === 'object' ? value.constructor.name : typeof value;
    const typeKey = typeof value === 'object' ? value.constructor : typeof value;

    // 3. Ищем конвертер в таблице
    const convert = this.#converters.get(typeKey);

    // 4. Если типа нет в таблице — сразу выбрасываем ошибку
    if (!convert) {
      const typeName = typeof value === 'object' ? value.constructor.name : typeof value;
      throw new TypeError(`[RealNumber]: Тип "${typeKey}" не поддерживается для приведения.`);
    }

    return convert(value);
    // 5. Вызываем конвертер
    /*const result = convert(value);

    // 6. Финальная валидация (проверяем, что на выходе валидный инстанс и внутри нет NaN)
    if (result instanceof RealNumber && !Number.isNaN(result.value)) {
      return result;
    }

    throw new TypeError(`[RealNumber]: Ошибка валидации приведения для типа "${typeKey}".`);*/
  }  

  // ==========================================
  // АРИФМЕТИЧЕСКИЕ МЕТОДЫ ЭКЗЕМПЛЯРА (Instance Methods)
  // ==========================================

  /**
   * Реализация унарного минуса для вещественного числа
   */
  negate() { return new RealNumber(-this.value); }

  /**
   * Возвращает обратную величину числа (результат деления единицы на это число).
   * @returns {RealNumber} Новое число вида 1/x.
   */  
  inverse() { return new RealNumber(1 / this.value); }
  /**
   * Внутренний метод сложения двух вещественных чисел
   */
  add(other) {
    return new RealNumber(this.#value + RealNumber.#from(other).#value);
  }

  /**
   * Внутренний метод вычитания двух вещественных чисел
   */
  subtract(other) {
    return new RealNumber(this.#value - RealNumber.#from(other).#value);
  }

  /**
   * Внутренний метод умножения двух вещественных чисел
   */
  multiply(other) {
    return new RealNumber(this.#value * RealNumber.#from(other).#value);
  }

  /**
   * Внутренний метод деления двух вещественных чисел
   */
  divide(other) {
    return new RealNumber(this.#value / RealNumber.#from(other).#value);
  }

  // ==========================================
  // МЕТОДЫ СРАВНЕНИЯ (Equality)
  // ==========================================

  /**
   * Строгое математическое равенство (IEEE 754)
   * Корректно различает +0 и -0 для точных фазовых переходов 
   * и позволяет проверять идентичность NaN в юнит-тестах.
   * @param {RealNumber|number} other 
   * @returns {boolean}
   */
  equals(other) {
    try {
      // Используем ваш проверенный метод приведения типов RealNumber.#from
      const o = RealNumber.#from(other);
      
      // Object.is — стандартный способ JS проверить абсолютную идентичность:
      // 1. Object.is(NaN, NaN) -> true
      // 2. Object.is(0, -0) -> false (сохраняет знак для комплексных разрезов)
      return Object.is(this.#value, o.#value);
    } catch {
      return false; // Если тип не приводимый, числа заведомо не равны
    }
  }

  // ==========================================
  // ЭКСПАНСИЯ: СТЕПЕНИ, КОРНИ, ЛОГАРИФМЫ (Instance)
  // ==========================================

  exp()  { return new RealNumber(Math.exp(this.#value)); }

  /**
   * Внутренний метод возведения в степень
   */
  pow(other) { return this.accuratePow(other); }


  accuratePow(other) {
   try {
      // 1. Приведение типа через внутреннюю вещественную фабрику
      const p = RealNumber.#from(other);
      
      const b = this.#value;
      const e = p.#value; // Читаем приватное поле симметричного экземпляра

      // 2. ПРЕДОХРАНИТЕЛЬ NaN: Если основание или степень NaN — строго возвращаем RealNumber(NaN)
      if (Number.isNaN(b) || Number.isNaN(e)) {
        return new RealNumber(NaN);
      }

      // 3. СТАНДАРТ IEEE 754 ДЛЯ СТЕПЕНИ 0 (Любое число в степени 0 равно 1)
      if (e === 0) return new RealNumber(1);

      // 4. СТАНДАРТ IEEE 754 ДЛЯ ОСНОВАНИЯ 0 (Исправляем баг зануления отрицательных степеней)
      if (b === 0) {
        // 0^(положительное число) -> 0. Например, 0^5 = 0
        // 0^(отрицательное число) -> Infinity. Например, 0^(-2) = 1/(0^2) = Infinity
        return e > 0 ? new RealNumber(0) : new RealNumber(Infinity);
      }

      // 5. Поведение для положительных оснований (Движок JS считает идеально по IEEE 754, включая Infinity)
      if (b > 0) return new RealNumber(Math.pow(b, e));
      
      // 6. Поведение для отрицательных оснований при бесконечных степенях
      if (!isFinite(e)) {
        // Уходим в комплексный класс, так как (-b)^Infinity не имеет однозначного вещественного решения
        const complexBase = new ComplexNumber(b, 0);
        const complexExp = new ComplexNumber(e, 0);
        return complexBase.accuratePow(complexExp);
      }

      // 7. Если степень — честное целое число, знак раскрывается классическим Math.pow
      if (Number.isInteger(e)) return new RealNumber(Math.pow(b, e));

      // 8. ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ ДЛЯ ОТРИЦАТЕЛЬНЫХ ОСНОВАНИЙ И ДРОБНЫХ СТЕПЕНЕЙ (b < 0)
      const rational = MathType.toRational(Math.abs(e));
      
      if (rational.den % 2 !== 0) {
        // Вещественный корень нечетной степени существует!
        const magnitudeResult = Math.pow(Math.abs(b), e);
        const sign = (rational.num % 2 === 0) ? 1 : -1;
        return new RealNumber(sign * magnitudeResult);
      }

      // ====================================================================
      // ФАЗОВЫЙ ПЕРЕХОД: вещественного корня нет (например, четный знаменатель дроби)
      // Красиво и безопасно передаем управление комплексному классу, как вы и задумали!
      // ====================================================================
      const complexBase = new ComplexNumber(b, 0);
      const complexExp = new ComplexNumber(e, 0);
      
      return complexBase.accuratePow(complexExp);

    } catch (e) {
      throw new Error(`[RealNumber]: Ошибка в методе .accuratePow(). ${e.message}`);
    }    
      /*other = RealNumber.#from(other);
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
      return complexBase.accuratePow(complexExp);*/
  }
  
  /**
   * Вычисление корня n-й степени. По умолчанию n = 2 (квадратный корень)
   * @param {number|RealNumber} nParam - степень корня
   */
  sqrt(nParam = 2) {
    try {
      // 1. Приведение типа через внутреннюю вещественную фабрику
      const p = RealNumber.#from(nParam);
      const n = p.#value; // Читаем приватное поле симметричного экземпляра

      const x = this.#value;

      // 2. ПРЕДОХРАНИТЕЛЬ NaN: Если число или степень корни NaN — строго возвращаем RealNumber(NaN)
      if (Number.isNaN(x) || Number.isNaN(n)) {
        return new RealNumber(NaN);
      }

      // 3. ОПТИМИЗАЦИЯ 1: КВАДРАТНЫЙ КОРЕНЬ (n === 2)
      // Заменяем хрупкое сравнение expValue === 0.5 на прямое сравнение степени
      if (n === 2) {
        if (x >= 0) {
          return new RealNumber(Math.sqrt(x));
        }
        // ФАЗОВЫЙ ПЕРЕХОД по стандарту ISO C99 (Приложение G):
        // Главное значение корня из отрицательного вещественного числа всегда имеет ПОЛОЖИТЕЛЬНУЮ мнимую часть (+j)
        return new ComplexNumber(0, Math.sqrt(Math.abs(x)));
      }

      // 4. ОПТИМИЗАЦИЯ 2: КОРЕНЬ 1-й СТЕПЕНИ (n === 1)
      if (n === 1) {
        return this;
      }

      // 5. ОПТИМИЗАЦИЯ 3: ВОЗВЕДЕНИЕ В КВАДРАТ (n === 0.5)
      if (n === 0.5) {
        return new RealNumber(x * x);
      }

      // 6. ОБЩИЙ СЛУЧАЙ ДЛЯ ВСЕХ ОСТАЛЬНЫХ СТЕПЕНЕЙ КОРНЯ (n = 3, 4, 0, ...)
      // Вычисляем экспоненту степени: 1 / n. 
      // Если n === 0, JS вернет Infinity, и метод accuratePow обработает это строго по IEEE 754 без throw.
      const expValue = 1 / n;

      return this.accuratePow(new RealNumber(expValue));

    } catch (e) {
      throw new Error(`[RealNumber]: Ошибка в методе .sqrt(). ${e.message}`);
    }
    /*//const n = nParam instanceof RealNumber ? nParam.value : nParam;
    const n = RealNumber.#from(nParam).#value;

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
    return this.accuratePow(new RealNumber(expValue));*/
  }
  
  /**
   * Интеллектуальный натуральный логарифм ln(x)
   */
  log() {
    const x = this.#value;

    // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если значение NaN, строго возвращаем RealNumber(NaN)
    if (Number.isNaN(x)) return new RealNumber(NaN);

    // 1. Для строго положительных чисел считаем стандартно
    if (x > 0) {
      return new RealNumber(Math.log(x));
    }

    // 2. СТАНДАРТ ISO C99: Обработка вещественных нулей (+0 и -0)
    if (x === 0) {
      // Если это отрицательный нуль -0, мы ОБЯЗАНЫ совершить фазовый переход на комплексный разрез:
      // ln(-0) = -Infinity + i * pi
      if (Object.is(x, -0)) {
        return new ComplexNumber(-Infinity, Math.PI);
      }
      // Для обычного положительного нуля возвращаем вещественный -Infinity
      return new RealNumber(-Infinity);
    }

    // 3. Для строго отрицательных уходим в комплексную плоскость: ln(|x|) + i * pi
    const realPart = Math.log(Math.abs(x));
    const imagPart = Math.PI;
    
    return new ComplexNumber(realPart, imagPart);    
    /*// 1. Для строго положительных чисел считаем стандартно
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
    
    return new ComplexNumber(realPart, imagPart);*/
  }

  /**
   * Интеллектуальный десятичный логарифм lg(x)
   */
  log10() {
    const x = this.#value;

    if (Number.isNaN(x)) return new RealNumber(NaN);

    if (x > 0) {
      return new RealNumber(Math.log10(x));
    }

    // Обработка нулей с сохранением направления разреза
    if (x === 0) {
      if (Object.is(x, -0)) {
        // lg(-0) = -Infinity + i * (pi / ln(10))
        return new ComplexNumber(-Infinity, Math.PI / Math.LN10);
      }
      return new RealNumber(-Infinity);
    }

    // 3. Для отрицательных переходим через комплексный натуральный логарифм,
    // используя стандартную константу JavaScript Math.LN10
    const complexLn = this.log(); // Получаем защищенный ComplexNumber
    
    return new ComplexNumber(complexLn.real / Math.LN10, complexLn.imaginary / Math.LN10);

    /*if (this.#value > 0) {
      return new RealNumber(Math.log10(this.#value));
    }

    // 2. ИСПРАВЛЕНО: lg(0) = -Infinity
    if (this.#value === 0) {
      return new RealNumber(-Infinity);
    }

    // 3. Для отрицательных переходим через комплексный натуральный логарифм: ln(x) / ln(10)
    const complexLn = this.log(); // Получаем ComplexNumber
    const ln10 = Math.log(10);
    
    return new ComplexNumber(complexLn.real / ln10, complexLn.imaginary / ln10);*/
  }

  /**
   * Интеллектуальный логарифм по произвольному основанию Log(value, base)
   */
  logBase(other) {

    try {
      // Ваша лаконичная JIT-оптимизированная строка приведения типа
      const baseVal = RealNumber.#from(other).#value;
      const x = this.#value;

      // ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(x) || Number.isNaN(baseVal)) {
        return new RealNumber(NaN);
      }

      // Точка неопределенности: log0(0) = NaN
      if (x === 0 && baseVal === 0) {
        return new RealNumber(NaN);
      }

      // 1. Если само значение равно 0, а основание корректно
      if (x === 0) {
        // Устраняем баг поглощения знака -0: если x === -0 или baseVal равен проблемным точкам,
        // безопаснее всего сразу отдать расчет комплексному ядру
        if (Object.is(x, -0) || Object.is(baseVal, -0)) {
          return new ComplexNumber(x, 0).logBase(new ComplexNumber(baseVal, 0));
        }
        if (baseVal > 1) return new RealNumber(-Infinity);
        if (baseVal > 0 && baseVal < 1) return new RealNumber(Infinity); // log_{0.5}(0) = +Infinity
      }

      // 2. Проверка сингулярностей основания логарифма
      if (baseVal <= 0 || baseVal === 1) {
        // Если основание проблемное, полностью делегируем вычисления в комплексное поле
        const complexBase = new ComplexNumber(baseVal, 0);
        const complexValue = new ComplexNumber(x, 0);
        return complexValue.logBase(complexBase);
      }

      // 3. Если основание корректно (base > 0, base != 1), а значение отрицательное
      if (x < 0) {
        const complexLnValue = this.log(); // Наш комплексный ln(x)
        const lnBase = Math.log(baseVal);
        
        return new ComplexNumber(complexLnValue.real / lnBase, complexLnValue.imaginary / lnBase);
      }

      // 4. Идеальный стандартный случай
      const result = Math.log(x) / Math.log(baseVal);
      return new RealNumber(result);

    } catch (e) {
      throw new Error(`[RealNumber]: Ошибка в методе .logBase(). ${e.message}`);
    }    
    /*const baseVal = RealNumber.#from(other).#value;

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
    return new RealNumber(result);*/
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
    const x = this.#value;

    // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если значение NaN, строго возвращаем RealNumber(NaN)
    if (Number.isNaN(x)) return new RealNumber(NaN);

    // 1. Стандартный вещественный случай (внутри ОДЗ)
    // Math.asin идеально сохраняет знак отрицательного нуля: asin(-0) = -0
    if (Math.abs(x) <= 1) {
      return new RealNumber(Math.asin(x));
    }

    // 2. ФАЗОВЫЙ ПЕРЕХОД на комплексную плоскость для |x| > 1
    // Устраняем баг знака мнимой части строго по стандарту ISO C99
    const sign = x > 0 ? 1 : -1;
    
    // Вещественная часть строго равна +pi/2 или -pi/2
    const realPart = (Math.PI / 2) * sign;
    
    // Мнимая часть рассчитывается через каноническое логарифмическое представление arcosh(|x|):
    // Знак мнимой части ОБЯЗАН совпадать со знаком x (для x > 1 -> +j, для x < -1 -> -j)
    const imagPart = sign * Math.log(Math.abs(x) + Math.sqrt(x * x - 1));

    return new ComplexNumber(realPart, imagPart);    
   /* // 1. Стандартный вещественный случай
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

    return new ComplexNumber(realPart, imagPart);*/
  }

  /**
   * Интеллектуальный Ареасинус (Гиперболический арксинус)
   * Функция определена на всей вещественной оси (-inf; +inf), поэтому всегда возвращает RealNumber
   */
  arcsinh() {
    if (Number.isNaN(this.#value)) return new RealNumber(NaN);
    // Математическая формула: arcsinh(x) = ln(x + sqrt(x^2 + 1))
    // Используем Math.asinh для максимальной скорости встроенного движка V8
    return new RealNumber(Math.asinh(this.#value));
  }
   
   /**
   * Интеллектуальный Арккосинус с фазовым переходом (|x| > 1)
   */
  arccos() {
    const x = this.#value;

    // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если значение NaN, строго возвращаем RealNumber(NaN)
    if (Number.isNaN(x)) return new RealNumber(NaN);

    // 1. Стандартный вещественный случай (внутри ОДЗ)
    if (Math.abs(x) <= 1) {
      return new RealNumber(Math.acos(x));
    }

    // 2. Фазовый переход для x > 1 (вещественная часть становится строго 0)
    if (x > 1) {
      // Для x > 1 мнимая часть ОБЯЗАНА быть отрицательной (-j)
      const imagPart = -Math.log(x + Math.sqrt(x * x - 1));
      return new ComplexNumber(0, imagPart);
    }

    // 3. Фазовый переход для x < -1 (вещественная часть становится строго PI)
    // УСТРАНЯЕМ БАГ ЗНАКА: Для x < -1 мнимая часть ОБЯЗАНА быть строго ПОЛОЖИТЕЛЬНОЙ (+j)
    // Математическое тождество: arccos(-x) = PI - arccos(x). 
    // Поскольку для x > 1 мнимая часть отрицательна, для x < -1 она меняет знак на плюс!
    // Проверим: arccos(-2) = PI - arccos(2) = PI - (0 - j*1.3169) = PI + j*1.3169.
    // Ваш исходный код для x < -1 возвращал плюс, что СЛУЧАЙНО оказалось верным из-за компенсации знаков,
    // но в Блоке 2 знак стоял минус. Проверим общую аналитическую непрерывность:
    const imagPart = Math.log(Math.abs(x) + Math.sqrt(x * x - 1));
    return new ComplexNumber(Math.PI, imagPart);    
    /*const x = this.#value;

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
    return new ComplexNumber(Math.PI, imagPart);*/
  }

  /**
   * Интеллектуальный Арекосинус (Гиперболический арккосинус)
   * Область определения в вещественном поле: [1; +inf)
   */
  arccosh() {
    const x = this.#value;

    if (Number.isNaN(x)) return new RealNumber(NaN);

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
    // Здесь Re = ln(|x| + sqrt(x^2 - 1)), Im = PI. Все знаки и компоненты согласованы с ISO C99.
    const realPart = Math.log(Math.abs(x) + Math.sqrt(x * x - 1));
    return new ComplexNumber(realPart, Math.PI);    
     /*const x = this.#value;

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
    return new ComplexNumber(realPart, Math.PI);*/
  } 

  /**
   * Интеллектуальный Арктангенс
   * В вещественном поле определен на всей оси, фазовых переходов нет
   */
  arctan() {
    if (Number.isNaN(this.#value)) return new RealNumber(NaN);
    return new RealNumber(Math.atan(this.#value));
  }

  /**
   * Интеллектуальный Аретангенс (Гиперболический арктангенс)
   * Область определения в вещественном поле строго (-1; 1)
   */
  arctanh() {
   const x = this.#value;

    // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если значение NaN, строго возвращаем RealNumber(NaN)
    if (Number.isNaN(x)) return new RealNumber(NaN);

    // 1. Точки сингулярности (Асимптоты): arctanh(1) = +Infinity, arctanh(-1) = -Infinity
    // Движок JS выполняет это идеально, но явный Fast Path экономит такты процессора
    if (x === 1) return new RealNumber(Infinity);
    if (x === -1) return new RealNumber(-Infinity);

    // 2. Стандартный вещественный случай (-1 < x < 1)
    // Math.atanh сохраняет знаки нулей: atanh(-0) = -0
    if (Math.abs(x) < 1) {
      return new RealNumber(Math.atanh(x));
    }

    // 3. ФАЗОВЫЕ ПЕРЕХОДЫ ДЛЯ |x| > 1
    // Устраняем баг знака мнимой части и опечатку логарифма вещественной части строго по ISO C99.
    // Каноническое комплексное представление: arctanh(x) = 0.5 * ln(|x+1| / |x-1|) - i * pi/2
    
    // Универсальная формула вещественной части, защищенная от генерации ложных NaN
    const realPart = 0.5 * Math.log(Math.abs((x + 1) / (x - 1)));
    
    // Согласно стандарту ISO C99 (Приложение G), для вещественных чисел за пределами ОДЗ
    // мнимая часть комплексного аретангенса всегда строго равна -pi/2
    const imagPart = -Math.PI / 2;

    return new ComplexNumber(realPart, imagPart);
    /*const x = this.#value;

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
    return new ComplexNumber(realPart, Math.PI / 2);*/
  }  
  // #endregion

  // ==========================================
  // ВЕКТОРНАЯ ГЕОМЕТРИЯ (Скалярное и Векторное произведение)
  // ==========================================

  /**
   * Скалярное произведение двух вещественных векторов (чисел).
   * Полностью совместимо с IEEE 754 на бесконечностях.
   * @param {RealNumber|number} other 
   * @returns {RealNumber}
   */
  dot(other) {
    try {
      const o = RealNumber.#from(other);
      
      const x1 = this.#value;
      const x2 = o.#value;

      // 0. ПРЕДОХРАНИТЕЛЬ NaN: Если хоть одна компонента NaN, строго возвращаем RealNumber(NaN)
      if (Number.isNaN(x1) || Number.isNaN(x2)) {
        return new RealNumber(NaN);
      }

      // 1. Защита от неопределенности (0 * Infinity) при ортогональных бесконечностях.
      // Если один вектор бесконечный, а второй нулевой, их проекция равна строго 0.
      let result = x1 * x2;
      if (Number.isNaN(result) && (x1 === 0 || x2 === 0)) {
        result = 0; 
      }

      return new RealNumber(result);
    } catch (e) {
      throw new TypeError(`[RealNumber]: Ошибка в методе .dot(). ${e.message}`);
    }
  }

  /**
   * Модуль косого (векторного) произведения на плоскости.
   * На вещественной числовой прямой все векторы коллинеарны, поэтому всегда равен 0.
   * @param {RealNumber|number} other 
   * @returns {RealNumber}
   */
  cross(other) {
    try {
      const o = RealNumber.#from(other);

      // ПРЕДОХРАНИТЕЛЬ NaN
      if (Number.isNaN(this.#value) || Number.isNaN(o.#value)) {
        return new RealNumber(NaN);
      }

      return new RealNumber(0);
    } catch (e) {
      throw new TypeError(`[RealNumber]: Ошибка в методе .cross(). ${e.message}`);
    }
  }

  // ==========================================
  // МЕТОДЫ ВЫВОДА ФОРМАТА
  // ==========================================

  /**
   * Возвращает чистую строку TeX
   */
  toRawTeX(locale = new Intl.NumberFormat().resolvedOptions().locale) {
   const val = this.#value;

    // 1. Изолируем и спасаем знак -0, так как num.toString() внутри утилиты сотрет минус
    if (Object.is(val, -0)) return '-0';

    // 2. Фильтруем микро-погрешности плавающей точки JS
    let cleanVal = val;
    if (Math.abs(val) < MathType.EPSILON) {
      cleanVal = 0; // Обычный 0, так как случай с -0 мы перехватили строкой выше
    }

    // 3. Полностью делегируем форматирование вашему интеллектуальному методу MathType
    return MathType.formatNumberToTeX(cleanVal, locale);    
    //return `${Math.abs(this.#value) < MathType.EPSILON ? 0 : MathType.formatNumberToTeX(this.#value, locale)}`;
  }

  /**
   * Стандартный строковый вывод
   */
  toString() {
    const val = this.#value;

    if (Number.isNaN(val)) return 'NaN';
    if (!isFinite(val)) return val.toString(); // Вернет 'Infinity' или '-Infinity'

    // Фильтрация погрешностей для строк
    let cleanVal = val;
    if (Math.abs(val) < MathType.EPSILON) {
      cleanVal = Object.is(val, -0) || val < 0 ? -0 : 0;
    }

    if (Object.is(cleanVal, -0)) return '-0';
    return `${cleanVal}`;    
    //return `${Math.abs(this.#value) < MathType.EPSILON ? 0 : this.#value}`;
  }
}