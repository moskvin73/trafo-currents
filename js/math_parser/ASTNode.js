// Импортируем наш базовый математический тип, чтобы использовать в проверках, 
// если потребуется расширение, или для явного понимания типов
import MathType from '../math/MathType.js';
import ComplexNumber from '../math/ComplexNumber.js';

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
 * Узел комплексного числа (Терминальный узел / Лист дерева)
 */
export class ComplexNode extends ASTNode {
  constructor(complexValue, loc) {
    super(loc);
    this.value = complexValue; // Объект класса ComplexNumber
  }

  evaluate(context) {
    return this.value;
  }

  toTeX() {
    return this.value.toRawTeX();
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
    this.left = left;         // Левый узел ASTNode
    this.operator = operator;   // Строка оператора
    this.right = right;       // Правый узел ASTNode
  }

  evaluate(context) {
    const leftVal = this.left.evaluate(context);
    const rightVal = this.right.evaluate(context);

    switch (this.operator) {
      case '+': return leftVal.add(rightVal);
      case '-': return leftVal.subtract(rightVal);
      case '*': return leftVal.multiply(rightVal);
      case '/': return leftVal.divide(rightVal);
      case '^': return leftVal.pow(rightVal);
      default:
        throw new Error(`[AST]: Неизвестный бинарный оператор "${this.operator}" на ${this.loc}`);
    }
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