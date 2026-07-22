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
