import { TokenType } from './TokenTypes.js';
import { CompilerError } from './CompilerErrors.js';
import ASTNode, { 
  NumberNode,
  UnaryOpNode, 
  UnaryOpNodePlus,
  UnaryOpNodeMinus,
  AddNode,
  SubNode,
  MulNode,
  DivNode,
  PowNode,
  CallNode, 
  AssignNode, 
  VariableNode, 
  PrintNode, 
  ProgramNode, 
  ConstantNode } from './ASTNodes.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import { MathLexer } from './MathLexer.js';

/**
 * Единый узел для любой инструкции в коде
 */
export class StatementNode {
  constructor(node, isSilent) {
    this.node = node;
    this.isSilent = isSilent;
  }

  collectMathExpressions(list) {
    // Обходим все аргументы функции, каждый из них может быть математикой
      if (typeof node.collectMathExpressions === 'function') {
      node.collectMathExpressions(list);
    }
  }

  toString() { return this.node.toString(); }
  
  evaluate(context) {
    const result = this.node.evaluate(context);
    return {
      value: result,
      isSilent: this.isSilent,
      isPrintCommand: this.node instanceof PrintNode
    };
  }

  toTeX() { return this.node.toTeX(); }
}

/**
 * Финальный отказоустойчивый Парсер (Рекурсивный спуск)
 */
