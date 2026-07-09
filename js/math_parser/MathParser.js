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
     const printToken = this.#advance(); // забрали 'print'
    
    if (!this.#match('LPAREN')) {
      throw new Error("Ожидалась открывающая скобка '(' после команды print");
    }

    const elements = [];

    while (!this.#check('RPAREN') && !this.#isAtEnd()) {
      if (this.#check('TEXT_BLOCK')) {
        elements.push({ type: 'TEXT_BLOCK', value: this.#advance().value });
      } else {
        // Если это не текст в кавычках, принудительно парсим как математическое выражение (переменную или число)
        elements.push(this.#parseExpression());
      }
      
      // На всякий случай: если пользователь поставит запятую между аргументами, мягко пропускаем её
      if (this.#check('OPERATOR') && this.#peek().value === ',') {
        this.#advance();
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
    let expr = this.#parseMultiplication();

    // Сначала проверяем, что перед нами оператор и его значение равняется '+' или '-'
    while (this.#check('OPERATOR') && (this.#peek().value === '+' || this.#peek().value === '-')) {
      // Только после успешной проверки мы явно забираем этот токен и двигаем указатель
      const opToken = this.#advance(); 
      const operator = opToken.value;
      
      const right = this.#parseMultiplication();
      expr = new BinaryOpNode(expr, operator, right, expr.loc);
    }
    return expr;
  }

  // Умножение и деление в MathParser.js
  #parseMultiplication() {
    let expr = this.#parseUnary();

    // Аналогично: проверяем тип и значение БЕЗ сдвига указателя
    while (this.#check('OPERATOR') && (this.#peek().value === '*' || this.#peek().value === '/')) {
      const opToken = this.#advance();
      const operator = opToken.value;
      
      const right = this.#parseUnary();
      expr = new BinaryOpNode(expr, operator, right, expr.loc);
    }
    return expr;
  }

  // Унарные операции (-x, +5)
  #parseUnary() {
   // 1. Безопасно проверяем, что перед нами OPERATOR и это именно знак '+' или '-' БЕЗ сдвига указателя
    if (this.#check('OPERATOR') && (this.#peek().value === '-' || this.#peek().value === '+')) {
      // 2. Только теперь, когда мы уверены, что это унарный знак, забираем его и двигаем указатель
      const opToken = this.#advance(); 
      const operator = opToken.value;
      
      // Рекурсивно вызываем для цепочек вроде --5
      const right = this.#parseUnary(); 
      return new UnaryOpNode(operator, right, opToken.loc);
    }
    
    // Если это не унарный плюс/минус, спокойно идем к степеням, не потеряв ни одного токена!
    return this.#parsePower(); 
  }

  // Степени (Правая ассоциативность: вычисляется Справа Налево)
  #parsePower() {
     let expr = this.#parsePrimary();

    // Безопасно проверяем, что текущий токен — это оператор '^'
    if (this.#check('OPERATOR') && this.#peek().value === '^') {
      // Только теперь, когда мы на 100% уверены, забираем токен и двигаем указатель
      const opToken = this.#advance(); 
      const operator = opToken.value;
      const loc = opToken.loc;
      
      // Рекурсивный вызов самого себя для обеспечения правой ассоциации (2^3^2)
      const right = this.#parsePower(); 
      expr = new BinaryOpNode(expr, operator, right, loc);
    }
    return expr;
  }

  // Базовые терминалы (Высший приоритет)
  #parsePrimary() {
     const token = this.#peek();

    // Вещественное число
    if (this.#match('NUMBER')) {
      return new NumberNode(new RealNumber(this.tokens[this.current - 1].value), token.loc);
    }

    // Комплексное число (например, 1i или 4i)
    if (this.#match('COMPLEX_NUMBER')) {
      return new NumberNode(new ComplexNumber(0, this.tokens[this.current - 1].value), token.loc);
    }

    // Инженерные функции
    if (this.#match('FUNCTION')) {
      const funcName = this.tokens[this.current - 1].value;
      if (!this.#match('LPAREN')) throw new Error(`Ожидалась открывающая скобка '(' после функции ${funcName}`);
      const arg = this.#parseExpression();
      if (!this.#match('RPAREN')) throw new Error(`Ожидалась закрывающая скобка ')' после функции ${funcName}`);
      return new FunctionNode(funcName, arg, token.loc);
    }

    // Скобки
    if (this.#match('LPAREN')) {
      const expr = this.#parseExpression();
      if (!this.#match('RPAREN')) throw new Error("Ожидалась закрывающая скобка ')'");
      return expr;
    }

    // Переменные (сюда же автоматически и абсолютно законно попадёт одинокая буква i)
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