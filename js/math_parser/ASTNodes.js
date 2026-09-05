// Импортируем наш базовый математический тип, чтобы использовать в проверках, 
// если потребуется расширение, или для явного понимания типов
import BoolValue from '../math/BoolValue.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { MathRegistry } from './MathRegistry.js';
import { dispatcher } from './SemanticDispatcher.js';
import { TokenType } from './TokenTypes.js';
import { SYM_UNDEFINED, SYM_VARIABLE, SYM_BUILTIN } from './SymbolTableContext.js';
import { TYPE_UNIT } from './ConstantsDef.js';
import { restoreLocation } from './CompilerErrors.js';
import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';

Matrix.registerRealNumberClass(RealNumber);

const OpPriority = { 
    ASSIGN: 1,       // '='
    OR: 2,
    XOR: 3,
    AND: 4,
    RELATIONAL: 5,
    IS: 6,  
    ADD_SUB: 7,      // '+', '-'
    MUL_DIV: 8,      // '*', '/'
    UNARY: 9,        // унарные '+' и '-'
    POW: 10,          // '^'
    PRIMARY: 11       // Числа, переменные
};

/**
 * Базовый абстрактный класс для всех узлов Дерева Выражений (AST).
 */
export default class ASTNode {
  /**
   * @param {SourceLocation|IndependentSourceLocation} loc - Координаты токена в исходном коде
   */
  constructor(loc) {
    // 1. Защита от прямого создания экземпляра Base класса
    if (this.constructor === ASTNode) {
      throw new TypeError("[ASTNode]: Нельзя создать экземпляр абстрактного базового класса.");
    }
   this.loc = loc;
  }

  toJSON() {
    return {
      dataType: this.constructor.dataTypeName,
      loc: this.loc // JS зайдет внутрь SourceLocation и вызовет его кастомный toJSON()!
    };
  }

  get isLiteral() {
    return false; // По умолчанию большинство узлов динамические (переменные, функции и т.д.)
  }

  get isAssigned() { return false; }

  getPriority() { throw new Error("Not implemented"); }

  toString(context) { throw new Error("Not implemented"); }

  errorValue() { return new RealNumber(0); }

  get type_unit() { throw new Error("Not implemented"); }

  error(context, msg, loc) {
    context.error(msg, loc ?? this.loc, "AST");
  }
 
  /** Вычисляет значение узла, возвращая экземпляр MathType (ComplexNumber/Matrix) */
  evaluate(context) {
    try
    {
      return this.internal_evaluate(context);
    }
    catch(err)
    {
      this.error(context, err.toString());
      return this.errorValue();
    }
  }

  /** Внутренний метод вычисляет значение узла, возвращая экземпляр MathType (ComplexNumber/Matrix) */
  internal_evaluate(context) {
    throw new Error("[ASTNode]: Метод evaluate() не реализован.");
  }

  /** Генерирует чистый LaTeX-код БЕЗ знаков доллара */
  toTeX(context) {
    throw new Error("[ASTNode]: Метод toTeX() не реализован.");
  }

  /**
   * Статический метод для форматирования идентификаторов в TeX код для MathJax
   * @param {string} name - Имя идентификатора (например, "U_max", "user_profile_id")
   * @returns {string} - Валидный TeX код
   */
  static formatIdentifierToTeX(name) {
      if (!name) return '';

      // Функция для оборачивания национальных символов в \text{...}
      // Оставляет чистую латиницу [a-zA-Z] как есть, а кириллицу/другие языки изолирует
      const wrapNationalText = (text) => {
          return text.replace(/([^\x00-\x7F\s]+|[\p{L}\p{N}&&\s]+)/gu, (match) => {
              // Если блок состоит только из латинских букв или цифр ASCII, не трогаем
              if (/^[a-zA-Z0-9]+$/.test(match)) return match;
              return `\\text{${match}}`;
          });
      };

      // Считаем количество подчеркиваний
      const underscoreCount = (name.match(/_/g) || []).length;
      
      // Определяем стратегию: Snake_Case (много '_') или системное имя (начинается с '_')
      const isSnakeCase = underscoreCount > 1 || name.startsWith('_');

      if (isSnakeCase) {
          // Сценарий 1: Много '_ ' или ведущее '_' (например, ХХХ_ХХХ_ХХХ или _ХХХ)
          // Экранируем все подчеркивания, чтобы MathJax не воспринял их как индексы
          let processed = name.replace(/_/g, '\\_');
          return wrapNationalText(processed);
      } else if (underscoreCount === 1) {
          // Сценарий 2: Ровно одно подчеркивание (например, U_a, Скорость_базовая)
          // Разделяем строку на основу и будущий нижний индекс
          const [base, index] = name.split('_');
          
          const cleanBase = wrapNationalText(base);
          const cleanIndex = wrapNationalText(index);
          
          // Если в индексе больше 1 символа, обязательно группируем его в скобки _{...}
          const formattedIndex = index.length > 1 ? `{${cleanIndex}}` : cleanIndex;
          
          return `${cleanBase}_${formattedIndex}`;
      } else {
          // Сценарий 3: Подчеркиваний нет вообще
          return wrapNationalText(name);
      }
  }

  /**
   * Чисто виртуальный метод. ДОЛЖЕН быть реализован во всех дочерних классах.
   * @param {MathNode[]} list 
   */
  collectMathExpressions(list) {
    // Если управление попало сюда, значит производный класс не создал свой метод
    throw new Error(
      `[Abstract Error]: Класс "${this.constructor.name}" обязан реализовать метод collectMathExpressions(list).`
    );
  }

  // Виртуальный метод поиска
  find(condition) {
      // 1. Проверяем сам текущий узел
      if (condition(this)) {
          return this;
      }

      // 2. Рекурсивно обходим детей
      for (const child of this.getChildren()) {
          if (!child) continue;

          const found = child.find(condition);
          if (found) return found; // Нашли — возвращаем вверх по стеку
      }

      return null;
  }

  findAll(condition, accumulator = []) {
      // 1. Если текущий узел подходит, добавляем его в результаты
      if (condition(this)) {
          accumulator.push(this);
      }

      // 2. Продолжаем обход детей в любом случае (не прерываем цикл)
      for (const child of this.getChildren()) {
          child.findAll(condition, accumulator);
      }

      // 3. Возвращаем итоговый массив наружу
      return accumulator;
  }  

  // Генератор детей, который каждый класс переопределяет под себя
  *getChildren() {
      // По умолчанию у абстрактного узла детей нет
  }
}

export function regAST(ClassRef) {
  registerDataType(ClassRef.dataTypeName, ClassRef.fromJSON);
}

/**
 * Единый узел для любой инструкции в коде
 */
export class StatementNode {
  constructor(node, isSilent) {
    this.node = node;
    this.isSilent = isSilent;
  }

  toJSON() {
    return {
      node: this.node,
      isSilent: this.isSilent
    };
  }

  static get dataTypeName() { return "StatementNode"; }

  static fromJSON(data) {
    return new StatementNode(
      restoreDataType(data.node),
      data.isSilent
    );
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
regAST(StatementNode);

export class VarableCode {
  // На этапе парсинга передаем statements и число — сколько у функции аргументов
  constructor(statements, paramsCount, localsCount, lexicalParentFrame) {
    this.statements = statements;
    this.paramsCount = paramsCount;
    this.localsCount = localsCount;
    this.lexicalParentFrame = lexicalParentFrame; 
  }

  toJSON() {
    if (this.lexicalParentFrame != null)
      throw new Error(`Попытка сохранить не корнивойю процедуру.`);
    return {
      statements: this.statements,
      paramsCount: this.paramsCount,
      localsCount: this.localsCount,
    };
  }

  static get dataTypeName() { return "VarableCode"; }

  static fromJSON(data) {
    const restoredstatements = data.statements.map(stm => restoreDataType(stm));
    return new VarableCode(
      restoredstatements,
      data.paramsCount,
      data.localsCount,
      null
    );
  }

  toRawTeX(settings) { return "\\text{code}"; }

  evaluate(context, args) {
    const scopeCtrl = context.scope_context;
    const frame = scopeCtrl.createFrame(this.localsCount, this.lexicalParentFrame);
    for (let i = 0; i < this.paramsCount; i++) {
        frame.symbols[i].value = args[i];
    }
    scopeCtrl.scopes.push(frame);
    context.call_code(this.statements);
  }
}
regAST(VarableCode);

export class ErrorNode extends ASTNode {
  constructor(msg, loc) {
    super(loc);
    this.msg = msg;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      msg: this.msg
    };
  }

  static get dataTypeName() { return "ErrorNode"; }

  static fromJSON(data) {
    return new ErrorNode(
      data.msg,
      restoreLocation(data.loc)
    );
  }

  get type_unit() { return TYPE_UNIT.EMPTY; }

  internal_evaluate(context) {
    throw this.msg;
  }
}
regAST(ErrorNode);


export class IF_Node extends ASTNode {
  constructor(if_expr, len_code_false, loc) {
    super(loc);
    this.if_expr = if_expr;
    this.len_code_false = len_code_false;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      if_expr: this.if_expr,
      len_code_false: this.len_code_false
    };
  }

