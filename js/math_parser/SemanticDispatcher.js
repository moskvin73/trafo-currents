import MathType from '../math/MathType.js';
import ComplexNumber from '../math/ComplexNumber.js';
import RealNumber from '../math/RealNumber.js';
import Matrix from '../math/Matrix.js';

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

    // СЛУЧАЙ 1: Типы абсолютно одинаковы
    if (leftId === rightId) {
      if (leftConfig?.selfPromote) {
        return { 
          l: leftConfig.selfPromote(leftVal), 
          r: leftConfig.selfPromote(rightVal) 
        };
      }
      return { l: leftVal, r: rightVal };
    }

    // ИСКЛЮЧЕНИЕ ДЛЯ ЛИНЕЙНОЙ АЛГЕБРЫ:
    // ИНТЕЛЛЕКТУАЛЬНЫЙ АНАЛИЗ ДЛЯ ЛИНЕЙНОЙ АЛГЕБРЫ
    const MATRIX_SYMBOL = Symbol.for('Math.Matrix');
    const isLeftMatrix = leftVal.constructor.typeId === MATRIX_SYMBOL;
    const isRightMatrix = rightVal.constructor.typeId === MATRIX_SYMBOL;

    if (isLeftMatrix || isRightMatrix) {
      let matrix = isLeftMatrix ? leftVal : rightVal;
      let scalar = isLeftMatrix ? rightVal : leftVal;

      // Нормализуем примитив 'number' до RealNumber через ваш реестр, если это необходимо
      if (typeof scalar === 'number' && this.#registry.get('number')?.selfPromote) {
        scalar = this.#registry.get('number').selfPromote(scalar);
      }

      // Определяем типы (классы-конструкторы) скаляра и элементов внутри матрицы
      const scalarClass = scalar.constructor;
      // Так как матрица у нас теперь гарантированно однородная, берем тип ее самого первого элемента [0][0]
      const matrixElementsClass = matrix.get(0, 0).constructor;

      // Извлекаем конфигурации рангов из вашего приватного реестра #registry
      const scalarConfig = this.#registry.get(scalarClass);
      const matrixElementsConfig = this.#registry.get(matrixElementsClass);

      const scalarRank = scalarConfig ? scalarConfig.rank : 0;
      const matrixElementsRank = matrixElementsConfig ? matrixElementsConfig.rank : 0;

      // ГЛАВНОЕ РЕШЕНИЕ: Если ранг скаляра выше, чем текущий ранг элементов матрицы,
      // мы динамически повышаем ВСЮ матрицу до типа этого скаляра!
      if (scalarRank > matrixElementsRank) {
        matrix = matrix.castElementsTo(scalarClass);
      }

      // Возвращаем операнды на свои места, полностью выровненные по типам чисел!
      return {
        l: isLeftMatrix ? matrix : scalar,
        r: isLeftMatrix ? scalar : matrix
      };
    }

    // СЛУЧАЙ 2: Стандартное семантическое повышение (для чисел между собой)
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

    /*const leftId = this.#getTypeId(leftVal);
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

    return { l, r };*/
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