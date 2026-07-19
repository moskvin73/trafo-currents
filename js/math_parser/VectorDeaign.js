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

/**
 * Рекурсивный вспомогательный метод для "размотки" последовательных унарных операций.
 * Считает количество унарных минусов в цепочке (например, для +---++x) и находит базовый узел.
 * 
 * @param {Object} node - Текущий узел AST-дерева.
 * @param {Object} signState - Ссылка на объект-аккумулятор количества минусов { minusCount: N }.
 * @returns {Object} Базовый (не унарный) узел, который находился в самом конце цепочки знаков.
 */
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

/**
 * Рекурсивно обходит AST-дерево и собирает все переменные и константы в единый плоский массив.
 * Правильно вычисляет и пробрасывает математический знак (плюс/минус) сверху вниз по дереву.
 * 
 * @param {Object} node - Корень AST-дерева (или текущий под-узел).
 * @param {Object} out_errors - Объект для логирования синтаксических или семантических ошибок.
 * @param {boolean} currentSign - Текущий контекстный знак (false — плюс, true — минус). По умолчанию false.
 * @returns {Array<Object>} Плоский массив объектов с описанием знака, имени переменной или значения константы.
 */
function collectTerms(node, out_errors, currentSign = false) {
    if (node instanceof UnaryOpNode) {
        const signState = { minusCount: 0 };
        const coreNode = collapseUnaryChain(node, signState);
        const hasMinus = signState.minusCount % 2 !== 0;
        return collectTerms(coreNode, out_errors, currentSign !== hasMinus);
    }

    if (node instanceof AddNode) {
        const a_left = collectTerms(node.left, out_errors, currentSign);
        const a_right = collectTerms(node.right, out_errors, currentSign);
        return [...a_left, ...a_right];
    }
    
    if (node instanceof SubNode) {
        const a_left = collectTerms(node.left, out_errors, currentSign);
        const a_right = collectTerms(node.right, out_errors, !currentSign);
        return [...a_left, ...a_right];
    }
    
    if (node instanceof VariableNode) {
        return [{ sign: currentSign, name: node.name, value: null }];
    }
    
    // Поддержка узла ConstantNode
    if (node instanceof ConstantNode) {
        const rawValue = node.value(); // Вызываем метод value()
        let finalValue = ComplexNumber.from(rawValue);
        
        if (currentSign) {
            finalValue = finalValue.negate();
        }
        return [{ sign: false, name: null, value: finalValue }];
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

        if (currentSign) {
            finalValue = finalValue.negate();
        }

        return [{ sign: false, name: null, value: finalValue }];
    }

    out_errors.error("Недопустимая векторная операция", node.loc);
    return [];
}

/**
 * Агрегирует (группирует) плоский массив элементов. 
 * Складывает все константы в единое значение, вычисляет итоговые множители переменных 
 * и полностью исключает из результата переменные с нулевым коэффициентом.
 * 
 * @param {Array<Object>} terms - Плоский массив объектов, возвращенный функцией collectTerms.
 * @returns {Object} Объект с выделенной константой и массивом сгруппированных идентификаторов.
 */
function aggregateTerms(terms) {
    // Выделенная финальная константа (инициализируем комплексным нулем)
    let totalConstant = new ComplexNumber(0, 0); 
    
    // Промежуточный объект для подсчета множителей идентификаторов
    const variableCounts = {};

    // 1. Проходим по всем элементам и распределяем их
    for (const item of terms) {
        if (item.name !== null) {
            // Переменная: true -> -1, false -> +1
            const weight = item.sign ? -1 : 1;
            
            if (variableCounts[item.name] === undefined) {
                variableCounts[item.name] = 0;
            }
            variableCounts[item.name] += weight;
        } else if (item.value !== null) {
            // Константа (из NumberNode или ConstantNode): просто суммируем
            totalConstant = totalConstant.add(item.value);
        }
    }

    // 2. Формируем массив переменных, исключая нулевые множители
    const variablesArray = [];
    
    for (const varName in variableCounts) {
        const multiplier = variableCounts[varName];
        
        if (multiplier !== 0) {
            variablesArray.push({
                multiplier: multiplier, // Число (множитель)
                name: varName,           // Идентификатор
            });
        }
    }

    // 3. Возвращаем разделенный результат
    return {
        constant: totalConstant, // Отдельное константное значение (ComplexNumber)
        terms: variablesArray    // Массив элементов вида [{ multiplier, name }, ...] без нулей
    };
}

export function BuildVectorOperationDescription(node, out_errors)
{
    try {
        if (node instanceof AssignNode)
        {
            const cur_e = out_errors.count;
            const rawTerms = collectTerms(node.expression, out_errors);
            if (cur_e === out_errors.count) {
                rawTerms.var_let = node.name;
                return aggregateTerms(rawTerms); }
            else return {};
        }
        else
        {
            out_errors.error("Ожидался оператор присваения", node.loc);
        }
    } catch(err) {
        out_errors.error(err.toString(), node.loc);
    } 
    return {};
}