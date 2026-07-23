import { registry } from './AtomRegistry.js';
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
  MatrixNode,
  IndexNode,
  ConstantNode } from '../math_parser/ASTNodes.js';
  import RealNumber from './RealNumber.js';
  import ComplexNumber from './ComplexNumber.js';


/**
 * Главная функция: разворачивает таблицу обратно в дерево AST
 * @param {PolynomialTable} table 
 * @returns {Object} Корневой узел AST (BinaryOpNode, NumberNode, ComplexNode и др.)
 */
export function unfoldTableToAST(table, loc) {
  // Если таблица пустая — это чистый ноль
  if (table.monomials.size === 0) {
    return createLiteralNode(0n, 0n);
  }

  const monoms = Array.from(table.monomials.values());

  // Шаг 1: Разворачиваем каждый отдельный моном в его собственное поддерево AST
  const astNodes = monoms.map(monom => unfoldMonomToAST(monom, loc));

  // Шаг 2: Связываем все мономы через операторы сложения или вычитания
  // Идем по цепочке слева направо
  let rootAST = astNodes[0].node;

  // Если самый первый элемент был отрицательным, а узел позволяет, 
  // мы можем сформировать унарный минус, но для простоты начнем с плоской склейки
  if (astNodes[0].isNegative) {
    rootAST = new UnaryOpNodeMinus(rootAST, loc);
  }

  for (let i = 1; i < astNodes.length; i++) {
    const nextItem = astNodes[i];
    
    if (nextItem.isNegative) {
      // Если коэффициент отрицательный, вместо "+ (-экспонент)" делаем "- (абсолютный_экспонент)"
      rootAST = new SubNode(rootAST, nextItem.node, loc);
    } else {
      rootAST = new AddNode(rootAST, nextItem.node, loc);
    }
  }

  return rootAST;
}

/**
 * Вспомогательная функция: разворачивает ОДИН моном в поддерево (Coeff * Var1^Exp1 * Var2^Exp2...)
 * @returns {Object} { node: ASTNode, isNegative: boolean }
 */
function unfoldMonomToAST(monom, loc) {
  const { coeff, powers } = monom;
  
  // Выясняем свойства коэффициента
  const isRealZero = coeff.real.isZero();
  const isImagZero = coeff.imag.isZero();
  
  // Проверяем, отрицательный ли моном целиком (для красивого вычитания)
  // Моном считается отрицательным, если у него строго отрицательная вещественная часть (и нет мнимой),
  // либо если он чисто мнимый с отрицательным знаком.
  let isNegative = false;
  let absCoeff = coeff;

  if (!isRealZero && isImagZero && coeff.real.num < 0n) {
    isNegative = true;
    absCoeff = new RationalComplexBigInt(coeff.real.unaryMinus(), 0n);
  } else if (isRealZero && !isImagZero && coeff.imag.num < 0n) {
    isNegative = true;
    absCoeff = new RationalComplexBigInt(0n, coeff.imag.unaryMinus());
  }

  // 1. Создаем узел для самого числового коэффициента
  let coeffNode = null;
  
  // Проверяем, нужно ли вообще рендерить коэффициент
  // Если это чисто вещественная единица (1 или -1), мы её опускаем, ПРИ УСЛОВИИ что есть переменные.
  const isUnitCoeff = absCoeff.real.num === 1n && absCoeff.real.den === 1n && absCoeff.imag.isZero();
  
  if (!isUnitCoeff || powers.size === 0) {
    coeffNode = createLiteralNodeFromRationalComplex(absCoeff, loc);
  }

  // 2. Строим дерево для буквенной части (переменных)
  let varsAST = null;

  for (const [id, exp] of powers.entries()) {
    // Восстанавливаем объект переменной или функции из глобального реестра по ID
    const atom = registry.resolve(id); 
    let atomNode;

    if (typeof atom === 'string') {
      // Это чистая переменная ('x', 'y'...)
      atomNode = new VariableNode(atom, loc);
    } else if (typeof atom === 'object' && atom.type) {
      // Это функциональный атом { type: 'sin', argumentTable: ... }, разворачиваем его аргумент рекурсивно!
      const argAST = unfoldTableToAST(atom.argumentTable);
      atomNode = new CallNode(atom.type, [argAST], loc);
    }

    // Обрабатываем степень переменной
    let factorNode = atomNode;
    if (exp !== 1) {
      // Если степень отрицательная или просто не равна 1, генерируем узел степени '^'
      // Заметьте: отрицательные степени вроде x^-1 запишутся как x^(-1)
      factorNode = new PowNode(atomNode, new NumberNode(RealNumber(exp)));
    }

    // Собираем переменные последовательно через умножение
    if (varsAST === null) {
      varsAST = factorNode;
    } else {
      varsAST = new MulNode(varsAST, factorNode, loc);
    }
  }

  // 3. Соединяем коэффициент и переменные вместе
  if (coeffNode && varsAST) {
    return { node: new MulNode(coeffNode, varsAST, loc), isNegative };
  } else if (coeffNode) {
    return { node: coeffNode, isNegative };
  } else {
    return { node: varsAST, isNegative };
  }
}

/**
 * Фабрика литералов: возвращает NumberNode, ComplexNode или узел дроби в зависимости от структуры
 */
function createLiteralNodeFromRationalComplex(coeff, loc) {
  // Если это простая целая дробь вида N/1 (чисто вещественная)
  if (coeff.imag.isZero() && coeff.real.den === 1n) {
    return new NumberNode(new RealNumber(coeff.real.num), loc);
  }
  
  // Если это вещественная дробь N/D
  if (coeff.imag.isZero()) {
    return new DivNode(new NumberNode(new RealNumber(coeff.real.num), loc), new NumberNode(new RealNumber(coeff.real.den), loc), loc);
  }

  // Если это комплексное число без дробей
  if (coeff.real.den === 1n && coeff.imag.den === 1n) {
    // Передаем в ваш ComplexNode реальную и мнимую части
    return new NumberNode(new ComplexNumber(coeff.real.num, coeff.imag.num), loc);
  }

  // В самом крайнем случае, если это комплексные дроби, собираем их через базовую арифметику AST
  // (RealNum/RealDen) + (ImagNum/ImagDen)*i
  const realPart = new DivNode(new NumberNode(new RealNumber(coeff.real.num)), new NumberNode(new RealNumber(coeff.real.den)), loc);
  const imagPart = new DivNode(new NumberNode(new RealNumber(coeff.imag.num)), new NumberNode(new RealNumber(coeff.imag.den)), loc);
  
  return new AddNode(realPart, new MulNode(imagPart, new VariableNode('i', loc), loc), loc);
}

function createLiteralNode(real, imag) {
  if (imag === 0n) return new NumberNode(new RealNumber(real));
  return new NumberNode(new ComplexNumber(real, imag), loc);
}