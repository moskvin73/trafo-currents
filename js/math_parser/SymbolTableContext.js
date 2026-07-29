import { COMPILER_REGISTRY } from './MathRegistry.js';
import { COMPLEX_FORMAT, ANGLE_MODE } from './ConstantsDef.js';


export const SYM_UNDEFINED = 0; // Идентификатор объявлен, но значения еще нет
export const SYM_VARIABLE  = 1; // Обычная переменная (число, комплексное)
export const SYM_BUILTIN   = 2; // Встроенная системная функция (sin, cos)

export class SymbolTableContext {
  constructor() {
    this.settings = {
      complexFormat: COMPLEX_FORMAT.ALGEBRAIC,
      angleMode:     ANGLE_MODE.RADIANS,
      precision:     4,
      matrixFormat: 'bmatrix', // 'bmatrix', 'pmatrix', 'matrix'
    };

    // Статическая часть
    this.fixedNames = Array.from(COMPILER_REGISTRY.keys());
    this.CD = this.fixedNames.length;
    // Массив свойств встроенных функций
    this.fixedSymbols = new Array(this.CD);
    // Быстрый хэш без прототипов для парсера
    this.fixedHash = Object.create(null);

    for (let i = 0; i < this.CD; i++) {
      const name = this.fixedNames[i];
      const overloads = COMPILER_REGISTRY.get(name);

      this.fixedSymbols[i] = {
        get type() { return SYM_BUILTIN; },
        set type(t) {
          throw new Error(`Идентификатор "${name}" является зарезервированным.`);
        },
        get value() { 
          return overloads; 
        },
        set value(val) {
          throw new Error(`Идентификатор "${name}" является зарезервированным.`);
        }
      };

      this.fixedHash[name] = i; // Связываем имя с числовым ID
    }
 
    // Динамическая часть пользователя (Глобальный scope прямого кода)
    this.varNames = [];
    this.varSymbols = [];
    // Тоже очищаем от прототипов, чтобы x = "toString" не ломал рантайм
    this.varHash = Object.create(null);

    // --- СТЕК ЛОКАЛЬНЫХ ОБЛАСТЕЙ ВИДИМОСТИ ---
    // Каждый элемент стека — это объект { hash: Object.create(null), names: [], symbols: [] }
    this.scopes = []; 
    // Смещение для локальных ID, чтобы они никогда не пересекались с глобальными.
    // Локальный ID = LOCAL_MARKER + (инндекс_слоя << 16) + индекс_переменной_в_слое
    this.LOCAL_MARKER = 1000000;     
  }


