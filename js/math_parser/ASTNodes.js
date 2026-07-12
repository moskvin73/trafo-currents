// Импортируем наш базовый математический тип, чтобы использовать в проверках, 
// если потребуется расширение, или для явного понимания типов
import MathType from '../math/MathType.js';
import ComplexNumber from '../math/ComplexNumber.js';
import RealNumber from '../math/RealNumber.js';
import { MathRegistry } from './MathRegistry.js';
import SemanticDispatcher from './SemanticDispatcher.js';
import { TokenType } from './TokenTypes.js';

const OpPriority = { 
    ASSIGN: 1,       // '='
    ADD_SUB: 2,  // '+', '-'
    MUL_DIV: 3,  // '*', '/'
    UNARY: 4,        // унарные '+' и '-'
    POW: 5,          // '^'
    PRIMARY: 6       // Числа, переменные
};

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

  getPriority() { throw new Error("Not implemented"); }

  toString() { throw new Error("Not implemented"); }

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
    this.value = mathTypeValue;
  }

  getPriority() { return OpPriority.PRIMARY; }

  toString() { return this.value.toString(); }

  evaluate(context) { return this.value; }

  toTeX() { return this.value.toRawTeX(); }
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

  getPriority() { return OpPriority.UNARY; }

  toString() {
      let innerCode = this.argument.toString();      
      // Если у внутреннего выражения приоритет ниже, берем его в скобки
      if (this.argument.getPriority() < this.getPriority()) {
          innerCode = `(${innerCode})`;
      }
      
      return `${this.operator}${innerCode}`;
  }  

  toTeX() {
    const signState = { minusCount: 0 };
    
    // Запускаем сборку знаков с текущего узла
    const coreNode = this._collapseUnaryChain(this, signState);

    // Получаем TeX-код для «чистого» центрального узла
    let argTex = coreNode.toTeX();
    
    // Проверяем приоритет: если внутри унарной цепочки сидит выражение 
    // с низким приоритетом (например, сложение A+B), его нужно взять в скобки
    if (coreNode.getPriority() < this.getPriority()) {
      argTex = `\\left(${argTex}\\right)`;
    }

    // Определяем итоговый знак цепочки
    const finalOperator = (signState.minusCount % 2 !== 0) ? '-' : '';

    return `${finalOperator}${argTex}`;
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

  evaluate(context) { return this.argument.evaluate(context); }
}

export class UnaryOpNodeMinus extends UnaryOpNode {
  /**
   * @param {ASTNode} argument - Узел, к которому применяется операция
   * @param {SourceLocation} loc 
   */
  constructor(argument, loc) {
    super('-', argument, loc);
  }

