import { RationalComplexBigInt } from './RationalComplexBigInt.js';
import { PolynomialTable } from './PolynomialTable.js';
import { createFunctionTable } from './IdentityEngine.js'; // Логика функций из Шага Б
import { registry } from './AtomRegistry.js';

export function foldASTToTable(node) {
  if (!node) throw new Error("Передан пустой узел в foldASTToTable");

  switch (node.constructor.name) {
    
    case 'NumberNode': {
      const table = new PolynomialTable();
      if (node.value.constructor.name === 'RealNumber') {
        // Чисто вещественное число — мнимая часть 0
        const coeff = new RationalComplexBigInt(BigInt(node.value), 0n);
        table.addMonomial(coeff, new Map());
        return table;
      }
      else if (node.value.constructor.name === 'ComplexNumber') {
        const coeff = new RationalComplexBigInt(BigInt(node.real), BigInt(node.imag));
        table.addMonomial(coeff, new Map());
        return table;
      }
    }

    case 'VariableNode': {
      // Больше никакой проверки на 'i', только чистые переменные (x, y,...)
      const table = new PolynomialTable();
      const id = registry.getOrCreateId(node.name); 
      const coeff = new RationalComplexBigInt(1n, 0n); // Коэффициент 1
      table.addMonomial(coeff, new Map([[id, 1]]));
      return table;
    }

    case 'UnaryOpNode': {
      const innerTable = foldASTToTable(node.argument);
      if (node.operator === '-') return innerTable.unaryMinus();
      if (node.operator === '+') return innerTable;
      throw new Error(`Неподдерживаемый унарный оператор: ${node.operator}`);
    }

     case 'AddNode': {
      const leftTable = foldASTToTable(node.left);
      const rightTable = foldASTToTable(node.right);
      return leftTable.add(rightTable);
     }
     case 'SubNode': {
      const leftTable = foldASTToTable(node.left);
      const rightTable = foldASTToTable(node.right);
      return leftTable.add(rightTable.unaryMinus());
     }
     case 'MulNode': {
      const leftTable = foldASTToTable(node.left);
      const rightTable = foldASTToTable(node.right);
      return leftTable.multiply(rightTable);
     }
     case 'PowNode': {
      const leftTable = foldASTToTable(node.left);
      const rightTable = foldASTToTable(node.right);
       if (node.right.type !== 'NumberNode') {
        throw new Error("Символьные степени требуют расширения CAS");
       }
       return leftTable.pow(node.right.value);
     }

    case 'CallNode': {
      if (!node.args || node.args.length === 0) {
        const emptyTable = new PolynomialTable();
        emptyTable.addMonomial(new RationalComplexBigInt(0n, 0n), new Map());
        return createFunctionTable(node.name, emptyTable);
      }
      const argumentTable = foldASTToTable(node.args[0]); // Берём первый аргумент
      return createFunctionTable(node.name, argumentTable);
    }

    default:
      throw new Error(`Неизвестный тип узла AST: ${node.type}`);
  }
}