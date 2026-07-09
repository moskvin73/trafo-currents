class ASTNode {
  constructor(loc) {
    this.loc = loc; // Объект SourceLocation для вывода ошибок
  }

  /** Вычисляет значение узла. Должен быть переопределен в наследниках. */
  evaluate(context = {}) {
    throw new Error("[ASTNode]: Метод evaluate() не реализован.");
  }

  /** Генерирует LaTeX код для узла. Должен быть переопределен. */
  toTeX() {
    throw new Error("[ASTNode]: Метод toTeX() не реализован.");
  }
}

class BinaryOpNode extends ASTNode {
  constructor(left, operator, right, loc) {
    super(loc);
    this.left = left;       // Узел ASTNode (левая часть)
    this.operator = operator; // Строка: '+', '-', '*', '/', '^'
    this.right = right;     // Узел ASTNode (правая часть)
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
        throw new Error(`[AST]: Неизвестный оператор "${this.operator}" на ${this.loc}`);
    }
  }

  toTeX() {
    const l = this.left.toTeX();
    const r = this.right.toTeX();

    switch (this.operator) {
      case '+': return `${l} + ${r}`;
      case '-': return `${l} - ${r}`;
      case '*': return `${l} \\cdot ${r}`; // В LaTeX умножение — это красивая точка \cdot
      case '/': return `\\frac{${l}}{${r}}`; // Деление становится вертикальной дробью
      case '^': return `{${l}}^{${r}}`;     // Степень оформляется через фигурные скобки
    }
  }
}

class FunctionNode extends ASTNode {
  constructor(name, argument, loc) {
    super(loc);
    this.name = name;         // Имя функции (например, 'sin')
    this.argument = argument; // Узел ASTNode внутри скобок
  }

  evaluate(context) {
    const argVal = this.argument.evaluate(context);
    
    // Вызываем метод динамически у класса ComplexNumber
    if (typeof argVal[this.name] === 'function') {
      return argVal[this.name]();
    }
    throw new Error(`[AST]: Функция "${this.name}" не поддерживается типом данных.`);
  }

  toTeX() {
    const argTex = this.argument.toTeX();
    // В LaTeX стандартные функции экранируются: \sin, \cos, \ln и т.д.
    const texName = this.name === 'log' ? '\\ln' : `\\${this.name}`;
    return `${texName}\\left(${argTex}\\right)`; // \left( и \right) автоматически растягивают скобки по высоте дробей
  }
}

class ComplexNode extends ASTNode {
  constructor(complexValue, loc) {
    super(loc);
    this.value = complexValue; // Наш объект ComplexNumber
  }

  evaluate(context) {
    return this.value;
  }

  toTeX() {
    // Просто вызываем стандартизированный метод!
    return this.value.toRawTeX(); 
  }
}