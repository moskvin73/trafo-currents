import BoolValue from '../math/BoolValue.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { TYPE_REGISTRY, dispatcher } from './SemanticDispatcher.js';
import { roundNumber } from '../math/util.js';

const mathClasses = {
    BoolValue,
    RealNumber,
    ComplexNumber,
    Matrix,
};

export const MathRegistry = {

  execute(overloads, args, loc, context = {}) {
    const { overload, castFunctions } = this.resolve(overloads, args, loc);
    
    // Применяем касты к аргументам
    const finalArgs = args.map((arg, i) => castFunctions[i] ? castFunctions[i](arg) : arg);
    
    return this.invoke(overload, finalArgs, loc);
  },

  // НОВЫЙ МЕТОД: Находит перегрузку один раз и готовит функции каста
  resolve(overloads, args, loc) {
    const arity = args.length;
    let bestOverload = null;
    let minConversionScore = Infinity;
    let bestCastFunctions = new Array(arity).fill(null); // Сохраняем функции каста здесь

    const actualTypes = args.map(arg => {
      const type = typeof arg;
      return type === 'object' && arg !== null ? arg.constructor : type;
    });

    for (const overload of overloads) {
      if (overload.types.length !== arity) continue;

      let isCompatible = true;
      let currentScore = 0;
      const currentCastFunctions = new Array(arity).fill(null);

      for (let i = 0; i < arity; i++) {
        const actualType = actualTypes[i];
        const expectedType = overload.types[i];

        if (actualType === expectedType) continue;

        const actualConfig = TYPE_REGISTRY.get(actualType);
        const expectedConfig = TYPE_REGISTRY.get(expectedType);
        const actualRank = actualConfig ? actualConfig.rank : 0;
        const expectedRank = expectedConfig ? expectedConfig.rank : 0;

        if (actualRank > expectedRank) {
          isCompatible = false;
          break;
        }

        const castFn = actualConfig?.casts.get(expectedType);
        if (!castFn) {
          isCompatible = false;
          break;
        }

        currentScore += (expectedRank - actualRank);
        currentCastFunctions[i] = castFn; // Сохраняем ссылку на каст для этого аргумента
      }

      if (isCompatible) {
        if (currentScore < minConversionScore) {
          minConversionScore = currentScore;
          bestOverload = overload;
          bestCastFunctions = currentCastFunctions;
        } else if (currentScore === minConversionScore && bestOverload !== null) {
          throw new TypeError(`[Semantic Error]: Неоднозначность при вызове функции. Найдены несколько конфликтующих перегрузок на ${loc}`);
        }
      }
    }

    if (!bestOverload) {
      const signatureStr = actualTypes.map(t => typeof t === 'function' ? t.name : t).join(', ');
      throw new TypeError(`[Semantic Error]: Ни одна из существующих перегрузок не принимает параметры вида (${signatureStr}) на ${loc}`);
    }

    return { overload: bestOverload, castFunctions: bestCastFunctions };
  },

  // ВЫЗОВ (Шаг 4 из вашего кода вынесен сюда)
  invoke(bestOverload, finalArgs, loc) {
    switch (bestOverload.callType) {
      case 'instance': {
        const [instance, ...rest] = finalArgs;
        return instance[bestOverload.method](...rest);
      }
      case 'static': {
        const targetName = bestOverload.target;
        const methodName = bestOverload.method;
        const targetClass = mathClasses[targetName];
        if (!targetClass || typeof targetClass[methodName] !== 'function') {
          throw new Error(`[Runtime Error]: Не найден статический контекст ${targetName}.${methodName} на ${loc}`);
        }
        return targetClass[methodName](...finalArgs);
      }
      case 'custom': {
        return bestOverload.execute(finalArgs);
      }
      default:
        throw new Error(`[Compiler Error]: Неизвестный callType "${bestOverload.callType}"`);
    }
  }  
/*execute(overloads, args, loc, context = {}) {
  
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
        const targetClass = mathClasses[targetName];//context[targetName];
        
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
  }*/
};