  static get dataTypeName() { return "IF_Node"; }

  static fromJSON(data) {
    return new IF_Node(
      restoreDataType(data.if_expr),
      data.len_code_false,
      restoreLocation(data.loc)
    );
  }

  get type_unit() { return TYPE_UNIT.EMPTY; }

  internal_evaluate(context) {
    const if_result = this.if_expr.internal_evaluate(context);
    const b_value = BoolValue.from(if_result).value;
    if (!b_value) {
      context.index_code += this.len_code_false;
    }
  }

  *getChildren() {
      yield this.if_expr;
  }
}
regAST(IF_Node);

export class Goto_Node extends ASTNode {
  constructor(len_code, loc) {
    super(loc);
    this.len_code = len_code;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      len_code: this.len_code,
    };
  }

  static get dataTypeName() { return "IF_Node"; }

  static fromJSON(data) {
    return new Goto_Node(
      data.len_code,
      restoreLocation(data.loc)
    );
  }

  get type_unit() { return TYPE_UNIT.EMPTY; }

  internal_evaluate(context) {
      context.index_code += this.len_code;
  }
}
regAST(Goto_Node);

export class DefineVarableCodeNode extends ASTNode {
    constructor(funcId, statements, paramsCount, localsCount, loc) {
    super(loc);
    this.funcId = funcId;
    this.statements = statements;
    this.paramsCount = paramsCount;
    this.localsCount = localsCount;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      funcId: this.funcId,
      statements: this.statements,
      paramsCount: this.paramsCount,
      localsCount: this.localsCount,
    };
  }

  static get dataTypeName() { return "DefineVarableCodeNode"; }

  static fromJSON(data) {
    return new DefineVarableCodeNode(
      data.funcId,
      restoreDataType(data.statements),
      data.paramsCount,
      data.localsCount,
      restoreLocation(data.loc)
    );
  }

  get type_unit() { return TYPE_UNIT.EMPTY; }

  internal_evaluate(context) {
    try {
      const scopeCtrl = context.scope_context;

      // Находим живой кадр, в котором мы СЕЙЧАС находимся (кадр родителя)
      const currentLiveFrame = scopeCtrl.currentScope;

      // Создаем замыкание, передавая ему жесткий указатель на этот кадр
      const closure = new VarableCode(this.statements, this.paramsCount, this.localsCount, currentLiveFrame);

      // Записываем это замыкание в символ функции
      const funcSymbol = scopeCtrl.getSymbolById(this.funcId);
      funcSymbol.value = closure;
    } catch(err) {
       this.error(context, err);
    }
  }
}
regAST(DefineVarableCodeNode);

export class MathNode extends ASTNode {
  constructor(loc) {
    super(loc);
    if (this.constructor === MathNode) {
      throw new TypeError("[MathNode]: Нельзя создать экземпляр абстрактного базового класса.");
    }
  }

  get type_unit() { return TYPE_UNIT.EXPR; }

  /**
   * Добавляет себя в список и останавливает погружение.
   */
  collectMathExpressions(list) { list.push(this); }  
}

/**
 * Узел числа (Терминальный узел / Лист дерева)
 */
export class NumberNode extends MathNode {
  constructor(mathTypeValue, loc) {
    super(loc);
    this.value = mathTypeValue;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      value: this.value,
    };
  }

  static get dataTypeName() { return "NumberNode"; }

  static fromJSON(data) {
    return new NumberNode(
      restoreDataType(data.value),
      restoreLocation(data.loc)
    );
  }

  get isLiteral() { return true; }

  getPriority() {
    if (this.value instanceof ComplexNumber && !this.value.isComplexFormat())
      return OpPriority.PRIMARY;
    else return OpPriority.ADD_SUB;
  }

  toString(context) { return this.value.toString(context); }

  internal_evaluate(context) { return this.value; }

  toTeX(context) { return this.value.toRawTeX(context); }
}
regAST(NumberNode);

export class MatrixNode extends MathNode {
  #rows; // Двумерный массив узлов ASTNode/MathNode

  /**
   * @param {ASTNode[][]} rows - Двумерный массив узлов дерева
   * @param {SourceLocation} loc - Локация токена для вывода ошибок
   */
  constructor(rows, loc) {
    super(loc);
    this.#rows = rows;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      rows: this.#rows,
    };
  }

  static get dataTypeName() { return "MatrixNode"; }

  static fromJSON(data) {
    const restoredRows = data.rows.map(row => 
      row.map(astNodeData => restoreDataType(astNodeData))
    );

    return new MatrixNode(
      restoredRows,
      restoreLocation(data.loc)
    );
  }

  get isLiteral() { return true; }

  getPriority() {  return OpPriority.PRIMARY; }

  /**
   * Текстовое представление дерева (до вычисления)
   */
  toString(context) {
    const rowsStr = this.#rows.map(row => 
      `[${row.map(node => node.toString(context)).join(', ')}]`
    );
    return `[${rowsStr.join(', ')}]`;
  }

  /**
   * Генерирует TeX-код структуры дерева выражений (например, покажет \frac{1}{2} внутри матрицы)
   */
  toTeX(context) {
    const env = (context && context.settings && context.settings.matrixFormat) || 'bmatrix';
    
    const body = this.#rows.map(row => 
      row.map(node => node.toTeX(context)).join(' & ')
    ).join(' \\\\ \n');

    return `\\begin{${env}}\n${body}\n\\end{${env}}`;
  }

  *getChildren() {
      for (const row of this.#rows) {
          if (!row) continue; // На случай, если строка целиком пустая
          
          for (const node of row) {
              if (node) { 
                  yield node; // Выдаем только существующие узлы
              }
          }
      }
  }

  /**
   * Вычисление матрицы: вычисляет каждый узел внутри дерева
   * @returns {Matrix} Готовый математический объект матрицы
   */
  internal_evaluate(context) {
      // 1. Вычисляем все узлы AST внутри матрицы, получая атомарные объекты MathType
     const evaluatedElements = this.#rows.map(row =>
      row.map(node => node.evaluate(context))
    );

    // 2. Сначала найдём базовый "эталонный" тип, к которому нужно привести всю матрицу.
    // Мы просто пройдёмся по всем элементам и будем последовательно вызывать promoteTypes.
    // За стартовую точку возьмём самый первый элемент матрицы [0][0].
    let targetSample = evaluatedElements[0][0];

    for (const row of evaluatedElements) {
      for (const cell of row) {
        // Вызываем ваш диспетчер. Он посмотрит на ранги внутри своего приватного #registry,
        // сам выполнит cast сильного типа и вернёт нам нормализованную пару!
        const { l } = dispatcher.promoteTypes(targetSample, cell);
        targetSample = l; // Запоминаем текущий самый сильный объект-эталон
      }
    }

    // 3. Теперь, когда targetSample гарантированно имеет самый высокий ранг в этой матрице,
    // приводим ВСЕ элементы к его типу через promoteTypes
    const finalElements = evaluatedElements.map(row =>
      row.map(cell => {
        const { r } = dispatcher.promoteTypes(targetSample, cell);
        return r; // r — это наш cell, подтянутый диспетчером до уровня targetSample!
      })
    );

    // 4. Передаем идеально однородный массив в конструктор Матрицы
    return new Matrix(finalElements);
  }

  /**
   * Сбор математических выражений (интеграция в вашу систему обхода)
   */
  collectMathExpressions(list) {
    list.push(this);
    // Рекурсивно погружаемся в каждый узел матрицы, если это необходимо системе
    for (const row of this.#rows) {
      for (const node of row) {
        node.collectMathExpressions(list);
      }
    }
  }
}
regAST(MatrixNode);

const TYPE_CLASSES = {
  'bool': BoolValue,
  'real': RealNumber,
  'сomplex': ComplexNumber,
  'matrix':  Matrix
};

const REVERSE_TYPE_CLASSES = new Map(
  Object.entries(TYPE_CLASSES).map(([name, ClassRef]) => [ClassRef, name])
);

/**
 * Функция-обертка для получения строкового имени типа.
 * @param {string|Function|null|undefined} typeRef - Строка ('number', 'boolean') или класс (Matrix, RealNumber)
 * @param {Map} reverseMap - Ваш словарь REVERSE_TYPE_CLASSES (Маппинг: Класс -> Строка)
 * @returns {string} - Понятное имя типа для пользователя
 */
