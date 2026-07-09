// Импортируем наш базовый математический тип, чтобы использовать в проверках, 
// если потребуется расширение, или для явного понимания типов
import MathType from '../math/MathType.js';
import ComplexNumber from '../math/ComplexNumber.js';
import RealNumber from '../math/RealNumber.js';

/**
 * Базовый абстрактный класс для всех узлов Дерева Выражений (AST).
 */
export default class ASTNode {
  /**
   * @param {SourceLocation} loc - Координаты токена в исходном коде
   */
  constructor(loc) {
    this.loc = loc;
  }

  /** Вычисляет значение узла, возвращая экземпляр MathType (ComplexNumber/Matrix) */
  evaluate(context = {}) {
    throw new Error("[ASTNode]: Метод evaluate() не реализован.");
  }

  /** Генерирует чистый LaTeX-код БЕЗ знаков доллара */
  toTeX() {
    throw new Error("[ASTNode]: Метод toTeX() не реализован.");
  }
}

/**
 * Узел числа (Терминальный узел / Лист дерева)
 */
export class NumberNode extends ASTNode {
  constructor(mathTypeValue, loc) {
    super(loc);
    this.value = mathTypeValue; // Здесь может лежать и RealNumber, и ComplexNumber
  }

  evaluate(context) {
    return this.value; // Просто возвращает математический объект
  }

  toTeX() {
    return this.value.toRawTeX(); // Каждый тип сам знает, как себя нарисовать!
  }
}

/**
 * Узел унарной операции (например: -x, +sin(i))
 */
export class UnaryOpNode extends ASTNode {
  /**
   * @param {string} operator - '+' или '-'
   * @param {ASTNode} argument - Узел, к которому применяется операция
   * @param {SourceLocation} loc 
   */
  constructor(operator, argument, loc) {
    super(loc);
    this.operator = operator;
    this.argument = argument;
  }

  evaluate(context) {
    const argVal = this.argument.evaluate(context);

    if (this.operator === '+') {
      return argVal; // Плюс ничего не меняет
    }
    if (this.operator === '-') {
      // Унарный минус — это умножение комплексного числа на -1
      return argVal.multiply(-1);
    }
    throw new Error(`[AST]: Неподдерживаемый унарный оператор "${this.operator}" на ${this.loc}`);
  }

  toTeX() {
    const argTex = this.argument.toTeX();
    // Если аргумент — это бинарная операция со знаком (например, - (a + b)),
    // в LaTeX могут понадобиться скобки. Но для простых узлов выводим как есть.
    return `${this.operator}${argTex}`;
  }
}

/**
 * Узел бинарной операции (+, -, *, /, ^)
 */
export class BinaryOpNode extends ASTNode {
  constructor(left, operator, right, loc) {
    super(loc);
    this.left = left;
    this.operator = operator;
    this.right = right;
  }

  /**
   * СЕМАНТИЧЕСКИЙ ДИСПЕТЧЕР ТИПОВ
   * Приводит аргументы к единому типу на основе иерархии перед вычислением.
   */
  #promoteTypes(leftVal, rightVal) {
   // 1. Автоматическая обертка сырых чисел JS в RealNumber
    if (typeof leftVal === 'number') leftVal = new RealNumber(leftVal);
    if (typeof rightVal === 'number') rightVal = new RealNumber(rightVal);


    // 1. Определение рангов типов
    const getRank = (obj) => {
      if (obj instanceof RealNumber) return 1;
      if (obj instanceof ComplexNumber) return 2;
      // Задел на будущее: if (obj instanceof Matrix) return 3;
      return 0;
    };

    let l = leftVal;
    let r = rightVal;
    const leftRank = getRank(l);
    const rightRank = getRank(r);

    // 2. Если типы разные, семантически повышаем младший до старшего через конструкторы
    if (leftRank < rightRank) {
      l = this.#cast(l, r.constructor);
    } else if (rightRank < leftRank) {
      r = this.#cast(r, l.constructor);
    }

