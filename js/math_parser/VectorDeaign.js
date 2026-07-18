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

// Вспомогательный метод для размотки цепочки знаков +---++
function collapseUnaryChain(node, signState) {
// Если текущий узел — унарная операция, обрабатываем её и идём вглубь
if (node instanceof UnaryOpNode) {
    if (node.operator === '-') {
    signState.minusCount++;
    }
    return collapseUnaryChain(node.argument, signState);
}

// Как только наткнулись на не-унарный узел, это база — возвращаем его
return node;
}  

function collectTerms(node, out_errors, currentSign = false) {
    // Если наткнулись на унарный знак, раскрываем всю цепочку
    if (node instanceof UnaryOpNode) {
        const signState = { minusCount: 0 };
        const coreNode = collapseUnaryChain(node, signState);
        // Если количество минусов нечетное, инвертируем текущий знак
        const hasMinus = signState.minusCount % 2 !== 0;
        return collectTerms(coreNode, out_errors, currentSign !== hasMinus);
    }

    if (node instanceof AddNode) {
        // При сложении знак родителя передается обоим поддеревьям без изменений
        const a_left = collectTerms(node.left, out_errors, currentSign);
        const a_right = collectTerms(node.right, out_errors, currentSign);
        return [...a_left, ...a_right];
    }
    
    if (node instanceof SubNode) {
        // При вычитании правое поддерево инвертирует входящий знак
        const a_left = collectTerms(node.left, out_errors, currentSign);
        const a_right = collectTerms(node.right, out_errors, !currentSign);
        return [...a_left, ...a_right];
    }
    
    if (node instanceof VariableNode) {
        // Обязательно возвращаем в виде массива [ ... ]
        return [{ sign: currentSign, name: node.name, value: null }];
    }
    
    if (node instanceof NumberNode) {
        const value_node = node.value;
        let finalValue = null;

        if (value_node instanceof RealNumber) {
            finalValue = ComplexNumber.from(value_node);
        } else if (value_node instanceof ComplexNumber) {
            finalValue = value_node;
        } else { 
            out_errors.error("Недопустимый тип операнда векторной операции", node.loc);
            return [];
        }

        // Если итоговый знак минус, инвертируем (негатируем) само число
        if (currentSign) {
            finalValue = finalValue.negate();
        }

        return [{ sign: false, name: null, value: finalValue }];
    }

    out_errors.error("Недопустимая векторная операция", node.loc);
    return [];
}

function aggregateTerms(terms) {
    // Сюда будем суммировать все NumberNode. Предполагаем, что у ComplexNumber есть метод .add()
    // Инициализируем нулем (замените на ваш класс комплексного нуля, если требуется)
    let constantSum = new ComplexNumber(0, 0); 
    
    // Карта для подсчета множителей переменных: { "x": 2, "y": -1 }
    const variableCounts = {};

    for (const item of terms) {
        if (item.name !== null) {
            // Это переменная. Знак true означает (-1), false означает (+1)
            const weight = item.sign ? -1 : 1;
            
            if (variableCounts[item.name] === undefined) {
                variableCounts[item.name] = 0;
            }
            variableCounts[item.name] += weight;
        } else if (item.value !== null) {
            // Это константа. В collectTerms мы её уже инвертировали, если был минус,
            // поэтому здесь просто складываем через метод .add() вашего класса
            constantSum = constantSum.add(item.value);
        }
    }

    // Формируем красивый итоговый результат
    return {
        constants: constantSum,        // Единое итоговое комплексное число
        variables: variableCounts      // Объект вида { x: 2, y: -1, z: 0 }
    };
}

export function BuildVectorOperationDescription(node, out_errors)
{

}