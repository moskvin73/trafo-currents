export class RationalBigInt {
  constructor(numerator, denominator = 1n) {
    // Приводим к BigInt, если переданы обычные числа
    let num = BigInt(numerator);
    let den = BigInt(denominator);

    if (den === 0n) {
      throw new Error("Катастрофа: Деление на ноль в CAS!");
    }

    // Следим за знаком: знаменатель всегда должен быть положительным
    if (den < 0n) {
      num = -num;
      den = -den;
    }

    // Автоматическое сокращение при создании дроби
    const gcdValue = RationalBigInt.gcd(num < 0n ? -num : num, den);
    this.num = num / gcdValue;
    this.den = den / gcdValue;
  }

  // Быстрый алгоритм Евклида для BigInt
  static gcd(a, b) {
    while (b !== 0n) {
      let t = b;
      b = a % b;
      a = t;
    }
    return a;
  }

  add(other) {
    const newNum = this.num * other.den + other.num * this.den;
    const newDen = this.den * other.den;
    return new RationalBigInt(newNum, newDen);
  }

  mul(other) {
    return new RationalBigInt(this.num * other.num, this.den * other.den);
  }

  isZero() {
    return this.num === 0n;
  }

  toString() {
    return this.den === 1n ? `${this.num}` : `${this.num}/${this.den}`;
  }
}