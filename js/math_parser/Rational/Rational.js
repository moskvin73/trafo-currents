class Rational {
  constructor(numerator, denominator = 1n) {
    this.num = BigInt(numerator);
    this.den = BigInt(denominator);

    this._simplify();
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

  static _toRational(val) {
    if (val instanceof Rational) return val;
    return new Rational(val);
  }

  _simplify() {
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
    const o = Rational._toRational(other);
    
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
    const o = Rational._toRational(other);
    if (this.isNaN || o.isNaN) return Rational.NaN;

    if (this.isInfinity || o.isInfinity) {
      if (this.isPositiveInfinity && o.isPositiveInfinity) return Rational.NaN; // Inf - Inf = NaN
      if (this.isNegativeInfinity && o.isNegativeInfinity) return Rational.NaN; // (-Inf) - (-Inf) = NaN
      return this.isPositiveInfinity || o.isNegativeInfinity ? Rational.POSITIVE_INFINITY : Rational.NEGATIVE_INFINITY;
    }

    return new Rational(this.num * o.den - o.num * this.den, this.den * o.den);
  }

  mul(other) {
    const o = Rational._toRational(other);
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
    const o = Rational._toRational(other);
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

  // --- ВЫВОД ДАННЫХ ---

  toString() {
    if (this.isNaN) return "NaN";
    if (this.isPositiveInfinity) return "Infinity";
    if (this.isNegativeInfinity) return "-Infinity";
    return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`;
  }
}