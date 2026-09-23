import { COMPILER_REGISTRY, getCommandInfo } from './MathRegistry.js';
import { COMPLEX_FORMAT, ANGLE_MODE } from './ConstantsDef.js';
import { restoreDataType } from '../DataTypeRegistry.js';


export const SYM_UNDEFINED = 0; // Идентификатор объявлен, но значения еще нет
export const SYM_VARIABLE  = 1; // Обычная переменная (число, комплексное)
export const SYM_BUILTIN   = 2; // Встроенная системная функция (sin, cos)

export class SymbolTableContext {
  #listenersUpdateVarable;
  #state;
  #insance;
  #name;
  constructor(state, insance, name) {
    this.#listenersUpdateVarable = new Set();
    this.#state = state;
    this.#insance = insance;
    this.name = name;
  }

  #invoke(sym) {
   this.#listenersUpdateVarable.forEach(callback => callback(sym)); 
  }

  get type() { return this.#state.type; }

  get context() { return this.#insance; }

  get name() { return this.#name; }

  get value() { return this.#state.value; }

  set value(v) { 
    this.state.value = v; 
    this.state.type = SYM_VARIABLE;
    this.#invoke(this);
  }

  set context(newContext) {
    if (this.#insance.getIdByName(#name) === null) 
      this.insance = newContext;
    else throw new Error("Недопустимое изменение контекста символа таблицы идентификаторов"); 
  }
  
  subscribeUpdateVarable(callback) {
    if (typeof callback === 'function') {
        this.#listenersUpdateVarable.add(callback);
    }    
  }

  unsubscribeUpdateVarable(callback) { this.#listenersUpdateVarable.delete(callback); },

  toJSON() {
    return {
      type: this.type,
      value: this.value,
      name: this.name
    };
  }        
}

export class SymbolTableContext {
  #listenersAddVarable;
  #listenersDeleteVarable;
  #listenersUpdateSettings;
  #listenersIndexRenumbering;
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
          [state_settings.complexFormat, v] = [v, state_settings.complexFormat];
          update_format('complexFormat', v, state_settings.complexFormat);
      },
      get angleMode() { return state_settings.angleMode; },
      set angleMode(v) {
        [state_settings.angleMode, v] = [v, state_settings.angleMode];
        update_format('angleMode', v, state_settings.angleMode);
      },
      get precision() { return state_settings.precision; },
      set precision(v) {
        [state_settings.precision, v] = [v, state_settings.precision];
        update_format('precision', v, state_settings.precision);
      },
      get matrixFormat() { return state_settings.matrixFormat; },
      set matrixFormat(v) {
        [state_settings.matrixFormat, v] = [v, state_settings.matrixFormat];
        update_format('matrixFormat', v, state_settings.matrixFormat);
      },
      get max_count_report() { return state_settings.max_count_report; },
      set max_count_report(v) {
        [state_settings.max_count_report, v] = [v, state_settings.max_count_report];
        update_format('max_count_report', v, state_settings.max_count_report);
      }
    };

    this.#listenersAddVarable = new Set();
    this.#listenersDeleteVarable = new Set();
    this.#listenersUpdateSettings = new Set();
    this.#listenersIndexRenumbering = new Set();

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
        set value(_val) {
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

  // Происходит после добавления тип пременой SYM_UNDEFINED
  #invokeAddVarable(source, newIndex) { this.#listenersAddVarable.forEach(callback => callback(source, newIndex)); }
  subscribeAddVarable(callback) {
   if (typeof callback === 'function') {
      this.#listenersAddVarable.add(callback);
    }    
  }
  unsubscribeAddVarable(callback) { this.#listenersAddVarable.delete(callback); }

  // Происходит перед еренумерацией
  #invokeIndexRenumbering(source, lastIdx, newIndex) { this.#listenersIndexRenumbering.forEach(callback => callback(source, lastIdx, newIndex)); }
  subscribeIndexRenumbering(callback) {
   if (typeof callback === 'function') {
      this.#listenersIndexRenumbering.add(callback);
    }    
  }
  unsubscribeIndexRenumbering(callback) { this.#listenersIndexRenumbering.delete(callback); }

  // Происходит передудалеием
  #invokeDeleteVarable(source, delIndex) { this.#listenersDeleteVarable.forEach(callback => callback(source, delIndex)); }
  subscribeDeleteVarable(callback) {
   if (typeof callback === 'function') {
      this.#listenersDeleteVarable.add(callback);
    }    
  }
  unsubscribeDeleteVarable(callback) { this.#listenersDeleteVarable.delete(callback); }

  #invokeUpdateSettings(name, oldValue, newValue) { this.#listenersUpdateSettings.forEach(callback => callback(name, oldValue, newValue)); }
  subscribeUpdateSettings(callback) {
   if (typeof callback === 'function') {
      this.#listenersUpdateSettings.add(callback);
    }    
  }
  unsubscribeUpdateSettings(callback) { this.#listenersUpdateSettings.delete(callback); }

  static #defaultState() { return { type: SYM_UNDEFINED, value: 0 }; } 

  static #create_sybol(state, insance, name) {
    const listenersUpdateVarable = new Set();
    const invoke = (sym) => { listenersUpdateVarable.forEach(callback => callback(sym)); };
    return {
      get type() { return state.type; },
      get value() { return state.value; },
      get context() { return insance; },
      set context(newContext) {
        if (insance.getIdByName(name) === null) 
          insance = newContext;
        else throw new Error("Недопустимое изменение контекста символа таблицы идентификаторов"); 
      },
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
      toJSON() {
        return {
          type: this.type,
          value: this.value,
          name: this.name
        };
      }        
    }
  }

  #initVarable(name = null) {
      return SymbolTableContext.#create_sybol(SymbolTableContext.#defaultState(), this, name);
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

  #internalDeleteGlobalForId(varIdx) {
    const globalId = varIdx + this.CD;
    this.#invokeDeleteVarable(this, globalId);
    const sym_del = this.varSymbols[varIdx];
    const name = this.varNames[varIdx];
    const lastIdx = this.varSymbols.length - 1;
    // Если удаляемый элемент не последний, меняем его местами с последним
    if (varIdx < lastIdx) {
        this.#invokeIndexRenumbering(this, lastIdx + this.CD, globalId);
        const lastParamName = this.varNames[lastIdx];        
        // Переносим данные последнего элемента на место удаляемого
        this.varNames[varIdx] = this.varNames[lastIdx];
        this.varSymbols[varIdx] = this.varSymbols[lastIdx];        
        // Обновляем индекс бывшего последнего элемента в хэш-таблице
        this.varHash[lastParamName] = varIdx;
    }
    // Удаляем последний элемент из массивов (теперь там дубликат или удаляемый элемент)
    this.varNames.pop();
    this.varSymbols.pop();

    // Удаляем имя из хэш-таблицы
    delete this.varHash[name];
    sym_del.context = null;
  }

  deleteGlobalForId(varIdx) {
    const real_id = varIdx - this.CD;
    if (real_id >= 0 && real_id < this.varSymbols.length) { 
      this.#internalDeleteGlobalForId(real_id);
      return true;
    }
    return false;
  }

  deleteGlobalForName(name) {
    const varIdx = this.varHash[name];
    if (varIdx === undefined) return false;
    this.#internalDeleteGlobalForId(varIdx);
    return true;
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

      const reactiveSymbol = SymbolTableContext.#create_sybol(state, context, savedSymbol.name);

      // 3. Заполняем таблицы контекста
      this.varSymbols.push(reactiveSymbol);
      this.varHash[name] = i;
    }
    this.#loading = true;
    for (const action of this.#resolveReferencesLlist) {
      const realObject = this.getParseSymbolById(action.id);
      if (realObject) {
        if (action.callback) action.callback(realObject);
      }
      else console.error(`Не удалось найти объект с ID: ${action.id}`);
    }
    this.#resolveReferencesLlist = [];
  }

  static dataToJSON(sym) {
    //  Проверяем базовое наличие объекта и нужных свойств (включая прототип)
    const isValidSymbol = sym && 
      'context' in sym && 
      'name' in sym && 
      'value' in sym && 
      'type' in sym;

    if (!isValidSymbol) {
      throw new Error("Неверный тип элемента символа в static dataToJSON(sym)");
    }

    const { context, name, type, value } = sym;

    // Обработка символа с контекстом таблицы
    if (context instanceof SymbolTableContext) {
      const id = context.getIdByName(name);
      
      if (id !== null) {
        if (!context.is_global(id)) {
          throw new Error(`Попытка сериализовать локальную или предопределенную переменную: ${name}`);
        }
        
        return {
          present_in_context: true,
          id_name: id
        };
      }
    } 
    
    // бработка символа без контекста
    if (context === null) {
      return {
        present_in_context: false,
        type,
        value,
        name,
      };
    }

    // Если context не null и не относится к SymbolTableContext, либо id === null
    throw new Error("Неверный тип элемента символа в static dataToJSON(sym)");   
  }

  dataFromJSON(data) {
    if (data.present_in_contex) {
      if (!this.loading) {
          const ref_data = { 
            proxyPlaceholder: SymbolTableContext.#create_sybol(SymbolTableContext.#defaultState(), null, null),  
            id: data.id_name, 
            callback: null }; 
          this.#resolveReferencesLlist.push(ref_data);
          return ref_data;
      } else        
        return context.getParseSymbolById(data.id_name);
    } else {
      const state = { 
        type: data.type, 
        value: restoreDataType(data.value)
      };
      return SymbolTableContext.#create_sybol(state, null, data.name);
    }
  }
}