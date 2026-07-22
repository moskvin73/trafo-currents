import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { TYPE_REGISTRY } from './SemanticDispatcher.js';

// =========================================================================
// 2. ДЕКЛАРАТИВНЫЙ РЕЕСТР СИГНАТУР ФУНКЦИЙ (COMPILER REGISTRY)
// =========================================================================
export const COMPILER_REGISTRY = new Map([
  // === ФУНКЦИЯ SQRT (1 или 2 аргумента) ===
  ['sqrt', [
    { types: [RealNumber], callType: 'instance', method: 'sqrt' },
    { types: [ComplexNumber], callType: 'instance', method: 'sqrt' },
    { types: [RealNumber, RealNumber], callType: 'instance', method: 'sqrt' }
  ]],

  // === ЛОГАРИФМЫ ===
  ['ln', [
    { types: [RealNumber], callType: 'instance', method: 'log' },
    { types: [ComplexNumber], callType: 'instance', method: 'log' }
  ]],
  ['lg', [
    { types: [RealNumber], callType: 'instance', method: 'log10' },
    { types: [ComplexNumber], callType: 'instance', method: 'log10' }
  ]],
  ['log', [
    { types: [RealNumber, RealNumber], callType: 'instance', method: 'logBase' },
    { types: [ComplexNumber, ComplexNumber], callType: 'instance', method: 'logBase' }
  ]],

  // === СТЕПЕНЬ ===
  ['pow', [
    { types: [RealNumber, RealNumber], callType: 'instance', method: 'accuratePow' },
    { types: [ComplexNumber, ComplexNumber], callType: 'instance', method: 'accuratePow' }
  ]],

  ['exp', [
    { types: [RealNumber], callType: 'instance', method: 'exp' },
    { types: [ComplexNumber], callType: 'instance', method: 'exp' }
  ]],

  // === ТРИГОНОМЕТРИЯ И СИНОНИМЫ ===
  ['sin',  [{ types: [RealNumber], callType: 'instance', method: 'sin' }, { types: [ComplexNumber], callType: 'instance', method: 'sin' }]],
  ['cos',  [{ types: [RealNumber], callType: 'instance', method: 'cos' }, { types: [ComplexNumber], callType: 'instance', method: 'cos' }]],
  ['tan',  [{ types: [RealNumber], callType: 'instance', method: 'tan' }, { types: [ComplexNumber], callType: 'instance', method: 'tan' }]],
  ['tg',   [{ types: [RealNumber], callType: 'instance', method: 'tan' }, { types: [ComplexNumber], callType: 'instance', method: 'tan' }]],

  // === ГИПЕРБОЛИЧЕСКИЕ ФУКЦИИ ===
  ['sinh',  [{ types: [RealNumber], callType: 'instance', method: 'sin' }, { types: [ComplexNumber], callType: 'instance', method: 'sin' }]],
  ['cosh',  [{ types: [RealNumber], callType: 'instance', method: 'cos' }, { types: [ComplexNumber], callType: 'instance', method: 'cos' }]],
  ['tanh',  [{ types: [RealNumber], callType: 'instance', method: 'tan' }, { types: [ComplexNumber], callType: 'instance', method: 'tan' }]],
  ['tgh',   [{ types: [RealNumber], callType: 'instance', method: 'tan' }, { types: [ComplexNumber], callType: 'instance', method: 'tan' }]],

  // === ОБРАТНЫЕ ФУНКЦИИ ===
  ['arcsin',  [{ types: [RealNumber], callType: 'instance', method: 'arcsin' },  { types: [ComplexNumber], callType: 'instance', method: 'arcsin' }]],
  ['arccos',  [{ types: [RealNumber], callType: 'instance', method: 'arccos' },  { types: [ComplexNumber], callType: 'instance', method: 'arccos' }]],
  ['arctan',  [{ types: [RealNumber], callType: 'instance', method: 'arctan' },  { types: [ComplexNumber], callType: 'instance', method: 'arctan' }]],
  ['arctg',   [{ types: [RealNumber], callType: 'instance', method: 'arctan' },  { types: [ComplexNumber], callType: 'instance', method: 'arctan' }]],
  ['arcsinh', [{ types: [RealNumber], callType: 'instance', method: 'arcsinh' }, { types: [ComplexNumber], callType: 'instance', method: 'arcsinh' }]],
  ['arccosh', [{ types: [RealNumber], callType: 'instance', method: 'arccosh' }, { types: [ComplexNumber], callType: 'instance', method: 'arccosh' }]],
  ['arctanh', [{ types: [RealNumber], callType: 'instance', method: 'arctanh' }, { types: [ComplexNumber], callType: 'instance', method: 'arctanh' }]],

  // === СОСТАВНЫЕ ФУНКЦИИ ПРЯМО В ТАБЛИЦЕ (Без раздувания числовых классов) ===
  ['sec', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.cos().accuratePow(new RealNumber(-1)) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.cos().accuratePow(new RealNumber(-1)) }
  ]],

  ['arcsec', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.equals(0) ? new ComplexNumber(Math.PI * 0.5, -Infinity): x.inverse().arccos() },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.equals(0) ? new ComplexNumber(Math.PI * 0.5, -Infinity): x.inverse().arccos() }
  ]],

  ['csc', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.sin().accuratePow(new RealNumber(-1)) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.sin().accuratePow(new RealNumber(-1)) }
  ]],

  ['arccsc', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.equals(0) ? new ComplexNumber(0, Infinity): x.inverse().arcsin() },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.equals(0) ? new ComplexNumber(0, Infinity): x.inverse().arcsin() }
  ]],

  ['ctg', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.tan().accuratePow(new RealNumber(-1)) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.tan().accuratePow(new RealNumber(-1)) }
  ]],
  ['cot', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.tan().accuratePow(new RealNumber(-1)) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.tan().accuratePow(new RealNumber(-1)) }
  ]],

  // Единичная матрица: принимает размерность (вещественное число)
  ['ident', [
    {
      types: [RealNumber],
      callType: 'custom',
      execute: (finalArgs) => {
        // finalArgs[0] — это гарантированно RealNumber благодаря вашей системе скоринга
        const n = finalArgs[0].value; 
        return Matrix.identity(n);
      }
    }
  ]],

  // Диагональная матрица
  ['diag', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
       const [inputMatrix] = finalArgs;
        if (inputMatrix.rowCount !== 1) {
          throw new TypeError("[Semantic Error]: Функция diag() ожидает одномерный список элементов вида [a, b, c].");
        }
        // Извлекаем именно ОДНОМЕРНЫЙ массив объектов MathType из первой строки матрицы
        const diagonalElements = inputMatrix.getRawRows()[0]; 
        return Matrix.diagonal(diagonalElements);
      }
    }
  ]],

  // Вектор-столбец
  ['colvector', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const inputMatrix = finalArgs;
        if (inputMatrix.rowCount !== 1) {
          throw new TypeError("[Semantic Error]: Функция colvector() ожидает одномерный список элементов вида [a, b, c].");
        }
        // Извлекаем именно ОДНОМЕРНЫЙ массив объектов MathType
        const vectorElements = inputMatrix.getRawRows()[0];
        return Matrix.columnVector(vectorElements);
      }
    }
  ]],

  // === СТАТИЧЕСКИЕ СТРУКТУРНЫЕ ВЫЗОВЫ (Пример на будущее) ===
  /*['solve', [
    { types: ['Matrix', 'Vector'], callType: 'static', target: 'LinearAlgebra', method: 'solve' }
  ]]*/
]);

