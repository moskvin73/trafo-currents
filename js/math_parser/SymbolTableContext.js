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
      matrixFormat: 'pmatrix', // 'bmatrix', 'pmatrix', 'matrix'
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
    // Валидация: имя должно быть строкой и не должно быть пустым
    if (typeof name !== 'string' || name.trim() === '') {
      throw new TypeError(`Внутренняя ошибка: Идентификатор должен быть непустой строкой. Получено: ${String(name)}`);
    }


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

    const state = {
      type: SYM_UNDEFINED,
      value: 0
    };

    const userSymbol = {
      get type() { return state.type; },
      set type(t) { state.type = t; },
      
      get value() { return state.value; },
      set value(v) {
        state.value = v;
        state.type = SYM_VARIABLE; // Авто-смена типа
      }
    };
    
    // 3. Если имени нет — регистрируем как новую неопределенную переменную
    const newVarIdx = this.varNames.length;
    this.varNames.push(name);
    this.varSymbols.push(userSymbol);
    this.varHash[name] = newVarIdx;

    return newVarIdx + this.CD; // Возвращаем новый ID со смещением CD
  }
  
  /**
   * Чистый поиск ID по имени БЕЗ автоматической регистрации новой переменной.
   * Нужен парсеру, чтобы просто проверить, существует ли уже такой идентификатор.
   * @param {string} name - Имя для поиска
   * @returns {number|null} ID символа или null, если не найден
   */
  getIdByName(name) {
    // 1. Ищем в фиксированной части
    const fixedIdx = this.fixedHash[name];
    if (fixedIdx !== undefined) return fixedIdx;

    // 2. Ищем в вариативной части
    const varIdx = this.varHash[name];
    if (varIdx !== undefined) return varIdx + this.CD;

    return null; // Идентификатор вообще не зарегистрирован
  }

  /**
   * Находит содержимое (свойства) символа напрямую по его текстовому имени.
   * @param {string} name - Имя для поиска
   * @returns {Object|null} Объект свойств символа ({type, value} или {type, overloads})
   */
  getSymbolByName(name) {
    const id = this.getIdByName(name);
    if (id !== null) {
      return this.getSymbolById(id); // Использует сверхбыстрый доступ по ID
    }
    return null;
  }

  // ============================================================================
  // ОБРАТНЫЙ ДОСТУП (ДЛЯ ДЕРЕВА И РАНТАЙМА): ID -> ИМЯ ИЛИ СОДЕРЖИМОЕ
  // ============================================================================

  /**
   * Возвращает текстовое имя идентификатора по его числовому ID за O(1).
   * @param {number} id - Числовой идентификатор
   * @returns {string} Имя переменной или функции
   */
  getNameById(id) {
    if (id < this.CD) {
      return this.fixedNames[id];
    }
    const varIdx = id - this.CD;
    if (varIdx >= this.varNames.length || varIdx < 0) {
      return `[Неизвестный ID: ${id}]`;
    }
    return this.varNames[varIdx];
  }

  /**
   * Возвращает всё содержимое (свойства), хранящееся под этим ID за O(1).
   * Подходит как для извлечения значения переменной, так и для получения массива overloads функций.
   * @param {number} id - Числовой идентификатор токена/символа
   * @returns {Object} Объект свойств ({type, value} для переменных или {type, overloads} для функций)
   */
  getSymbolById(id) {
    if (id < this.CD) {
      return this.fixedSymbols[id];
    }
    const varIdx = id - this.CD;
    if (varIdx >= this.varSymbols.length || varIdx < 0) {
      throw new Error(`Внутренняя ошибка рантайма: Выход за границы таблицы по ID ${id}`);
    }
    return this.varSymbols[varIdx];
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
}