  evaluate(context) { 
    const argVal = this.argument.evaluate(context);
    return argVal.negate();
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

  toString() {
    let leftCode = this.left.toString();
    let rightCode = this.right.toString();
    const currentPriority = this.getPriority();

    if (this.left.getPriority() < currentPriority) leftCode = `(${leftCode})`;
    if (this.right.getPriority() < currentPriority) rightCode = `(${rightCode})`;

    return `${leftCode}${this.operator}${rightCode}`;
  }

  toTeX() {
    let leftCode = this.left.toTeX();
    let rightCode = this.right.toTeX();
    const currentPriority = this.getPriority();

    if (this.left.getPriority() < currentPriority) leftCode = `\\left(${leftCode}\\right)`;
    if (this.right.getPriority() < currentPriority) rightCode = `\\left(${rightCode}\\right)`;

    return this.simpleTeX(leftCode, rightCode);
  }

  /**
   * Общий метод для красивого книжного рендеринга умножения и деления.
   * Дочерние классы (MulNode, DivNode) будут просто вызывать его.
   */
  _renderFractionChain() {
    const nums = [];
    const dens = [];
    const signState = { minusCount: 0 };

    // Запускаем сборку факторов, начиная с самого себя (this)
    this._collectFactors(this, false, nums, dens, signState);

    // Умная функция сборки элементов на строке без лишних точек умножения
    const joinFactors = (nodes) => {
      if (nodes.length === 0) return '';
      
      let resultTeX = '';

      for (let i = 0; i < nodes.length; i++) {
        const currentNode = nodes[i];
        let currentTeX = currentNode.toTeX();

        // Защита скобками: если приоритет ниже умножения (например, сложение или комплексное число)
        if (currentNode.getPriority?.() < OpPriority.MUL_DIV) {
          currentTeX = `\\left(${currentTeX}\\right)`;
        }

        if (i === 0) {
          resultTeX = currentTeX;
        } else {
          const leftStr = resultTeX.trim();
          const rightStr = currentTeX.trim();

          // Регулярные выражения проверяют стык строк на наличие цифр
          const endsWithDigit = /[0-9]$/.test(leftStr);
          const startsWithDigit = /^[0-9]/.test(rightStr);
          const startsWithTeXConstant = /^\\[a-zA-Z]/.test(rightStr);

          let needDot = false;
          if (endsWithDigit && startsWithDigit) {
            needDot = true; // Число * Число -> нужна точка
          } else if (endsWithDigit && startsWithTeXConstant) {
            needDot = true; // Число * \pi -> нужна точка
          }

          // Склеиваем: либо точкой \cdot, либо красивым пробелом для символьных переменных
          if (needDot) {
            resultTeX += ` \\cdot ${currentTeX}`;
          } else {
            resultTeX += ` ${currentTeX}`;
          }
        }
      }
      return resultTeX;
    };

    // Выносим глобальный знак
    const globalSign = (signState.minusCount % 2 !== 0) ? '- ' : '';

    // КРАЙНИЙ КЕЙС: Если в цепочке вообще НЕ БЫЛО делений (например, выражение вида A * B * C)
    // То рисовать \frac{}{} не нужно. Рендерим просто красивую строчку умножения.
    if (dens.length === 0) {
      return `${globalSign}${joinFactors(nums)}`;
    }

    // Если знаменатель есть, строим профессиональную дробь
    const numTeX = joinFactors(nums);
    const denTeX = joinFactors(dens);

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

// Вспомогательная функция для склейки множителей по правилам книжной типографики
function joinFactors(nodes) {
  if (nodes.length === 0) return '';
  
  let resultTeX = '';

  for (let i = 0; i < nodes.length; i++) {
    const currentNode = nodes[i];
    let currentTeX = currentNode.toTeX();

    // Защита скобками: благодаря вашей идее с динамическим приоритетом,
    // комплексное число здесь автоматически получит скобки, так как ADD_SUB < MUL_DIV!
    if (currentNode.getPriority() < OpPriority.MUL_DIV) {
      currentTeX = `\\left(${currentTeX}\\right)`;
    }

    if (i === 0) {
      resultTeX = currentTeX;
    } else {
      const leftStr = resultTeX.trim();
      const rightStr = currentTeX.trim();

      // Смотрим на стык двух TeX-строк:
      // 1. Заканчивается ли левая часть цифрой?
      const endsWithDigit = /[0-9]$/.test(leftStr);
      // 2. Начинается ли правая часть с цифры?
      const startsWithDigit = /^[0-9]/.test(rightStr);
      // 3. Начинается ли правая часть с константы TeX (например, \pi, \e)?
      const startsWithTeXConstant = /^\\[a-zA-Z]/.test(rightStr);

      let needDot = false;

      if (endsWithDigit && startsWithDigit) {
        // Например: 5 * 3 -> 5 \cdot 3
        needDot = true;
      } else if (endsWithDigit && startsWithTeXConstant) {
        // Например: 5 * \pi -> 5 \cdot \pi
        needDot = true;
      }

      // Склеиваем: либо через точку, либо через красивый тонкий пробел '\,'
      if (needDot) {
        resultTeX += ` \\cdot ${currentTeX}`;
      } else {
        resultTeX += ` \\, ${currentTeX}`;
      }
    }
  }

  return resultTeX;
}


class StrictRightBinNode extends BinaryOpNode {
  constructor(left, operator, right, loc) {
    super(left, operator, right, loc);
  }

  toString() {
    let leftCode = this.left.toString();
    let rightCode = this.right.toString();
    const currentPriority = this.getPriority();

    // Слева - строго меньше
    if (this.left.getPriority() < currentPriority) leftCode = `(${leftCode})`;
    
    // Справа - МЕНЬШЕ ИЛИ РАВЕН (ваше условие)
    if (this.right.getPriority() <= currentPriority) rightCode = `(${rightCode})`;

    return `${leftCode}${this.operator}${rightCode}`;
  }

  toTeX() {
    let leftCode = this.left.toTeX();
    let rightCode = this.right.toTeX();
    const currentPriority = this.getPriority();

    if (this.left.getPriority() < currentPriority) leftCode = `\\left(${leftCode}\\right)`;
    if (this.right.getPriority() <= currentPriority) rightCode = `\\left(${rightCode}\\right)`;

    return this.simpleTeX(leftCode, rightCode);
  }
}

export class AddNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '+', right, loc);
  }

