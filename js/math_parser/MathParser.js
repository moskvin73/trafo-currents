import { TokenType } from './TokenTypes.js';
import { CompilerError } from './CompilerErrors.js';
import ASTNode, { NumberNode, UnaryOpNode, BinaryOpNode, FunctionNode, AssignNode, VariableNode, PrintNode, ProgramNode } from './ASTNodes.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';

/**
 * Единый узел для любой инструкции в коде
 */
export class StatementNode {
  constructor(node, isSilent) {
    this.node = node;
    this.isSilent = isSilent;
  }

  evaluate(context) {
    const result = this.node.evaluate(context);
    return {
      value: result,
      isSilent: this.isSilent,
      isPrintCommand: this.node instanceof PrintNode
    };
  }

  toTeX() {
    return this.node.toTeX();
  }
}

/**
 * Финальный отказоустойчивый Парсер (Рекурсивный спуск)
 */
export class MathParser {
  /**
   * @param {MathLexer} lexer - Потоковый лексер нового поколения
   */
  constructor(lexer) {
    this.lexer = lexer;
    this.errors = [];
    this.lookahead = null; // Тот самый ЕДИНСТВЕННЫЙ первый токен LL(1)
    
    // Инициализируем lookahead первым токеном из потока
    this.#consume();
  }