function executeMatrixOperationUniversal(matrix, extraArgs, overloads) {
  const rawData = matrix.unsafeRows;
  const rows = rawData.length;
  if (rows === 0) return new Matrix([]);
  const cols = rawData[0].length;
  if (cols === 0) return new Matrix([]);

  const firstElement = rawData[0][0];
  const elementType = typeof firstElement === 'object' && firstElement !== null 
    ? firstElement.constructor 
    : typeof firstElement;

  // 1. РЕКУРСИЯ: Матрица матриц
  if (elementType === Matrix) {
    const newData = new Array(rows);
    for (let i = 0; i < rows; i++) {
      newData[i] = new Array(cols);
      for (let j = 0; j < cols; j++) {
        newData[i][j] = executeMatrixOperationUniversal(rawData[i][j], extraArgs, overloads);
      }
    }
    return new Matrix(newData);
  }

  // 2. ОПРЕДЕЛЯЕМ ПРАВИЛО И КАСТЫ ОДИН РАЗ НА ВСЮ МАТРИЦУ
  // Имитируем аргументы для первой ячейки: [Ячейка, ...допАргументы]
  const pilotArgs = [firstElement, ...extraArgs];
  const { overload, castFunctions } = MathRegistry.resolve(overloads, pilotArgs, "внутри Matrix");

  // Кэшируем функции каста для дополнительных аргументов (они одинаковы для всех ячеек!)
  // Нам не нужно кастить extraArgs на каждой итерации. Сделаем это один раз прямо сейчас:
  const finalizedExtraArgs = extraArgs.map((arg, idx) => {
    const castFn = castFunctions[idx + 1]; // idx + 1 так как первый аргумент — ячейка матрицы
    return castFn ? castFn(arg) : arg;
  });

  // Смотрим, нужен ли каст для самой ячейки матрицы (первый элемент сигнатуры)
  const cellCastFn = castFunctions[0];

  // 3. СВЕРХБЫСТРЫЙ ВЫЧИСЛИТЕЛЬНЫЙ ЦИКЛ (Чистый Runtime по готовой ссылке)
  const newData = new Array(rows);
  for (let i = 0; i < rows; i++) {
    newData[i] = new Array(cols);
    for (let j = 0; j < cols; j++) {
      // Извлекаем значение ячейки
      let cellValue = rawData[i][j];
      
      // Если для типа ячейки нужен каст согласно выбранной сигнатуре — выполняем
      if (cellCastFn) cellValue = cellCastFn(cellValue);

      // Собираем готовый массив аргументов для вызова
      const finalCellArgs = [cellValue, ...finalizedExtraArgs];

      // Мгновенный вызов метода по готовой ссылке на перегрузку! Без поиска!
      newData[i][j] = MathRegistry.invoke(overload, finalCellArgs, "внутри Matrix");
    }
  }

  return new Matrix(newData);
}

export function getCommandInfo(commandName) {
  const entry = COMPILER_REGISTRY.get(commandName);
  if (!entry) return null;

  // Проверяем: это объект с описанием (как у 'sqrt') или прямой массив (как у 'conjugate')?
  const isObjectWithDescription = !Array.isArray(entry) && entry.overloads;

  return {
    // Если есть явное описание — берем его, иначе — дефолтный текст
    description: isObjectWithDescription ? entry.description : 'Описание отсутсвует',
    // Вытаскиваем массив перегрузок в любом случае
    overloads: isObjectWithDescription ? entry.overloads : entry
  };
}

