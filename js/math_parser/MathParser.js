import { TokenType } from './TokenTypes.js';
import { CompilerError } from './CompilerErrors.js';
import ASTNode, { 
  NumberNode,
  UnaryOpNode, 
  UnaryOpNodePlus,
  UnaryOpNodeMinus,
  BinaryOpNode,
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
import { SymbolTableContext, SYM_UNDEFINED, SYM_VARIABLE, SYM_BUILTIN } from './SymbolTableContext.js';
import { TYPE_UNIT } from './ConstantsDef.js';
import { PlotInitNode, PlotDataNode, PlotConfigNode, PlotLayerNode, PlotVectorNode } from './DiagramNodes.js';
import { isValidCSSColor }  from '../util.js';

/**
 * Единый узел для любой инструкции в коде
 */
export class StatementNode {
  constructor(node, isSilent) {
    this.node = node;
    this.value = null;
    this.isSilent = isSilent;
  }

  collectMathExpressions(list) {
    // Обходим все аргументы функции, каждый из них может быть математикой
      if (typeof node.collectMathExpressions === 'function') {
      node.collectMathExpressions(list);
    }
  }

  get type_unit() { return this.node.type_unit; }


  toString() { return this.node.toString(); }

  
  toTeX() { return this.node.toTeX(); }
}

export class TeXOutputFormatter {
  /**
   * Главный метод, возвращающий финальную строку для MathJax
   * @param {ASTNode} inputTree - Исходное дерево, построенное парсером
   * @param {MathValue} resultValue - Атомарный объект-результат вычисления (.toRawTeX())
   * @returns {string} Строка TeX для рендеринга
   */
  static format(inputTree, resultValue, context) {
    // 1. Если это операция присваивания (например, U = 10 + 3i)
    if (inputTree instanceof AssignNode) {
      const varNameTeX = inputTree.getTexName(context);
      return `${varNameTeX} = ${this.format(inputTree.expression, resultValue, context)}`;
    }


    if (resultValue instanceof ComplexNumber && this._isStaticLiteralTreeComplex(inputTree)) {
      return resultValue.toRawTeX(context.settings);
    }

    // 2. Если пользователь ввёл просто константу или комплексное число (например, 10 + 3i)
    if (this._isStaticLiteralTree(inputTree)) {
      if (typeof resultValue === 'boolean') {
        return inputTree.toTeX(context);
      }
      return resultValue.toRawTeX(context.settings); // Гасим левую часть, выводим только ответ
    }

    if (typeof resultValue === 'boolean') {
      resultValue = `\\mathrm{${resultValue}}`
    }
    else resultValue = resultValue.toRawTeX(context.settings);

    // 3. Для полноценных вычислений выводим классическую цепочку (например, 2 * 5 = 10)
    return `${inputTree.toTeX(context)} = ${resultValue}`;
  }

  /**
   * Рекурсивно проверяет, является ли дерево просто статичной записью константы
   * @private
   */
  static _isStaticLiteralTree(node) {
    // База: числа и системные константы (%pi, %inf) — это статика
    if (node instanceof NumberNode || node instanceof ConstantNode) {
      return true;
    }

    // Унарные цепочки (+---10) — это тоже статика
    if (node instanceof UnaryOpNode) {
      return this._isStaticLiteralTree(node.argument);
    }

    // Бинарные операции (сложение, вычитаение)
    /*if (node instanceof BinaryOpNode) {
      // Чтобы не сгасить красивое вычисление "5 * 2 = 10", мы считаем 
      // статикой ТОЛЬКО каноническую запись комплексного числа (a + b*i или a - b*i).
      // Проверяем: если это операция сложения/вычитания, и она состоит из статичных узлов,
      // то разрешаем скрыть левую часть выражения.
      if (node.operator === '+' || node.operator === '-') {
        return this._isStaticLiteralTree(node.left) && this._isStaticLiteralTree(node.right);
      }
    }*/

    // Любые переменные (VariableNode), функции (CallNode) или деления (DivNode) 
    // делают дерево динамическим — для них левую часть нужно показывать обязательно!
    return false;
  }

  static _isStaticLiteralTreeComplex(node) {
    if (node instanceof BinaryOpNode) {
      if (node.operator === '+' || node.operator === '-') {
        return this._isStaticLiteralTree(node.left) && this._isStaticLiteralTree(node.right);
      }
    }
    return this._isStaticLiteralTree(node);
  }
}

class out_errors
{
  constructor(scope_context, errors) {
    this.errors = errors;
    this.scope_context = scope_context;
  }

  error(message, loc, severity = 'error') {
    const err = new CompilerError(message, loc, severity);
    this.errors.push(err);
  }
}

/**
 * Финальный отказоустойчивый Парсер (Рекурсивный спуск)
 */
export class MathParser {
  #program;
  /**
   * Создает экземпляр парсера/анализатора выражений.
   * 
   * @param {string} input - Входная математическая строка или выражение для анализа (например, "2 + 2").
   * @param {SymbolTableContext} context - Контекст таблицы символов, содержащий переменные, функции и константы.
   * @param {number} [baseLine=1] - Начальный номер строки для корректного отслеживания позиций ошибок.
   * 
   * @throws {TypeError} Если `input` не является строкой.
   * @throws {TypeError} Если `context` не является экземпляром SymbolTableContext.
   */
  constructor(input, context, baseLine = 1) {
    // 1. Валидация входной строки
    if (typeof input !== 'string') {
        throw new TypeError(`Ожидалась строка в параметре 'input', получено: ${typeof input}`);
    }

    // 2. Валидация контекста (замените SymbolTableContext на ваш реальный класс, если имя отличается)
    if (!(context instanceof SymbolTableContext)) {
        throw new TypeError("Параметр 'context' должен быть экземпляром SymbolTableContext");
    }

    this.errors = [];
    const startLine = Number(baseLine) || 1;
    this.lexer = new MathLexer(input, this.errors, startLine);

    this.c_token = TokenType.EOF;
    this.context = context;
    this.#consume();
    this.#program = new ProgramNode();
  }

  // Возвращает положение текущий лексемы
  get #location() { return this.lexer.createLocation(); }

  // Сдвигает поток, считывая следующий токен из лексера
  #consume() { this.c_token = this.lexer.next(); }

  // Проверяет совпадение типа и сдвигает lookahead. Если тип не совпал — это синтаксический сбой.
  #match(token_id, errorMessage) {
    if (this.c_token === token_id) {
      this.#consume();
      return true;
    }
    this.#error(errorMessage, this.#location);
    return false;
  }

  #error(message, loc) {
    const err = new CompilerError(message, loc);
    this.errors.push(err);
  }

  #create_evl_context() {
    return new out_errors(this.context, this.errors);
  }

  /**
   * Главный метод запуска LL(1) анализа
   */
  parse() {
    try {
        const statements = [];
        while (this.c_token !== TokenType.EOF) {
          const stmt = this.#parseStatement();
          if (stmt) {
             statements.push(new StatementNode(stmt.node, stmt.isSilent));
          }
      }
      if (this.errors.length === 0) {
          const evl_context = this.#create_evl_context();
          for (const stmtNode of statements) {
            // Вычисляем значение для каждого сохраненного узла
            stmtNode.value = stmtNode.node.evaluate(evl_context);
          }
        this.#program.statements = statements;
      }
      } catch (error) {
        this.errors.push(new CompilerError(`[ФАТАЛЬНЯ ОШИБКА] ${error.message}`, this.#location));
      }
  }

  toTex() {
    if (this.errors.length > 0) {
      return [];
    }

    return this.#program.statements
      .filter((stmt) => !stmt.isSilent)
      .map((stmt) => {
        if (stmt.type_unit === TYPE_UNIT.PRINT) { 
          return { mixed: true, value: stmt.value };
        }

        const renderString = TeXOutputFormatter.format(stmt.node, stmt.value, this.context);
        return { mixed: false, value: `$$${renderString}$$` };
      });
  }

  static parseStatement_FALLOW = Object.freeze(new Set([
    TokenType.EOF,
    TokenType.SEMICOLON,
    TokenType.SILENT,
  ]));

  static parseStatement_FIRST = Object.freeze(new Set([
    TokenType.RW_PLOT_INIT,
    TokenType.RW_PLOT_CHORD,
    TokenType.RW_PLOT_CONFIG,
    TokenType.RW_PLOT_LAYER,
    TokenType.RW_PLOT_VECTOR,
    TokenType.RW_TRUE,
    TokenType.RW_FALSE,
    TokenType.RW_PRINT,
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


  static Expr_FIRST = Object.freeze(new Set([
    TokenType.RW_TRUE,
    TokenType.RW_FALSE,
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

    switch(this.c_token)
    {
      case TokenType.RW_PRINT:
        exprNode = this.#parsePrintStatement();
        break;
      case TokenType.RW_PLOT_INIT:
        exprNode = this.#parsePlotInit();
        break;
      //case TokenType.RW_PLOT_CHORD:
      case TokenType.RW_PLOT_CONFIG:
        exprNode = this.#parsePlotConfig();
        break;
      case TokenType.RW_PLOT_LAYER:
        exprNode = this.#parsePlotLayer();
        break;
      case TokenType.RW_PLOT_VECTOR:
        exprNode = this.#parsePlotVector();
        break;
      default:
        exprNode = this.#parseExpression();
        break;
    }
    
    // 2. СТРОГИЙ КОНТРОЛЬ РАЗДЕЛИТЕЛЕЙ ДЛЯ ВСЕХ БЕЗ ИСКЛЮЧЕНИЯ
    while (true) switch (this.c_token)
    {
      case TokenType.EOF:
      case TokenType.SEMICOLON:
        this.#consume();
        return { node: exprNode, isSilent: false };
        //return new StatementNode(exprNode, false);
      case TokenType.SILENT:
        this.#consume();
        return { node: exprNode, isSilent: exprNode instanceof AssignNode };
      default:
        this.#error(
          `Ожидался разделитель ';' или '<span class="tex2jax_ignore">$</span>' инструкция "${this.lexer.stringValue()}"`,
           this.#location);
        while (true)
        {
          if (MathParser.parseStatement_FIRST.has(this.c_token)) {
            return { node: exprNode, isSilent: false };
          }
          this.#consume();
          if (MathParser.parseStatement_FALLOW.has(this.c_token)) break;
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

    const print_loc = this.#location;
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '(' после print")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return new PrintNode(elements, print_loc);
    }

    // Если скобка закрывается сразу, значит print() пустой
    if (this.c_token !== TokenType.RPAREN) {
        while (true) {
          if (this.c_token === TokenType.TEXT_BLOCK) {
              elements.push({ 
                type: 'TEXT_BLOCK', 
                value: this.lexer.stringValue() 
              });
              this.#consume();
          } else {
              // Парсим полноценное математическое выражение (переменная, функция, операция)
              elements.push(this.#parseExpression());
          }

          // Если следующий токен — запятая, поглощаем её и продолжаем цикл
          if (this.c_token === TokenType.COMMA) {
              this.#consume();
              
              // Проверка на trailing comma: если после запятой сразу закрывающая скобка
              if (this.c_token=== TokenType.RPAREN) {
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
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
    }
    return new PrintNode(elements, print_loc);
  }

  #unconIdent(errorMessage = 'Ожидался идентификатор') {
    if (this.c_token !== TokenType.VARIABLE) {
      this.#error(errorMessage, this.#location);
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return null;
    }
    const varable = this.lexer.stringValue();
    this.#consume();
    return varable;
  }

  #possibleIdent() {
    if (this.c_token !== TokenType.VARIABLE) {
      return null;
    }
    const varable = this.lexer.stringValue();
    this.#consume();
    return varable;
  }


  #parsePlotInit() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const mode = this.unconIdent();
    if (!diagram_id) return error_value();

    let view_type = null;
    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else { 
      this.#consume();
      view_type = this.unconIdent();
    }
    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    return new PlotInitNode(diagram_id, mode, view_type, token_loc);
  }

  #parsePlotConfig() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const key = this.unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const valueNode = this.#parseExpression();

    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    return new PlotConfigNode(diagram_id, key, valueNode, token_loc);    
  }

  #parsePlotLayer() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const layer_id = this.unconIdent();
    if (!layer_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    let color = '#000000';
    if (this.c_token === TokenType.TEXT_BLOCK)
    {
      const t_color = this.lexer.stringValue();
      if (isValidCSSColor(color)) color = t_color;
      else this.#error(`Неверно заданный цвет ${t_color}`, this.#location); 
      this.#consume();
    }
    else this.#error("Пропущен цвет", this.#location);

    let stroke_width = null;
    if (this.c_token === TokenType.COMMA) {
      this.#consume();
      stroke_width = this.#parseExpression();
    }
    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    return new PlotLayerNode(diagram_id, layer_id, color, stroke_width, token_loc);    
  }

  #parsePlotVector() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const variable = this.#parseExpression();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const layer_id = this.unconIdent();
    if (!layer_id) return error_value();

    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    return new PlotVectorNode(diagram_id, variable, layer_id, token_loc);       
  }

  // =======================================================
  // МАТЕМАТИЧЕСКАЯ ГРАММАТИКА (Строгий детерминированный спуск)
  // =======================================================

  #parseExpression() { 
    const result = this.#parseAssignment();
    while (MathParser.Expr_FIRST.has(this.c_token))
    {
        this.#error(`Ожидался оператор "${this.lexer.stringValue()}"`, this.#location);
        this.#parseAssignment();  
    }
    return result;
  }

  /**
   * Присваивание (Самый низкий приоритет).
   * Правая ассоциативность: x = y = 5 означает x = (y = 5)
   */
  #parseAssignment() {
    // Сначала парсим левую часть как обычное сложение/вычитание
    let expr = this.#parseAddition();

    // Если следующим токеном идёт знак равенства '='
    if (this.c_token === TokenType.ASSIGN) {
      const opToken_loc = this.#location;
      this.#consume(); // сожрали '='

      // КРИТИЧЕСКАЯ СЕМАНТИЧЕСКАЯ ПРОВЕРКА: слева ОБЯЗАНА быть переменная!
      if (!(expr instanceof VariableNode)) {
        this.#error(`[Semantic Error]: Неверное выражение слева от оператора присваивания. Ожидалось имя переменной.`,  opToken_loc);
      }

      // Рекурсивно парсим правую часть (поддержка цепочек присваивания x = y = 5)
      const right = this.#parseAssignment();
      return new AssignNode(expr.name, right, opToken_loc);
    }
    return expr;
  }

  // Множество FIRST для знаков сложения/вычитания
  #parseAddition() {
    let expr = this.#parseMultiplication();
    let loc;
    while (true) switch (this.c_token) {
      case TokenType.PLUS:
        loc = this.#location;
        this.#consume();
        expr = new AddNode(expr, this.#parseMultiplication(), loc);
        break;
      case TokenType.MINUS:
        loc = this.#location;
        this.#consume();
        expr = new SubNode(expr, this.#parseMultiplication(), loc);
        break;
      default: return expr;
    }
  }

  // Множество FIRST для знаков умножения/деления
  #parseMultiplication() {
    let expr = this.#parseUnary();
    let loc;
    while (true) switch (this.c_token) {
      case TokenType.MUL:
        loc = this.#location;
        this.#consume();
        expr = new MulNode(expr, this.#parseUnary(), loc);
        break;
      case TokenType.DIV:
        loc = this.#location;
        this.#consume();
        expr = new DivNode(expr, this.#parseUnary(), loc);
        break;
      default: return expr;
    }
  }

  // Унарные знаки
  #parseUnary() {
    let loc;
    switch (this.c_token)
    {
      case TokenType.PLUS:
        loc = this.#location;
        this.#consume();
        return new UnaryOpNodePlus(this.#parseUnary(), loc);
      case TokenType.MINUS:
        loc = this.#location;
        this.#consume();
        return new UnaryOpNodeMinus(this.#parseUnary(), loc);
      default: return this.#parsePower();
    }
  }

  // Степень (Правая ассоциация)
  #parsePower() { 
    let expr = this.#parsePrimary();

    if (this.c_token === TokenType.POW) {
      const loc = this.#location;
      this.#consume();      
      expr = new PowNode(expr, this.#parseUnary(), loc);
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
    let token_loc = this.#location;
    while (true) switch (this.c_token) {
        case TokenType.MATH_PI:
            this.#consume();
            return new ConstantNode(TokenType.MATH_PI, token_loc);
            
        case TokenType.MATH_E:
            this.#consume();
            return new ConstantNode(TokenType.MATH_E, token_loc);
            
        case TokenType.MATH_PHI:
            this.#consume();
            return new ConstantNode(TokenType.MATH_PHI, token_loc);
            
        case TokenType.MATH_INF:
            this.#consume();
            return new ConstantNode(TokenType.MATH_INF, token_loc);
            
        case TokenType.MATH_NAN:
            this.#consume();
            return new ConstantNode(TokenType.MATH_NAN, token_loc);

         case TokenType.RW_TRUE:
            this.#consume();
            return new ConstantNode(TokenType.RW_TRUE, token_loc);

         case TokenType.RW_FALSE:
            this.#consume();
            return new ConstantNode(TokenType.RW_FALSE, token_loc);
            
         case TokenType.NUMBER:
         {
            var value = this.lexer.numberValue();
            this.#consume();
            return new NumberNode(new RealNumber(value), token_loc);
         } 
         case TokenType.COMPLEX_NUMBER:
         {
             var value = this.lexer.numberValue();
             this.#consume();
             return new NumberNode(new ComplexNumber(0, value), token_loc);
         }
         case TokenType.LPAREN:
             this.#consume();
             const expr = this.#parseExpression();
             this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')'");
             return expr;

         case TokenType.VARIABLE:
             return this.#callFuncORVar();
         default:
          this.#error(`Ожидался операнд "${this.lexer.stringValue()}"`, token_loc);
          while (true)
          {
            this.#consume();
            token_loc = this.#location;
            if (MathParser.Primary_FIRST.has(this.c_token)) break;
            if (MathParser.Primary_FALLOW.has(this.c_token))
            {
              return new NumberNode(new RealNumber(1), token_loc);
            }
          }
    }
  }


  #callFuncORVar() {
      const token_loc = this.#location;
      const name = this.lexer.stringValue();      

      this.#consume();
      // СИНТАКСИЧЕСКИЙ ВЫБОР ВЫЗОВА: Если сразу за идентификатором идет '('
      if (this.c_token === TokenType.LPAREN) {
        this.#consume(); // сожрали '('
        const args = [];
        // Читаем список аргументов через запятую (например: pow(x, 3) или sin(x))
        if (this.c_token !== TokenType.RPAREN) {
          args.push(this.#parseExpression());
          
          while (this.c_token === TokenType.COMMA) {
            this.#consume(); // сожрали ','
            args.push(this.#parseExpression());
          }
        }

        this.#match(TokenType.RPAREN, `Ожидалась закрывающая скобка ')' после аргументов функции "${name}"`);
        
        // Возвращаем универсальный узел вызова
        return new CallNode(name, args, token_loc);
      }

      return new VariableNode(name, token_loc);
  }
}