export function getTypeNameString(typeRef, reverseMap = REVERSE_TYPE_CLASSES) {
  // 1. Защита от пустых значений (если что-то пошло не так в AST)
  if (typeRef === null || typeRef === undefined) {
    return 'empty';
  }

  // 2. Если это уже строка (например, 'number', 'boolean', 'string')
  if (typeof typeRef === 'string') {
    return typeRef;
  }

  // 3. Если это функция-конструктор (ваш класс типа Matrix, ComplexNumber и т.д.)
  if (typeof typeRef === 'function') {
    return reverseMap.get(typeRef) || typeRef.name || 'unknown_class';
  }

  // 4. На случай, если передан сам объект-экземпляр вместо его типа/класса
  if (typeof typeRef === 'object' && typeRef.constructor) {
    return reverseMap.get(typeRef.constructor) || typeRef.constructor.name || 'unknown_object';
  }

  return 'unknown';
}

export class IsOpNode extends MathNode {
  constructor(argument, targetType, loc) {
    super(loc);
    this.argument = argument;
    this.targetType = TYPE_CLASSES[targetType];
    if (!this.targetType) {
      throw new Error(`Runtime Error: Тип данных "${targetType}" не зарегистрирован в ядре калькулятора.`);
    }
  }

  toJSON() {
    return {
      ...super.toJSON(),
      argument: this.argument,
      targetType: getTypeNameString(this.targetType, REVERSE_TYPE_CLASSES)
    };
  }

  static get dataTypeName() { return "IsOpNode"; }

  static fromJSON(data) {    
    return new IsOpNode(
      restoreDataType(data.argument),
      data.targetType,
      restoreLocation(data.loc)
    );
  }

  getPriority() { return OpPriority.IS; }

  internal_evaluate(context) { 
    const leftValue = this.argument.internal_evaluate(context);
    if (leftValue === null || leftValue === undefined) return false;
    const targetClass = this.targetType;
    return new BoolValue(leftValue instanceof targetClass);
  }

  *getChildren() {
    yield this.argument;
  }

  toString(context) {
    let innerCode = this.argument.toString(context);
    if (this.argument.getPriority() < this.getPriority()) {
          innerCode = `(${innerCode})`;
    }
    const name = getTypeNameString(this.targetType, REVERSE_TYPE_CLASSES);
    return `${innerCode} is ${name}`;
  }

  toTeX(context) {
    let innerCode = this.argument.toTeX(context);
    if (this.argument.getPriority() < this.getPriority()) {
          innerCode = `\\left(${innerCode}\\right)`;
    }
    const name = getTypeNameString(this.targetType, REVERSE_TYPE_CLASSES);
    return `${innerCode}\\text{ is ${name}}`;
  }
}
regAST(IsOpNode);

// Реализация таблицы через объект объектов (или Map)
const CAST_TABLE = new Map([
  // Правила конвертации ИЗ типа 'bool'
  [ 'boolean', {
    casts: new Map([
    [BoolValue,      (value) => new BoolValue(value)],
    ]),
  }],
  [ BoolValue, {
    casts: new Map([
    [BoolValue,      (value) => value],
    ]),
  }],
  // Правила конвертации ИЗ типа 'real'
  [ 'number', {
    casts: new Map([
    [BoolValue,      (value) => BoolValue.from(value !== 0)], 
    [RealNumber,     (value) => RealNumber.from(value)],      
    [ComplexNumber,  (value) => ComplexNumber.from(value)],
    [Matrix,         (value) => new Matrix([value])],
    ]),
  }],
  [ RealNumber, {
    casts: new Map([
    [BoolValue,      (value) => BoolValue.from(!value.equals(0))], 
    [RealNumber,     (value) => value],      
    [ComplexNumber,  (value) => ComplexNumber.from(value)],
    [Matrix,         (value) => new Matrix([[value]])],
    ]),
  }],
  // Правила конвертации ИЗ типа 'complex'
  [ComplexNumber, {
    casts: new Map([
    [BoolValue,      (value) => BoolValue.from(!value.equals(0))],
    [RealNumber,     (value) => RealNumber.from(value.real)],      
    [ComplexNumber,  (value) => value],
    [Matrix,         (value) => new Matrix([[value]])],
    ]),
  }],
  [Matrix, {
    casts: new Map([
    [Matrix,         (value) => value],
    ]),
  }],
]);

export class CastOpNode extends MathNode {
  constructor(argument, targetType, loc) {
    super(loc);
    this.argument = argument;
    this.targetType = TYPE_CLASSES[targetType];
    if (!this.targetType) {
      throw new Error(`Runtime Error: Тип данных "${targetType}" не зарегистрирован в ядре калькулятора.`);
    }
  }

   toJSON() {
    return {
      ...super.toJSON(),
      argument: this.argument,
      targetType: getTypeNameString(this.targetType, REVERSE_TYPE_CLASSES)
    };
  }

  static get dataTypeName() { return "CastOpNode"; }

  static fromJSON(data) {    
    return new CastOpNode(
      restoreDataType(data.argument),
      data.targetType,
      restoreLocation(data.loc)
    );
  }
  
  getPriority() {  return OpPriority.PRIMARY; }

  toString(context) {
    let innerCode = this.argument.toString(context);
    const name = getTypeNameString(this.targetType, REVERSE_TYPE_CLASSES);
    return `${name}(${innerCode})`;
  }

  toTeX(context) {
    let innerCode = this.argument.toTeX(context);
    const name = getTypeNameString(this.targetType, REVERSE_TYPE_CLASSES);
    return `\\text{${name}}\\left(${innerCode}\\right)`;
  }

  *getChildren() {
    yield this.argument;
  }

  internal_evaluate(context) { 
    const valueToCast = this.argument.internal_evaluate(context);

    const type = typeof valueToCast;
    const sourceType = type === 'object' && valueToCast !== null ? valueToCast.constructor : type;

    const config =  CAST_TABLE.get(sourceType);
    const castFunction = config?.casts.get(this.targetType);
    if (castFunction) {
      return castFunction(valueToCast);
    }

    const name_sourceType = getTypeNameString(sourceType, REVERSE_TYPE_CLASSES);
    const name_targetType = getTypeNameString(this.targetType, REVERSE_TYPE_CLASSES);
    this.error(context, `Невозможно привести тип "${name_sourceType}" к типу "${name_targetType}".`);
  }
}
regAST(CastOpNode);

/**
 * Узел унарной операции (например: -x, +sin(i))
 */
export class UnaryOpNode extends MathNode {
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

  toJSON() {
    return {
      ...super.toJSON(),
      argument: this.argument,
    };
  }

  static create(ClassRef, data) {
     return new ClassRef(
      restoreDataType(data.argument),
      restoreLocation(data.loc)
    );   
  }

  getPriority() { return OpPriority.UNARY; }

  toString(context) {
      let innerCode = this.argument.toString(context);      
      // Если у внутреннего выражения приоритет ниже, берем его в скобки
      if (this.argument.getPriority() < this.getPriority()) {
          innerCode = `(${innerCode})`;
      }
      
      return `${this.operator}${innerCode}`;
  }  

  toTeX(context) {
    const signState = { minusCount: 0 };
    
    // Запускаем сборку знаков с текущего узла
    const coreNode = this._collapseUnaryChain(this, signState);

    // Получаем TeX-код для «чистого» центрального узла
    let argTex = coreNode.toTeX(context);
    
    // Проверяем приоритет: если внутри унарной цепочки сидит выражение 
    // с низким приоритетом (например, сложение A+B), его нужно взять в скобки
    if (coreNode.getPriority() < this.getPriority()) {
      argTex = `\\left(${argTex}\\right)`;
    }

    // Определяем итоговый знак цепочки
    const finalOperator = (signState.minusCount % 2 !== 0) ? '-' : '';

    return `${finalOperator}${argTex}`;
  }

  *getChildren() {
    yield this.argument;
  }

  // Вспомогательный метод для размотки цепочки знаков +---++
  _collapseUnaryChain(node, signState) {
    // Если текущий узел — унарная операция, обрабатываем её и идём вглубь
    if (node instanceof UnaryOpNode) {
      if (node.operator === '-') {
        signState.minusCount++;
      }
      return this._collapseUnaryChain(node.argument, signState);
    }
    
    // Как только наткнулись на не-унарный узел, это база — возвращаем его
    return node;
  }  
}

export class UnaryOpNodePlus extends UnaryOpNode {
  /**
   * @param {ASTNode} argument - Узел, к которому применяется операция
   * @param {SourceLocation} loc 
   */
  constructor(argument, loc) {
    super('+', argument, loc);
  }

  static get dataTypeName() { return "UnaryOpNodePlus"; }

  static fromJSON(data) { return UnaryOpNode.create(UnaryOpNodePlus, data); }

