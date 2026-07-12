import { TokenType } from './TokenTypes.js';
import { CompilerError } from './CompilerErrors.js';
import ASTNode, { 
  NumberNode,
  UnaryOpNode, 
  UnaryOpNodePlus,
  UnaryOpNodeMinus,
  //BinaryOpNode,
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

/**
 * Единый узел для любой инструкции в коде
 */
export class StatementNode {
  constructor(node, isSilent) {
    this.node = node;
    this.isSilent = isSilent;
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
      isSilent = exprNode instanceof AssignNode;
      this.#consume(); // успешно поглотили '$'
    } else if (this.lookahead.type === TokenType.EOF) {
      // Исключение только для самой последней конструкции в конце файла
      isSilent = false; 
    } else {
      // Если знака нет между командами — это синтаксическая ошибка для ВСЕХ
      throw new Error(`Ожидался разделитель ';' или '<span class="tex2jax_ignore">$</span>' после инструкции "${this.lookahead.value}"`);
    }

    return new StatementNode(exprNode, isSilent);
  }

  #parsePrintStatement() {
    const printToken = this.lookahead;
    this.#consume();
    this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '(' после print");

    const elements = [];

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
      
      const right = this.#parseUnary(); // Правая рекурсия
      expr = new BinaryOpNode(expr, opToken.value, right, opToken.loc);
    }
    return expr;
  }

  // Терминалы (FIRST множество: NUMBER, COMPLEX_NUMBER, FUNCTION, LPAREN, VARIABLE)
  #parsePrimary() {
     const token = this.lookahead;

    switch (token.type) {
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
    }

    if (this.lookahead.type === TokenType.NUMBER) {
      this.#consume();
      return new NumberNode(new RealNumber(token.value), token.loc);
    }

    if (this.lookahead.type === TokenType.COMPLEX_NUMBER) {
      this.#consume();
      return new NumberNode(new ComplexNumber(0, token.value), token.loc);
    }

    if (this.lookahead.type === TokenType.LPAREN) {
      this.#consume();
      const expr = this.#parseExpression();
      this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')'");
      return expr;
    }

    // СЮДА ПОПАДАЮТ ВСЕ ИДЕНТИФИКАТОРЫ
    if (this.lookahead.type === TokenType.VARIABLE) {
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

    throw new Error(`Неожиданный математический символ "${token.value}"`);
  }

  #synchronize() {
    // В потоковом LL(1) мы просто сдвигаем lookahead на один шаг вперед, 
    // чтобы выйти из тупика и попытаться разобрать следующую инструкцию кода
    this.#consume();
  }
}