export const MathRegistry = {
  /**
   * Диспетчер сигнатур с алгоритмом автоматического скоринга и приведения типов
   */
  /*execute(name, args, loc, context = {}) {
    const overloads = COMPILER_REGISTRY.get(name);
    if (!overloads) {
      throw new Error(`[Semantic Error]: Функция "${name}" не поддерживается вычислительным ядром на ${loc}`);
    }*/
execute(overloads, args, loc, context = {}) {
  
    const arity = args.length;
    let bestOverload = null;
    let finalArgs = null;
    let minConversionScore = Infinity; // Чем меньше счет, тем точнее совпадение типов

    // Шаг 1: Извлекаем фактические типы переданных аргументов за O(1)
    const actualTypes = args.map(arg => {
      const type = typeof arg;
      return type === 'object' && arg !== null ? arg.constructor : type;
    });

    // Шаг 2: Сканируем перегрузки и ищем наиболее совместимую
    for (const overload of overloads) {
      // Фильтр по количеству аргументов (арности)
      if (overload.types.length !== arity) continue;

      let isCompatible = true;
      let currentScore = 0;
      const candidatesArgs = [];

      for (let i = 0; i < arity; i++) {
        const actualType = actualTypes[i];
        const expectedType = overload.types[i];

        // Ситуация А: Точное совпадение типа (Идеальный случай, штраф = 0)
        if (actualType === expectedType) {
          candidatesArgs.push(args[i]);
          continue;
        }

        // Ситуация Б: Неявное приведение типов на основе декларативных рангов
        const actualConfig = TYPE_REGISTRY.get(actualType);
        const expectedConfig = TYPE_REGISTRY.get(expectedType);

        const actualRank = actualConfig ? actualConfig.rank : 0;
        const expectedRank = expectedConfig ? expectedConfig.rank : 0;

        // Запрещено: Попытка передать старший тип вместо младшего (например, Complex вместо Real)
        if (actualRank > expectedRank) {
          isCompatible = false;
          break;
        }

        // Ищем функцию каста фактического типа к формальному типу сигнатуры
        const castFn = actualConfig?.casts.get(expectedType);
        if (!castFn) {
          isCompatible = false;
          break;
        }

        // Вычисляем "дистанцию" трансформации как штрафной балл компилятора
        currentScore += (expectedRank - actualRank);
        candidatesArgs.push(castFn(args[i]));
      }

      // Шаг 3: Разрешение неоднозначностей (Ambiguous Resolution)
      if (isCompatible) {
        if (currentScore < minConversionScore) {
          minConversionScore = currentScore;
          bestOverload = overload;
          finalArgs = candidatesArgs;
        } else if (currentScore === minConversionScore && bestOverload !== null) {
          // Если две разные перегрузки требуют одинакового веса преобразований
          throw new TypeError(`[Semantic Error]: Неоднозначность при вызове функции "${name}". Найдены несколько конфликтующих перегрузок с одинаковым приоритетом на ${loc}`);
        }
      }
    }

    // Если совместимая сигнатура так и не была найдена
    if (!bestOverload) {
      const signatureStr = actualTypes.map(t => typeof t === 'function' ? t.name : t).join(', ');
      throw new TypeError(`[Semantic Error]: Ни одна из существующих перегрузок функции "${name}" не принимает параметры вида (${signatureStr}) на ${loc}`);
    }

    // Шаг 4: Выполнение вызова на основе разрешенного контекста сигнатуры
    switch (bestOverload.callType) {
      
      // Вызов метода экземпляра класса: arg0.method(arg1, ...)
      case 'instance': {
        const [instance, ...rest] = finalArgs;
        const methodName = bestOverload.method;
        return instance[methodName](...rest);
      }

      // Вызов статического метода внешнего модуля: Module.method(arg0, arg1, ...)
      case 'static': {
        const targetName = bestOverload.target;
        const methodName = bestOverload.method;
        const targetClass = context[targetName];
        
        if (!targetClass || typeof targetClass[methodName] !== 'function') {
          throw new Error(`[Runtime Error]: Не найден статический контекст ${targetName}.${methodName} на ${loc}`);
        }
        return targetClass[methodName](...finalArgs);
      }

      // Вызов изолированной логики, описанной замыканием прямо в таблице
      case 'custom': {
        return bestOverload.execute(finalArgs);
      }

      default:
        throw new Error(`[Compiler Error]: Критическая ошибка: неизвестный callType "${bestOverload.callType}"`);
    }
  }
};