  internal_evaluate(context) { return this.argument.internal_evaluate(context); }
}
regAST(UnaryOpNodePlus);

export class UnaryOpNodeMinus extends UnaryOpNode {
  /**
   * @param {ASTNode} argument - Узел, к которому применяется операция
   * @param {SourceLocation} loc 
   */
  constructor(argument, loc) {
    super('-', argument, loc);
  }

  static get dataTypeName() { return "UnaryOpNodeMinus"; }

  static fromJSON(data) { return UnaryOpNode.create(UnaryOpNodeMinus, data); }

  internal_evaluate(context) { 
    const argVal = this.argument.internal_evaluate(context);
    return argVal.negate();
  }
}
regAST(UnaryOpNodeMinus);

export class UnaryOpNodeNot extends UnaryOpNode {
  /**
   * @param {ASTNode} argument - Узел, к которому применяется операция
   * @param {SourceLocation} loc 
   */
  constructor(argument, loc) {
    super('!', argument, loc);
  }

  static get dataTypeName() { return "UnaryOpNodeNot"; }

  static fromJSON(data) { return UnaryOpNode.create(UnaryOpNodeNot, data); }


  internal_evaluate(context) { 
    const argVal = this.argument.internal_evaluate(context);
    return argVal.not();
  }

  toTeX(context) {
    const argTex = this.argument.toTeX(context);
    return `\\overline{${argTex}}`;
  }
}
regAST(UnaryOpNodeNot);

/**
 * Узел бинарной операции (+, -, *, /, ^)
 */
export class BinaryOpNode extends MathNode {
  constructor(left, operator, right, loc) {
    super(loc);
    this.left = left;
    this.operator = operator;
    this.right = right;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      left: this.left,
      right: this.right,
    };
  }

  static create(ClassRef, data) {
     return new ClassRef(
      restoreDataType(data.left),
      restoreDataType(data.right),
      restoreLocation(data.loc)
    );   
  }

  toString(context) {
    let leftCode = this.left.toString(context);
    let rightCode = this.right.toString(context);
    const currentPriority = this.getPriority();

    if (this.left.getPriority() < currentPriority) leftCode = `(${leftCode})`;
    if (this.right.getPriority() < currentPriority) rightCode = `(${rightCode})`;

    return `${leftCode}${this.operator}${rightCode}`;
  }

  toTeX(context) {
    let leftCode = this.left.toTeX(context);
    let rightCode = this.right.toTeX(context);
    const currentPriority = this.getPriority();

    if (this.left.getPriority() < currentPriority) leftCode = `\\left(${leftCode}\\right)`;
    if (this.right.getPriority() < currentPriority) rightCode = `\\left(${rightCode}\\right)`;

    return this.simpleTeX(leftCode, rightCode);
  }

  *getChildren() {
    yield this.left;
    yield this.right;
  }

  /**
   * Общий метод для красивого книжного рендеринга умножения и деления.
   * Дочерние классы (MulNode, DivNode) будут просто вызывать его.
   */
  _renderFractionChain(context) {
    const nums = [];
    const dens = [];
    const signState = { minusCount: 0 };

    // 1. Собираем все факторы
    this._collectFactors(this, false, nums, dens, signState);

    // Сортируем (числа вперед)
    const sortFactors = (nodes) => {
      return nodes.sort((a, b) => {
        const aIsNum = a instanceof NumberNode;
        const bIsNum = b instanceof NumberNode;
        if (aIsNum && !bIsNum) return -1;
        if (!aIsNum && bIsNum) return 1;
        return 0;
      });
    };

    const sortedNums = sortFactors(nums);
    const sortedDens = sortFactors(dens);

    // 2. Обновленная функция сборки элементов
    // Добавляем второй параметр: isSingleChain (равен true, если этот массив — весь числитель или весь знаменатель целиком)
    const joinFactors = (nodes, isSingleChain = false) => {
      if (nodes.length === 0) return '';
      
      let resultTeX = '';

      for (let i = 0; i < nodes.length; i++) {
        const currentNode = nodes[i];
        let currentTeX = currentNode.toTeX(context);

        // УМНОЕ ПРАВИЛО СКОБОК:
        // Мы ставим скобки, только если приоритет ниже умножения И выполняется одно из двух:
        // 1. В этой цепочке больше одного элемента (например, A * (B + C))
        // 2. Или этот элемент единственный, но это НЕ выражение числителя/знаменателя (isSingleChain === false)
        if (currentNode.getPriority?.() < OpPriority.MUL_DIV) {
          const needBrackets = !isSingleChain || nodes.length > 1;
          if (needBrackets) {
            currentTeX = `\\left(${currentTeX}\\right)`;
          }
        }

        if (i === 0) {
          resultTeX = currentTeX;
        } else {
          const leftStr = resultTeX.trim();
          const rightStr = currentTeX.trim();

          const endsWithDigit = /[0-9]$/.test(leftStr);
          const startsWithDigit = /^[0-9]/.test(rightStr);
          const startsWithTeXConstant = /^\\[a-zA-Z]/.test(rightStr);

          let needDot = false;
          if (endsWithDigit && startsWithDigit) {
            needDot = true;
          } else if (endsWithDigit && startsWithTeXConstant) {
            needDot = true;
          }

          if (needDot) {
            resultTeX += ` \\cdot ${currentTeX}`;
          } else {
            resultTeX += ` ${currentTeX}`;
          }
        }
      }
      return resultTeX;
    };

    const globalSign = (signState.minusCount % 2 !== 0) ? '- ' : '';

    // Если знаменателя нет
    if (sortedDens.length === 0) {
      return `${globalSign}${joinFactors(sortedNums, false)}`;
    }

    // 3. Собираем числитель и знаменатель, указывая, что они являются одиночными монолитами (isSingleChain = true)
    const numTeX = joinFactors(sortedNums, true);
    const denTeX = joinFactors(sortedDens, true);

    return `${globalSign}\\frac{${numTeX}}{${denTeX}}`;
  }
  
  // Единый рекурсивный сборщик факторов для всех видов бинарных узлов умножения/деления
  _collectFactors(node, isInverted, nums, dens, signState) {
    // 1. Обработка унарных операций (+ / -)
    if (node instanceof UnaryOpNode) {
      if (node.argument.getPriority?.() < OpPriority.MUL_DIV) {
        if (isInverted) dens.push(node); else nums.push(node);
        return;
      }
      if (node.operator === '-') {
        signState.minusCount++;
      }
      this._collectFactors(node.argument, isInverted, nums, dens, signState);
      return;
    }

    // 2. Бинарное ДЕЛЕНИЕ (Разворачиваем правую ветку)
    if (node instanceof DivNode) {
      this._collectFactors(node.left, isInverted, nums, dens, signState);
      this._collectFactors(node.right, !isInverted, nums, dens, signState);
      return;
    }

    // 3. Бинарное УМНОЖЕНИЕ (Сохраняем текущее направление)
    if (node instanceof MulNode) {
      this._collectFactors(node.left, isInverted, nums, dens, signState);
      this._collectFactors(node.right, isInverted, nums, dens, signState);
      return;
    }

    // 4. База рекурсии: обычный изолированный узел (число, переменная, функция)
    if (isInverted) {
      dens.push(node);
    } else {
      nums.push(node);
    }
  }  
}


class StrictRightBinNode extends BinaryOpNode {
  constructor(left, operator, right, loc) {
    super(left, operator, right, loc);
  }

  toString(context) {
    let leftCode = this.left.toString(context);
    let rightCode = this.right.toString(context);
    const currentPriority = this.getPriority();

    // Слева - строго меньше
    if (this.left.getPriority() < currentPriority) leftCode = `(${leftCode})`;
    
    // Справа - МЕНЬШЕ ИЛИ РАВЕН (ваше условие)
    if (this.right.getPriority() <= currentPriority) rightCode = `(${rightCode})`;

    return `${leftCode}${this.operator}${rightCode}`;
  }

  toTeX(context) {
    let leftCode = this.left.toTeX(context);
    let rightCode = this.right.toTeX(context);
    const currentPriority = this.getPriority(context);

    if (this.left.getPriority() < currentPriority) leftCode = `\\left(${leftCode}\\right)`;
    if (this.right.getPriority() <= currentPriority) rightCode = `\\left(${rightCode}\\right)`;

    return this.simpleTeX(leftCode, rightCode);
  }
}

export class AddNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '+', right, loc);
  }

  static get dataTypeName() { return "AddNode"; }

  static fromJSON(data) { return BinaryOpNode.create(AddNode, data); }

  getPriority() { return OpPriority.OR; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.add(r);
  }

  simpleTeX(l, r) {
    return `${l} + ${r}`;
  }
}
regAST(AddNode);

