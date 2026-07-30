import { BoolValue } from './js/math/BoolValue.js';
import { RealNumber } from './js/math/RealNumber.js';
import { ComplexNumber } from './js/math/ComplexNumber.js';
import { Matrix } from './js/math/Matrix.js';
import ASTNode, {
  IF_Node,
  Goto_Node,
  IsOpNode,
  ErrorNode,
  CastOpNode,
  NumberNode,
  UnaryOpNode, 
  UnaryOpNodePlus,
  UnaryOpNodeMinus,
  UnaryOpNodeNot,
  BinaryOpNode,
  OrNode,
  XorNode,
  AndNode,
  EquNode,
  NotEquNode,
  LtNode,
  GtNode,
  LteNode,
  GteNode,
  AddNode,
  SubNode,
  MulNode,
  DivNode,
  ModNode,
  PowNode,
  CallNode,
  RefNode, 
  AssignNode, 
  VariableNode, 
  PrintNode, 
  ProgramNode,
  MatrixNode,
  IndexNode,
  VarableCode,
  DefineVarableCodeNode,
  ConstantNode } from './js/math_parser/ASTNodes.js';

// Реестр математических типов данных
const DATA_TYPE_REGISTRY = new Map([
  [BoolValue,     (data) => BoolValue.fromJSON(data)]
  [RealNumber,    (data) => RealNumber.fromJSON(data)],
  [ComplexNumber, (data) => ComplexNumber.fromJSON(data)],
  [Matrix,        (data) => ComplexNumber.fromJSON(data)]
]);

const DATA_TYPE_STRING_LOOKUP = new Map();
for (const [ClassRef, fromJsonFunc] of DATA_TYPE_REGISTRY) {
  DATA_TYPE_STRING_LOOKUP.set(ClassRef.dataTypeName, fromJsonFunc);
}

// Универсальный восстановитель значений математических типов
export function restoreDataType(data) {
  if (!data || typeof data !== 'object') return data;

  // Ищем функцию восстановления по безопасной строке dataType
  const loader = DATA_TYPE_STRING_LOOKUP.get(data.dataType);
  if (!loader) {
    throw new Error(`[Data] Неизвестный тип данных для восстановления: "${data.dataType}"`);
  }

  return loader(data);
}