// =========================================================================
// 2. ДЕКЛАРАТИВНЫЙ РЕЕСТР СИГНАТУР ФУНКЦИЙ (COMPILER REGISTRY)
// =========================================================================
let roundRules = [];
roundRules =
[
  { types: [RealNumber], 
           callType: 'custom', 
           execute: ([x]) => new RealNumber(Math.round(x.value)) 
  },
  { types: [RealNumber, RealNumber], callType: 'custom', execute: 
                                      ([x, y]) => new RealNumber(roundNumber(x.value, y.value)) },
  { types: [ComplexNumber], callType: 'custom', execute: ([x]) => { 
        const r = Math.round(x.real);
        const i = Math.round(x.imaginary);
        return new ComplexNumber(r, i) }},
  { types: [ComplexNumber, RealNumber], callType: 'custom', execute: ([x, y]) => { 
        const r = roundNumber(x.real, y);
        const i = roundNumber(x.imaginary, y);
        return new ComplexNumber(r, i) }},
  { 
    types: [Matrix], 
    callType: 'custom', 
    execute: (args) => {
      const [matrix, ...restArgs] = args; 
      return executeMatrixOperationUniversal(matrix, restArgs, roundRules);
    }
  },
  { 
    types: [Matrix, RealNumber], 
    callType: 'custom', 
    execute: (args) => {
      const [matrix, ...restArgs] = args; 
      return executeMatrixOperationUniversal(matrix, restArgs, roundRules);
    }
  },
];

let floorRules = [];
floorRules =
[
    { types: [RealNumber], callType: 'custom', execute: ([x]) => new RealNumber(Math.floor(x.value)) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => {
        const r = Math.floor(x.real);
        const i = Math.floor(x.imaginary);
        return new ComplexNumber(r, i) }},
    { 
      types: [Matrix], 
      callType: 'custom', 
      execute: (args) => {
        const [matrix, ...restArgs] = args; 
        return executeMatrixOperationUniversal(matrix, restArgs, floorRules);
      }
    },
];

let ceilRules = [];
ceilRules =
[
    { types: [RealNumber], callType: 'custom', execute: ([x]) => new RealNumber(Math.ceil(x.value)) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => {
        const r = Math.ceil(x.real);
        const i = Math.ceil(x.imaginary);
        return new ComplexNumber(r, i) }},
    { 
      types: [Matrix], 
      callType: 'custom', 
      execute: (args) => {
        const [matrix, ...restArgs] = args; 
        return executeMatrixOperationUniversal(matrix, restArgs, ceilRules);
      }
    },
];

let absRules = [];
absRules =
[
    { types: [RealNumber], callType: 'custom', execute: ([x]) => new RealNumber(x.abs()) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => new RealNumber(x.abs()) },
    { 
      types: [Matrix], 
      callType: 'custom', 
      execute: (args) => {
        const [matrix, ...restArgs] = args; 
        return executeMatrixOperationUniversal(matrix, restArgs, absRules);
      }
    },
];