export class OrNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, 'or', right, loc);
  }

  static get dataTypeName() { return "OrNode"; }

  static fromJSON(data) { return BinaryOpNode.create(OrNode, data); }

  getPriority() { return OpPriority.OR; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.or(r);
  }

  simpleTeX(l, r) {
    return `${l} \\vee ${r}`;
  }
}
regAST(OrNode);

export class XorNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, 'xor', right, loc);
  }

  static get dataTypeName() { return "XorNode"; }

  static fromJSON(data) { return BinaryOpNode.create(XorNode, data); }

  getPriority() { return OpPriority.XOR; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.xor(r);
  }

  simpleTeX(l, r) {
    return `${l} \\oplus ${r}`;
  }
}
regAST(XorNode);

export class AndNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, 'and', right, loc);
  }

  static get dataTypeName() { return "AndNode"; }

  static fromJSON(data) { return BinaryOpNode.create(AndNode, data); }

  getPriority() { return OpPriority.AND; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.and(r);
  }

  simpleTeX(l, r) {
    return `${l} \\wedge ${r}`;
  }
}
regAST(AndNode);

export class EquNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '==', right, loc);
  }

  static get dataTypeName() { return "EquNode"; }

  static fromJSON(data) { return BinaryOpNode.create(EquNode, data); }

  getPriority() { return OpPriority.RELATIONAL; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.eq(r);
  }

  simpleTeX(l, r) {
    return `${l} = ${r}`;
  }
}
regAST(EquNode);

export class NotEquNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '!=', right, loc);
  }

  static get dataTypeName() { return "NotEquNode"; }

  static fromJSON(data) { return BinaryOpNode.create(NotEquNode, data); }

  getPriority() { return OpPriority.RELATIONAL; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.not_eq(r);
  }

  simpleTeX(l, r) {
    return `${l} \\neq ${r}`;
  }
}
regAST(NotEquNode);

export class LtNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '<', right, loc);
  }

  static get dataTypeName() { return "LtNode"; }

  static fromJSON(data) { return BinaryOpNode.create(LtNode, data); }

  getPriority() { return OpPriority.RELATIONAL; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.lt(r);
  }

  simpleTeX(l, r) {
    return `${l} < ${r}`;
  }
}
regAST(LtNode);

export class GtNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '>', right, loc);
  }

  static get dataTypeName() { return "GtNode"; }

  static fromJSON(data) { return BinaryOpNode.create(GtNode, data); }

  getPriority() { return OpPriority.RELATIONAL; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.gt(r);
  }

  simpleTeX(l, r) {
    return `${l} > ${r}`;
  }
}
regAST(GtNode);

export class LteNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '<=', right, loc);
  }

  static get dataTypeName() { return "LteNode"; }

  static fromJSON(data) { return BinaryOpNode.create(LteNode, data); }

  getPriority() { return OpPriority.RELATIONAL; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.lte(r);
  }

  simpleTeX(l, r) {
    return `${l} \\leqslant ${r}`;
  }
}
regAST(LteNode);

export class GteNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '>=', right, loc);
  }

  static get dataTypeName() { return "GteNode"; }

  static fromJSON(data) { return BinaryOpNode.create(GteNode, data); }

  getPriority() { return OpPriority.RELATIONAL; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.gte(r);
  }

  simpleTeX(l, r) {
    return `${l} \\geqslant ${r}`;
  }
}
regAST(GteNode);

export class SubNode extends StrictRightBinNode {
  constructor(left, right, loc) {
    super(left, '-', right, loc);
  }

  static get dataTypeName() { return "SubNode"; }

  static fromJSON(data) { return BinaryOpNode.create(SubNode, data); }

  getPriority() { return OpPriority.ADD_SUB; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.subtract(r);
  }

  simpleTeX(l, r) {
    return `${l} - ${r}`;
  }
}
regAST(SubNode);

export class MulNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '*', right, loc);
  }

  static get dataTypeName() { return "MulNode"; }

  static fromJSON(data) { return BinaryOpNode.create(MulNode, data); }

  getPriority() { return OpPriority.MUL_DIV; }

  internal_evaluate(context) {

    // 1. Вычисляем левую и правую части
    const leftValue = this.left.internal_evaluate(context);
    const rightValue = this.right.internal_evaluate(context);

    // 2. Выравниваем скаляры между собой (если это, например, Real и Complex)
    const { l, r } = dispatcher.promoteTypes(leftValue, rightValue);

    const MATRIX_SYMBOL = Symbol.for('Math.Matrix');

    // 3. Проверяем, является ли левый операнд ЧИСЛОМ, а правый — МАТРИЦЕЙ
    const isLeftMatrix = l.constructor.typeId === MATRIX_SYMBOL;
    const isRightMatrix = r.constructor.typeId === MATRIX_SYMBOL;

    if (!isLeftMatrix && isRightMatrix) {
      // Математический закон: Скаляр * Матрица === Матрица * Скаляр
      // Вызываем метод умножения у матрицы (r), передавая ей скаляр (l)
      return r.multiply(l);
    }

    // 4. Во всех остальных случаях (Матрица * Матрица, Матрица * Скаляр, Число * Число)
    // выполняем стандартный линейный вызов
    return l.multiply(r);

    /*const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.multiply(r);*/
  } 

  toTeX(context) { return super._renderFractionChain(context); }
}
regAST(MulNode);

export class DivNode extends StrictRightBinNode {
  constructor(left, right, loc) {
    super(left, '/', right, loc);
  }

  static get dataTypeName() { return "DivNode"; }

  static fromJSON(data) { return BinaryOpNode.create(DivNode, data); }

  getPriority() { return OpPriority.MUL_DIV; }

  internal_evaluate(context) {
    const leftValue = this.left.evaluate(context);
    const rightValue = this.right.evaluate(context);

    const MATRIX_SYMBOL = Symbol.for('Math.Matrix');
    const isRightMatrix = rightValue && rightValue.constructor.typeId === MATRIX_SYMBOL;

    // ЕСЛИ мы делим что-то на Матрицу (например, A / B)
    if (isRightMatrix) {
      // Математика: A / B === A * B.invert()
      const invertedB = rightValue.invert();
      
      // Прогоняем левую матрицу и новую обратную матрицу через promoteTypes для выравнивания типов
      const { l, r } = dispatcher.promoteTypes(leftValue, invertedB);
      return l.multiply(r);
    }

    // Стандартное деление чисел или матрицы на скаляр
    const { l, r } = dispatcher.promoteTypes(leftValue, rightValue);
    
    // Если делим Матрицу на Число (скаляр):
    if (l.constructor.typeId === MATRIX_SYMBOL) {
      // Деление матрицы на число k — это умножение на (1 / k)
      const scalarInverse = r.inverse ? r.inverse() : r; // Если у вашего числа есть метод inverse()
      return l.multiply(scalarInverse);
    }

    return l.divide(r);
  } 

  toTeX(context) { return super._renderFractionChain(context); }
}
regAST(DivNode);

export class ModNode extends StrictRightBinNode {
  constructor(left, right, loc) {
    super(left, 'mod', right, loc);
  }

  static get dataTypeName() { return "ModNode"; }

  static fromJSON(data) { return BinaryOpNode.create(ModNode, data); }

  getPriority() { return OpPriority.MUL_DIV; }

  internal_evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    return l.mod(r);
  }

  simpleTeX(l, r) {
    return `${l} \\bmod ${r}`;
  }
}
regAST(ModNode);

export class PowNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '^', right, loc);
  }

  static get dataTypeName() { return "PowNode"; }

  static fromJSON(data) { return BinaryOpNode.create(PowNode, data); }

  getPriority() { return OpPriority.POW; }

  toString(context) {
    let leftCode = this.left.toString(context);
    let rightCode = this.right.toString(context);
    const currentPriority = this.getPriority();

    if (this.left.getPriority() < currentPriority) leftCode = `(${leftCode})`;
    
    const isRightUnary = this.right instanceof UnaryOpNode;

    if (!isRightUnary && this.right.getPriority() < currentPriority) rightCode = `(${rightCode})`;

    return `${leftCode}${this.operator}${rightCode}`;
  }

  internal_evaluate(context) {
    const leftValue = this.left.evaluate(context);
    const rightValue = this.right.evaluate(context); // Правая часть — это степень (RealNumber)

    const MATRIX_SYMBOL = Symbol.for('Math.Matrix');
    
    if (leftValue && leftValue.constructor.typeId === MATRIX_SYMBOL) {
      // Извлекаем примитивное целое число из объекта степени
      const exp = Math.floor(rightValue.value ?? Number(rightValue));
      return leftValue.pow(exp);
    }
    const { l, r } = dispatcher.promoteTypes(this.left.internal_evaluate(context), this.right.internal_evaluate(context));
    if (typeof l?.accuratePow === 'function') {
      return l.accuratePow(r);
    } else {
      this.error(context, `Оператор '^' не определён для типов "${l.type}" и "${r.type}".`);
      return this.errorValue();
    }
  } 

  toTeX(context) {
    let l = this.left.toTeX(context);
    if (this.left.getPriority() < this.getPriority()) l = `\\left(${l}\\right)`;
    const r = this.right.toTeX(context);
    return `{${l}}^{${r}}`;
  }
}
regAST(PowNode);

