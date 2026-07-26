import { TokenType } from './TokenTypes.js';
import { CompilerError } from './CompilerErrors.js';
import ASTNode, {
  IF_Node,
  Goto_Node,
  NumberNode,
  UnaryOpNode, 
  UnaryOpNodePlus,
  UnaryOpNodeMinus,
  UnaryOpNodeNot,
  BinaryOpNode,
  OrNode,
  XorNode,
  AndNode,
  EquNode,
  NotEquNode,
  LtNode,
  GtNode,
  LteNode,
  GteNode,
  AddNode,
  SubNode,
  MulNode,
  DivNode,
  PowNode,
  CallNode,
  RefNode, 
  AssignNode, 
  VariableNode, 
  PrintNode, 
  ProgramNode,
  MatrixNode,
  IndexNode,
  VarableCode,
  DefineVarableCodeNode,
  ConstantNode } from './ASTNodes.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import { MathLexer } from './MathLexer.js';
import { SymbolTableContext, SYM_UNDEFINED, SYM_VARIABLE, SYM_BUILTIN } from './SymbolTableContext.js';
import { TYPE_UNIT } from './ConstantsDef.js';
import { PlotInitNode, PlotDataNode, PlotConfigNode, PlotLayerNode, PlotVectorNode, PlotChordNode } from './DiagramNodes.js';
import { isValidCSSColor }  from '../util.js';
import DiagramDescriptor from '../views/DiagramDescriptor.js';
import { BuildVectorOperationDescription } from './VectorDeaign.js';
import { foldASTToTable } from '../math/ASTToTableConverter.js'
import { unfoldTableToAST } from '../math/unfoldTableToAST.js'

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
      return resultValue.toRawTeX(context.settings); // Гасим левую часть, выводим только ответ
    }

    resultValue = resultValue.toRawTeX(context.settings);

    // 3. Для полноценных вычислений выводим классическую цепочку (например, 2 * 5 = 10)
    return `${inputTree.toTeX(context)} = ${resultValue}`;
  }

  /**
   * Рекурсивно проверяет, является ли дерево просто статичной записью константы
   * @private
   */
  static _isStaticLiteralTree(node) {
    // База: числа и системные константы (%pi, %inf) — это статика
    if (node.isLiteral) return true;
    /*if (node instanceof NumberNode || node instanceof MatrixNode || node instanceof ConstantNode) {
      return true;
    }*/

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

class reportRecord {
  constructor(node, value) {
    this.node = node;
    this.value = value;
  }

  get type_unit() { return this.node.type_unit; }
}

class context_evallution
{
  constructor(scope_context, errors) {
    this.errors = errors;
    this.scope_context = scope_context;
    this.code = null;
    this.index_code = 0;
    this.report = [];
  }

  call_code(code, index = 0) {
    const sw_code = this.code;
    const sw_index = this.index_code;
    this.code = code;
    this.index_code = index;
    const len = this.report.length;
    this.run();
    this.code = sw_code;
    this.index_code = sw_index;
    // Если код что то вывел в отчёт
    if (len !== this.report.length) {
      // Удаляем последнию команду
      const data = this.report[this.report.length - 1];
      this.report.pop();
      return data.value;
    }
  }

  run() {
    while (this.index_code < this.code.length) {
      const ast_op = this.code[this.index_code++];
      if (!ast_op.isSilent && ast_op.type_unit !== TYPE_UNIT.EMPTY)
      {
        const value = ast_op.node.evaluate(this);
        if (value) {
          const rn = new reportRecord(ast_op.node, value);
          this.report.push(rn);
        }
      }
      else ast_op.node.evaluate(this);
    }
  }

  get count() { return this.errors.length; }

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

  // 1. Определяем константы флагов (степени двойки)
  static ALLOW_BREAK = 1;    // 001 в двоичной
  static ALLOW_CONTINUE = 2; // 010 в двоичной
  static ALLOW_RETURN = 4;   // 100 в двоичной

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
    this.flags = 0; // Изначально все запрещено (000)
  }

    // 2. Метод для установки (включения) флагов
  setFlags(flagMask) {
    this.flags |= flagMask; // Побитовое ИЛИ
  }

  // 3. Метод для сброса (выключения) флагов
  clearFlags(flagMask) {
    this.flags &= ~flagMask; // Побитовое И-НЕ
  }

  // 4. Метод для полной очистки всех флагов
  resetAll() {
    this.flags = 0;
  }

  // 5. Метод проверки, разрешена ли команда
  isAllowed(flag) {
    return (this.flags & flag) !== 0; // Побитовое И
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
    return new context_evallution(this.context, this.errors);
  }

  /**
   * Главный метод запуска LL(1) анализа
   */
  parse() {
    try {
        const code = [];
        this.#parseCode(code);
        if (this.errors.length === 0) {
            const evl_context = this.#create_evl_context();
            evl_context.code = code;
            evl_context.run();
            this.#program.statements = evl_context.report;
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
      .map((stmt) => {
        switch (stmt.type_unit)
        {
          case TYPE_UNIT.PRINT:
            return { type: 'mixed', value: stmt.value };
          case TYPE_UNIT.PLOT:
            return { type: 'plot', value: stmt.value };
          case TYPE_UNIT.EXPR:
            if (stmt.value instanceof DiagramDescriptor) {
              return { type: 'plot', value: stmt.value };
            }
            else {
              const renderString = TeXOutputFormatter.format(stmt.node, stmt.value, this.context);
              return { type: 'expr', value:  `$$${renderString}$$` };
            }
          default:
            throw new Error(`Неизвестная единица компиляции ${stmt.type_unit}`);
        }
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
    TokenType.LSQUARE,
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
    TokenType.LSQUARE,
    TokenType.VARIABLE,
    TokenType.PLUS,
    TokenType.MINUS,
  ]));

  #parseCode(code) {
    while (this.c_token !== TokenType.EOF) this.#parseStatement(code);
  }

  #parseStatement(code, f_out = false) {
    let exprNode = null;

    switch(this.c_token)
    {
      case TokenType.RW_PRINT:
        exprNode = this.#parsePrintStatement();
        break;
      case TokenType.RW_PLOT_INIT:
        exprNode = this.#parsePlotInit();
        break;
      case TokenType.RW_PLOT_CHORD:
        exprNode = this.#parsePlotChord();
        break;
      case TokenType.RW_PLOT_CONFIG:
        exprNode = this.#parsePlotConfig();
        break;
      case TokenType.RW_PLOT_LAYER:
        exprNode = this.#parsePlotLayer();
        break;
      case TokenType.RW_PLOT_VECTOR:
        exprNode = this.#parsePlotVector();
        break;
      case TokenType.RW_LET:
        exprNode = this.#parseDeclarationStatement();
        break;
      case TokenType.RW_IF:
        this.#parseIF(code, f_out);
        return;
      case TokenType.RW_WHERE:
        this.#parseWhere(code, f_out);
        return;
      case TokenType.RW_DO:
        this.#parseDoWhere(code, f_out);
        break; // Требуем ; или $
      case TokenType.RW_FOR:
        this.#parseFor(code, f_out);
        return;
      case TokenType.RW_BREAK:
        if (!this.isAllowed(MathParser.ALLOW_BREAK))
        {
          this.#error("Недопустимый оператор 'break'", this.#location);
          this.#consume();
        }
        return;
      case TokenType.RW_CONTINUE:
        if (!this.isAllowed(MathParser.ALLOW_CONTINUE))
        {
          this.#error("Недопустимый оператор 'continue': нет окружающего цикла", this.#location);
          this.#consume();
        }
        return;
      case TokenType.RW_RETUTN:
        if (!this.isAllowed(MathParser.ALLOW_RETURN))
        {
          this.#error("Оператор 'return' может использоваться только внутри тела функции", this.#location);
          this.#consume();
        }
        return;
      case TokenType.SEMICOLON:
      case TokenType.SILENT:
        // Проопускаем пустые ;;; $$$$ разделители операторов
        this.#consume();
        return;
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
        if (exprNode !== null)
          code.push(new StatementNode(exprNode, false));
        return;
      case TokenType.SILENT:
        this.#consume();
        if (exprNode !== null)
          code.push(new StatementNode(exprNode, exprNode instanceof AssignNode || f_out));
        return;
      default:
        this.#error(
          `Ожидался разделитель ';' или '<span class="tex2jax_ignore">$</span>' инструкция "${this.lexer.stringValue()}"`,
           this.#location);
        while (true)
        {
          if (MathParser.parseStatement_FIRST.has(this.c_token)) {
            return;
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
    TokenType.RSQUARE,
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

  /**
   * plot_init(diagram_id, mode, [view_type])
   *  Инициализация диаграммы.
   * - mode: three-phase (базис ТОЭ) или math (базис математики).
   * - view_type (опционально): inline (в карточке, по умолчанию) или window (плавающее окно).
   * Пример: plot_init(d1, three-phase, window);
   */
  #parsePlotInit() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.#unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const mode = this.#unconIdent();;
    if (!mode) return error_value();

    let view_type = null;
    if (this.c_token === TokenType.COMMA) {
      this.#consume();
      view_type = this.#unconIdent();
      if (!view_type) return error_value();
    }

    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    return new PlotInitNode(diagram_id, mode, view_type, token_loc);
  }

  /**
   * plot_config(diagram_id, key, value)
   * Глобальные настройки.
   * Пример: plot_config(d1, auto_add, true);
   */
  #parsePlotConfig() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.#unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const key = this.#unconIdent();;
    if (!key) return error_value();

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

  /**
   * plot_layer(diagram_id, layer_id, color, [stroke_width])
   * Регистрация слоя графики. Цвет задается строкой в кавычках.
   * Пример: plot_layer(d1, voltages, "#FF0000", 3);
   */
  #parsePlotLayer() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.#unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const layer_id = this.#unconIdent();
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

  /** 
   * plot_vector(diagram_id, variable, layer_id)
   * Построение вектора из начала координат.
   * Пример: plot_vector(d1, U_a, voltages);
   */
  #parsePlotVector() {
    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.#unconIdent();
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

    const layer_id = this.#unconIdent();
    if (!layer_id) return error_value();

    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    return new PlotVectorNode(diagram_id, variable, layer_id, token_loc);       
  }

  /**
   * plot_chord(diagram_id, expression, layer_id)
   * Построение хорды на основе выражения связи. Запрещены *, /, ^.
   * Пример: plot_chord(d1, U_ab = U_a - U_b, linears);
   */
  #parsePlotChord() {
    const e_c = this.errors.length;

    const token_loc = this.#location;
    const error_value = () => { return new NumberNode(new RealNumber(0), token_loc); };
    this.#consume();
    if (!this.#match(TokenType.LPAREN, "Ожидалась открывающая скобка '('")) {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    const diagram_id = this.#unconIdent();
    if (!diagram_id) return error_value();

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const exp = this.#parseExpression();
    const data = BuildVectorOperationDescription(exp, this.#create_evl_context());

    if (this.c_token !== TokenType.COMMA) {
      this.#error("Пропущена ','", this.#location);
    }
    else this.#consume();

    const layer_id = this.#unconIdent();
    if (!layer_id) return error_value();

    if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')' в конце print"))
    {
      while (!MathParser.parsePrintStatement_FALLOW.has(this.c_token)) this.#consume();
      return error_value();
    }
    if (e_c === this.errors.length)
      return new PlotChordNode(diagram_id, exp, data, layer_id, token_loc);
    else
      return error_value();
  }

  #parseIF(code, f_out) {
    let trueStatement = [];
    let falseStatement = [];
    this.#consume();
    // Условие
    if (!this.#match(TokenType.LPAREN, "Ожидалась '('"));
    const token_cond = this.#location;
    const exp = this.#parseExpression();
    if (!this.#match(TokenType.RPAREN, "Ожидалась ')'"));

    // Блок Then
    const token_then = this.#location;
    if (this.c_token === TokenType.LBRACE)
    {
      trueStatement =this.#parseBlock(f_out);
      if (!this.#match(TokenType.RBRACE, "Ожидалась закрывающая скобка '}' в конце блока кода "));
    }
    else {
      this.#parseStatement(trueStatement, f_out);
    }
    
    // Блок Else
    const token_else = this.#location;
    if (this.c_token === TokenType.RW_ELSE)
    {
       this.#consume();
      if (this.c_token === TokenType.LBRACE)
      {
        falseStatement =this.#parseBlock(f_out);
        if (!this.#match(TokenType.RBRACE, "Ожидалась закрывающая скобка '}' в конце блока кода "));
      }
      else {
        this.#parseStatement(falseStatement, f_out);
      }
    }

    // Симантика
    if (trueStatement.length === 0)
    {
      this.#error("Пустое тело оператора 'if'", token_then);
    }
    if (this.errors.length === 0)
    {
      // Собираем код
      const false_len = falseStatement.length;
      if (false_len !== 0)
      {
        trueStatement.push(new StatementNode(new Goto_Node(false_len, token_else), f_out));
      }
      code.push(new StatementNode(new IF_Node(exp, trueStatement.length, token_cond), f_out));
      code.push(... trueStatement, ... falseStatement);
    }
  }

  #parseWhere(code, f_out) {
    let loopBody = [];
    this.#consume();
    // Условие
    if (!this.#match(TokenType.LPAREN, "Ожидалась '('"));
    const token_cond = this.#location;
    const exp = this.#parseExpression();
    if (!this.#match(TokenType.RPAREN, "Ожидалась ')'"));

    // Тело цикла
    if (this.c_token === TokenType.LBRACE)
    {
      loopBody =this.#parseBlock(f_out);
      this.#match(TokenType.RBRACE, "Ожидалась закрывающая скобка '}' в конце блока кода ");
    }
    else {
      this.#parseStatement(loopBody, f_out);
    }

    if (this.errors.length === 0)
    {
      loopBody.push(new StatementNode(new Goto_Node(-(loopBody.length + 2), this.#location), f_out));
      code.push(new StatementNode(new IF_Node(exp, loopBody.length, token_cond), f_out));
      code.push(... loopBody);
    }
  }

  #parseDoWhere(code, f_out) {
    let loopBody = [];
    this.#consume();

    // Тело цикла
    if (this.c_token === TokenType.LBRACE)
    {
      loopBody =this.#parseBlock(f_out);
      this.#match(TokenType.RBRACE, "Ожидалась закрывающая скобка '}' в конце блока кода ");
    }
    else {
      this.#parseStatement(loopBody, f_out);
    }

    if (this.#match(TokenType.RW_WHERE, "Ожидалась 'where' в конце блока кода")) {
      this.#match(TokenType.LPAREN, "Ожидалась '('");
      const token_cond = this.#location;
      const exp = this.#parseExpression();
      this.#match(TokenType.RPAREN, "Ожидалась ')'");

      if (this.errors.length === 0)
      {
          code.push(... loopBody);
          code.push(new StatementNode(new IF_Node(exp, 1, token_cond), f_out));
          code.push(new StatementNode(new Goto_Node(-(loopBody.length + 2), this.#location), f_out));
      }
    }
  }

 #parseFor(code, f_out) {
    let loopBody = [];
    this.#consume();

    const end_expr = () => {
      switch(this.c_token)
      {
        case TokenType.SEMICOLON:
          this.#consume();
          return false;
        case TokenType.SILENT:
          this.#consume();
          return true;
        default:
          this.#error(`Ожидался разделитель ';' или '<span class="tex2jax_ignore">$</span>' инструкция "${this.lexer.stringValue()}"`, 
                        this.#location);
          return false;
      }
    };

    this.#match(TokenType.LPAREN, "Ожидалась '('");

    let expInit = null; let f_out_expInit = false;
    if (this.c_token !== TokenType.SEMICOLON && this.c_token !== TokenType.SILENT)
    {
      const exp_init_loc = this.#location;
      expInit = this.#parseExpression();
      if (!expInit.isAssigned) {
        this.#error(`[Semantic Error]: Выражение должно быть присвоением`, exp_init_loc);
      }
      f_out_expInit = end_expr();
    } else this.#consume();

    let expCond = null; let f_out_expCond = false;
    const exp_cond_loc = this.#location;
    if (this.c_token !== TokenType.SEMICOLON && this.c_token !== TokenType.SILENT)
    {
      expCond = this.#parseExpression();
      f_out_expCond = end_expr();
    } else this.#consume();

    const exp_inc_loc = this.#location;
    let expInc = null; let f_out_expInc = false;
    if (this.c_token !== TokenType.RPAREN)
    {      
      expInc = this.#parseExpression();
      // Разрешается вводить символ $ полсе оператора прирощения
      if (this.c_token === TokenType.SILENT)
      {
        f_out_expInc = true;
        this.#consume();
      }
    }

    this.#match(TokenType.RPAREN, "Ожидалась ')'");

    // Тело цикла
    if (this.c_token === TokenType.LBRACE)
    {
      loopBody =this.#parseBlock(f_out);
      this.#match(TokenType.RBRACE, "Ожидалась закрывающая скобка '}' в конце блока кода ");
    }
    else {
      this.#parseStatement(loopBody, f_out);
    }
    
    if (this.errors.length === 0)
    {
      if (expInc)
      {
        loopBody.push(new StatementNode(expInc, f_out || f_out_expInc));
      }
      loopBody.push(new StatementNode(new Goto_Node(-(loopBody.length + (expCond ? 2 : 1)), exp_inc_loc), f_out));

      if (expInit)
      {
        code.push(new StatementNode(expInit, f_out || f_out_expInit));
      }
      if (expCond)
      {
        code.push(new StatementNode(new IF_Node(expCond, loopBody.length, exp_cond_loc), f_out || f_out_expCond));
      }
      code.push(... loopBody);
    }
  }

  #parseBlock(f_out = true) {
      
      this.#consume();
      const statements = [];
      while (this.c_token !== TokenType.EOF && this.c_token !== TokenType.RBRACE) {
        this.#parseStatement(statements, f_out);
      } 
      if (statements.length === 0) 
          this.#error("Блок кода не может быть пустым", this.#location);
      return statements;
  }

  #parseDeclarationStatement() {
    this.#consume();
    const token_loc = this.#location;
    if (this.c_token !== TokenType.VARIABLE) {
      this.#error("Ожидалось имя (идентификатор) после 'let'", token_loc);
      return null;
    }
    const name = this.lexer.stringValue();
    this.#consume();
    if (this.c_token === TokenType.ASSIGN) {
      this.#consume();
      if (this.c_token === TokenType.LBRACE) {
        const statements =this.#parseBlock();
        const ret_loc = this.#location;
        if (!this.#match(TokenType.RBRACE, "Ожидалась закрывающая скобка '}' в конце блока кода "));
        if (this.errors.length === 0)
        {
          //statements.push(new StatementNode(new ReturnCodeNode(ret_loc), true));
          return new DefineVarableCodeNode(name, statements, null, token_loc);
        }
      }
      else if (this.c_token === TokenType.LPAREN) {
        this.#consume();
        const params = [];
        if (this.c_token !== TokenType.RPAREN) {
          while (true) {
            if (this.c_token !== TokenType.VARIABLE) {
              this.#error("Ожидалось имя параметра в круглых скобках", this.#location);
            }
            params.push(this.lexer.stringValue());
            this.#consume();
            
            if (this.c_token === TokenType.COMMA) {
              this.#consume(); // Сожрали запятую ','
              continue;
            }
            break;
          }
        }
        if (!this.#match(TokenType.RPAREN, "Ожидалась закрывающая скобка ')'"));
        if (this.c_token === TokenType.LBRACE) {
          const statements =this.#parseBlock();
          const ret_loc = this.#location;
          if (!this.#match(TokenType.RBRACE, "Ожидалась закрывающая скобка '}' в конце блока кода "));
          if (this.errors.length === 0)
          {
            //statements.push(new StatementNode(new ReturnCodeNode(ret_loc), true));
            return new DefineVarableCodeNode(name, statements, params, token_loc);
          }
        }
      }
      this.#error("Ожидалась открывающиеся скобка '{' блока кода", this.#location);
    }
    else
    {
      this.#error("Ожидалось '='", this.#location);
    }
    return null;
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
    let expr = this.#parseOR();

    // Если следующим токеном идёт знак равенства '='
    if (this.c_token === TokenType.ASSIGN) {
      const opToken_loc = this.#location;
      this.#consume(); // сожрали '='

      // КРИТИЧЕСКАЯ СЕМАНТИЧЕСКАЯ ПРОВЕРКА: слева ОБЯЗАНА быть переменная!
      if (!(expr instanceof RefNode)) {
        this.#error(`[Semantic Error]: Неверное выражение слева от оператора присваивания. Ожидалось ссылка.`,  opToken_loc);
      }

      // Рекурсивно парсим правую часть (поддержка цепочек присваивания x = y = 5)
      const right = this.#parseAssignment();
      return expr.createAssign(right, opToken_loc);
    }
    return expr;
  }

    // Множество FIRST для знаков сложения/вычитания
  #parseOR() {
    let expr = this.#parseXor();
    let loc;
    while (true) switch (this.c_token) {
      case TokenType.RW_OR:
        loc = this.#location;
        this.#consume();
        expr = new OrNode(expr, this.#parseXor(), loc);
        break;
      default: return expr;
    }
  }

  #parseXor() {
    let expr = this.#parseAnd();
    let loc;
    while (true) switch (this.c_token) {
      case TokenType.RW_XOR:
        loc = this.#location;
        this.#consume();
        expr = new XorNode(expr, this.#parseAnd(), loc);
        break;
      default: return expr;
    }
  }

   #parseAnd() {
    let expr = this.#parseRelational();
    let loc;
    while (true) switch (this.c_token) {
      case TokenType.RW_AND:
        loc = this.#location;
        this.#consume();
        expr = new AndNode(expr, this.#parseRelational(), loc);
        break;
      default: return expr;
    }
  }

   #parseRelational() {
    let expr = this.#parseAddition();
    let loc;
    while (true) switch (this.c_token) {
      case TokenType.EQU:
        loc = this.#location;
        this.#consume();
        expr = new EquNode(expr, this.#parseAddition(), loc);
        break;
      case TokenType.NOT_EQU:
        loc = this.#location;
        this.#consume();
        expr = new NotEquNode(expr, this.#parseAddition(), loc);
        break;
      case TokenType.LT:
        loc = this.#location;
        this.#consume();
        expr = new LtNode(expr, this.#parseAddition(), loc);
        break;
      case TokenType.LTE:
        loc = this.#location;
        this.#consume();
        expr = new LteNode(expr, this.#parseAddition(), loc);
        break;
      case TokenType.GT:
        loc = this.#location;
        this.#consume();
        expr = new GtNode(expr, this.#parseAddition(), loc);
        break;
      case TokenType.GTE:
        loc = this.#location;
        this.#consume();
        expr = new GteNode(expr, this.#parseAddition(), loc);
        break;
      default: return expr;
    }
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
      case TokenType.RW_NOT:
        loc = this.#location;
        this.#consume();
        return new UnaryOpNodeNot(this.#parseUnary(), loc);
      default: return this.#parsePower();
    }
  }

  // Степень (Правая ассоциация)
  #parsePower() { 
    let expr = this.#parsePrimaryExpression();

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
    TokenType.LSQUARE,
    TokenType.VARIABLE,
  ]));

  static Primary_FALLOW = Object.freeze(new Set([
    TokenType.EOF,
    TokenType.SEMICOLON,
    TokenType.SILENT,
    TokenType.PARENR,
    TokenType.RSQUARE,
    TokenType.POW,
    TokenType.MUL,
    TokenType.DIV,
    TokenType.PLUS,
    TokenType.MINUS,
    TokenType.ASSIGN,
    TokenType.COMMA,
  ]));

  #parsePrimaryExpression() {
    let expr = this.#parsePrimary();

    // ЗАПУСКАЕМ ЦИКЛ ПОСТФИКСОВ: Пока после атома идут скобки или индексы, мы оборачиваем его!
    while (true) {
      if (this.c_token === TokenType.LSQUARE) {
        const loc = this.#location;
        this.#consume(); // Поглощаем '['

        // Парсим индекс строки
        const rowExpr = this.#parseExpression();
        let colExpr = null;

        // Если дальше идет запятая, значит передан второй индекс (столбец)
        if (this.c_token === TokenType.COMMA) {
          this.#consume(); // Поглощаем ','
          colExpr = this.#parseExpression(); // Парсим индекс столбца
        }

        this.#match(TokenType.RSQUARE, "Ожидалась закрывающая квадратная скобка индекса ']'");

        // Магия! Мы оборачиваем текущее выражение expr в IndexNode.
        // Это позволит работать цепочкам вида A[1,2], (M*N)[1,1], или даже функциям: getMatrix()[1,2]!
        expr = new IndexNode(expr, rowExpr, colExpr, loc);
        continue;
      }
      
      // Здесь же у вас может стоять проверка на круглую скобку (вызов функции)
      // if (this.c_token === TokenType.LPAREN) { ... expr = new CallNode(expr, ...); continue; }

      break; // Никаких постфиксов больше нет, выходим
    }

    return expr;    
  }

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

         case TokenType.LSQUARE: {
          const startLoc = this.#location; // Сохраняем локацию начала матрицы
          this.#consume(); // Поглощаем стартовую '['

          // Проверка на пустую матрицу '[]'
          if (this.c_token === TokenType.RSQUARE) {
              this.#consume();
              this.#error("Матрица или вектор не могут быть пустыми.", startLoc);
              return new NumberNode(this.errorValue(), startLoc);
          }

          // Проверяем, что находится внутри: строка матрицы или элементы вектора?
          if (this.c_token === TokenType.LSQUARE) {
              // --- ВАРИАНТ: Двумерная матрица [[a, b], [c, d]] ---
              const matrixRows = [];
              
              while (true) {
                  // Утверждаем и поглощаем внутреннюю открывающую скобку '['
                  this.#match(TokenType.LSQUARE, "Ожидалась открывающая квадратная скобка строки матрицы '['");
                  
                  const rowNodes = [];
                  while (true) {
                      rowNodes.push(this.#parseExpression()); // Парсим узел элемента
                      
                      // Если дальше идет запятая, поглощаем её и продолжаем парсить строку
                      if (this.c_token === TokenType.COMMA) {
                          this.#consume();
                      } else {
                          break; // Запятой нет, значит строка закончилась
                      }
                  }

                  // Утверждаем и поглощаем закрывающую скобку строки ']'
                  this.#match(TokenType.RSQUARE, "Ожидалась закрывающая квадратная скобка строки матрицы ']'");
                  matrixRows.push(rowNodes); // Сохраняем готовую строку узлов

                  // Если после строки идет запятая, значит будет еще одна строка
                  if (this.c_token === TokenType.COMMA) {
                      this.#consume();
                  } else {
                      break; // Больше строк нет
                  }
              }

              // Утверждаем и поглощаем финальную закрывающую скобку матрицы ']'
              this.#match(TokenType.RSQUARE, "Ожидалась закрывающая квадратная скобка матрицы ']'");
              
              return new MatrixNode(matrixRows, startLoc);
              
          } else {
              // --- ВАРИАНТ: Вектор-строка [a, b, c] ---
              const rowNodes = [];
              
              while (true) {
                  rowNodes.push(this.#parseExpression());
                  
                  if (this.c_token === TokenType.COMMA) {
                      this.#consume();
                  } else {
                      break;
                  }
              }

              // Утверждаем и поглощаем закрывающую скобку вектора ']'
              this.#match(TokenType.RSQUARE, "Ожидалась закрывающая квадратная скобка вектора ']'");

              // Оборачиваем вектор в двумерную структуру (одна строка) для MatrixNode
              return new MatrixNode([rowNodes], startLoc);
          }
         }

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