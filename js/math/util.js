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
  #map = new Map();  // Имя -> Индекс в массиве
  #store = [];       // Массив, где хранятся сами данные

  // 1. ДОБАВЛЕНИЕ (Возвращает полученный индекс) — O(1)
  add(name, data) {
    // Если имя уже есть, пушим в существующий массив данных
    if (this.#map.has(name)) {
      const index = this.#map.get(name);
      this.#store[index].values.push(data);
      return index; // Возвращаем тот же индекс
    }

    // Если имени нет, создаем новую запись
    const newIndex = this.#store.length;
    this.#store.push({ name, values: [data] });
    this.#map.set(name, newIndex);
    
    return newIndex; // Возвращаем сгенерированный индекс
  }

  // 2. БЫСТРЫЙ ПОИСК ПО ИМЕНИ — O(1)
  getByName(name) {
    const index = this.#map.get(name);
    if (index === undefined) return undefined;
    return this.#store[index].values; // Возвращает массив элементов
  }

  // 3. БЫСТРЫЙ ПОИСК ПО ИНДЕКСУ — O(1)
  getByIndex(index) {
    if (index < 0 || index >= this.#store.length) return undefined;
    return this.#store[index]; // Возвращает { name, values: [...] }
  }

  // 4. МГНОВЕННАЯ ОЧИСТКА — O(1)
  clear() {
    this.#map.clear();
    this.#store.length = 0; // Используем самый быстрый способ очистки массива
  }

  // Геттер для получения общего количества уникальных имен
  get size() {
    return this.#map.size;
  }
}