export class RefNode extends MathNode {
  constructor(loc) {
    super(loc);
  }

  createAssign(expression, loc = this.loc) { throw new Error("[ASTNode]: Метод createAssign() не реализован."); }
}

export class IdentifierNode extends RefNode {
  constructor(id_name, name, loc) {
    super(loc);
    this.id_name = id_name;
    this.name = name;
  }

  getTexName() {
    return ASTNode.formatIdentifierToTeX(this.name);
  }
}

/**
 * Узел чтения переменной (например, использование 'x' в выражении)
 */
export class VariableNode extends IdentifierNode {
  constructor(id_name, name, loc) {
    super(id_name, name, loc);
  }

  toJSON() {
    return {
      ...super.toJSON(),
      id_name: this.id_name,
      name: this.name
    };
  }

  static get dataTypeName() { return "VariableNode"; }

  static fromJSON(data) {
    return new VariableNode(
      data.id_name,
      data.name,
      restoreLocation(data.loc)
    );
  }

  createAssign(expression, loc = this.loc) {
    return new AssignNode(this.id_name, this.name, expression, loc);
  }

  getPriority()  { return OpPriority.PRIMARY; }

  toString(context) { return this.name; }

  internal_evaluate(context) {
    // Ищем переменную в локальном контексте вызова
    //const sym = context.scope_context.getSymbolByName(this.name);
    const sym = context.scope_context.getSymbolById(this.id_name);
    if (sym === null) {
      this.error(context, `Идентификатор "${this.name}" не опредилён.`);
    }
    else if (sym.type === SYM_UNDEFINED) {
      this.error(context, `Переменная "${this.name}" не инициализирована.`);
      return this.errorValue();
    }
    else if (sym.type !== SYM_VARIABLE) {
      this.error(context, `Идентификатор "${this.name}" не является переменной.`);
      return this.errorValue();
    }
    else {
      return sym.value;
    }
  }

  toTeX(context) { return this.getTexName(); }
}
regAST(VariableNode);

// Дополнительные узлы для поддержки переменных, которые мы спроектировали
export class AssignNode extends IdentifierNode {
  constructor(id_name, name, expression, loc) {
    super(id_name, name, loc);
    this.expression = expression;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      id_name: this.id_name,
      name: this.name,
      expression: this.expression
    };
  }

  static get dataTypeName() { return "AssignNode"; }

  static fromJSON(data) {
    return new AssignNode(
      data.id_name,
      data.name,
      restoreDataType(data.expression),
      restoreLocation(data.loc)
    );
  }
  
  createAssign(expression, loc = this.loc) {
    return new AssignNode(this.id_name, this.name, expression, loc);
  }  

  get isAssigned() { return true; }

  getPriority() { return OpPriority.ASSIGN; }

  toString(context) { return `${this.name} = ${this.expression.toString(context)}`; }

  internal_evaluate(context) {
    try {
      const sym = context.scope_context.getSymbolById(this.id_name);
      return sym.value = this.expression.internal_evaluate(context);
    }
    catch (err)
    {
       this.error(context, err);
       return this.errorValue();
    }
  }

  *getChildren() {
    yield this.expression;
  }

  toTeX(context) {
    return `${this.getTexName()} = ${this.expression.toTeX(context)}`;
  }
}
regAST(AssignNode);

export class IndexNode extends RefNode {
  #target;
  #rowExpr;
  #colExpr;

  constructor(target, rowExpr, colExpr, loc) {
    super(loc);
    this.#target = target;
    this.#rowExpr = rowExpr;
    this.#colExpr = colExpr; // Может быть null
  }

  toJSON() {
    return {
      ...super.toJSON(),
      target: this.#target,
      rowExpr: this.#rowExpr,
      colExpr: this.#colExpr
    };
  }

  static get dataTypeName() { return "IndexNode"; }

  static fromJSON(data) {
    return new IndexNode(
      restoreDataType(data.target),
      restoreDataType(data.rowExpr),
      restoreDataType(data.colExpr),
      restoreLocation(data.loc)
    );
  }

  createAssign(expression, loc = this.loc) {
    return new AssignIndexNode(this.#target, this.#rowExpr, this.#colExpr, expression, loc);
  }    

  getPriority() {
    return  OpPriority.PRIMARY;
  }

  toString(context) {
    const targetStr = this.#target.toString(context);
    const rowStr = this.#rowExpr.toString(context);
    const colStr = this.#colExpr ? `, ${this.#colExpr.toString(context)}` : '';
    return `${targetStr}[${rowStr}${colStr}]`;
  }

  toTeX(context) {
    let targetTeX = this.#target.toTeX(context);
    const rowTeX = this.#rowExpr.toTeX(context);
    const colTeX = this.#colExpr ? `, ${this.#colExpr.toTeX(context)}` : '';
    const matrixIndex = `${rowTeX}${colTeX}`;

    // Проверяем, заканчивается ли имя на } (признак того, что там уже есть индекс)
    if (targetTeX.endsWith('}')) {
      // Отрезаем закрывающую скобку и вставляем матричный индекс через запятую
      return `${targetTeX.slice(0, -1)}, ${matrixIndex}}`;
    } else {
      // Если индекса не было, создаем новый
      return `${targetTeX}_{{${matrixIndex}}}`;
    }
  }

  *getChildren() {
    yield this.#target;
    yield this.#rowExpr;
    yield this.#colExpr;
  }

  internal_evaluate(context) {
    // 1. Вычисляем то, к чему применяется индексация (получаем объект Matrix)
    const matrixObj = this.#target.internal_evaluate(context);
    
    const MATRIX_SYMBOL = Symbol.for('Math.Matrix');
    if (!matrixObj || matrixObj.constructor.typeId !== MATRIX_SYMBOL) {
      throw new TypeError("[Runtime Error]: Операция индексации [,] применима только к матрицам и векторам.");
    }

    // 2. Вычисляем индексы строки и столбца
    const rNum = this.#rowExpr.internal_evaluate(context);
    const cNum = this.#colExpr ? this.#colExpr.internal_evaluate(context) : null;

    // Извлекаем примитивные целые числа. 
    // ВНИМАНИЕ: Пользователи калькулятора обычно считают с 1 (1-indexed), 
    // а внутри JS массивы с 0 (0-indexed). Вычитаем 1 для удобства человека!
    const rowIndex = Math.floor(rNum.value ?? Number(rNum)) - 1;
    
    let colIndex = 0;
    if (cNum) {
      colIndex = Math.floor(cNum.value ?? Number(cNum)) - 1;
    } else {
      // Если передан только один индекс (например, v[3]), проверяем, что это вектор
      if (matrixObj.isVector) {
        // Если это вектор-строка, то индекс означает столбец, если столбец — то строку
        if (matrixObj.rowCount === 1) {
          return matrixObj.get(0, rowIndex);
        } else {
          return matrixObj.get(rowIndex, 0);
        }
      } else {
        throw new RangeError("[Runtime Error]: Для двумерной матрицы необходимо указать два индекса [строка, столбец].");
      }
    }

    // 3. Возвращаем готовый MathType объект из ячейки матрицы
    //return matrixObj.get(rowIndex, colIndex);
    return this.evaluate_command(context, matrixObj, rowIndex, colIndex);
  }

  evaluate_command(context, matrixObj, rowIndex, colIndex) {
    return matrixObj.get(rowIndex, colIndex);
  }

  collectMathExpressions(list) {
    list.push(this);
    this.#target.collectMathExpressions(list);
    this.#rowExpr.collectMathExpressions(list);
    if (this.#colExpr) this.#colExpr.collectMathExpressions(list);
  }
}
regAST(IndexNode);

export class AssignIndexNode extends IndexNode {
  constructor(target, rowExpr, colExpr, expression, loc) {
    super(target, rowExpr, colExpr, loc);
    this.expression = expression;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      expression: this.expression,
    };
  }

  static get dataTypeName() { return "AssignIndexNode"; }

  static fromJSON(data) {
    return new AssignIndexNode(
      restoreDataType(data.target),
      restoreDataType(data.rowExpr),
      restoreDataType(data.colExpr),
      restoreDataType(data.expression),
      restoreLocation(data.loc)
    );
  }

  get isAssigned() { return true; }

  evaluate_command(context, matrixObj, rowIndex, colIndex) {
    const elm = matrixObj.get(0, 0);
    const { l } = dispatcher.promoteTypes(this.expression.internal_evaluate(context), elm);
    return matrixObj.set(rowIndex, colIndex, l);
  }
}
regAST(AssignIndexNode);

/**
 * Узел для всей программы (блокнота/интерфейса вычислений)
 */
export class ProgramNode {
  constructor() { 
    this.statements = [];
  }

