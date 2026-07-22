import { RationalBigInt } from './RationalBigInt.js';
import { PolynomialTable } from './PolynomialTable.js';
import { createFunctionTable } from './IdentityEngine.js'; // Логика функций из Шага Б
import { registry } from './AtomRegistry.js';

export function foldASTToTable(node) {
  switch (node.type) {
    
    case 'NumberNode': {
      const table = new PolynomialTable();
      // Наш парсер может возвращать вещественные числа. Для простоты пока приводим к BigInt.
      // Если число дробное, здесь нужно будет распарсить его в числитель/знаменатель.
      table.addMonomial(new RationalBigInt(BigInt(node.value), 1n), new Map());
      return table;
    }

    case 'VariableNode': {
      const table = new PolynomialTable();
      let id;
      if (node.name === 'i') {
        id = -2; // Наш зарезервированный ID для мнимой единицы
      } else {
        id = registry.getOrCreateId(node.name); // 'x' -> -3, 'y' -> -4
      }
      table.addMonomial(new RationalBigInt(1n, 1n), new Map([[id, 1]]));
      return table;
    }

    case 'UnaryOpNode': {
        const leftTable = foldASTToTable(node.argument);
        if (node.operator === '-') return leftTable.unaryMinus();
        return leftTable;
    }

    case 'BinaryOpNode': {
      const leftTable = foldASTToTable(node.left);

      const rightTable = foldASTToTable(node.right);

      switch (node.operator) {
        case '+': return leftTable.add(rightTable);
        case '-': return leftTable.add(rightTable.unaryMinus());
        case '*': return leftTable.multiply(rightTable);
        case '^': {
          // Для полиномов степень обязана быть константным целым числом в рамках этого слоя
          if (node.right.type !== 'NumberNode') {
            throw new Error("Символьные степени требуют расширения CAS до экспоненциального слоя");
          }
          return leftTable.pow(node.right.value);
        }
        default:
          throw new Error(`Неподдерживаемый оператор в полиномиальном слое: ${node.op}`);
      }
    }

    case 'CallNode': {
      // Рекурсивно вычисляем таблицу для аргумента функции (например, x + 1)
      const argumentTable = foldASTToTable(node.args);
      // Передаем в интеллектуальную фабрику функций
      return createFunctionTable(node.name, argumentTable);
    }

    default:
      throw new Error(`Неизвестный узел AST: ${node.type}`);
  }
}