export class MathParser {
  /**
   * @param {MathLexer} lexer - Потоковый лексер нового поколения
   */
  constructor(input, baseLine = 1, baseColumn = 1) {
    this.errors = [];
    this.lexer = new MathLexer(input, this.errors, baseLine, baseColumn);
    this.lookahead = null;
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
      return true;
    }
    this.#error(errorMessage, this.lookahead.loc);
    return false;
  }

  #error(message, loc) {
    const err = new CompilerError(message, loc);
    this.errors.push(err);
  }

  /**
   * Главный метод запуска LL(1) анализа
   */
  parse() {
    const program = new ProgramNode();

    try {
        while (this.lookahead.type !== TokenType.EOF) {
          const stmt = this.#parseStatement();
          if (stmt) program.statements.push(stmt);
      }
      } catch (error) {
        this.errors.push(new CompilerError(`[ФАТАЛЬНЯ ОШИБКА] ${error.message}`, this.lookahead.loc));
      }

    return { program, errors: this.errors };
  }

  static parseStatement_FALLOW = Object.freeze(new Set([
    TokenType.EOF,
    TokenType.SEMICOLON,
    TokenType.SILENT,
  ]));

  static Expr_FIRST = Object.freeze(new Set([
    TokenType.MATH_PI,
    TokenType.MATH_E,
    TokenType.MATH_PHI,
    TokenType.MATH_INF,
    TokenType.MATH_NAN,
    TokenType.NUMBER,
    TokenType.COMPLEX_NUMBER,
    TokenType.LPAREN,
    TokenType.VARIABLE,
    TokenType.PLUS,
    TokenType.MINUS,
  ]));

  #parseStatement() {
    let exprNode = null;

    // 1. Парсим узел (это либо print, либо любое математическое выражение/присваивание)
    if (this.lookahead.type === TokenType.VARIABLE && this.lookahead.value === 'print') {
      exprNode = this.#parsePrintStatement();
    } else {
      exprNode = this.#parseExpression();
    }
    
    // 2. СТРОГИЙ КОНТРОЛЬ РАЗДЕЛИТЕЛЕЙ ДЛЯ ВСЕХ БЕЗ ИСКЛЮЧЕНИЯ
    while (true) switch (this.lookahead.type)
    {
      case TokenType.EOF:
      case TokenType.SEMICOLON:
        this.#consume();
        return new StatementNode(exprNode, false);
      case TokenType.SILENT:
        this.#consume();
        return new StatementNode(exprNode, exprNode instanceof AssignNode);
      default:
        this.#error(
          `Ожидался разделитель ';' или '<span class="tex2jax_ignore">$</span>' инструкция "${this.lookahead.value}"`,
           this.lookahead.loc);
        while (true)
        {
          if (MathParser.Expr_FIRST.has(this.lookahead.type)) {
            this.#consume();
            return new StatementNode(exprNode, false);
          }
          this.#consume();
          if (MathParser.parseStatement_FALLOW.has(this.lookahead.type)) break;
        }
    }
  }

  static parsePrintStatement_FALLOW = Object.freeze(new Set([
    TokenType.EOF,
    TokenType.SEMICOLON,
    TokenType.SILENT,
    TokenType.PARENR,
  ]));

  #parsePrintStatement() {
    const elements = [];

    const printToken = this.lookahead;
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '(' после print")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.lookahead.type)) this.#consume();
      return new PrintNode(elements, printToken.loc);
    }

    // Если скобка закрывается сразу, значит print() пустой
    if (this.lookahead.type !== TokenType.RPAREN) {
        while (true) {
          if (this.lookahead.type === TokenType.TEXT_BLOCK) {
              elements.push({ 
                type: 'TEXT_BLOCK', 
                value: this.lookahead.value 
              });
              this.#consume();
          } else {
              // Парсим полноценное математическое выражение (переменная, функция, операция)
              elements.push(this.#parseExpression());
          }

          // Если следующий токен — запятая, поглощаем её и продолжаем цикл
          if (this.lookahead.type === TokenType.COMMA) {
              this.#consume();
              
              // Проверка на trailing comma: если после запятой сразу закрывающая скобка
              if (this.lookahead.type === TokenType.RPAREN) {
              break; 
              }
          } else {
              // Если запятой нет, то это должен быть конец списка аргументов
              break;
          }
        }
    }

    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.lookahead.type)) this.#consume();
    }
    return new PrintNode(elements, printToken.loc);
  }

  // =======================================================
  // МАТЕМАТИЧЕСКАЯ ГРАММАТИКА (Строгий детерминированный спуск)
  // =======================================================

  #parseExpression() { return this.#parseAssignment(); }

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
        this.#error(`[Semantic Error]: Неверное выражение слева от оператора присваивания. Ожидалось имя переменной.`,  opToken.loc);
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
    while (true) switch (this.lookahead.type) {
      case TokenType.PLUS:
        this.#consume();
        expr = new AddNode(expr, this.#parseMultiplication(), expr.loc);
        break;
      case TokenType.MINUS:
        this.#consume();
        expr = new SubNode(expr, this.#parseMultiplication(), expr.loc);
        break;
      default: return expr;
    }
  }

  // Множество FIRST для знаков умножения/деления
  #parseMultiplication() {
    let expr = this.#parseUnary();
    while (true) switch (this.lookahead.type) {
      case TokenType.MUL:
        this.#consume();
        expr = new MulNode(expr, this.#parseUnary(), expr.loc);
        break;
      case TokenType.DIV:
        this.#consume();
        expr = new DivNode(expr, this.#parseUnary(), expr.loc);
        break;
      default: return expr;
    }
  }

  // Унарные знаки
  #parseUnary() {
    let opToken;
    switch (this.lookahead.type)
    {
      case TokenType.PLUS:
        opToken = this.lookahead;
        this.#consume();
        return new UnaryOpNodePlus(this.#parseUnary(), opToken.loc);
      case TokenType.MINUS:
        opToken = this.lookahead;
        this.#consume();
        return new UnaryOpNodeMinus(this.#parseUnary(), opToken.loc);
      default: return this.#parsePower();
    }
  }

  // Степень (Правая ассоциация)
  #parsePower() { 
    let expr = this.#parsePrimary();

    if (this.lookahead.type === TokenType.POW) {
      const opToken = this.lookahead;
      this.#consume();      
      expr = new PowNode(expr, this.#parseUnary(), opToken.loc);
    }
    return expr;
  }

  static Primary_FIRST = Object.freeze(new Set([
    TokenType.MATH_PI,
    TokenType.MATH_E,
    TokenType.MATH_PHI,
    TokenType.MATH_INF,
    TokenType.MATH_NAN,
    TokenType.NUMBER,
    TokenType.COMPLEX_NUMBER,
    TokenType.LPAREN,
    TokenType.VARIABLE,
  ]));

  static Primary_FALLOW = Object.freeze(new Set([
    TokenType.EOF,
    TokenType.SEMICOLON,
    TokenType.SILENT,
    TokenType.PARENR,
    TokenType.POW,
    TokenType.MUL,
    TokenType.DIV,
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.ASSIGN,
    TokenType.COMMA,
  ]));

  // Терминалы (FIRST множество: NUMBER, COMPLEX_NUMBER, FUNCTION, LPAREN, VARIABLE)
  #parsePrimary() {
    let token = this.lookahead;
    while (true) switch (token.type) {
        case TokenType.MATH_PI:
            this.#consume();
            return new ConstantNode(TokenType.MATH_PI, token.loc);
            
        case TokenType.MATH_E:
            this.#consume();
            return new ConstantNode(TokenType.MATH_E, token.loc);
            
        case TokenType.MATH_PHI:
            this.#consume();
            return new ConstantNode(TokenType.MATH_PHI, token.loc);
            
        case TokenType.MATH_INF:
            this.#consume();
            return new ConstantNode(TokenType.MATH_INF, token.loc);
            
        case TokenType.MATH_NAN:
            this.#consume();
            return new ConstantNode(TokenType.MATH_NAN, token.loc);

         case TokenType.NUMBER:
            this.#consume();
            return new NumberNode(new RealNumber(token.value), token.loc);

        case TokenType.COMPLEX_NUMBER:
             this.#consume();
             return new NumberNode(new ComplexNumber(0, token.value), token.loc);

        case TokenType.LPAREN:
             this.#consume();
             const expr = this.#parseExpression();
             this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')'");
             return expr;

        case TokenType.VARIABLE:
             return this.#callFuncORVar();
        default:
          this.#error(`Ожидался операнд "${token.value}"`, token.loc);
          while (true)
          {
            this.#consume();
            token = this.lookahead;
            if (MathParser.Primary_FIRST.has(token.type)) break;
            if (MathParser.Primary_FALLOW.has(token.type))
            {
              return new NumberNode(new RealNumber(1), token.loc);
            }
          }
    }
  }

  #callFuncORVar() {
      const idToken = this.lookahead;
      this.#consume();

      // СИНТАКСИЧЕСКИЙ ВЫБОР ВЫЗОВА: Если сразу за идентификатором идет '('
      if (this.lookahead.type === TokenType.LPAREN) {
        this.#consume(); // сожрали '('

        const args = [];
        // Читаем список аргументов через запятую (например: pow(x, 3) или sin(x))
        if (this.lookahead.type !== TokenType.RPAREN) {
          args.push(this.#parseExpression());
          
          while (this.lookahead.type === TokenType.COMMA) {
            this.#consume(); // сожрали ','
            args.push(this.#parseExpression());
          }
        }

        this.#match(TokenType.RPAREN, `Ожидалась закрывающая скобка ')' после аргументов функции "${idToken.value}"`);
        
        // Возвращаем универсальный узел вызова
        return new CallNode(idToken.value, args, idToken.loc);
      }

      // Если скобки нет — это обычное чтение переменной из памяти
      return new VariableNode(idToken.value, idToken.loc);
  }

  #synchronize() {
    // В потоковом LL(1) мы просто сдвигаем lookahead на один шаг вперед, 
    // чтобы выйти из тупика и попытаться разобрать следующую инструкцию кода
    this.#consume();
  }
}