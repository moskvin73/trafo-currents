import BoolValue from './math/BoolValue.js';
import RealNumber from './math/RealNumber.js';
import ComplexNumber from './math/ComplexNumber.js';
import Matrix from './math/Matrix.js';
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
  ConstantNode } from './math_parser/ASTNodes.js';

// Реестр типов данных
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

export function test(data) {
    console.log("=== Старт тестирования сериализации ===");

  try {
    // 1. Создаем сложную вложенную матрицу
    const subMatrix = new Matrix([
      [new BoolValue(true), new BoolValue(false)]
    ]);
    const rootMatrix = new Matrix([
      [new BoolValue(true), subMatrix]
    ]);

    // 2. Тестируем СЕРИАЛИЗАЦИЮ
    const jsonString = JSON.stringify(rootMatrix);
    console.log("1. Сгенерированный JSON для LocalStorage:\n", jsonString);

    // 3. Тестируем ДЕСЕРИАЛИЗАЦИЮ
    const rawData = JSON.parse(jsonString);
    const restored = restoreDataType(rawData);

    console.log("2. Объект успешно восстановлен?", restored instanceof Matrix);
    console.log("3. Проверка TeX вложенной матрицы:", restored.rows[0][1].toTeX());

  } catch (error) {
    console.error("Критическая ошибка в тесте:", error);
  }    
}