    return { l, r };
  }

  /**
   * Чистая логика преобразования одного типа в другой с помощью стандартных конструкторов
   */
  #cast(obj, TargetClass) {
    if (obj instanceof TargetClass) return obj;

    // Вещественное число -> в Комплексное число
    if (obj instanceof RealNumber && TargetClass === ComplexNumber) {
      return new ComplexNumber(obj.value, 0);
    }
    
    // Задел на будущее: Вещественное/Комплексное число -> в Матрицу 1х1
    // if (TargetClass === Matrix) { return new Matrix([[obj]]); }

    throw new TypeError(`[Semantic Error]: Невозможно автоматически привести тип ${obj.constructor.name} к ${TargetClass.name} на ${this.loc}`);
  }

  evaluate(context) {
    // Вычисляем ветви дерева (получаем чистые MathType объекты)
    const rawLeft = this.left.evaluate(context);
    const rawRight = this.right.evaluate(context);

    // Семантическое выравнивание типов перед вычислением
    const { l, r } = this.#promoteTypes(rawLeft, rawRight);

    // Вызываем скрытый метод операции, теперь типы ГАРАНТИРОВАННО одинаковые
    const internalMethod = `_${this.operator === '+' ? 'add' : 
                             this.operator === '-' ? 'subtract' : 
                             this.operator === '*' ? 'multiply' : 
                             this.operator === '/' ? 'divide' : 'pow'}`;

    if (typeof l[internalMethod] === 'function') {
      return l[internalMethod](r);
    }

    throw new Error(`[AST]: Операция "${this.operator}" не поддерживается типами на ${this.loc}`);
  }

  toTeX() {
    const l = this.left.toTeX();
    const r = this.right.toTeX();
    switch (this.operator) {
      case '+': return `${l} + ${r}`;
      case '-': return `${l} - ${r}`;
      case '*': return `${l} \\cdot ${r}`;
      case '/': return `\\frac{${l}}{${r}}`;
      case '^': return `{${l}}^{${r}}`;
    }
  }
}

/**
 * Узел вызова встроенной математической функции (sin, cos, log...)
 */
export class FunctionNode extends ASTNode {
  constructor(name, argument, loc) {
    super(loc);
    this.name = name;
    this.argument = argument;
  }

  evaluate(context) {
    const argVal = this.argument.evaluate(context);
    
    if (typeof argVal[this.name] === 'function') {
      return argVal[this.name]();
    }
    throw new Error(`[AST]: Функция "${this.name}" не поддерживается данным типом на ${this.loc}`);
  }

  toTeX() {
    const argTex = this.argument.toTeX();
    const texName = this.name === 'log' ? '\\ln' : `\\${this.name}`;
    return `${texName}\\left(${argTex}\\right)`;
  }
}

/**
 * Узел присваивания переменной: x = выражение
 */
export class AssignNode extends ASTNode {
  constructor(name, expression, loc) {
    super(loc);
    this.name = name;         // Имя переменной (строка, например 'x')
    this.expression = expression; // Узел ASTNode
  }

  evaluate(context) {
    // Вычисляем значение правой части
    const value = this.expression.evaluate(context);
    // Сохраняем в переданный локальный контекст вызова!
    context[this.name] = value;
    // Возвращаем результат присваивания, чтобы можно было выводить строки вида x = y = 5
    return value;
  }

  toTeX() {
    return `${this.name} = ${this.expression.toTeX()}`;
  }
}

/**
 * Узел чтения переменной (например, использование 'x' в выражении)
 */
export class VariableNode extends ASTNode {
  constructor(name, loc) {
    super(loc);
    this.name = name;
  }

  evaluate(context) {
    // Ищем переменную в локальном контексте вызова
    if (this.name in context) {
      return context[this.name];
    }
    throw new Error(`[AST]: Переменная "${this.name}" не определена в текущем контексте.`);
  }

  toTeX() {
    return this.name; // В LaTeX переменные выводятся своим именем
  }
}