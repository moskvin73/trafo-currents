import { MathType } from './MathType.js';
import { RationalBigInt } from './RationalBigInt.js';
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
   * Умножение текущей таблицы на другую таблицу (раскрытие скобок)
   * @param {PolynomialTable} other 
   * @returns {PolynomialTable} Новая упрощенная таблица-результат
   */
  multiply(other) {
    const resultTable = new PolynomialTable();

    // Перебираем каждый моном из первой таблицы (this)
    for (const [_, monomA] of this.monomials.entries()) {
      
      // Перебираем каждый моном из второй таблицы (other)
      for (const [_, monomB] of other.monomials.entries()) {
        
    
        // 1. Умножение комплексных дробей BigInt автоматически учтет i^2 = -1
        const nextCoeff = monomA.coeff.mul(monomB.coeff);
        
        // 2. Складываем степени чистых символьных переменных (x, y...)
        const nextPowers = new Map();
        for (const [id, exp] of monomA.powers.entries()) nextPowers.set(id, exp);
        
        for (const [id, exp] of monomB.powers.entries()) {
          if (nextPowers.has(id)) {
            const totalExp = nextPowers.get(id) + exp;
            if (totalExp === 0) nextPowers.delete(id);
            else nextPowers.set(id, totalExp);
          } else {
            nextPowers.set(id, exp);
          }
        }

        // 3. Просто добавляем — никакой ручной чистки мнимой единицы!
        resultTable.addMonomial(nextCoeff, nextPowers);
        /*// 1. Перемножаем дробные коэффициенты BigInt
        const nextCoeff = monomA.coeff.mul(monomB.coeff);
        
        // 2. Складываем степени сомножителей
        const nextPowers = new Map();

        // Копируем степени из А
        for (const [id, exp] of monomA.powers.entries()) {
          nextPowers.set(id, exp);
        }

        // Добавляем/складываем степени из B
        for (const [id, exp] of monomB.powers.entries()) {
          if (nextPowers.has(id)) {
            const totalExp = nextPowers.get(id) + exp;
            if (totalExp === 0) {
              nextPowers.delete(id); // x^0 = 1, убираем операнд
            } else {
              nextPowers.set(id, totalExp);
            }
          } else {
            nextPowers.set(id, exp);
          }
        }

        // 3. Специфическая постобработка мнимой единицы (ID = -2)
        // Если после перемножения i имеет степень, отличную от 0 или 1, упрощаем её
        let finalCoeff = nextCoeff;
        if (nextPowers.has(-2)) {
          const iExp = nextPowers.get(-2);
          
          // Обрабатываем только целые положительные степени мнимой единицы
          if (iExp > 1) {
            const remainder = iExp % 4;
            nextPowers.delete(-2); // Временно убираем, чтобы переписать степень

            if (remainder === 0) {
              // i^4 = 1 -> коэффициент не меняется, i уходит полностью
            } else if (remainder === 1) {
              // i^5 = i -> возвращаем i в 1-й степени
              nextPowers.set(-2, 1);
            } else if (remainder === 2) {
              // i^2 = -1 -> меняем знак коэффициента
              finalCoeff = finalCoeff.mul(new RationalBigInt(-1n, 1n));
            } else if (remainder === 3) {
              // i^3 = -i -> меняем знак коэффициента и возвращаем i в 1-й степени
              finalCoeff = finalCoeff.mul(new RationalBigInt(-1n, 1n));
              nextPowers.set(-2, 1);
            }
          }
        }

        // 4. Безопасно добавляем получившийся моном в результирующую таблицу
        // Метод addMonomial сам отсортирует ключи и схлопнет подобные, если они возникнут
        resultTable.addMonomial(finalCoeff, nextPowers);*/
      }
    }

    return resultTable;
  }

  /**
   * Сложение текущей таблицы с другой таблицей
   * @param {PolynomialTable} other 
   * @returns {PolynomialTable} Новая объединенная таблица
   */
  add(other) {
    const resultTable = new PolynomialTable();

    // Копируем все мономы из первой таблицы
    for (const [_, monom] of this.monomials.entries()) {
      resultTable.addMonomial(monom.coeff, monom.powers);
    }

    // Добавляем все мономы из второй таблицы (метод addMonomial сам схлопнет подобные)
    for (const [_, monom] of other.monomials.entries()) {
      resultTable.addMonomial(monom.coeff, monom.powers);
    }

    return resultTable;
  }

  /**
   * Унарный минус (инверсия знаков всех коэффициентов)
   * @returns {PolynomialTable} Новая инвертированная таблица
   */
  unaryMinus() {
    const resultTable = new PolynomialTable();
    const minusOne = new RationalBigInt(-1n, 1n);

    for (const [_, monom] of this.monomials.entries()) {
      const newCoeff = monom.coeff.mul(minusOne);
      resultTable.addMonomial(newCoeff, monom.powers);
    }

    return resultTable;
  }

  /**
   * Быстрое бинарное возведение таблицы в целую положительную степень
   * @param {number|bigint} exponent 
   * @returns {PolynomialTable} Результат возведения в степень
   */
  pow(exponent) {
    let exp = BigInt(exponent);
    
    if (exp < 0n) {
      throw new Error("Отрицательные степени полиномиальных таблиц требуют деления (внедрение RationalExpression)");
    }

    // Любое выражение в степени 0 дает единичную константу
    if (exp === 0n) {
      const unitTable = new PolynomialTable();
      unitTable.addMonomial(new RationalBigInt(1n, 1n), new Map());
      return unitTable;
    }

    // Алгоритм быстрого возведения в степень (схож с тем, что мы делали для матриц)
    let base = this;
    let result = new PolynomialTable();
    result.addMonomial(new RationalBigInt(1n, 1n), new Map()); // Инициализация единицей

    while (exp > 0n) {
      if (exp % 2n === 1n) {
        result = result.multiply(base);
      }
      base = base.multiply(base);
      exp /= 2n;
    }

    return result;
  } 

  /**
   * Добавить моном в таблицу
   * @param {number|Complex} coeff - Коэффициент
   * @param {Map<number, number>} powers - Карта: [ID операнда] -> [Степень]
   */
  addMonomial(coeff, powers) {
     if (coeff.isZero()) return;

    // Сортируем ID для детерминированной сигнатуры
    const sortedKeys = Array.from(powers.keys()).sort((a, b) => a - b);
    
    let signature = '';
    for (const id of sortedKeys) {
      const exp = powers.get(id);
      if (exp !== 0) {
        signature += `${id}:${exp};`;
      }
    }
    if (!signature) signature = 'constant';

    if (this.monomials.has(signature)) {
      const existing = this.monomials.get(signature);
      existing.coeff = existing.coeff.add(coeff);
      
      if (existing.coeff.isZero()) {
        this.monomials.delete(signature);
      }
    } else {
      this.monomials.set(signature, { coeff, powers, sortedKeys });
    }
    
    this._hash = null; // Сбрасываем кэш хэша
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
