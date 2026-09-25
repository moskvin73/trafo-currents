const POWERS_OF_10 = [
  1,           // 10^0
  10,          // 10^1
  100,         // 10^2
  1000,        // 10^3
  10000,       // 10^4
  100000,      // 10^5
  1000000,     // 10^6
  10000000,    // 10^7
  100000000,   // 10^8
  1000000000,  // 10^9
  10000000000, // 10^10
  100000000000,
  1000000000000,
  10000000000000,
  100000000000000,
  1000000000000000,
  10000000000000000,
  100000000000000000,
  1000000000000000000,
  10000000000000000000,
  100000000000000000000 // 10^20
];

export function roundNumber(value, decimals = 0) {
  // 1. Защита от NaN и бесконечностей самого числа
  if (!Number.isFinite(value)) return value;

  // 2. Защита от дробных чисел: отсекаем дробную часть у параметра decimals.
  // Битовый оператор `~~` работает как Math.trunc, но делает это мгновенно на уровне процессора.
  // Он превратит 2.5 в 2, а -1.2 в -1.
  let cleanDecimals = ~~decimals;

  // 3. Строгое ограничение диапазона индексов для нашей таблицы степеней
  if (cleanDecimals < 0) cleanDecimals = 0;
  if (cleanDecimals > 20) cleanDecimals = 20;

  // 4. Мгновенное извлечение коэффициента из таблицы степеней
  const factor = POWERS_OF_10[cleanDecimals];

  // 5. Точное математическое округление
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export class IndexedMap {
  #map = new Map();  // Связь: Ключ -> Индекс
  #store = [];       // Список контейнеров { key, value }

  // Добавление / Обновление. Возвращает индекс.
  set(key, value) {
    if (this.#map.has(key)) {
      const index = this.#map.get(key);
      this.#store[index].value = value; // Обновили значение
      return index;
    }

    const newIndex = this.#store.length;
    this.#store.push({ key, value });  // Сохраняем и ключ, и значение
    this.#map.set(key, newIndex);
    return newIndex;
  }

  // Получить ИМЯ (ключ) по индексу — O(1)
  getKeyByIndex(index) {
    return this.#store[index]?.key;
  }

  // Получить ЗНАЧЕНИЕ по индексу — O(1)
  getValueByIndex(index) {
    return this.#store[index]?.value;
  }

  // Получить ЗНАЧЕНИЕ по имени (ключу) — O(1)
  get(key) {
    const index = this.#map.get(key);
    return index !== undefined ? this.#store[index].value : undefined;
  }

  // Проверить наличие по имени — O(1)
  has(key) {
    return this.#map.has(key);
  }

  // Полная очистка структуры — O(1)
  clear() {
    this.#map.clear();
    this.#store.length = 0; // Самая быстрая очистка массива
  }
  
  get size() {
    return this.#store.length;
  }  
}

export class Stack {
  #items = []; // Приватное свойство, чтобы никто не мог изменить массив напрямую

  // Добавить элемент в стек
  push(element) {
    this.#items.push(element);
  }

  // Удалить и вернуть элемент со стекa (с проверкой)
  pop() {
    if (this.isEmpty()) {
      throw new Error("Стек пуст! Невозможно выполнить pop().");
    }
    return this.#items.pop();
  }

  // Посмотреть верхний элемент без удаления
  peek() {
    if (this.isEmpty()) return undefined;
    return this.#items[this.#items.length - 1];
  }

  // Проверить, пуст ли стек
  isEmpty() {
    return this.#items.length === 0;
  }

  get length() { return this.#items.length; }

  // Очистить стек
  clear() {
    this.#items = [];
  }

  reverse() { this.#items.reverse(); return this; }
}

/**
 * Двухрежимная структура данных (словарь), предназначенная для хранения 
 * пар ключ-значение с автоматическим разделением типов ключей.
 * 
 * Использует `Map` для примитивных ключей (строки, числа, символы) и 
 * `WeakMap` для ссылочных типов (объекты, массивы, функции), предотвращая 
 * утечки памяти и позволяя сборщику мусора удалять неиспользуемые объекты.
 */
export class DualDictionary {
  /** 
   * Хранилище для примитивных ключей.
   * @type {Map<any, any>} 
   * @private
   */
  #indexMap;

   /** 
   * Хранилище для объектных ключей с поддержкой автоматической сборки мусора.
   * @type {WeakMap<object, any>} 
   * @private
   */ 
  #objectMap;

   /**
   * Создает пустой экземпляр DualDictionary.
   */
    constructor() {
    // Для простых индексов (строки, числа)
    this.#indexMap = new Map();
    // Для экземпляров классов (объектов)
    this.#objectMap = new WeakMap();
  }

  /**
   * Проверяет, является ли переданный ключ объектом или функцией.
   * 
   * @param {*} key - Проверяемый ключ.
   * @returns {boolean} `true`, если ключ является ссылочным типом данных, иначе `false`.
   * @private
   */
   #isObject(key) {
    return key !== null && (typeof key === 'object' || typeof key === 'function');
  }

  has(key) {
    if (this.#isObject(key)) {
      this.#objectMap.has(key);
    } else {
      this.#indexMap.has(key);
    }
  }

  /**
   * Добавляет новый элемент или обновляет существующий по указанному ключу.
   * 
   * @param {*} key - Ключ элемента. Может быть как примитивом, так и объектом/функцией.
   * @param {*} value - Сохраняемое значение любого типа.
   * @returns {void}
   */
  set(key, value) {
    if (this.#isObject(key)) {
      this.#objectMap.set(key, value);
    } else {
      this.#indexMap.set(key, value);
    }
  }

  /**
   * Извлекает значение, связанное с ключом.
   * 
   * @param {*} key - Ключ для поиска.
   * @returns {*|null} Возвращает сохраненное значение, либо `null`, если ключ не найден.
   */
  get(key) {
    if (this.#isObject(key)) {
      const result = this.#objectMap.get(key);
      return result !== undefined ? result : null;
    } else {
      const result = this.#indexMap.get(key);
      return result !== undefined ? result : null;
    }
  }

  /**
   * Удаляет элемент по его ключу.
   * 
   * @param {*} key - Ключ удаляемого элемента.
   * @returns {boolean} `true`, если элемент успешно найден и удален; `false`, если элемент отсутствовал.
   */
  delete(key) {
    if (this.#isObject(key)) {
      return this.#objectMap.delete(key);
    } else {
      return this.#indexMap.delete(key);
    }
  }

  /**
   * Полностью очищает словарь, удаляя все сохраненные пары ключ-значение.
   * 
   * @returns {void}
   */
  clear() {
    // Map очищается стандартным методом
    this.#indexMap.clear();
    
    // WeakMap не имеет метода .clear() из-за особенностей сборки мусора.
    // Чтобы очистить его, мы просто пересоздаем экземпляр.
    this.#objectMap = new WeakMap();
  }
}