  toString(context) {
    return this.statements
          .map(statement => statement.toString(context))
          .join('\n');
  }

  evaluate(context = {}) {
    let outputHTML = "";
    for (const stmt of this.statements) {
      // Каждую строчку вычисляем и оборачиваем в div для вывода
      outputHTML += `<div>${stmt.evaluate(context)}</div>`;
    }
    return outputHTML;
  }

  collectMathExpressions(list) {
    // Обходим все аргументы функции, каждый из них может быть математикой
    for (const stmt of this.statements) {
      if (typeof stmt.collectMathExpressions === 'function') {
      stmt.collectMathExpressions(list);
      }  
    }
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

  toJSON() {
    return {
      ...super.toJSON(),
      elements: this.elements,
    };
  }

  static get dataTypeName() { return "PrintNode"; }

  static fromJSON(data) {
    const restoredElements = data.elements.map(element => {
      // Если это простой объект TEXT_BLOCK — оставляем как есть (или восстанавливаем его класс)
      if (element.type === 'TEXT_BLOCK') {
        return element; 
      }
      // Для всех остальных типов вызываем вашу функцию восстановления
      return restoreDataType(element);
    });
    return new PrintNode(
      restoredElements,
      restoreLocation(data.loc)
    );
  }

  get type_unit() { return TYPE_UNIT.PRINT; }

  toString(context) {
    return "print (" + this.elements.map(element => {
      if (element.type == 'TEXT_BLOCK') element.value;
      return element.toString(context);
    }).join(', ') + ")";
  }

  collectMathExpressions(list) {
    // Обходим все аргументы функции, каждый из них может быть математикой
    return this.elements.map(element => {
      // 1. ОБРАБОТКА МАТЕМАТИЧЕСКИХ ВЫРАЖЕНИЙ
      if (element.type !== 'TEXT_BLOCK') {
        element.collectMathExpressions(list);
      }
    });
  }

  *getChildren() {
    for (const element of this.elements) {
        // Проверяем: элемент существует, это объект (не строка) и это узел AST
        if (element && typeof element === 'object' && element.type !== 'TEXT_BLOCK') {
            yield element;
        }
    }
  }

  internal_evaluate(context) {
    return this.elements.map(element => {
      // 1. ОБРАБОТКА МАТЕМАТИЧЕСКИХ ВЫРАЖЕНИЙ
      if (element.type !== 'TEXT_BLOCK') {
        const evaluatedValue = element.internal_evaluate(context);
        // Математика всегда возвращается как инлайн-формула
        return `$${evaluatedValue.toRawTeX(context.scope_context.settings)}$`;
      }
 
      // 2. ОБРАБОТКА ТЕКСТОВЫХ БЛОКОВ С ВАЛИДАЦИЕЙ И ЭКРАНИРОВАНИЕМ
      const rawText = element.value;
      let resultHtml = "";
      
      let i = 0;
      let inInlineMath = false;
      let inDisplayMath = false;

      while (i < rawText.length) {
        // --- Поддержка экранирования: если видим \$ ---
        if (rawText[i] === '\\' && rawText[i + 1] === '$') {
          // Оборачиваем сырой знак доллара в тег, который MathJax гарантированно проигнорирует
          resultHtml += '<span class="tex2jax_ignore">$</span>';
          i += 2;
          continue;
        }
        
        // --- Поддержка экранирования: если видим \[ или \] как обычный текст ---
        if (rawText[i] === '\\' && i + 1 < rawText.length && 
                (rawText[i + 1] === '[' || rawText[i + 1] === ']' || rawText[i + 1] === '(' || rawText[i + 1] === ')')) {
          resultHtml += `<span class="tex2jax_ignore">${rawText[i]}${rawText[i + 1]}</span>`;
          i += 2;
          continue;
        }

        // --- Обработка выключных формул $$ ---
        if (rawText.startsWith("$$", i)) {
          if (inInlineMath) {
            throw new Error(
              `Ошибка синтаксиса разметки: Попытка открыть выключную формулу '<span class="tex2jax_ignore">$$</span>' внутри инлайн-формулы '<span class="tex2jax_ignore">$</span>'.`
            );
          }
          
          // Нормализуем: если это разрешенный дизайн, оставляем $$, иначе заменяем на $
          // Допустим, мы сохраняем $$ для красивого центрирования
          resultHtml += "$";
          inDisplayMath = !inDisplayMath;
          i += 2;
          continue;
        }

        // --- Обработка инлайн формул $ ---
        if (rawText[i] === '$') {
          if (inDisplayMath) {
            throw new Error(
              `Ошибка синтаксиса разметки: Попытка использовать одиночный '<span class="tex2jax_ignore">$</span>' внутри выключной формулы '<span class="tex2jax_ignore">$$</span>'. Используйте чистый LaTeX.`);
          }
          resultHtml += "$";
          inInlineMath = !inInlineMath;
          i++;
          continue;
        }

        // Экранируем стандартные HTML-символы, чтобы не сломать DOM
        let char = rawText[i];
        if (char === '&') char = '&amp;';
        else if (char === '<') char = '&lt;';
        else if (char === '>') char = '&gt;';

        resultHtml += char;
        i++;
      }

      // Финальная проверка: если строка закончилась, а формула не закрыта
      if (inInlineMath) {
        throw new Error(`Ошибка синтаксиса разметки: Ожидался закрывающий символ '<span class="tex2jax_ignore">$</span>' в конце текстовой строки.`);
      }
      if (inDisplayMath) {
        throw new Error(`Ошибка синтаксиса разметки: Ожидался закрывающий символ '<span class="tex2jax_ignore">$$</span>' в конце текстовой строки.`);
      }

      return resultHtml;
    }).join('');
  }    
}
regAST(PrintNode);

// 1. Инициализируем объекты в кэше один раз при старте
const PRECOMPUTED_CONSTANTS = {
  PI:  new RealNumber(Math.PI),
  E:   new RealNumber(Math.E),
  PHI: new RealNumber((1 + Math.sqrt(5)) / 2),
  INF: new RealNumber(Infinity),
  NAN: new RealNumber(NaN),
  TRUE: new BoolValue(true),
  FALSE: new BoolValue(false),
};

// 2. Декларативная таблица, использующая TokenType напрямую в роли ключей
export const CONSTANTS_AST_REGISTRY = new Map([
  [TokenType.MATH_PI, {
    instance: PRECOMPUTED_CONSTANTS.PI,
    tex: '\\pi',
    str: '%pi'
  }],
  [TokenType.MATH_E, {
    instance: PRECOMPUTED_CONSTANTS.E,
    tex: 'e',
    str: '%e'
  }],
  [TokenType.MATH_PHI, {
    instance: PRECOMPUTED_CONSTANTS.PHI,
    tex: '\\phi',
    str: '%phi'
  }],
  [TokenType.MATH_INF, {
    instance: PRECOMPUTED_CONSTANTS.INF,
    tex: '\\infty',
    str: '%inf'
  }],
  [TokenType.MATH_NAN, {
    instance: PRECOMPUTED_CONSTANTS.NAN,
    tex: '\\color{red}\\text{NaN}',
    str: '%nan'
  }],
  [TokenType.RW_TRUE, {
    instance: PRECOMPUTED_CONSTANTS.TRUE,
    tex: '\\mathrm{true}',
    str: 'true'
  }],
  [TokenType.RW_FALSE, {
    instance: PRECOMPUTED_CONSTANTS.FALSE,
    tex: '\\mathrm{false}',
    str: 'false'
  }],
])

export class ConstantNode extends MathNode {
  #tokenType;

  constructor(tokenType, loc) {
    super(loc);
    this.#tokenType = tokenType; 
  }

  toJSON() {
    return {
      ...super.toJSON(),
      tokenType: this.#tokenType,
    };
  }

  static get dataTypeName() { return "ConstantNode"; }

  static fromJSON(data) {
    return new ConstantNode(
      data.tokenType,
      restoreLocation(data.loc)
    );
  }  

  get isLiteral() { return true; }
  
  getPriority() { return OpPriority.PRIMARY; }

