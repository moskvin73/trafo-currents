import { RationalBigInt } from './RationalBigInt.js';

export class RationalComplexBigInt {
  constructor(real, imag = null) {
    // Если переданы уже готовые дроби RationalBigInt
    this.real = real instanceof RationalBigInt ? real : new RationalBigInt(BigInt(real));
    this.imag = imag instanceof RationalBigInt ? imag : new RationalBigInt(BigInt(imag || 0n));
  }

  add(other) {
    return new RationalComplexBigInt(
      this.real.add(other.real),
      this.imag.add(other.imag)
    );
  }

  mul(other) {
    // (a + bi)*(c + di) = (a*c - b*d) + (a*d + b*c)i
    const ac = this.real.mul(other.real);
    const bd = this.imag.mul(other.imag);
    const ad = this.real.mul(other.imag);
    const bc = this.imag.mul(other.real);

    // Унарный минус для bd, так как i^2 = -1
    return new RationalComplexBigInt(
      ac.add(bd.unaryMinus ? bd.unaryMinus() : bd.mul(new RationalBigInt(-1n))), 
      ad.add(bc)
    );
  }

  isZero() {
    return this.real.isZero() && this.imag.isZero();
  }

  toString() {
    if (this.imag.isZero()) return this.real.toString();
    if (this.real.isZero()) return `${this.imag.toString()}*i`;
    return `(${this.real.toString()} + ${this.imag.toString()}*i)`;
  }
}