  // Сдвигает поток, считывая следующий токен из лексера
  #consume() {
    this.lookahead = this.lexer.next();
  }

  // Проверяет совпадение типа и сдвигает lookahead. Если тип не совпал — это синтаксический сбой.
  #match(expectedType, errorMessage) {
    if (this.lookahead.type === expectedType) {
      const currentToken = this.lookahead;
      this.#consume();
      return currentToken;
    }
    throw new Error(`${errorMessage} на ${this.lookahead.loc}`);
  }

  /**
   * Главный метод запуска LL(1) анализа
   */
  parse() {
    const program = new ProgramNode();

    while (this.lookahead.type !== TokenType.EOF) {
      try {
        const stmt = this.#parseStatement();
        if (stmt) program.statements.push(stmt);
      } catch (error) {
        // Восстановление после синтаксической ошибки: пишем в отчет и мотаем до конца строки
        this.errors.push(new CompilerError(error.message, this.lookahead.loc));
        this.#synchronize();
      }
    }

    // Объединяем лексические ошибки лексера и синтаксические ошибки парсера в один массив!
    const allCompilerErrors = [...this.lexer.errors, ...this.errors];
    return { program, errors: allCompilerErrors };
  }

  #parseStatement() {
    let exprNode = null;

    // 1. Парсим узел (это либо print, либо любое математическое выражение/присваивание)
    if (this.lookahead.type === TokenType.VARIABLE && this.lookahead.value === 'print') {
      exprNode = this.#parsePrintStatement();
    } else {
      exprNode = this.#parseExpression();
    }
    
    // 2. СТРОГИЙ КОНТРОЛЬ РАЗДЕЛИТЕЛЕЙ ДЛЯ ВСЕХ БЕЗ ИСКЛЮЧЕНИЯ
    let isSilent = false;
    
    if (this.lookahead.type === TokenType.SEMICOLON) {
      this.#consume(); // успешно поглотили ';'
    } else if (this.lookahead.type === TokenType.SILENT) {
      isSilent = !(exprNode instanceof AssignNode || exprNode instanceof PrintNode);
      this.#consume(); // успешно поглотили '$'
    } else if (this.lookahead.type === TokenType.EOF) {
      // Исключение только для самой последней конструкции в конце файла
      isSilent = false; 
    } else {
      // Если знака нет между командами — это синтаксическая ошибка для ВСЕХ
      throw new Error(`Ожидался разделитель ';' или '$' после инструкции "${this.lookahead.value}"`);
    }

    return new StatementNode(exprNode, isSilent);
    }

  #parsePrintStatement() {
    const printToken = this.#match(TokenType.VARIABLE, "Ожидалась команда print");
    this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '(' после print");

    const elements = [];

    // Множество FIRST для аргументов print: TEXT_BLOCK или любое математическое выражение
    while (this.lookahead.type !== TokenType.RPAREN && this.lookahead.type !== TokenType.EOF) {
      if (this.lookahead.type === TokenType.TEXT_BLOCK) {
        elements.push({ type: 'TEXT_BLOCK', value: this.lookahead.value });
        this.#consume();
      } else {
        elements.push(this.#parseExpression());
      }
    }

    this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print");
    return new PrintNode(elements, printToken.loc);
  }

  // =======================================================
  // МАТЕМАТИЧЕСКАЯ ГРАММАТИКА (Строгий детерминированный спуск)
  // =======================================================

  #parseExpression() {
    return this.#parseAssignment();
  }

  /**
   * Присваивание (Самый низкий приоритет).
   * Правая ассоциативность: x = y = 5 означает x = (y = 5)
   */
  #parseAssignment() {
    // Сначала парсим левую часть как обычное сложение/вычитание
    let expr = this.#parseAddition();

    // Если следующим токеном идёт знак равенства '='
    if (this.lookahead.type === TokenType.ASSIGN) {
      const opToken = this.lookahead;
      this.#consume(); // сожрали '='

      // КРИТИЧЕСКАЯ СЕМАНТИЧЕСКАЯ ПРОВЕРКА: слева ОБЯЗАНА быть переменная!
      if (!(expr instanceof VariableNode)) {
        throw new Error(`[Semantic Error]: Неверное выражение слева от оператора присваивания. Ожидалось имя переменной.`);
      }

      // Рекурсивно парсим правую часть (поддержка цепочек присваивания x = y = 5)
      const right = this.#parseAssignment();
      
      // Возвращаем узел присваивания, забирая имя из VariableNode
      return new AssignNode(expr.name, right, opToken.loc);
    }

    return expr;
  }

  // Множество FIRST для знаков сложения/вычитания
  #parseAddition() {
    let expr = this.#parseMultiplication();

    while (this.lookahead.type === TokenType.PLUS || this.lookahead.type === TokenType.MINUS) {
      const opToken = this.lookahead;
      this.#consume(); // Сожрали оператор, сдвинули lookahead к следующему числу
      
      const right = this.#parseMultiplication();
      expr = new BinaryOpNode(expr, opToken.value, right, expr.loc);
    }
    return expr;
  }

  // Множество FIRST для знаков умножения/деления
  #parseMultiplication() {
    let expr = this.#parseUnary();

    while (this.lookahead.type === TokenType.MUL || this.lookahead.type === TokenType.DIV) {
      const opToken = this.lookahead;
      this.#consume();
      
      const right = this.#parseUnary();
      expr = new BinaryOpNode(expr, opToken.value, right, expr.loc);
    }
    return expr;
  }

  // Унарные знаки
  #parseUnary() {
    if (this.lookahead.type === TokenType.PLUS || this.lookahead.type === TokenType.MINUS) {
      const opToken = this.lookahead;
      this.#consume();
      
      const right = this.#parseUnary();
      return new UnaryOpNode(opToken.value, right, opToken.loc);
    }
    return this.#parsePower();
  }

  // Степень (Правая ассоциация)
  #parsePower() {
    let expr = this.#parsePrimary();

    if (this.lookahead.type === TokenType.POW) {
      const opToken = this.lookahead;
      this.#consume();
      
      const right = this.#parsePower(); // Правая рекурсия
      expr = new BinaryOpNode(expr, opToken.value, right, opToken.loc);
    }
    return expr;
  }

  // Терминалы (FIRST множество: NUMBER, COMPLEX_NUMBER, FUNCTION, LPAREN, VARIABLE)
  #parsePrimary() {
    const token = this.lookahead;

    if (this.lookahead.type === TokenType.NUMBER) {
      this.#consume();
      return new NumberNode(new RealNumber(token.value), token.loc);
    }

    if (this.lookahead.type === TokenType.COMPLEX_NUMBER) {
      this.#consume();
      return new NumberNode(new ComplexNumber(0, token.value), token.loc);
    }

    if (this.lookahead.type === TokenType.FUNCTION) {
      const funcName = token.value;
      this.#consume();
      this.#match(TokenType.LPAREN, `Ожидалась '(' после функции ${funcName}`);
      const arg = this.#parseExpression();
      this.#match(TokenType.RPAREN, `Ожидалась ')' после аргумента функции ${funcName}`);
      return new FunctionNode(funcName, arg, token.loc);
    }

    if (this.lookahead.type === TokenType.LPAREN) {
      this.#consume();
      const expr = this.#parseExpression();
      this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')'");
      return expr;
    }

    if (this.lookahead.type === TokenType.VARIABLE) {
      this.#consume();
      return new VariableNode(token.value, token.loc);
    }

    throw new Error(`Неожиданный математический символ "${token.value}"`);
  }

  #synchronize() {
    // В потоковом LL(1) мы просто сдвигаем lookahead на один шаг вперед, 
    // чтобы выйти из тупика и попытаться разобрать следующую инструкцию кода
    this.#consume();
  }
}