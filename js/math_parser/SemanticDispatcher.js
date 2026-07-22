import MathType from '../math/MathType.js';
import ComplexNumber from '../math/ComplexNumber.js';
import RealNumber from '../math/RealNumber.js';

export const TYPE_REGISTRY = new Map([
  // 1. Примитив JS число. 
  ['number', {
    rank: 1,
    // ЕСЛИ тип встретился сам с собой, принудительно трансформируем его:
    selfPromote: (val) => new RealNumber(val), 
    casts: new Map([
      [RealNumber, (val) => new RealNumber(val)],
      [ComplexNumber, (val) => new ComplexNumber(val, 0)]
    ])
  }],

  // 2. Вещественное число.
  [RealNumber, {
    rank: 2,
    selfPromote: null, // Уже объект, повышать самого до себя не нужно
    casts: new Map([
      [ComplexNumber, (obj) => new ComplexNumber(obj.value, 0)]
    ])
  }],

  // 3. Комплексное число.
  [ComplexNumber, {
    rank: 3,
    selfPromote: null,
    casts: new Map()
  }],
  
  [Matrix, {
    rank: 4,          // Самый высокий ранг, чтобы диспетчер не пытался превратить матрицу в число
    selfPromote: null,
    casts: new Map()   // Касты пусты, так как число нельзя неявно превратить в матрицу
  }]
]);

export default class SemanticDispatcher {
  #registry;

  constructor(registry = TYPE_REGISTRY) {
    this.#registry = registry;
  }

  #getTypeId(val) {
    const type = typeof val;
    return type === 'object' && val !== null ? val.constructor : type;
  }

  /**
   * СЕМАНТИЧЕСКИЙ ДИСПЕТЧЕР ТИПОВ (Полностью абстрактный)
   */
  promoteTypes(leftVal, rightVal) {
    const leftId = this.#getTypeId(leftVal);
    const rightId = this.#getTypeId(rightVal);

    const leftConfig = this.#registry.get(leftId);
    const rightConfig = this.#registry.get(rightId);

    // СЛУЧАЙ 1: Типы абсолютно одинаковы (например, number и number)
    if (leftId === rightId) {
      // Проверяем, есть ли декларативное правило авто-повышения для этого типа
      if (leftConfig?.selfPromote) {
        return { 
          l: leftConfig.selfPromote(leftVal), 
          r: leftConfig.selfPromote(rightVal) 
        };
      }
      // Если правила нет (например, RealNumber и RealNumber), возвращаем как есть
      return { l: leftVal, r: rightVal };
    }

    // СЛУЧАЙ 2: Типы разные (стандартное семантическое повышение)
    const leftRank = leftConfig ? leftConfig.rank : 0;
    const rightRank = rightConfig ? rightConfig.rank : 0;

    let l = leftVal;
    let r = rightVal;

    if (leftRank < rightRank && rightConfig) {
      l = this.#cast(l, leftId, rightId, leftConfig);
    } else if (rightRank < leftRank && leftConfig) {
      r = this.#cast(r, rightId, leftId, rightConfig);
    }

    return { l, r };
  }

  #cast(value, currentTypeId, targetTypeId, currentConfig) {
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