export const COMPILER_REGISTRY = new Map([
  // === ФУНКЦИЯ SQRT (1 или 2 аргумента) ===
  ['sqrt', {
    description: 'Вычисление квадратного корня <code>sqrt(x)</code>—$\\sqrt{x}$ или вычисление корень заданной степени <code>sqrt(x, y)</code>—$\\sqrt[y]{x}$.<br>Типы данных <code>real, complex</code>.', 
    overloads:[
    { types: [RealNumber], callType: 'instance', method: 'sqrt' },
    { types: [ComplexNumber], callType: 'instance', method: 'sqrt' },
    { types: [RealNumber, RealNumber], callType: 'instance', method: 'sqrt' },
    { types: [ComplexNumber, ComplexNumber], callType: 'instance', method: 'sqrt' },
  ]}],

  ['round',   roundRules],
  ['floor',   floorRules],
  ['ceil',    ceilRules],
  ['abs',     absRules],

  ['conjugate', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.conjugate },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.conjugate },
  ]],

  ['phase', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.phase },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => new RealNumber(x.phase) },
  ]],

  ['imag', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => new RealNumber(0) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => new RealNumber(x.imaginary) },
  ]],

  // Радианы (rad) в Градусы (deg)
  ['deg', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.multiply(180 / Math.PI) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.multiply(180 / Math.PI) },
  ]],

  // Радианы (rad) в Грады (grad)
  ['grad', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.multiply(200 / Math.PI) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.multiply(200 / Math.PI) },
  ]],

  // Радианы (rad) в Обороты (rev)
  ['rev', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.divide(2 * Math.PI) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.divide(2 * Math.PI) },
  ]],

  ['rad_deg', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.multiply(Math.PI / 180) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.multiply(Math.PI / 180) },
  ]],

  ['rad_grad', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.multiply(Math.PI / 200) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.multiply(Math.PI / 200) },
  ]],

  ['rad_rev', [
    { types: [RealNumber], callType: 'custom', execute: ([x]) => x.multiply(2 * Math.PI) },
    { types: [ComplexNumber], callType: 'custom', execute: ([x]) => x.multiply1(2 * Math.PI) },
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
  ['zeros', [
    {
      types: [RealNumber, RealNumber],
      callType: 'custom',
      execute: (finalArgs) => {
        // finalArgs[0] — это гарантированно RealNumber благодаря вашей системе скоринга
        const n = finalArgs[0].value;
        const m = finalArgs[1].value;
        return Matrix.create(n, m);
      }
    }
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

  ['columns', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return new RealNumber(inputMatrix.colCount);
      }
    }
  ]],

  ['rows', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return new RealNumber(inputMatrix.rowCount);
      }
    }
  ]],

  ['is_square', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return new BoolValue(inputMatrix.isSquare);
      }
    }
  ]],

  ['is_vector', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return new BoolValue(inputMatrix.isVector);
      }
    }
  ]],

  ['min', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return inputMatrix.min();
      }
    }
  ]],

  ['max', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return inputMatrix.max();
      }
    }
  ]],

  ['avg', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return inputMatrix.avg();
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
        const [inputMatrix] = finalArgs;
        if (inputMatrix.rowCount !== 1) {
          throw new TypeError("[Semantic Error]: Функция colvector() ожидает одномерный список элементов вида [a, b, c].");
        }
        // Извлекаем именно ОДНОМЕРНЫЙ массив объектов MathType
        const vectorElements = inputMatrix.getRawRows()[0];
        return Matrix.columnVector(vectorElements);
      }
    }
  ]],

  // === ТРАНСПОНИРОВАНИЕ МАТРИЦЫ ===
  ['transpose', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs; // Извлекаем матрицу из массива аргументов
        return inputMatrix.transpose();
      }
    }
  ]],  

   // === ОПРЕДЕЛИТЕЛЬ МАТРИЦЫ ===
  ['det', [
    { types: [Matrix], callType: 'instance', method: 'det' }
  ]],

  // === РЕШЕНИЕ СИСТЕМ ЛИНЕЙНЫХ УРАВНЕНИЙ (СЛАУ) ===
  ['linsolve', [
    {
      types: [Matrix, Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        // 1. Распаковываем исходные аргументы из массива
        const [matrixM, vectorB] = finalArgs;

        // 2. ЯВНО вызываем ваш семантический диспетчер типов!
        // Он заглянет внутрь матриц, увидит, что вектор комплексный, 
        // и подтянет матрицу M до комплексного уровня.
        const { l, r } = dispatcher.promoteTypes(matrixM, vectorB);

        // 3. Передаем идеально выровненные по типам данных матрицы в вычислительное ядро
        return Matrix.solveSystem(l, r);
      }
    }
  ]],  
  
  // === ОБРАТНАЯ МАТРИЦА ===
  ['invert', [
    {
      types: [Matrix],
      callType: 'custom',
      execute: (finalArgs) => {
        const [inputMatrix] = finalArgs;
        return inputMatrix.invert();
      }
    }
  ]],  
  // === СТАТИЧЕСКИЕ СТРУКТУРНЫЕ ВЫЗОВЫ (Пример на будущее) ===
  /*['solve', [
    { types: ['Matrix', 'Vector'], callType: 'static', target: 'LinearAlgebra', method: 'solve' }
  ]]*/
]);