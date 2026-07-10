// Импортируем наш базовый математический тип, чтобы использовать в проверках, 
// если потребуется расширение, или для явного понимания типов
import MathType from '../math/MathType.js';
import ComplexNumber from '../math/ComplexNumber.js';
import RealNumber from '../math/RealNumber.js';
import { MathRegistry } from './MathRegistry.js';
import SemanticDispatcher from './SemanticDispatcher.js';
import { TokenType } from './TokenTypes.js';

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
 * Узел числа (Терминальный узел / Лист дерева)
 */
export class NumberNode extends ASTNode {
  constructor(mathTypeValue, loc) {
    super(loc);
    this.value = mathTypeValue; // Здесь может лежать и RealNumber, и ComplexNumber
  }

  evaluate(context) {
    return this.value; // Просто возвращает математический объект
  }

  toTeX() {
    return this.value.toRawTeX(); // Каждый тип сам знает, как себя нарисовать!
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
      return argVal.negate();
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

const dispatcher = new SemanticDispatcher();

/**
 * Узел бинарной операции (+, -, *, /, ^)
 */
export class BinaryOpNode extends ASTNode {
  constructor(left, operator, right, loc) {
    super(loc);
    this.left = left;
    this.operator = operator;
    this.right = right;
  }

  /**
   * СЕМАНТИЧЕСКИЙ ДИСПЕТЧЕР ТИПОВ
   * Приводит аргументы к единому типу на основе иерархии перед вычислением.
   */
  #promoteTypes(leftVal, rightVal) {
   // 1. Автоматическая обертка сырых чисел JS в RealNumber
    if (typeof leftVal === 'number') leftVal = new RealNumber(leftVal);
    if (typeof rightVal === 'number') rightVal = new RealNumber(rightVal);


    // 1. Определение рангов типов
    const getRank = (obj) => {
      if (obj instanceof RealNumber) return 1;
      if (obj instanceof ComplexNumber) return 2;
      // Задел на будущее: if (obj instanceof Matrix) return 3;
      return 0;
    };

    let l = leftVal;
    let r = rightVal;
    const leftRank = getRank(l);
    const rightRank = getRank(r);

    // 2. Если типы разные, семантически повышаем младший до старшего через конструкторы
    if (leftRank < rightRank) {
      l = this.#cast(l, r.constructor);
    } else if (rightRank < leftRank) {
      r = this.#cast(r, l.constructor);
    }

    return { l, r };
  }

  /**
   * Чистая логика преобразования одного типа в другой с помощью стандартных конструкторов
   */
  #cast(obj, TargetClass) {
    if (obj instanceof TargetClass) return obj;

    // Вещественное число -> в Комплексное число
    if (obj instanceof RealNumber && TargetClass === ComplexNumber) {
      return new ComplexNumber(obj.value, 0);
    }
    
    // Задел на будущее: Вещественное/Комплексное число -> в Матрицу 1х1
    // if (TargetClass === Matrix) { return new Matrix([[obj]]); }

    throw new Error(`[Semantic Error]: Невозможно автоматически привести тип ${obj.constructor.name} к ${TargetClass.name} на ${this.loc}`);
  }

  evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.evaluate(context), this.right.evaluate(context));
    switch (this.operator) {
      case '+': return l.add(r);
      case '-': return l.subtract(r);
      case '*': return l.multiply(r);
      case '/': return l.divide(r);
      case '^': return l.accuratePow(r);
      default:
        throw new Error(`[AST]: Неизвестный оператор "${this.operator}" на ${this.loc}`);
    }   

    /*// Вычисляем ветви дерева (получаем чистые MathType объекты)
    const rawLeft = this.left.evaluate(context);
    const rawRight = this.right.evaluate(context);

    // Семантическое выравнивание типов перед вычислением
    const { l, r } = this.#promoteTypes(rawLeft, rawRight);

    // 2. Просто вызываем метод по имени оператора напрямую у левого объекта!
    switch (this.operator) {
      case '+': return l.add(r);
      case '-': return l.subtract(r);
      case '*': return l.multiply(r);
      case '/': return l.divide(r);
      case '^': return l.accuratePow(r);
      default:
        throw new Error(`[AST]: Неизвестный оператор "${this.operator}" на ${this.loc}`);
    }*/ 
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
    return this.elements.map(element => {
      // 1. ОБРАБОТКА МАТЕМАТИЧЕСКИХ ВЫРАЖЕНИЙ
      if (element.type !== 'TEXT_BLOCK') {
        const evaluatedValue = element.evaluate(context);
        // Математика всегда возвращается как инлайн-формула
        return `$${evaluatedValue.toRawTeX()}$`;
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

        // --- Стандартные альтернативные LaTeX-разделители ---
        /*if (rawText.startsWith("\\[", i) || rawText.startsWith("\\]", i)) {
          throw new Error(
            "Используйте стандартные разделители '$$' вместо '\\[' и '\\]'."
          );
        }*/

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

// 1. Инициализируем объекты в кэше один раз при старте
const PRECOMPUTED_CONSTANTS = {
  PI:  new RealNumber(Math.PI),
  E:   new RealNumber(Math.E),
  PHI: new RealNumber((1 + Math.sqrt(5)) / 2),
  INF: new RealNumber(Infinity),
  NAN: new RealNumber(NaN)
};

// 2. Декларативная таблица, использующая TokenType напрямую в роли ключей
export const CONSTANTS_AST_REGISTRY = new Map([
  [TokenType.MATH_PI, {
    instance: PRECOMPUTED_CONSTANTS.PI,
    tex: '\\pi'
  }],
  [TokenType.MATH_E, {
    instance: PRECOMPUTED_CONSTANTS.E,
    tex: 'e'
  }],
  [TokenType.MATH_PHI, {
    instance: PRECOMPUTED_CONSTANTS.PHI,
    tex: '\\phi'
  }],
  [TokenType.MATH_INF, {
    instance: PRECOMPUTED_CONSTANTS.INF,
    tex: '\\infty'
  }],
  [TokenType.MATH_NAN, {
    instance: PRECOMPUTED_CONSTANTS.NAN,
    tex: '\\color{red}\\text{NaN}'
  }]
])

export class ConstantNode extends ASTNode {
  #tokenType;

  constructor(tokenType, loc) {
    super(loc);
    this.#tokenType = tokenType; 
  }

  evaluate(context) {
    const config = CONSTANTS_AST_REGISTRY.get(this.#tokenType);
    if (!config) {
      throw new Error(`[AST Error]: Неизвестный тип константы (Token ID: ${this.#tokenType}) на ${this.loc}`);
    }
    return config.instance;    
  }

  toTeX() {
    const config = CONSTANTS_AST_REGISTRY.get(this.#tokenType);
    return config ? config.tex : `\\text{unknown}`;
  }
}


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
  ['tr',     { tex: '\\operatorname{tr}' }], // След матрицы
  ['lim',    { tex: '\\lim' }],
  ['arg',    { tex: '\\arg' }]  // Аргумент комплексного числа
]);

export class CallNode extends ASTNode {
  constructor(name, args, loc) {
    super(loc);
    this.name = name; // Имя функции (строка)
    this.args = args; // Массив дочерних узлов ASTNode
  }

  evaluate(context) {
    // 1. Сначала вычисляем все аргументы, превращая их в чистые объекты MathType
    const evaluatedArgs = this.args.map(arg => arg.evaluate(context));

    // 2. Передаем имя и вычисленные объекты в глобальный семантический реестр функций
    return MathRegistry.execute(this.name, evaluatedArgs, this.loc);
  }

  toTeX() {
    // Рендерим аргументы узла в LaTeX-строки
    const argsTexArray = this.args.map(arg => arg.toTeX());
    const config = TEX_FUNCTIONS_REGISTRY.get(this.name);

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
    return `\\operatorname{${this.name}}\\left(${joinedArgs}\\right)`;
    
    /*const argsTex = this.args.map(arg => arg.toTeX()).join(', ');
    // Если функция стандартная, добавим обратный слеш для LaTeX (\sin, \cos, \ln)
    if (this.name === 'pow')
    {
      return `\\text{${this.name}}\\left(${argsTex}\\right)`;
    }
    const isStandard = ['sin', 'cos', 'tan', 'sinh', 'cosh', 'tanh', 'exp', 'sqrt'].includes(this.name);
    const texName = this.name === 'log' ? '\\ln' : (isStandard ? `\\${this.name}` : this.name);
    
    return `${texName}\\left(${argsTex}\\right)`;*/
  }
}
