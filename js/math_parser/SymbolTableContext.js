import { COMPILER_REGISTRY, getCommandInfo } from './MathRegistry.js';
import { COMPLEX_FORMAT, ANGLE_MODE } from './ConstantsDef.js';
import { restoreDataType } from '../DataTypeRegistry.js';


export const SYM_UNDEFINED = 0; // Идентификатор объявлен, но значения еще нет
export const SYM_VARIABLE  = 1; // Обычная переменная (число, комплексное)
export const SYM_BUILTIN   = 2; // Встроенная системная функция (sin, cos)

export class SymbolTableContext {
  #listenersAddVarable;
  #listenersDeleteVarable;
  #listenersUpdateSettings;
  #loading;
  #resolveReferencesLlist;

  constructor() {
    this.#resolveReferencesLlist = [];
    const state_settings = {
      complexFormat: COMPLEX_FORMAT.ALGEBRAIC,
      angleMode:     ANGLE_MODE.RADIANS,
      precision:     4,
      matrixFormat: 'bmatrix', // 'bmatrix', 'pmatrix', 'matrix'
      max_count_report: 100
    };
    const update_format = (name, value) => {
      this.#invokeUpdateSettings(name, value);
    };
    this.settings = {
      get complexFormat() { return state_settings.complexFormat; },
      set complexFormat(v) {
          state_settings.complexFormat =  v;
          update_format('complexFormat', v);
      },
      get angleMode() { return state_settings.angleMode; },
      set angleMode(v) {
        state_settings.angleMode = v;
        update_format('angleMode', v);
      },
      get precision() { return state_settings.precision; },
      set precision(v) {
        state_settings.precision = v;
        update_format('precision', v);
      },
      get matrixFormat() { return state_settings.matrixFormat; },
      set matrixFormat(v) {
        state_settings.matrixFormat = v;
        update_format('matrixFormat', v);
      },
      get max_count_report() { return state_settings.max_count_report; },
      set max_count_report(v) {
        state_settings.max_count_report = v;
        update_format('max_count_report', v);
      }
    };

    this.#listenersAddVarable = new Set();
    this.#listenersDeleteVarable = new Set();
    this.#listenersUpdateSettings = new Set();

    // Статическая часть
    this.fixedNames = Array.from(COMPILER_REGISTRY.keys());
    this.CD = this.fixedNames.length;
    // Массив свойств встроенных функций
    this.fixedSymbols = new Array(this.CD);
    // Быстрый хэш без прототипов для парсера
    this.fixedHash = Object.create(null);

    const instance = this;

    for (let i = 0; i < this.CD; i++) {
      const name = this.fixedNames[i];
      const data = getCommandInfo(name);
      const overloads = data.overloads; // COMPILER_REGISTRY.get(name);
      const description = data.description;

      this.fixedSymbols[i] = {
        get type() { return SYM_BUILTIN; },
        get value() {  return overloads; },
        set value(val) {
          throw new Error(`Идентификатор "${name}" является зарезервированным.`);
        },
        get description() { return description; },
        get context() { return instance; },
        get name() { return name; }
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
    this.#loading = true;     
  }

  get loading() { return this.#loading; }

  #invokeAddVarable(...args) { this.#listenersAddVarable.forEach(callback => callback(...args)); }
  subscribeAddVarable(callback) {
   if (typeof callback === 'function') {
      this.#listenersAddVarable.add(callback);
    }    
  }
  unsubscribeAddVarable(callback) { this.#listenersAddVarable.delete(callback); }
  subscribeDeleteVarable(callback) {
   if (typeof callback === 'function') {
      this.#listenersDeleteVarable.add(callback);
    }    
  }
  unsubscribeDeleteVarable(callback) { this.#listenersDeleteVarable.delete(callback); }
  #invokeDeleteVarable(...args) { this.#listenersDeleteVarable.forEach(callback => callback(...args)); }
  subscribeUpdateSettings(callback) {
   if (typeof callback === 'function') {
      this.#listenersUpdateSettings.add(callback);
    }    
  }
  unsubscribeDeleteVarable(callback) { this.#listenersUpdateSettings.delete(callback); }
  #invokeUpdateSettings(...args) { this.#listenersUpdateSettings.forEach(callback => callback(...args)); }

  #initVarable(name = null) {
      const state = { type: SYM_UNDEFINED, value: 0 };
      const instance = this;
      const listenersUpdateVarable = new Set();
      const invoke = (sym) => { listenersUpdateVarable.forEach(callback => callback(sym)); };
      return {
        get type() { return state.type; },
        get value() { return state.value; },
        get context() { return instance; },
        get name() { return name; },
        subscribeUpdateVarable(callback) {
          if (typeof callback === 'function') {
              listenersUpdateVarable.add(callback);
          }    
        },      
        unsubscribeUpdateVarable(callback) { listenersUpdateVarable.delete(callback); },
        set value(v) { 
          state.value = v; 
          state.type = SYM_VARIABLE;
          invoke(this);
        },
      };   
  }

  /** Создает новый локальный кадр (Scope) при вызове функции */
  createFrame(count_vars, outerFrame = null) {
    const frame = {
      symbols: [],               
      outer: outerFrame 
    };
    while(count_vars-- > 0) frame.symbols.push(this.#initVarable());
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

  get localScope() {
    return this.scopes.length > 0;
  }

  is_define(id) {
    return id >= 0 && id < this.CD;
  }

  is_global(id) {
    return id >= this.CD && id < this.LOCAL_MARKER;
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
      
      const localSymbol = this.#initVarable(name);

      const newLocalIdx = currentScope.symbols.length;
      currentScope.names.push(name);
      currentScope.symbols.push(localSymbol);
      currentScope.hash[name] = newLocalIdx;

      const newLocalId = this.LOCAL_MARKER + (0 << 16) + newLocalIdx;      
      this.#invokeAddVarable(this, newLocalId);
      return newLocalId;
    }    

    // Системные предопределенные функции
    const fixedIdx = this.fixedHash[name];
    if (fixedIdx !== undefined) {
      return fixedIdx; // Индекс в диапазоне [0 ... CD-1]
    }

    const varIdx = this.varHash[name];
    if (varIdx !== undefined) {
      return varIdx + this.CD; // Возвращаем существующий глобальный ID со смещением
    }
    
    const userSymbol = this.#initVarable(name);

    const newVarIdx = this.varSymbols.length;
    this.varNames.push(name);
    this.varSymbols.push(userSymbol);
    this.varHash[name] = newVarIdx;

    const newGlobalId = newVarIdx + this.CD;
    this.#invokeAddVarable(this, newGlobalId);
    return newGlobalId;
  }

  getNameById(id) {
    if (id >= this.LOCAL_MARKER) {
      const payload = id - this.LOCAL_MARKER;
      const delta = payload >> 16;       
      const localIdx = payload & 0xFFFF;
      const currentScopeIdx = this.scopes.length - delta - 1;
      if (currentScopeIdx >= 0) {
        const scope_names = this.scopes[currentScopeIdx].names;
        if (localIdx < scope_names.length)
          return scope_names[localIdx];
      }
      throw new Error(`Внутренняя ошибка: Область видимости потеряна при декодировании ID: ${id}`);
    }
    if (id >= this.CD) {
      const globalIdx = id - this.CD;
      return this.varNames[globalIdx];
    }

    // В) Системная встроенная функция
    if (id >= 0 && id < this.CD) {
      return this.fixedNames[id];
    }
    return null;
  }

  /**
   * ВЫЗЫВАЕТСЯ НА ЭТАПЕ ПАРСИНГА.
   * Находит существующий ID.
   * Нужен парсеру, чтобы просто проверить, существует ли уже такой идентификатор.
   * @param {string} name - Имя для поиска
   * @returns {number|null} ID символа или null, если не найден
   */
  getIdByName(name) {
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

      const fixedIdx = this.fixedHash[name];
      if (fixedIdx !== undefined) return fixedIdx;
    }
    else
    {
      const fixedIdx = this.fixedHash[name];
      if (fixedIdx !== undefined) return fixedIdx;

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
        const scope_sym = this.scopes[currentScopeIdx].symbols;
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

    return undefined;
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

  // МЕТОДЫ СЕРИАЛИЗАЦИИ и ДЕСЕРИАЛИЗАЦИИ

  serializeGlobalContext() {
    return JSON.stringify({
      // Сохраняем имена переменных
      varNames: this.varNames,
      // Сохраняем их состояния. JS автоматически вызовет геттеры объектов символов!
      varSymbols: this.varSymbols 
    });
  }

  deserializeGlobalContext(jsonString) {
    if (!jsonString) return;

    this.#loading = false;
    const data = JSON.parse(jsonString);
    
    
    // 1. Сбрасываем текущее глобальное состояние
    this.varNames = data.varNames;
    this.varSymbols = [];
    this.varHash = Object.create(null);

    // 2. Восстанавливаем каждую переменную
    for (let i = 0; i < data.varNames.length; i++) {
      const name = data.varNames[i];
      const savedSymbol = data.varSymbols[i];
      const context = this;
      const codeWithContext = { ...savedSymbol.value, context };

      // Восстанавливаем значение переменной (число 0 или сложный MathType)
      const restoredValue = restoreDataType(codeWithContext);

      // Воссоздаем реактивное замыкание (state) с геттерами и сеттерами
      const state = { 
        type: savedSymbol.type, 
        value: restoredValue 
      };

      const listenersUpdateVarable = new Set();
      const invoke = (sym) => { listenersUpdateVarable.forEach(callback => callback(sym)); };
      const reactiveSymbol = {
        get type() { return state.type; },
        get value() { return state.value; },
        get context() { return context; },
        get name() { return savedSymbol.name; },
        subscribeUpdateVarable(callback) {
          if (typeof callback === 'function') {
              listenersUpdateVarable.add(callback);
          }    
        },      
        unsubscribeUpdateVarable(callback) { listenersUpdateVarable.delete(callback); },
        set value(v) { 
          state.value = v; 
          state.type = SYM_VARIABLE;
          invoke(this);
        },
      };

      // 3. Заполняем таблицы контекста
      this.varSymbols.push(reactiveSymbol);
      this.varHash[name] = i;
    }
    this.#loading = true;
    for (const action of this.#resolveReferencesLlist) {
      const realObject = getParseSymbolById(action.id);
      if (realObject) {
        if (action.callback) action.callback(realObject);
      }
      else console.error(`Не удалось найти объект с ID: ${action.id}`);
    }
  }

  static dataToJSON(sym) {
    const descContext = sym ? Object.getOwnPropertyDescriptor(sym, 'context') : null;
    const descName = sym ? Object.getOwnPropertyDescriptor(sym, 'name') : null;
    const descValue = sym ? Object.getOwnPropertyDescriptor(sym, 'value') : null;
    const descType = sym ? Object.getOwnPropertyDescriptor(sym, 'type') : null;
    if (descContext && typeof descContext.get === 'function' && 
        descName && typeof descName.get === 'function' &&
        descValue && typeof descValue.get === 'function' &&
        descType && typeof descType.get === 'function') {
      const context = sym.context;
      if (context instanceof SymbolTableContext) {
        const id = context.getIdByName(sym.name);
        if (id === null) {
          return {
            present_in_contex: true,
            id_name: id
          };
        }
      }
      else if (context === null) {
        return {
           present_in_contex: false,
           type: sym.type,
           value: sym.value,
           name: sym.name,
        };
      }
    }
    else throw new Error("Неверный тип элимента смвола static dataToJSON(sym)");
  }

  dataFromJSON(data) {
    const listenersUpdateVarable = new Set();
    const invoke = (sym) => { listenersUpdateVarable.forEach(callback => callback(sym)); };
    const create_sybol = (state, insance, name) => {
      return {
        get type() { return state.type; },
        get value() { return state.value; },
        get context() { return insance; },
        get name() { return name; },
        subscribeUpdateVarable(callback) {
          if (typeof callback === 'function') {
              listenersUpdateVarable.add(callback);
          }    
        },      
        unsubscribeUpdateVarable(callback) { listenersUpdateVarable.delete(callback); },
        set value(v) { 
          state.value = v; 
          state.type = SYM_VARIABLE;
          invoke(this);
        },
      };
    };
    if (data.present_in_contex) {
      if (!loading) {
          const state = { type: SYM_UNDEFINED, value: 0 };
          const ref_data = { proxyPlaceholder: create_sybol(state, null, null),  id: data.id, callback: null }; 
          this.#resolveReferencesLlist.push(ref_data);
          return ref_data;
      } else        
        return context.getParseSymbolById(data.id);
    } else {
      const state = { 
        type: data.type, 
        value: restoreDataType(data.value);
      };
      return create_sybol(state, null, data.name);
    }
  }
}