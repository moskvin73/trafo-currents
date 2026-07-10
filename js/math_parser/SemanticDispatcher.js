import MathType from '../math/MathType.js';
import ComplexNumber from '../math/ComplexNumber.js';
import RealNumber from '../math/RealNumber.js';

const TYPE_REGISTRY = new Map([
  // 1. Сырое число JS (самый низкий ранг)
  ['number', {
    rank: 1,
    casts: new Map([
      [RealNumber, (val) => new RealNumber(val)],
      [ComplexNumber, (val) => new ComplexNumber(val, 0)]
    ])
  }],

  // 2. Объект Вещественного числа
  [RealNumber, {
    rank: 2,
    casts: new Map([
      [ComplexNumber, (obj) => new ComplexNumber(obj.value, 0)]
    ])
  }],

  // 3. Объект Комплексного числа (самый высокий ранг)
  [ComplexNumber, {
    rank: 3,
    casts: new Map() // Ни во что автоматически не преобразуется
  }]
]);

export default class SemanticDispatcher {
  #registry;

  constructor(registry = TYPE_REGISTRY) {
    this.#registry = registry;
  }

  /**
   * Быстрое определение ID типа: строка для примитивов, класс для объектов
   */
  #getTypeId(val) {
    const type = typeof val;
    return type === 'object' && val !== null ? val.constructor : type;
  }

  /**
   * СЕМАНТИЧЕСКИЙ ДИСПЕТЧЕР ТИПОВ
   */
  promoteTypes(leftVal, rightVal) {
    const leftId = this.#getTypeId(leftVal);
    const rightId = this.#getTypeId(rightVal);

    // Если типы строго одинаковы (number и number, или RealNumber и RealNumber)
    if (leftId === rightId) {
      return { l: leftVal, r: rightVal };
    }

    const leftConfig = this.#registry.get(leftId);
    const rightConfig = this.#registry.get(rightId);

    const leftRank = leftConfig ? leftConfig.rank : 0;
    const rightRank = rightConfig ? rightConfig.rank : 0;

    let l = leftVal;
    let r = rightVal;

    // Повышаем младший тип до старшего по цепочке рангов
    if (leftRank < rightRank && rightConfig) {
      l = this.#cast(l, leftId, rightId, leftConfig);
    } else if (rightRank < leftRank && leftConfig) {
      r = this.#cast(r, rightId, leftId, rightConfig);
    }

    return { l, r };
  }

  /**
   * Прямое приведение типа за O(1)
   */
  #cast(value, currentTypeId, targetTypeId, currentConfig) {
    if (currentTypeId === targetTypeId) return value;

    const config = currentConfig || this.#registry.get(currentTypeId);
    const castFunction = config?.casts.get(targetTypeId);

    if (castFunction) {
      return castFunction(value);
    }

    const currentName = typeof currentTypeId === 'function' ? currentTypeId.name : currentTypeId;
    const targetName = typeof targetTypeId === 'function' ? targetTypeId.name : targetTypeId;
    throw new Error(`[Semantic Error]: Невозможно автоматически привести тип ${currentName} к ${targetName}`);
  }
}