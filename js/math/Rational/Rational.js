export default class Rational {
  constructor(numerator, denominator = 1n) {
    this.num = BigInt(numerator);
    this.den = BigInt(denominator);

    this.#simplify();
  }

  // --- СТАТИЧЕСКИЕ СВОЙСТВА ДЛЯ СПЕЦИАЛЬНЫХ СЛУЧАЕВ ---
  static get NaN() { return new Rational(0n, 0n); }
  static get POSITIVE_INFINITY() { return new Rational(1n, 0n); }
  static get NEGATIVE_INFINITY() { return new Rational(-1n, 0n); }

  // Геттеры для быстрой проверки состояния
  get isNaN() { return this.den === 0n && this.num === 0n; }
  get isInfinity() { return this.den === 0n && this.num !== 0n; }
  get isPositiveInfinity() { return this.den === 0n && this.num > 0n; }
  get isNegativeInfinity() { return this.den === 0n && this.num < 0n; }

  static #toRational(val) {
    if (val instanceof Rational) return val;
    return new Rational(val);
  }

  #simplify() {
    // Если это Infinity или NaN (знаменатель 0), сохраняем их базовый вид
    if (this.den === 0n) {
      if (this.num > 0n) this.num = 1n;
      else if (this.num < 0n) this.num = -1n;
      return; 
    }

    const gcd = (a, b) => (b === 0n ? a : gcd(b, a % b));
    const absNum = this.num < 0n ? -this.num : this.num;
    const absDen = this.den < 0n ? -this.den : this.den;
    const commonDivisor = gcd(absNum, absDen);

    if (commonDivisor !== 0n) {
      this.num /= commonDivisor;
      this.den /= commonDivisor;
    }

    if (this.den < 0n) {
      this.num = -this.num;
      this.den = -this.den;
    }
  }

  // --- АРИФМЕТИКА С УЧЕТОМ NaN И INFINITY ---

  add(other) {
    const o = Rational.#toRational(other);
    
    // Любая операция с NaN дает NaN
    if (this.isNaN || o.isNaN) return Rational.NaN;
    
    // Операции с бесконечностями
    if (this.isInfinity || o.isInfinity) {
      if (this.isPositiveInfinity && o.isNegativeInfinity) return Rational.NaN; // +Inf + (-Inf) = NaN
      if (this.isNegativeInfinity && o.isPositiveInfinity) return Rational.NaN; // -Inf + (+Inf) = NaN
      return this.isPositiveInfinity || o.isPositiveInfinity ? Rational.POSITIVE_INFINITY : Rational.NEGATIVE_INFINITY;
    }

    return new Rational(this.num * o.den + o.num * this.den, this.den * o.den);
  }

  sub(other) {
    const o = Rational.#toRational(other);
    if (this.isNaN || o.isNaN) return Rational.NaN;

    if (this.isInfinity || o.isInfinity) {
      if (this.isPositiveInfinity && o.isPositiveInfinity) return Rational.NaN; // Inf - Inf = NaN
      if (this.isNegativeInfinity && o.isNegativeInfinity) return Rational.NaN; // (-Inf) - (-Inf) = NaN
      return this.isPositiveInfinity || o.isNegativeInfinity ? Rational.POSITIVE_INFINITY : Rational.NEGATIVE_INFINITY;
    }

    return new Rational(this.num * o.den - o.num * this.den, this.den * o.den);
  }

  mul(other) {
    const o = Rational.#toRational(other);
    if (this.isNaN || o.isNaN) return Rational.NaN;

    // Умножение бесконечности на 0 дает NaN
    if ((this.isInfinity && o.num === 0n) || (o.isInfinity && this.num === 0n)) {
      return Rational.NaN;
    }

    // В остальных случаях перемножаем знаки числителей
    if (this.isInfinity || o.isInfinity) {
      const sign = (this.num > 0n === o.num > 0n) ? 1n : -1n;
      return sign > 0n ? Rational.POSITIVE_INFINITY : Rational.NEGATIVE_INFINITY;
    }

    return new Rational(this.num * o.num, this.den * o.den);
  }

  div(other) {
    const o = Rational.#toRational(other);
    if (this.isNaN || o.isNaN) return Rational.NaN;

    // Деление 0 / 0 или Inf / Inf дает NaN
    if ((this.num === 0n && o.num === 0n) || (this.isInfinity && o.isInfinity)) {
      return Rational.NaN;
    }

    // Деление числа на бесконечность дает 0
    if (o.isInfinity) return new Rational(0n);

    // Деление ненулевого числа на 0 дает бесконечность нужного знака
    if (o.num === 0n) {
      const sign = (this.num > 0n === o.den > 0n) ? 1n : -1n;
      return sign > 0n ? Rational.POSITIVE_INFINITY : Rational.NEGATIVE_INFINITY;
    }

    return new Rational(this.num * o.den, this.den * o.num);
  }

    // Вычисляет остаток от деления текущей дроби на other (аналог оператора % в JS)
  mod(other) {
    const o = Rational.#toRational(other);

    // 1. Обработка NaN и деления на ноль
    if (this.isNaN || o.isNaN || o.num === 0n) return Rational.NaN;

    // 2. Обработка бесконечностей
    if (this.isInfinity) return Rational.NaN; // Inf % любое_число = NaN
    if (o.isInfinity) return this; // Любое_конечное_число % Inf = исходное_число

    // 3. Вычисление для обычных дробей: A % B = A - B * trunc(A / B)
    // Сначала находим результат деления
    const divResult = this.div(o);
    
    // Выделяем целую часть (trunc)
    const intPart = divResult.split()[0];
    
    // Возвращаем результат: this - (o * intPart)
    return this.sub(o.mul(intPart));
  }

    // --- ОПЕРАЦИИ ОТНОШЕНИЯ (СРАВНЕНИЯ) ---

    // Равно (==)
    eq(other) {
        const o = Rational.#toRational(other);
        // По правилам IEEE 754, NaN не равен ничему, даже NaN
        if (this.isNaN || o.isNaN) return false;
        
        // Если обе бесконечности одного знака — они равны
        if (this.den === 0n && o.den === 0n) {
        return (this.num > 0n) === (o.num > 0n);
        }
        
        // Для обычных дробей сравниваем перекрестным умножением
        return this.num * o.den === o.num * this.den;
    }

    // Не равно (!=)
    not_eq(other) {
        return !this.eq(other);
    }

    // Меньше (<)
    lt(other) {
        const o = Rational.#toRational(other);
        if (this.isNaN || o.isNaN) return false; // Сравнения с NaN всегда false

        // Обработка бесконечностей
        if (this.isInfinity || o.isInfinity) {
        if (this.isNegativeInfinity && !o.isNegativeInfinity) return true;
        if (this.isPositiveInfinity) return false;
        if (o.isPositiveInfinity && !this.isPositiveInfinity) return true;
        if (o.isNegativeInfinity) return false;
        }

        return this.num * o.den < o.num * this.den;
    }

    // Больше (>)
    gt(other) {
        const o = Rational.#toRational(other);
        if (this.isNaN || o.isNaN) return false;

        // Обработка бесконечностей
        if (this.isInfinity || o.isInfinity) {
        if (this.isPositiveInfinity && !o.isPositiveInfinity) return true;
        if (this.isNegativeInfinity) return false;
        if (o.isNegativeInfinity && !this.isNegativeInfinity) return true;
        if (o.isPositiveInfinity) return false;
        }

        return this.num * o.den > o.num * this.den;
    }

    // Меньше или равно (<=)
    lte(other) {
        const o = Rational.#toRational(other);
        if (this.isNaN || o.isNaN) return false;
        return this.lt(o) || this.eq(o);
    }

    // Больше или равно (>=)
    gte(other) {
        const o = Rational.#toRational(other);
        if (this.isNaN || o.isNaN) return false;
        return this.gt(o) || this.eq(o);
    }

  // --- ФУНКЦИИ ОКРУГЛЕНИЯ ---

  // Округление вниз (к ближайшему меньшему или равному)
  floor(precision = 0) {
    if (this.isNaN || this.isInfinity) return this;

    const p = BigInt(precision);
    const scale = 10n ** (p > 0n ? p : -p);

    let scaledNum, scaledDen;
    if (p >= 0n) {
      scaledNum = this.num * scale;
      scaledDen = this.den;
    } else {
      scaledNum = this.num;
      scaledDen = this.den * scale;
    }

    let divResult = scaledNum / scaledDen;
    let remainder = scaledNum % scaledDen;

    // Если число отрицательное и есть остаток, при делении BigInt 
    // округление идет к нулю (вверх), а для floor нам нужно вниз
    if (remainder !== 0n && scaledNum < 0n) {
      divResult -= 1n;
    }

    if (p >= 0n) {
      return new Rational(divResult, scale);
    } else {
      return new Rational(divResult * scale, 1n);
    }
  }

  // Округление вверх (к ближайшему большему или равному)
  ceil(precision = 0) {
    if (this.isNaN || this.isInfinity) return this;

    const p = BigInt(precision);
    const scale = 10n ** (p > 0n ? p : -p);

    let scaledNum, scaledDen;
    if (p >= 0n) {
      scaledNum = this.num * scale;
      scaledDen = this.den;
    } else {
      scaledNum = this.num;
      scaledDen = this.den * scale;
    }

    let divResult = scaledNum / scaledDen;
    let remainder = scaledNum % scaledDen;

    // Если число положительное и есть остаток, при делении BigInt 
    // округление идет к нулю (вниз), а для ceil нам нужно вверх
    if (remainder !== 0n && scaledNum > 0n) {
      divResult += 1n;
    }

    if (p >= 0n) {
      return new Rational(divResult, scale);
    } else {
      return new Rational(divResult * scale, 1n);
    }
  }

  // Математическое округление к ближайшему целому (0.5 округляется вверх по модулю)
  round(precision = 0) {
    if (this.isNaN || this.isInfinity) return this;

    const p = BigInt(precision);
    const scale = 10n ** (p > 0n ? p : -p);

    let scaledNum, scaledDen;
    if (p >= 0n) {
      scaledNum = this.num * scale;
      scaledDen = this.den;
    } else {
      scaledNum = this.num;
      scaledDen = this.den * scale;
    }

    let divResult = scaledNum / scaledDen;
    let remainder = scaledNum % scaledDen;
    
    if (remainder !== 0n) {
      // Берем абсолютные значения остатка и делителя для сравнения половины
      const absRemainder = remainder < 0n ? -remainder : remainder;
      const absDen = scaledDen < 0n ? -scaledDen : scaledDen;
      
      // Удваиваем остаток, чтобы избежать деления при проверке на "больше или равно 0.5"
      if (absRemainder * 2n >= absDen) {
        if (scaledNum > 0n) divResult += 1n;
        else divResult -= 1n;
      }
    }

    if (p >= 0n) {
      return new Rational(divResult, scale);
    } else {
      return new Rational(divResult * scale, 1n);
    }
  }

  // --- УНАРНЫЕ ОПЕРАЦИИ ---

  // Модуль числа (абсолютное значение)
  abs() {
    // Если это NaN, возвращаем его же
    if (this.isNaN) return this;
    
    // Если числитель отрицательный, меняем его знак на положительный
    if (this.num < 0n) {
      return new Rational(-this.num, this.den);
    }
    
    // В остальных случаях (число уже положительное или Infinity) возвращаем копию
    return new Rational(this.num, this.den);
  }

  // Смена знака (унарный минус)
  negate() {
    // Если это NaN, знак не меняется
    if (this.isNaN) return this;
    
    // Меняем знак числителя на противоположный. 
    // Это автоматически инвертирует и обычные числа, и бесконечности
    return new Rational(-this.num, this.den);
  }
 
   // Возвращает знак числа: 1n, -1n, 0n или Rational.NaN
  sign() {
    if (this.isNaN) return Rational.NaN; // У NaN знака нет
    if (this.num > 0n) return 1n;        // Положительные дроби и +Infinity
    if (this.num < 0n) return -1n;       // Отрицательные дроби и -Infinity
    return 0n;                           // Ноль
  } 

  // Возвращает массив [integerPart, fractionalPart], где оба элемента — объекты Rational
  split() {
    // 1. Обработка спец-состояний
    if (this.isNaN) {
      return [Rational.NaN, Rational.NaN];
    }
    if (this.isInfinity) {
      // Бесконечность полностью уходит в целую часть, дробная часть равна 0
      return [this, new Rational(0n)];
    }

    // 2. Вычисляем целую часть и остаток
    const integerValue = this.num / this.den;
    const remainderValue = this.num % this.den;

    // 3. Формируем объекты Rational
    const integerPart = new Rational(integerValue, 1n);
    const fractionalPart = new Rational(remainderValue, this.den);

    return [integerPart, fractionalPart];
  }  
  // --- СТЕПЕНИ И КОРНИ ---

  // Возведение в целую степень (степень может быть отрицательной)
  pow_int(exp) {
    const e = BigInt(exp);

    // 1. Обработка NaN
    if (this.isNaN) return Rational.NaN;

    // 2. Обработка нуля (0^0 = NaN по стандарту IEEE 754 в некоторых контекстах, но в JS 0^0 = 1)
    if (this.num === 0n) {
      if (e === 0n) return new Rational(1n);
      if (e < 0n) return Rational.POSITIVE_INFINITY; // 1 / 0^n = Infinity
      return new Rational(0n); // 0^n = 0
    }

    // 3. Обработка бесконечностей
    if (this.isInfinity) {
      if (e === 0n) return new Rational(1n);
      if (e < 0n) return new Rational(0n); // Inf^-n = 0
      
      // Inf^n зависит от знака бесконечности и четности степени
      if (this.isPositiveInfinity) return Rational.POSITIVE_INFINITY;
      
      // -Infinity в четной степени -> +Infinity, в нечетной -> -Infinity
      const isEven = e % 2n === 0n;
      return isEven ? Rational.POSITIVE_INFINITY : Rational.NEGATIVE_INFINITY;
    }

    // 4. Обычное возведение в степень для конечных дробей
    if (e === 0n) return new Rational(1n);
    
    if (e < 0n) {
      // (a/b)^-n = (b/a)^n
      if (this.num === 0n) return Rational.POSITIVE_INFINITY;
      return new Rational(this.den ** -e, this.num ** -e);
    }
    
    return new Rational(this.num ** e, this.den ** e);
  }

  // Квадратный корень методом Ньютона (целочисленный) с поддержкой точности
  sqrt(precision = 20) {
    // 1. Обработка NaN и отрицательных чисел
    if (this.isNaN || this.num < 0n) return Rational.NaN;

    // 2. Обработка бесконечности
    if (this.isPositiveInfinity) return Rational.POSITIVE_INFINITY;

    // 3. Обработка нуля
    if (this.num === 0n) return new Rational(0n);

    // 4. Вычисление для конечных положительных дробей
    const p = BigInt(precision);
    const shift = 10n ** (p * 2n);
    const scaledNum = (this.num * shift) / this.den;

    // Целочисленный метод Ньютона для поиска корня
    let x = scaledNum / 2n || 1n;
    let lastX = 0n;
    
    while (x !== lastX && x !== lastX + 1n && x !== lastX - 1n) {
      lastX = x;
      x = (x + scaledNum / x) / 2n;
    }

    // Возвращаем результат со сдвигом масштаба назад на 10^precision
    return new Rational(x, 10n ** p);
  }
 
  // --- ИНТЕГРАЦИЯ С JS (ПРИВЕДЕНИЕ ТИПОВ) ---

  // Автоматическое приведение типа в зависимости от контекста (hint)
  [Symbol.toPrimitive](hint) {
    // 1. Если JS ожидает строку (например, при `${obj}` или alert(obj))
    if (hint === "string") {
      return this.toString();
    }

    // 2. Если JS ожидает число (hint === "number") или режим "default" (например, obj + 2 или obj == 2)
    // Возвращаем стандартный Number (с возможной потерей точности, так как это ограничение самого Number)
    if (this.isNaN) return Number.NaN;
    if (this.isPositiveInfinity) return Number.POSITIVE_INFINITY;
    if (this.isNegativeInfinity) return Number.NEGATIVE_INFINITY;

    // Преобразуем через деление обычных чисел JavaScript
    return Number(this.num) / Number(this.den);
  }

  // --- ОБРАТНОЕ ПРЕОБРАЗОВАНИЕ ИЗ NUMBER ---

  // Статический метод создания Rational из стандартного JavaScript Number
  static fromNumber(num) {
    // 1. Проверка на спец-значения Number
    if (Number.isNaN(num)) return Rational.NaN;
    if (num === Number.POSITIVE_INFINITY) return Rational.POSITIVE_INFINITY;
    if (num === Number.NEGATIVE_INFINITY) return Rational.NEGATIVE_INFINITY;

    // 2. Если число целое, возвращаем num / 1
    if (Number.isInteger(num)) {
      return new Rational(BigInt(num), 1n);
    }

    // 3. Если число дробное (например, 0.125), превращаем его в точную дробь.
    // Используем метод toString(), чтобы избежать накопления плавающих ошибок JS при разборе парсером.
    // Если число записано в экспоненциальной форме (например, 1.2e-5), то String(num) вернет "0.000012" или "1.2e-5".
    // Наш ранее написанный метод Rational.parse() идеально справляется с обоими форматами строк.
    return Rational.parse(String(num));
  }

  // --- МАТЕМАТИЧЕСКИЕ КОНСТАНТЫ ---

  // Экспонента (число e) через ряд Тейлора: e = 1 + 1/1! + 1/2! + 1/3! + ...
  static e(digits = 50) {
    if (digits < 0) throw new RangeError("Количество знаков должно быть неотрицательным.");
    
    const d = BigInt(digits);
    const extra = 5n; // Запас точности для промежуточных вычислений
    const scale = 10n ** (d + extra);
    
    let sum = scale; // Первый член (1)
    let term = scale; // Текущий член ряда (1/n!)
    let n = 1n;
    
    while (term > 0n) {
      term /= n;
      sum += term;
      n++;
    }
    
    // Возвращаем результат, убирая запас точности
    return new Rational(sum / (10n ** extra), 10n ** d);
  }

  // Число Пи (PI) по формуле Бентли-Борвейна-Плауффа (BBP) или ряду братьев Чудновских.
  // Для простоты и высокой скорости на умеренных разрядах используем алгоритм кратной точности Бэйли-Борвейна-Плауффа,
  // либо классический алгоритм Гаусса-Лежандра (или формулу Мачина).
  // Ниже реализована формула Мачина: pi/4 = 4*arctan(1/5) - arctan(1/239), разложение arctan в ряд Тейлора.
  static pi(digits = 50) {
    if (digits < 0) throw new RangeError("Количество знаков должно быть неотрицательным.");
    
    const d = BigInt(digits);
    const extra = 5n;
    const scale = 10n ** (d + extra);

    // Функция вычисления arctan(1/x) * scale
    const arccot = (x, baseScale) => {
      let sum = baseScale / x;
      let term = sum;
      let x2 = x * x;
      let n = 3n;
      let sign = -1n;
      
      while (true) {
        term /= x2;
        let current = term / n;
        if (current === 0n) break;
        sum += sign * current;
        sign = -sign;
        n += 2n;
      }
      return sum;
    };

    // pi = 4 * (4 * arctan(1/5) - arctan(1/239))
    const term5 = arccot(5n, scale);
    const term239 = arccot(239n, scale);
    const piScaled = 4n * (4n * term5 - term239);

    return new Rational(piScaled / (10n ** extra), 10n ** d);
  }

  // Золотое сечение (phi) по формуле: (1 + sqrt(5)) / 2
  static phi(digits = 50) {
    if (digits < 0) throw new RangeError("Количество знаков должно быть неотрицательным.");
    
    const d = BigInt(digits);
    const one = new Rational(1n);
    const five = new Rational(5n);
    
    // Извлекаем корень из 5 с заданной точностью
    const sqrtFive = five.sqrt(digits);
    
    // (1 + sqrt(5)) / 2
    return one.add(sqrtFive).div(2n);
  }

  // Извлечение корня произвольной целой степени q методом Ньютона
  // precision - точность (количество знаков после запятой)
  _root(q, precision = 20) {
    const degree = BigInt(q);
    if (degree === 1n) return this;
    if (degree === 0n) return Rational.POSITIVE_INFINITY;
    
    // Обработка спец-состояний
    if (this.isNaN) return Rational.NaN;
    if (this.num === 0n) return new Rational(0n);
    if (this.num < 0n) {
      // Корень четной степени из отрицательного числа — NaN
      if (degree % 2n === 0n) return Rational.NaN;
      // Для нечетной степени: root(-x) = -root(x)
      return this.abs()._root(degree, precision).negate();
    }
    if (this.isPositiveInfinity) return Rational.POSITIVE_INFINITY;

    const p = BigInt(precision);
    // Масштабируем: умножаем числитель на 10^(degree * precision)
    const shift = 10n ** (degree * p);
    const scaledNum = (this.num * shift) / this.den;

    // Итерационная формула Ньютона: x_next = ((degree - 1) * x + scaledNum / x^(degree - 1)) / degree
    let x = scaledNum / degree || 1n;
    let lastX = 0n;

    while (x !== lastX && x !== lastX + 1n && x !== lastX - 1n) {
      lastX = x;
      const xPower = x ** (degree - 1n);
      x = ((degree - 1n) * x + scaledNum / xPower) / degree;
    }

    return new Rational(x, 10n ** p);
  }
  
    // Возведение в произвольную дробную степень
  pow(other, precision = 20) {
    const o = Rational.#toRational(other);

    // 1. Обработка спец-значений степени
    if (this.isNaN || o.isNaN) return Rational.NaN;
    
    // Любое число в степени 0 равно 1
    if (o.num === 0n) return new Rational(1n);

    // 2. Обработка бесконечностей в степени
    if (o.isInfinity) {
      if (this.eq(1) || this.eq(-1)) return Rational.NaN; // 1^Inf или (-1)^Inf не определено
      
      const absValue = this.abs();
      if (o.isPositiveInfinity) {
        return absValue.gt(1) ? Rational.POSITIVE_INFINITY : new Rational(0n);
      } else {
        return absValue.gt(1) ? new Rational(0n) : Rational.POSITIVE_INFINITY;
      }
    }

    // 3. Базовый расчет: x^(p/q) = (x^p)^(1/q)
    // Сначала возводим в целую степень числителя (используя ваш переименованный pow_int)
    const powerBase = this.pow_int(o.num);
    
    // Извлекаем корень степени знаменателя (знаменатель o.den всегда положительный после #simplify())
    return powerBase._root(o.den, precision);
  }

  // Вычисление e^x с заданной точностью знаков после запятой
  exp(precision = 20) {
    // 1. Обработка спец-состояний
    if (this.isNaN) return Rational.NaN;
    if (this.isPositiveInfinity) return Rational.POSITIVE_INFINITY;
    if (this.isNegativeInfinity) return new Rational(0n);
    if (this.num === 0n) return new Rational(1n); // e^0 = 1

    const p = BigInt(precision);
    const extra = 5n; // Запас точности для внутренних расчетов ряда
    const scale = 10n ** (p + extra);

    // 2. Выделяем целую и дробную часть числа x
    let integerPart = this.num / this.den;
    let remainder = this.num % this.den;

    // Результат для дробной части в масштабе scale
    let sum = scale; // Первый член ряда (1)
    
    if (remainder !== 0n) {
      // Переводим дробный остаток в масштабированное целое число для расчетов ряда
      // xScaled = (remainder * scale) / den
      let xScaled = (remainder * scale) / this.den;
      let term = xScaled; // Текущий член ряда (x^n / n!)
      let n = 1n;

      while (term > 0n || term < -0n) {
        sum += term;
        n++;
        // Следующий член: term = (term * xScaled) / (n * scale)
        term = (term * xScaled) / (n * scale);
      }
    }

    // Превращаем результат ряда для дробной части обратно в объект Rational
    let fractionalResult = new Rational(sum / (10n ** extra), 10n ** p);

    // 3. Если есть целая часть, считаем e^(integerPart) и умножаем результаты: e^(a+b) = e^a * e^b
    if (integerPart !== 0n) {
      // Генерируем константу e с нужной точностью
      const eConstant = Rational.e(Number(p));
      // Возводим константу e в целую степень (используя ваш pow_int)
      const ePower = eConstant.pow_int(integerPart);
      
      return ePower.mul(fractionalResult);
    }

    return fractionalResult;
  }

  // Вычисление натурального логарифма с заданной точностью знаков после запятой
  ln(precision = 20) {
    // 1. Проверка граничных условий и спец-значений
    if (this.isNaN || this.num <= 0n) return Rational.NaN; // ln от отрицательного или нуля — NaN
    if (this.isPositiveInfinity) return Rational.POSITIVE_INFINITY;
    if (this.num === this.den) return new Rational(0n); // ln(1) = 0

    const p = BigInt(precision);
    const extra = 5n; // Запас точности для внутренних расчетов
    const scale = 10n ** (p + extra);

    // Подготавливаем константу e с запасом точности
    const eConst = Rational.e(Number(p + extra));
    
    let current = this;
    let k = 0n; // Счетчик степеней e

    // 2. Редукция аргумента: приводим число к диапазону, близкому к 1
    // Оптимальный интервал для быстрой сходимости ряда: примерно от 0.75 до 1.5
    const upperLimit = new Rational(3n, 2n);
    const lowerLimit = new Rational(3n, 4n);

    while (current.gt(upperLimit)) {
      current = current.div(eConst);
      k++;
    }
    while (current.lt(lowerLimit)) {
      current = current.mul(eConst);
      k--;
    }

    // 3. Вычисление ln(current) через ряд для artanh(z), где z = (current - 1) / (current + 1)
    const one = new Rational(1n);
    const zNum = current.sub(one);
    const zDen = current.add(one);
    const z = zNum.div(zDen);

    // Масштабируем z в целое число BigInt для вычисления ряда
    let zScaled = (z.num * scale) / z.den;
    let z2Scaled = (zScaled * zScaled) / scale; // z^2

    let sum = 0n;
    let term = zScaled; // Первый член ряда: z^(2n+1)
    let n = 0n;

    while (term > 0n || term < -0n) {
      let currentTerm = term / (2n * n + 1n);
      if (currentTerm === 0n) break;
      
      sum += currentTerm;
      n++;
      
      // Вычисляем следующий член: term = (term * z^2) / scale
      term = (term * z2Scaled) / scale;
    }
    
    // Умножаем сумму ряда на 2 (по формуле логарифма)
    sum *= 2n;

    // Переводим результат ряда обратно в Rational с базовой точностью
    let lnRemainder = new Rational(sum / (10n ** extra), 10n ** p);

    // 4. Собираем итоговое значение: ln(x) = ln(remainder) + k
    if (k !== 0n) {
      return lnRemainder.add(new Rational(k, 1n));
    }

    return lnRemainder;
  }  
  // --- ВЫВОД ДАННЫХ ---

  toString() {
    if (this.isNaN) return "NaN";
    if (this.isPositiveInfinity) return "Infinity";
    if (this.isNegativeInfinity) return "-Infinity";
    return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`;
  }

    static parse(str) {
        // Убираем пробелы
        str = str.trim();

        // 1. Обработка спец-значений
        if (str === "NaN") return Rational.NaN;
        if (str === "Infinity" || str === "+Infinity") return Rational.POSITIVE_INFINITY;
        if (str === "-Infinity") return Rational.NEGATIVE_INFINITY;

        // 2. Регулярное выражение для разбора формата:
        // +/-XXX . XXX (XXX) e+/-XXX
        const regex = /^([+-]?\d+)?(?:\.(\d+)?(?:\((\d+)\))?)?(?:[eE]([+-]?\d+))?$/;
        const match = str.match(regex);

        if (!match) {
            return Rational.NaN; // Неверный формат строки
        }

        const [, intPartStr, fracPartStr, repeatPartStr, expPartStr] = match;

        // Если нет ни целой части, ни дробной — строка некорректна (например, просто "e3")
        if (!intPartStr && !fracPartStr && !repeatPartStr) return Rational.NaN;

        // Определяем знак
        const isNegative = str.startsWith('-');
        const absIntStr = intPartStr ? intPartStr.replace(/[+-]/, '') : '0';
        
        // Базовая целая часть
        let num = BigInt(absIntStr);
        let den = 1n;

        // 3. Обработка непериодической дробной части
        if (fracPartStr) {
            const fracLen = BigInt(fracPartStr.length);
            num = num * (10n ** fracLen) + BigInt(fracPartStr);
            den = 10n ** fracLen;
        }

        // 4. Обработка периодической дробной части
        if (repeatPartStr) {
            const fracLen = fracPartStr ? BigInt(fracPartStr.length) : 0n;
            const repeatLen = BigInt(repeatPartStr.length);

            // Дробь для периодической части: repeatPart / (999...000)
            const repNum = BigInt(repeatPartStr);
            const repDen = (10n ** repeatLen - 1n) * (10n ** fracLen);

            // Складываем текущую дробь (целая + обычная дробная) с периодической частью
            num = num * repDen + repNum * den;
            den = den * repDen;
        }

        // Применяем знак
        if (isNegative) num = -num;

        // 5. Обработка экспоненты (E+/-XXX)
        if (expPartStr) {
            const exp = BigInt(expPartStr);
            if (exp > 0n) {
            num *= 10n ** exp;
            } else if (exp < 0n) {
            den *= 10n ** (-exp);
            }
        }

        return new Rational(num, den);
    }

    toDecimalString(maxStandardDigits = 20) {
        if (this.isNaN) return "NaN";
        if (this.isPositiveInfinity) return "Infinity";
        if (this.isNegativeInfinity) return "-Infinity";

        const sign = this.num < 0n ? "-" : "";
        let absNum = this.num < 0n ? -this.num : this.num;
        let absDen = this.den;

        // 1. Проверяем, нужно ли использовать экспоненциальный формат (для очень больших/маленьких чисел)
        // Нам нужно грубо прикинуть порядок числа
        let integerPart = absNum / absDen;
        let exp = 0n;

        // Если число не равно 0 и требуется экспоненциальный вид
        if (integerPart === 0n && absNum !== 0n) {
            // Число слишком маленькое (меньше 1)
            let tempNum = absNum;
            while (tempNum / absDen === 0n) {
            tempNum *= 10n;
            exp--;
            }
            // Если вышли за рамки лимита знаков, масштабируем
            if (-exp > BigInt(maxStandardDigits)) {
            absNum = tempNum;
            integerPart = absNum / absDen;
            } else {
            exp = 0n; // Сбрасываем, помещается в стандартный формат
            }
        } else if (integerPart > 0n) {
            // Число очень большое
            let intStrLen = BigInt(integerPart.toString().length);
            if (intStrLen > BigInt(maxStandardDigits)) {
            exp = intStrLen - 1n;
            absDen *= 10n ** exp;
            integerPart = absNum / absDen;
            }
        }

        // 2. Вычисляем целую часть и остаток для дробной
        let remainder = absNum % absDen;
        let fracStr = "";
        
        // Карты для отслеживания остатков (чтобы найти период алгоритмом деления в столбик)
        const seenRemainders = new Map();
        let index = 0;
        let periodStartIndex = -1;

        // Алгоритм деления в столбик с поиском цикла
        while (remainder !== 0n) {
            if (seenRemainders.has(remainder)) {
            periodStartIndex = seenRemainders.get(remainder);
            break;
            }
            
            seenRemainders.set(remainder, index);
            remainder *= 10n;
            fracStr += (remainder / absDen).toString();
            remainder %= absDen;
            index++;
        }

        // 3. Формируем дробную часть с учетом периода
        let finalFrac = "";
        if (periodStartIndex !== -1) {
            // Есть период
            const nonRepeat = fracStr.slice(0, periodStartIndex);
            const repeat = fracStr.slice(periodStartIndex);
            finalFrac = nonRepeat + "(" + repeat + ")";
        } else if (fracStr.length > 0) {
            // Конечная дробь
            finalFrac = fracStr;
        }

        // Сборка финальной строки
        let result = sign + integerPart.toString();
        if (finalFrac) {
            result += "." + finalFrac;
        }
        
        // Добавляем экспоненту, если она была вычислена
        if (exp !== 0n) {
            result += "E" + (exp > 0n ? "+" : "") + exp.toString();
        }

        return result;
    }    
}