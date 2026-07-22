// AtomRegistry.js — Изолированный реестр уникальных сущностей
class AtomRegistry {
  constructor() {
    this.forwardMap = new Map(); // Object/String -> ID (-3, -4, ...)
    this.reverseMap = new Map(); // ID -> Object/String
    this.counter = -3;
  }

  // Получить или создать ID для символа или вложенной структуры
  getOrCreateId(key) {
    // Для вложенных таблиц ключом может служить их собственный хэш (строка/BigInt)
    const lookupKey = typeof key === 'object' && key.hash ? key.hash : key;
    
    if (this.forwardMap.has(lookupKey)) {
      return this.forwardMap.get(lookupKey);
    }
    
    const id = this.counter--;
    this.forwardMap.set(lookupKey, id);
    this.reverseMap.set(id, key);
    return id;
  }

  resolve(id) {
    return this.reverseMap.get(id);
  }
}

export const registry = new AtomRegistry();

export function createFunctionTable(type, argumentTable) {
  // 1. Проверяем, является ли аргумент константой
  if (argumentTable.monomials.size === 1 && argumentTable.monomials.has('constant')) {
    const constMonom = argumentTable.monomials.get('constant');
    
    // Если аргумент равен 0
    if (constMonom.coeff.isZero()) {
      if (type === 'sin') return createConstantTable(0n);
      if (type === 'cos') return createConstantTable(1n);
      if (type === 'ln') throw new Error("Математическая ошибка: ln(0)");
    }
  }

  // 2. Если это тригонометрия, проверяем знаки (вынос минуса)
  // sin(-x) -> -sin(x)
  if (type === 'sin' && isNegativeExpression(argumentTable)) {
    return createFunctionTable('sin', argumentTable.unaryMinus()).unaryMinus();
  }

  // 3. Если упростить аналитически нельзя, регистрируем как атомарную псевдо-переменную
  const atomId = registry.getOrCreateId({ type, argumentHash: argumentTable.hash, argumentTable });
  
  const funcTable = new PolynomialTable();
  funcTable.addMonomial(new RationalBigInt(1n, 1n), new Map([[atomId, 1]]));
  return funcTable;
}

function createConstantTable(value) {
  const t = new PolynomialTable();
  t.addMonomial(new RationalBigInt(BigInt(value), 1n), new Map());
  return t;
}