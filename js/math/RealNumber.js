import MathType from './MathType.js';
import ComplexNumber from './ComplexNumber.js';

export default class RealNumber extends MathType {
  #value;

  constructor(value) {
    super();
    if (typeof value !== 'number' || Number.isNaN(value)) {
      throw new TypeError('[RealNumber]: Значение должно быть валидным числом.');
    }
    this.#value = value;
  }

  get value() { return this.#value; }

  // Вещественная арифметика — абсолютно точная, без комплексной грязи!
  add(other) {
    if (other instanceof RealNumber) return new RealNumber(this.#value + other.value);
    return new ComplexNumber(this.#value, 0).add(other);
  }

  subtract(other) {
    if (other instanceof RealNumber) return new RealNumber(this.#value - other.value);
    return new ComplexNumber(this.#value, 0).subtract(other);
  }

  multiply(other) {
    if (other instanceof RealNumber) return new RealNumber(this.#value * other.value);
    return new ComplexNumber(this.#value, 0).multiply(other);
  }

  divide(other) {
    if (other instanceof RealNumber) {
      if (other.value === 0) throw new RangeError("Деление на ноль.");
      return new RealNumber(this.#value / other.value);
    }
    return new ComplexNumber(this.#value, 0).divide(other);
  }

  pow(other) {
    if (other instanceof RealNumber) {
      // Если возводим отрицательное число в дробную степень — переходим в комплексное поле
      if (this.#value < 0 && !Number.isInteger(other.value)) {
        return new ComplexNumber(this.#value, 0).pow(other);
      }
      return new RealNumber(Math.pow(this.#value, other.value));
    }
    return new ComplexNumber(this.#value, 0).pow(other);
  }

  // Математические функции
  sin() { return new RealNumber(Math.sin(this.#value)); }
  cos() { return new RealNumber(Math.cos(this.#value)); }
  tan() { return new RealNumber(Math.tan(this.#value)); }
  log() {
    if (this.#value <= 0) return new ComplexNumber(this.#value, 0).log(); // ln от отрицательного — комплексное
    return new RealNumber(Math.log(this.#value));
  }
  sqrt() {
    if (this.#value < 0) return new ComplexNumber(this.#value, 0).sqrt(); // корень из отрицательного — комплексное
    return new RealNumber(Math.sqrt(this.#value));
  }
  exp() { return new RealNumber(Math.exp(this.#value)); }

  toRawTeX() {
    // Округляем только для красивого вывода, как и раньше
    return `${Math.abs(this.#value) < 1e-15 ? 0 : this.#value}`;
  }

  toString() {
    return `${Math.abs(this.#value) < 1e-15 ? 0 : this.#value}`;
  }
}