  toString(context) {
    const config = CONSTANTS_AST_REGISTRY.get(this.#tokenType);
    return config ? config.str : "";
  }

  value() {
    const config = CONSTANTS_AST_REGISTRY.get(this.#tokenType);
    if (!config) {
      throw new Error(`[AST Error]: Неизвестный тип константы (Token ID: ${this.#tokenType}) на ${this.loc}`);
    }
    return config.instance;    
  }

  internal_evaluate(context) {
    const config = CONSTANTS_AST_REGISTRY.get(this.#tokenType);
    if (!config) {
      this.error(context, 'Неизвестный тип константы (Token ID: ${this.#tokenType})');
      return this.errorValue();
    }
    return config.instance;    
  }

  toTeX(context) {
    const config = CONSTANTS_AST_REGISTRY.get(this.#tokenType);
    return config ? config.tex : `\\text{unknown}`;
  }
}
regAST(ConstantNode);

const TEX_FUNCTIONS_REGISTRY = new Map([
  // === 1. ОСНОВНЫЕ АЛГЕБРАИЧЕСКИЕ И СТЕПЕННЫЕ ФУНКЦИИ ===
  ['pow', {
    render: ([base, exp]) => `\\text{pow}\\left(${base}, ${exp}\\right)`
  }],
  ['sqrt', {
    render: ([val, n]) => n ? `\\sqrt[${n}]{${val}}` : `\\sqrt{${val}}` // Поддержка \sqrt{x} и \sqrt[n]{x}
  }],
  ['exp',    { tex: '\\exp' }],
  ['abs',    { render: ([val]) => `\\left|${val}\\right|` }], // Модуль |x|
  ['sign',   { tex: '\\operatorname{sgn}' }], // Функция знака sgn(x)

  // === 2. ЛОГАРИФМЫ ===
  ['ln',     { tex: '\\ln' }],
  ['lg',     { tex: '\\lg' }],
  //['log',    { tex: '\\log' }], // Стандартный \log(x)
  ['log', {
    render: ([val, base]) => base ? `\\log_{${base}}\\left(${val}\\right)` : `\\log\\left(${val}\\right)`
  }],

  ["conjugate", { render: ([val]) =>  `\\overline{${val}}`}],
  ["arg",    {tex: '\\arg' }],
  ["from_deg",    {tex: '\\operatorname{from_deg}' }],
  ["from_grad",    {tex: '\\operatorname{from_grad}' }],
  ["from_rev",    {tex: '\\operatorname{from_rev}' }],

  // === 3. ПРЯМАЯ ТРИГОНОМЕТРИЯ ===
  ['sin',    { tex: '\\sin' }],
  ['cos',    { tex: '\\cos' }],
  ['tan',    { tex: '\\tan' }],
  ['tg',     { tex: '\\tan' }], // Синоним для русскоязычной нотации
  ['cot',    { tex: '\\cot' }],
  ['ctg',    { tex: '\\cot' }], // Синоним для русскоязычной нотации
  ['sec',    { tex: '\\sec' }],
  ['csc',    { tex: '\\csc' }],

  // === 4. ОБРАТНАЯ ТРИГОНОМЕТРИЯ ===
  ['arcsin', { tex: '\\arcsin' }],
  ['arccos', { tex: '\\arccos' }],
  ['arctan', { tex: '\\arctan' }],
  ['arctg',  { tex: '\\text{arctg}' }], // Русскоязычный арктангенс
  ['arccot', { tex: '\\text{arccot}' }],
  ['arcctg', { tex: '\\text{arcctg}' }],

  // === 5. ГИПЕРБОЛИЧЕСКИЕ ФУНКЦИИ ===
  ['sinh',   { tex: '\\sinh' }],
  ['cosh',   { tex: '\\cosh' }],
  ['tanh',   { tex: '\\tanh' }],
  ['th',     { tex: '\\text{th}' }], // Русскоязычный гиперболический тангенс
  ['coth',   { tex: '\\coth' }],
  ['cth',    { tex: '\\text{cth}' }],

  // === 6. ОБРАТНАЯ ГИПЕРБОЛИЧЕСКАЯ ТРИГОНОМЕТРИЯ ===
  ['asinh',  { tex: '\\operatorname{arsinh}' }],
  ['acosh',  { tex: '\\operatorname{arcosh}' }],
  ['atanh',  { tex: '\\operatorname{artanh}' }],

  // === 7. ОКРУГЛЕНИЯ И ЧИСЛОВЫЕ МЕТОДЫ ===
  ['floor',  { render: ([val]) => `\\left\\lfloor ${val} \\right\\rfloor` }], // Округление вниз ⌊x⌋
  ['ceil',   { render: ([val]) => `\\left\\lceil ${val} \\right\\rceil` }],   // Округление вверх ⌈x⌉
  ['round',  { tex: '\\operatorname{round}' }],
  ['trunc',  { tex: '\\operatorname{trunc}' }],
  ['mod',    { render: ([a, b]) => `${a} \\pmod{${b}}` }], // Остаток от деления a (mod b)

  // === 8. ВЫСШАЯ МАТЕМАТИКА И КОМБИНАТОРИКА ===
  ['min',    { tex: '\\min' }],
  ['max',    { tex: '\\max' }],
  ['gcd',    { tex: '\\gcd' }], // Наибольший общий делитель
  ['lcm',    { tex: '\\operatorname{lcm}' }], // Наименьшее общее кратное
  ['fact',   { render: ([val]) => `${val}!` }], // Факториал x!
  
  // ЛИНЕЙНАЯ АЛГЕБРА И АНАЛИЗ (Задел на будущее)
  ['det',    { tex: '\\det' }], // Определитель матрицы
  ['transpose',     { render: ([M]) => `${M}^\\top` }],  
  ['tr',     { tex: '\\operatorname{tr}' }], // След матрицы
  ['lim',    { tex: '\\lim' }],
  ['arg',    { tex: '\\arg' }]  // Аргумент комплексного числа
]);

export class CallNode extends MathNode {
  constructor(id_name, name, args, loc) {
    super(loc); 
    this.id_name = id_name;
    this.name = name;
    this.args = args;
  }

  toJSON() {
    return {
      ...super.toJSON(),
      id_name: this.id_name,
      name: this.name,
      args: this.args,
    };
  }

  static get dataTypeName() { return "CallNode"; }

  static fromJSON(data) {
    const args = data.args.map(arg => restoreDataType(arg));
    return new CallNode(
      data.id_name,
      data.name,
      args,
      restoreLocation(data.loc)
    );
  }  

  getPriority() { return OpPriority.PRIMARY; }

  toString(context) {
    const argsCode = this.args.map(arg => arg.toString(context)).join(", ");
    return `${this.name}(${argsCode})`;
  }

  *getChildren() {
      // yield* (со звездочкой) берет массив elements и выдает каждый узел по очереди
      yield* this.args;
  }

  internal_evaluate(context) {
    // 1. Сначала вычисляем все аргументы, превращая их в чистые объекты MathType
    try {
      const sym = context.scope_context.getSymbolById(this.id_name);
      if (sym.type === SYM_UNDEFINED) {
        this.error(context, `Переменная "${this.name}" не инициализирована.`);
        return this.errorValue();
      } else if (sym.value instanceof VarableCode) {        
        const evaluatedArgs = this.args.map(arg => arg.internal_evaluate(context));
        const p_c = sym.value.paramsCount;
        if (evaluatedArgs.length !== p_c)
        {
          this.error(context, `Неверное кол. пораметров вызова функции "${this.name}[${p_c}]"`);
          return this.errorValue();
        }
        return sym.value.evaluate(context, evaluatedArgs);
      } else if (sym.type !== SYM_BUILTIN) {
        this.error(context, `Идентификатор "${this.name}" не является функцией.`);
        return this.errorValue();
      } else {
        const evaluatedArgs = this.args.map(arg => arg.internal_evaluate(context));
        return MathRegistry.execute(sym.value, evaluatedArgs, this.loc);
      }
    } catch(err) {
       this.error(context, err);
       return this.errorValue();
    }
  }

  toTeX(context) {
    // Рендерим аргументы узла в LaTeX-строки
    const name = this.name;
    const argsTexArray = this.args.map(arg => arg.toTeX(context));
    const config = TEX_FUNCTIONS_REGISTRY.get(name);

    // 1. Если задано сложное кастомное отображение (шаблон вроде pow, sqrt, floor, abs)
    if (config?.render) {
      return config.render(argsTexArray);
    }

    // 2. Если задано простое имя макроса (\sin, \ln, \gcd)
    if (config?.tex) {
      const joinedArgs = argsTexArray.join(', ');
      return `${config.tex}\\left(${joinedArgs}\\right)`;
    }

    // 3. Резервный фолбэк для будущих кастомных функций, которых еще нет в таблице.
    // Обертка \operatorname позволяет рендерить "myFunc(x)" правильным математическим шрифтом, а не курсивом переменных.
    const joinedArgs = argsTexArray.join(', ');
    return `\\operatorname{${name}}\\left(${joinedArgs}\\right)`;
  }
}
regAST(CallNode);
