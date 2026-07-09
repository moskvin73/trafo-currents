import ASTNode, { 
  NumberNode, 
  UnaryOpNode, 
  BinaryOpNode, 
  FunctionNode 
} from './ASTNodes.js';

import ComplexNumber from '../math/ComplexNumber.js';
import RealNumber from '../math/RealNumber.js';
import { CompilerError } from './MathLexer.js';

// Дополнительные узлы для поддержки переменных, которые мы спроектировали
export class AssignNode extends ASTNode {
  constructor(name, expression, loc) {
    super(loc);
    this.name = name;
    this.expression = expression;
  }
  evaluate(context) {
    const value = this.expression.evaluate(context);
    context[this.name] = value;
    return value;
  }
  toTeX() {
    return `${this.name} = ${this.expression.toTeX()}`;
  }
}

export class VariableNode extends ASTNode {
  constructor(name, loc) {
    super(loc);
    this.name = name;
  }
  evaluate(context) {
    if (this.name in context) {
      return context[this.name];
    }
    throw new Error(`Переменная "${this.name}" не определена в текущем контексте.`);
  }
  toTeX() {
    return this.name;
  }
}

/**
 * Узел для всей программы (блокнота/интерфейса вычислений)
 */
export class ProgramNode {
  constructor() {
    this.statements = [];
  }

  evaluate(context = {}) {
    let outputHTML = "";
    for (const stmt of this.statements) {
      // Каждую строчку вычисляем и оборачиваем в div для вывода
      outputHTML += `<div>${stmt.evaluate(context)}</div>`;
    }
    return outputHTML;
  }
}

/**
 * Узел для команды print(...)
 */
export class PrintNode extends ASTNode {
  constructor(elements, loc) {
    super(loc);
    this.elements = elements;
  }

  evaluate(context) {
    let resultStrings = [];
    let texStrings = [];

    for (const element of this.elements) {
      if (element.type === 'TEXT_BLOCK') {
        // Безопасное экранирование HTML тегов (защита от XSS)
        const safeText = element.value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");
        
        resultStrings.push(safeText);
        texStrings.push(`\\text{${safeText}}`);
      } else {
        const val = element.evaluate(context);
        resultStrings.push(val.toString());
        texStrings.push(element.toTeX());
      }
    }

    // Возвращаем строку: текстовое превью для логов + чистый TeX для MathJax
    return {
      plain: resultStrings.join(" "),
      tex: texStrings.join(" ")
    };
  }
}

/**
 * Финальный отказоустойчивый Парсер (Рекурсивный спуск)
 */
export class MathParser {
  constructor(tokens) {
    this.tokens = tokens;
    this.current = 0;
    this.errors = [];
  }

  #peek() { return this.tokens[this.current]; }
  #isAtEnd() { return this.current >= this.tokens.length || this.#peek().type === 'EOF'; }
  
  #advance() {
    if (!this.#isAtEnd()) this.current++;
    return this.tokens[this.current - 1];
  }

  #check(type) {
    if (this.#isAtEnd()) return false;
    return this.#peek().type === type;
  }

