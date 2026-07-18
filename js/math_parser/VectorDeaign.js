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

export function BuildVectorOperationDescription(node, out_errors)
{
    const signState = { minusCount: 0 };
    if (node instanceof UnaryOpNode)
    {
        node = collapseUnaryChain(node, signState);
    }
    if (node instanceof AddNode)
    {
        conat a_left = BuildVectorOperationDescription(node.left, out_errors);
        conat a_right = BuildVectorOperationDescription(node.right, out_errors);
        return [...a_left, ...a_right];
    }
    else if (node instanceof SubNode)
    {

    }
    else if (node instanceof VariableNode)
    {
        return { sign: minusCount / 2 !== 0, name: node.name, value: null }
    }
    else if (node instanceof NumberNode)
    {
        const value_node = node.value;
        if (value_node instanceof RealNumber) {
            return [{ sign: minusCount / 2 !== 0, name: null, value: ComplexNumber.from(value_node) }];
        }
        if (value_node instanceof ComplexNumber) {
            return [{ sign: minusCount / 2 !== 0, name: null, value: value_node }];
        }
        else { 
            out_errors("Недопустимый тип операнда векторной опреации", node.loc);
            return null;
        }
    }
}