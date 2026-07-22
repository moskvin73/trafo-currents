import { MathType } from './MathType.js';
import { registry } from './AtomRegistry.js';

export class PolynomialTable extends MathType {
  constructor() {
    super();
    // Структура монома: { coeff: Number/Complex, powers: Map(operandID -> exponent) }
    // Использование Map(operandID -> exp) гарантирует быструю сортировку по ключам (ID)
    this.monomials = new Map(); 
    this._hash = null;
  }

  /**
   * Добавить моном в таблицу
   * @param {number|Complex} coeff - Коэффициент
   * @param {Map<number, number>} powers - Карта: [ID операнда] -> [Степень]
   */
  addMonomial(coeff, powers) {
    // 1. Сортируем ключи (ID операндов), чтобы получить каноническую строку степеней
    const sortedKeys = Array.from(powers.keys()).sort((a, b) => a - b);
    
    // 2. Строим уникальную сигнатуру монома для поиска подобных
    let signature = '';
    for (const id of sortedKeys) {
      const exp = powers.get(id);
      if (exp !== 0) {
        signature += `${id}:${exp};`;
      }
    }

    if (!signature) signature = 'constant';

    // 3. Схлопывание подобных членов (Алгебраическое сложение)
    if (this.monomials.has(signature)) {
      const existing = this.monomials.get(signature);
      // Предполагаем, что у нас есть полиморфный метод сложения (из SemanticDispatcher или MathType)
      existing.coeff = this._addCoefficients(existing.coeff, coeff);
      
      // Если коэффициент занулился — удаляем моном из таблицы
      if (this._isZero(existing.coeff)) {
        this.monomials.delete(signature);
      }
    } else {
      if (!this._isZero(coeff)) {
        this.monomials.set(signature, { coeff, powers, sortedKeys });
      }
    }
    
    this._hash = null; // Сбрасываем кэш хэша при изменении структуры
  }

  /**
   * Генерация однозначного хэша таблицы для O(1) сравнений выражений
   */
  get hash() {
    if (this._hash !== null) return this._hash;

    // Считаем хэш как сумму детерминированных хэшей всех мономов (XOR обеспечивает коммутативность)
    let totalHash = 0n;
    
    for (const [signature, monom] of this.monomials.entries()) {
      const monomStr = `${signature}=>${this._coeffToString(monom.coeff)}`;
      totalHash ^= this._cybHash(monomStr);
    }

    this._hash = totalHash.toString(16);
    return this._hash;
  }

  // Быстрая хэш-функция (например, FNV-1a или MurmurHash-like на BigInt)
  _cybHash(str) {
    let hash = 2166136261n;
    for (let i = 0; i < str.length; i++) {
      hash ^= BigInt(str.charCodeAt(i));
      hash = (hash * 16777619n) & 0xFFFFFFFFn;
    }
    return hash;
  }

  _addCoefficients(a, b) {
    // Внедрите вашу логику кросс-типового сложения (число + комплексное)
    return a + b; 
  }

  _isZero(coeff) {
    return coeff === 0 || (coeff.real === 0 && coeff.imag === 0);
  }

  _coeffToString(coeff) {
    return typeof coeff === 'object' ? `${coeff.real}+${coeff.imag}i` : String(coeff);
  }
}