  #match(...types) {
    for (const type of types) {
      if (this.#check(type)) {
        this.#advance();
        return true;
      }
    }
    return false;
  }

  /**
   * Запуск синтаксического анализа
   * @returns {{ program: ProgramNode, errors: CompilerError[] }}
   */
  parse() {
    const program = new ProgramNode();

    while (!this.#isAtEnd()) {
        try {
            if (this.#match('COMMENT')) continue;
            const stmt = this.#parseStatement();
            if (stmt) program.statements.push(stmt);
        } catch (error) {
            // Исправленная безопасная логика координат:
            const currentToken = this.#peek();
            // Если токен существует, берем его координаты. 
            // Если мы упёрлись в конец файла, берём координаты самого последнего известного токена.
            const errorLoc = currentToken?.loc || this.tokens[this.tokens.length - 1]?.loc || null;

            this.errors.push(new CompilerError(error.message, errorLoc));
            this.#synchronize();
        }
    }

    return { program, errors: this.errors };
  }

  #parseStatement() {
    // 1. Проверяем команду print
    if (this.#check('VARIABLE') && this.#peek().value === 'print') {
      return this.#parsePrintStatement();
    }
    
    // 2. Проверяем присваивание: Идентификатор = Выражение
    if (this.#check('VARIABLE') && this.tokens[this.current + 1]?.value === '=') {
      const varToken = this.#advance(); 
      this.#advance(); // пропускаем '='
      const expr = this.#parseExpression();
      return new AssignNode(varToken.value, expr, varToken.loc);
    }
    
    // 3. Иначе это просто свободное математическое выражение
    return this.#parseExpression();
  }

  #parsePrintStatement() {
    const printToken = this.#advance(); // сожрали 'print'
    
    if (!this.#match('LPAREN')) {
      throw new Error("Ожидалась открывающая скобка '(' после команды print");
    }

    const elements = [];

    while (!this.#check('RPAREN') && !this.#isAtEnd()) {
      if (this.#check('TEXT_BLOCK')) {
        elements.push({ type: 'TEXT_BLOCK', value: this.#advance().value });
      } else {
        elements.push(this.#parseExpression());
      }
    }

    if (!this.#match('RPAREN')) {
      throw new Error("Ожидалась закрывающая скобка ')' в конце команды print");
    }

    return new PrintNode(elements, printToken.loc);
  }

  // =======================================================
  // МАТЕМАТИЧЕСКАЯ ГРАММАТИКА (Приоритеты операторов)
  // =======================================================

  #parseExpression() {
    return this.#parseAddition();
  }

  // Сложение и вычитание (Низший приоритет)
  #parseAddition() {
    let expr = this.#parseMultiplication();

    while (this.#match('OPERATOR') && (this.tokens[this.current - 1].value === '+' || this.tokens[this.current - 1].value === '-')) {
      const operator = this.tokens[this.current - 1].value;
      const right = this.#parseMultiplication();
      expr = new BinaryOpNode(expr, operator, right, expr.loc);
    }
    return expr;
  }

  // Умножение и деление
  #parseMultiplication() {
    let expr = this.#parseUnary();

    while (this.#match('OPERATOR') && (this.tokens[this.current - 1].value === '*' || this.tokens[this.current - 1].value === '/')) {
      const operator = this.tokens[this.current - 1].value;
      const right = this.#parseUnary();
      expr = new BinaryOpNode(expr, operator, right, expr.loc);
    }
    return expr;
  }

  // Унарные операции (-x, +5)
  #parseUnary() {
    if (this.#match('OPERATOR') && (this.tokens[this.current - 1].value === '-' || this.tokens[this.current - 1].value === '+')) {
      const operator = this.tokens[this.current - 1].value;
      const right = this.#parseUnary(); 
      return new UnaryOpNode(operator, right, this.tokens[this.current - 1].loc);
    }
    return this.#parsePower(); // Идем к степеням
  }

  // Степени (Правая ассоциативность: вычисляется Справа Налево)
  #parsePower() {
    let expr = this.#parsePrimary();

    if (this.#match('OPERATOR') && this.tokens[this.current - 1].value === '^') {
      const operator = this.tokens[this.current - 1].value;
      const loc = this.tokens[this.current - 1].loc;
      // Рекурсивный вызов самого себя создает правильное дерево для правой ассоциации
      const right = this.#parsePower(); 
      expr = new BinaryOpNode(expr, operator, right, loc);
    }
    return expr;
  }

  // Базовые терминалы (Высший приоритет)
  #parsePrimary() {
    const token = this.#peek();

    if (this.#match('NUMBER')) {
      const numToken = this.tokens[this.current - 1];
      
      // Если сразу за числом идет мнимая единица, склеиваем в комплексное число
      if (this.#check('IMAGINARY')) {
        this.#advance(); 
        return new NumberNode(new ComplexNumber(0, numToken.value), numToken.loc);
      }
      
      // БЕЗУПРЕЧНАЯ ЧИСТОТА: Обычные числа создаются как RealNumber! Погрешность исключена.
      return new NumberNode(new RealNumber(numToken.value), numToken.loc);
    }

    if (this.#match('IMAGINARY')) {
      return new NumberNode(new ComplexNumber(0, 1), token.loc); // одинокая 'i' -> 0 + 1i
    }

    if (this.#match('FUNCTION')) {
      const funcName = this.tokens[this.current - 1].value;
      if (!this.#match('LPAREN')) throw new Error(`Ожидалась открывающая скобка '(' после функции ${funcName}`);
      const arg = this.#parseExpression();
      if (!this.#match('RPAREN')) throw new Error(`Ожидалась закрывающая скобка ')' после функции ${funcName}`);
      return new FunctionNode(funcName, arg, token.loc);
    }

    if (this.#match('LPAREN')) {
      const expr = this.#parseExpression();
      if (!this.#match('RPAREN')) throw new Error("Ожидалась закрывающая скобка ')'");
      return expr;
    }

    if (this.#match('VARIABLE')) {
      return new VariableNode(token.value, token.loc);
    }

    throw new Error(`Неожиданный математический символ или токен "${token?.value || 'конец строки'}"`);
  }

  #synchronize() {
    // Двигаем указатель на один токен вперед, чтобы выйти из аварийного состояния
    this.#advance();
  }
}