  getPriority() { return OpPriority.ADD_SUB; }

  evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.evaluate(context), this.right.evaluate(context));
    return l.add(r);
  }

  simpleTeX(l, r) {
    return `${l} + ${r}`;
  }
}

export class SubNode extends StrictRightBinNode {
  constructor(left, right, loc) {
    super(left, '-', right, loc);
  }

  getPriority() { return OpPriority.ADD_SUB; }

  evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.evaluate(context), this.right.evaluate(context));
    return l.subtract(r);
  }

  simpleTeX(l, r) {
    return `${l} - ${r}`;
  }
}

export class MulNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '*', right, loc);
  }

  getPriority() { return OpPriority.MUL_DIV; }

  evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.evaluate(context), this.right.evaluate(context));
    return l.multiply(r);
  } 

  simpleTeX(l, r) {
    return `${l} \\cdot ${r}`;
  }
}

export class DivNode extends StrictRightBinNode {
  constructor(left, right, loc) {
    super(left, '/', right, loc);
  }

  getPriority() { return OpPriority.MUL_DIV; }

  evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.evaluate(context), this.right.evaluate(context));
    return l.divide(r);
  } 

  toTeX() { 
    const nums = [];
    const dens = [];
    // Объект-состояние для подсчета унарных минусов
    const signState = { minusCount: 0 };

    // Собираем числители и знаменатели с учетом инверсии и знаков
    this._collectFactors(this.left, false, nums, dens, signState);
    this._collectFactors(this.right, true, nums, dens, signState);

    // Вспомогательная функция для сборки элементов через \cdot
    /*const joinFactors = (nodes) => {
      return nodes.map(node => {
        let tex = node.toTeX();
        // Если приоритет ниже умножения (например, сложение/вычитание), нужны скобки
        if (node.getPriority?.() < OpPriority.MUL_DIV) {
          tex = `\\left(${tex}\\right)`;
        }
        return tex;
      }).join(' \\cdot ');
    };*/

    const numTeX = joinFactors(nums);
    const denTeX = joinFactors(dens);

    // Если количество унарных минусов нечетное, выносим знак минус вперед
    const globalSign = (signState.minusCount % 2 !== 0) ? '- ' : '';

    return `${globalSign}\\frac{${numTeX}}{${denTeX}}`;
  }

  // Рекурсивный сборщик со знаком инверсии
  _collectFactors(node, isInverted, nums, dens, signState) {
    // 1. Обработка унарных операций (+ / -)
    if (node instanceof UnaryOpNode) {
      // Если внутри унарного знака сидит выражение с низким приоритетом (сложение/вычитание),
      // мы не имеем права выносить этот знак наружу всей дроби.
      if (node.argument.getPriority?.() < OpPriority.MUL_DIV) {
        if (isInverted) dens.push(node); else nums.push(node);
        return;
      }

      // Если это минус, инкрементируем глобальный счетчик знаков дроби
      if (node.operator === '-') {
        signState.minusCount++;
      }
      
      // Проваливаемся дальше по цепочке унарных операций (разматываем +---++)
      this._collectFactors(node.argument, isInverted, nums, dens, signState);
      return;
    }

    // 2. Бинарное ДЕЛЕНИЕ
    if (node instanceof DivNode) {
      this._collectFactors(node.left, isInverted, nums, dens, signState);
      this._collectFactors(node.right, !isInverted, nums, dens, signState);
      return;
    }

    // 3. Бинарное УМНОЖЕНИЕ (добавьте, когда создадите класс умножения)
    if (typeof MulNode !== 'undefined' && node instanceof MulNode) {
      this._collectFactors(node.left, isInverted, nums, dens, signState);
      this._collectFactors(node.right, isInverted, nums, dens, signState);
      return;
    }

    // 4. База рекурсии: обычный изолированный узел (число, переменная, функция)
    // Мы дошли до конца цепочки знаков для данного фактора.
    if (isInverted) {
      dens.push(node);
    } else {
      nums.push(node);
    }
  }
}

