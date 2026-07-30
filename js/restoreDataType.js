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

  
