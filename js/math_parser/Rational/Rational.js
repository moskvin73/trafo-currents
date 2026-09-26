class Rational {
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

    // --- ОПЕРАЦИИ ОТНОШЕНИЯ (СРАВНЕНИЯ) ---

    // Равно (==)
    eq(other) {
        const o = Rational._toRational(other);
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
        const o = Rational._toRational(other);
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
        const o = Rational._toRational(other);
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
        const o = Rational._toRational(other);
        if (this.isNaN || o.isNaN) return false;
        return this.lt(o) || this.eq(o);
    }

    // Больше или равно (>=)
    gte(other) {
        const o = Rational._toRational(other);
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