export class PowNode extends BinaryOpNode {
  constructor(left, right, loc) {
    super(left, '^', right, loc);
  }

  getPriority() { return OpPriority.POW; }

  toString() {
    let leftCode = this.left.toString();
    let rightCode = this.right.toString();
    const currentPriority = this.getPriority();

    if (this.left.getPriority() < currentPriority) leftCode = `(${leftCode})`;
    
    const isRightUnary = this.right instanceof UnaryOpNode;

    if (!isRightUnary && this.right.getPriority() < currentPriority) rightCode = `(${rightCode})`;

    return `${leftCode}${this.operator}${rightCode}`;
  }

  evaluate(context) {
    const { l, r } = dispatcher.promoteTypes(this.left.evaluate(context), this.right.evaluate(context));
    return l.accuratePow(r);
  } 

  toTeX() {
    let l = this.left.toTeX();
    if (this.left.getPriority() < this.getPriority()) l = `\\left(${l}\\right)`;
    const r = this.right.toTeX();
    return `{${l}}^{${r}}`;
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

  getPriority() { return OpPriority.PRIMARY; }

  toString() { return this.name; }

  evaluate(context) {
    // Ищем переменную в локальном контексте вызова
    if (this.name in context) {
      return context[this.name];
    }
    throw new Error(`[AST]: Переменная "${this.name}" не определена в текущем контексте.`);
  }

  toTeX() { return this.name; }
}

// Дополнительные узлы для поддержки переменных, которые мы спроектировали
export class AssignNode extends ASTNode {
  constructor(name, expression, loc) {
    super(loc);
    this.name = name;
    this.expression = expression;
  }

  getPriority() { return OpPriority.ASSIGN; }

  toString() { return `${this.name} = ${this.expression.toString()}`; }

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

  toString() {
    return this.statements
          .map(statement => statement.toString())
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
}

/**
 * Узел для команды print(...)
 */
export class PrintNode extends ASTNode {
  constructor(elements, loc) {
    super(loc);
    this.elements = elements;
  }

  toString() {
    return "print (" + this.elements.map(element => {
      if (element.type == 'TEXT_BLOCK') element.value;
      return element.toString();
    }).join(', ') + ")";
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
  }]
])

export class ConstantNode extends ASTNode {
  #tokenType;

  constructor(tokenType, loc) {
    super(loc);
    this.#tokenType = tokenType; 
  }

  getPriority() { return OpPriority.PRIMARY; }

  toString() {
    const config = CONSTANTS_AST_REGISTRY.get(this.#tokenType);
    return config ? config.str : "";
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

  getPriority() { return OpPriority.PRIMARY; }

  toString() {
    const argsCode = this.args.map(arg => arg.toString()).join(", ");
    return `${this.name}(${argsCode})`;
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
  }
}