  static #initVarable() {
      const state = { type: SYM_UNDEFINED, value: 0 };
      return {
        get type() { return state.type; },
        set type(t) { state.type = t; },
        get value() { return state.value; },
        set value(v) { state.value = v; state.type = SYM_VARIABLE; }
      };   
  }

  /** Создает новый локальный кадр (Scope) при вызове функции */
  createFrame(count_vars, outerFrame = null) {
    const frame = {
      symbols: [],               
      outer: outerFrame 
    };
    while(count_vars-- > 0)  frame.symbols.push(SymbolTableContext.#initVarable());
    return frame;
  }

  /** Фаза парсинга: вход в новую функцию */
  enterScope() {
    this.scopes.push({
      hash: Object.create(null),
      names: [],
      symbols: []
    });
  }

  /** Фаза парсинга: выход из функции */
  exitScope() {
    if (this.scopes.length === 0) {
      throw new Error("Внутренняя ошибка: Попытка удалить корневой Scope.");
    }
    this.scopes.pop();
  }

  get currentScope() {
    const len = this.scopes.length;
    return len > 0 ? this.scopes[len - 1] : null;
  }

  /**
   * ВЫЗЫВАЕТСЯ НА ЭТАПЕ ПАРСИНГА.
   * Находит существующий ID или регистрирует новый.
   * Запрещает глобальный пользовательский контекст внутри функций.
   */
  acquireId(name, def = false) {
    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError(`Внутренняя ошибка: Идентификатор должен быть непустой строкой.`);
    }

    // 1. Системные предопределенные функции (Доступны ВСЕГДА и везде)
    const fixedIdx = this.fixedHash[name];
    if (fixedIdx !== undefined) {
      return fixedIdx; // Индекс в диапазоне [0 ... CD-1]
    }

    // 2. РЕЖИМ 1: Мы внутри ФУНКЦИИ (scopes не пустой) -> Полная изоляция от глобального кода!
    if (this.scopes.length > 0) {
      const currentScopeIdx = this.scopes.length - 1;

      if (def)
      {
        const scope = this.scopes[currentScopeIdx];
        const localIdx = scope.hash[name];
        if (localIdx !== undefined) {
          return this.LOCAL_MARKER + (0 << 16) + localIdx;
        }
      }
      // Ищем вверх по цепочке функций (Паскаль-стиль для вложенных функций)
      else for (let i = currentScopeIdx; i >= 0; i--) {
        const scope = this.scopes[i];
        const localIdx = scope.hash[name];
        
        if (localIdx !== undefined) {
          const delta = currentScopeIdx - i;
          return this.LOCAL_MARKER + (delta << 16) + localIdx;
        }
      }

      // Если в цепочке функций переменная не найдена, создаем новую ЛОКАЛЬНУЮ переменную
      const currentScope = this.scopes[currentScopeIdx];
      
      const localSymbol = SymbolTableContext.#initVarable();

      const newLocalIdx = currentScope.symbols.length;
      currentScope.names.push(name);
      currentScope.symbols.push(localSymbol);
      currentScope.hash[name] = newLocalIdx;

      const newLocalId = this.LOCAL_MARKER + (0 << 16) + newLocalIdx;
      return newLocalId;
    }    

    // 3. РЕЖИМ 2: Мы в ПРЯМОМ КОДЕ (scopes пустой) -> Свободно работаем с глобальным scope пользователя
    const varIdx = this.varHash[name];
    if (varIdx !== undefined) {
      return varIdx + this.CD; // Возвращаем существующий глобальный ID со смещением
    }
    
    const userSymbol = SymbolTableContext.#initVarable();

    const newVarIdx = this.varSymbols.length;
    this.varNames.push(name);
    this.varSymbols.push(userSymbol);
    this.varHash[name] = newVarIdx;

    const newGlobalId = newVarIdx + this.CD;
    return newGlobalId;
  }

  /**
   * ВЫЗЫВАЕТСЯ НА ЭТАПЕ ПАРСИНГА.
   * Находит существующий ID или регистрирует новый.
   * Нужен парсеру, чтобы просто проверить, существует ли уже такой идентификатор.
   * @param {string} name - Имя для поиска
   * @returns {number|null} ID символа или null, если не найден
   */
  getIdByName(name) {
    // 1. Ищем в фиксированной части
    const fixedIdx = this.fixedHash[name];
    if (fixedIdx !== undefined) return fixedIdx;

    if (this.scopes.length > 0) {
      const currentScopeIdx = this.scopes.length - 1;

      // Ищем вверх по цепочке функций (Паскаль-стиль для вложенных функций)
      for (let i = currentScopeIdx; i >= 0; i--) {
        const scope = this.scopes[i];
        const localIdx = scope.hash[name];
        
        if (localIdx !== undefined) {
          const delta = currentScopeIdx - i;
          return this.LOCAL_MARKER + (delta << 16) + localIdx;
        }
      }
    }
    else
    {
      // 2. Ищем в вариативной части
      const varIdx = this.varHash[name];
      if (varIdx !== undefined) return varIdx + this.CD;
    }

    return null; // Идентификатор вообще не зарегистрирован
  }

  getParseSymbolById(id) {

    if (id >= this.LOCAL_MARKER) {

      const payload = id - this.LOCAL_MARKER;
      const delta = payload >> 16;       
      const localIdx = payload & 0xFFFF;

      const currentScopeIdx = this.scopes.length - delta - 1;
      if (currentScopeIdx >= 0) {
        const scope_sym = this.scopes[tcurrentScopeIdx].symbols;
        if (localIdx < scope_sym.length)
          return scope_sym[localIdx];
      }
      throw new Error(`Внутренняя ошибка: Область видимости потеряна при декодировании ID: ${id}`);
    }

    if (id >= this.CD) {
      const globalIdx = id - this.CD;
      return this.varSymbols[globalIdx];
    }

    // В) Системная встроенная функция
    if (id >= 0 && id < this.CD) {
      return this.fixedSymbols[id];
    }

  }
  // ФУНКЦИИ ВЫПОЛНЕНИЯ

  /**
   * ВЫЗЫВАЕТСЯ НА ЭТАПЕ ВЫПОЛНЕНИЯ (РАНТАЙМ) — Сложность O(1).
   * Достает ячейку памяти (объект-символ) по числовому ID.
   */
  getSymbolById(id) {

    // А) Локальный ID (содержит delta и localIdx)
    if (id >= this.LOCAL_MARKER) {
      const payload = id - this.LOCAL_MARKER;
      const delta = payload >> 16;       // На сколько уровней вверх по лексической цепочке подняться
      const localIdx = payload & 0xFFFF; // Индекс переменной внутри целевого кадра

      // Начинаем поиск с самого верхнего (текущего) кадра в стеке вызовов
      let targetFrame = this.scopes[this.scopes.length - 1];

      // Честно шагаем вверх по ссылкам родительских кадров ровно delta раз!
      // Если delta = 0, мы останемся в текущем кадре. 
      // Если delta = 1, мы перейдем в targetFrame.outer (живой кадр функции-родителя)
      for (let i = 0; i < delta; i++) {
        if (targetFrame) {
          targetFrame = targetFrame.outer;
        }
      }

      if (!targetFrame) {
        throw new Error(`Внутренняя ошибка рантайма: Область видимости потеряна при декодировании ID: ${id}`);
      }

      return targetFrame.symbols[localIdx];
    }

    // Б) Глобальный ID пользователя
    if (id >= this.CD) {
      const globalIdx = id - this.CD;
      return this.varSymbols[globalIdx];
    }

    // В) Системная встроенная функция
    if (id >= 0 && id < this.CD) {
      return this.fixedSymbols[id];
    }

    return undefined;
  }
}