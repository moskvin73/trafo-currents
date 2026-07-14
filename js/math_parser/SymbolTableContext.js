export const SYM_UNDEFINED = 0; // Идентификатор объявлен, но значения еще нет
export const SYM_VARIABLE  = 1; // Обычная переменная (число, комплексное)
export const SYM_BUILTIN   = 2; // Встроенная системная функция (sin, cos)

export class SymbolTableContext {
  constructor() {
    this.settings = {
      complexFormat: 'algebraic',
      angleMode: 'radians',
      precision: 4
    };

    // Статическая часть
    this.fixedNames = ['sin', 'cos', 'tan', 'sqrt', 'log', 'print'];
    this.fixedSymbols = [
      { type: SYM_BUILTIN, value: (x) => Math.sin(x) },
      { type: SYM_BUILTIN, value: (x) => Math.cos(x) },
      { type: SYM_BUILTIN, value: (x) => Math.tan(x) },
      { type: SYM_BUILTIN, value: (x) => Math.sqrt(x) },
      { type: SYM_BUILTIN, value: (x) => Math.log(x) },
      { type: SYM_BUILTIN, value: (...args) => console.log(...args) }
    ];
    this.CD = this.fixedSymbols.length;

    // ЧЕСТНЫЙ ХЭШ БЕЗ ПРОТОТИПОВ (Скорость упирается в железо)
    this.fixedHash = Object.create(null);
    for (let i = 0; i < this.CD; i++) {
      this.fixedHash[this.fixedNames[i]] = i;
    }

    // Динамическая часть пользователя
    this.varNames = [];
    this.varSymbols = [];
    // Тоже очищаем от прототипов, чтобы x = "toString" не ломал рантайм
    this.varHash = Object.create(null); 
  }

  /**
   * Находит существующий ID или регистрирует новый.
   * Честная сложность O(1), полностью защищенная от системных имен JS.
   */
  acquireId(name) {
    // 1. Ищем в предопределенной части через быстрое сравнение с undefined
    const fixedIdx = this.fixedHash[name];
    if (fixedIdx !== undefined) {
      return fixedIdx; // Возвращаем чистый индекс [0 ... CD-1]
    }

    // 2. Ищем в вариативной части пользователя
    const varIdx = this.varHash[name];
    if (varIdx !== undefined) {
      return varIdx + this.CD; // Возвращаем индекс со смещением CD
    }

    // 3. Если имени нет — регистрируем как новую неопределенную переменную
    const newVarIdx = this.varNames.length;
    this.varNames.push(name);
    this.varSymbols.push({ type: SYM_UNDEFINED, value: 0 });
    this.varHash[name] = newVarIdx;

    return newVarIdx + this.CD; // Возвращаем новый ID со смещением CD
  }
  
  // ============================================================================
  // СИНХРОНИЗАЦИЯ С LOCALSTORAGE (Ультра-компактный формат)
  // ============================================================================

  /**
   * Сериализует только вариативную часть пользователя в виде плоских массивов.
   * На выходе чистый JSON, который весит в 3 раза меньше стандартного.
   */
  serialize() {
    const len = this.varSymbols.length;
    const types = new Int32Array(len);
    const values = new Array(len);

    for (let i = 0; i < len; i++) {
      types[i] = this.varSymbols[i].type;
      values[i] = this.varSymbols[i].value;
    }

    return {
      settings: this.settings,
      names: this.varNames,
      types: Array.from(types), // Переводим в обычный массив для JSON
      values: values
    };
  }

  /**
   * Восстанавливает контекст и мгновенно перестраивает быстрый varHash
   */
  deserialize(jsonData) {
    if (!jsonData) return;

    if (jsonData.settings) {
      Object.assign(this.settings, jsonData.settings);
    }

    if (jsonData.names && jsonData.types && jsonData.values) {
      this.varNames = jsonData.names;
      const len = this.varNames.length;
      
      this.varSymbols = new Array(len);
      this.varHash = Object.create(null); // Инициализируем чистый хэш

      for (let i = 0; i < len; i++) {
        // Собираем объект свойства обратно в память рантайма
        this.varSymbols[i] = {
          type: jsonData.types[i],
          value: jsonData.values[i]
        };
        // Мгновенно восстанавливаем хэш-карту для поиска по имени
        this.varHash[this.varNames[i]] = i;
      }
    }
}