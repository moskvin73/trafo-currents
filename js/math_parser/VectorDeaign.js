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
    
    const variableCounts = {};

    for (const item of terms) {
        if (item.name !== null) {
            // true — это минус (-1), false — это плюс (+1)
            const weight = item.sign ? -1 : 1;
            
            if (variableCounts[item.name] === undefined) {
                variableCounts[item.name] = 0;
            }
            variableCounts[item.name] += weight;
        } else if (item.value !== null) {
            // Константы просто складываем
            constantSum = constantSum.add(item.value);
        }
    }

    // 3. Формируем итоговый массив элементов
    const resultArray = [];

    // Добавляем константу, только если она не равна нулю 
    // (предполагаю, что у вашего ComplexNumber есть метод проверки на ноль, например .isZero() или проверка поля)
    // Если такого метода нет, можно проверять модуль числа или его компоненты
    if (!constantSum.equals(0)) {
        resultArray.push({
            value: constantSum,
            name: null // У константы нет идентификатора
        });
    }

    // Проходим по собранным переменным и добавляем только ненулевые
    for (const varName in variableCounts) {
        const multiplier = variableCounts[varName];
        
        if (multiplier !== 0) {
            resultArray.push({
                value: multiplier, // Число (множитель)
                name: varName      // Идентификатор
            });
        }
    }

    return resultArray;
}

export function BuildVectorOperationDescription(node, out_errors)
{
    const rawTerms = collectTerms(node, out_errors);
    return aggregateTerms(rawTerms); 
}