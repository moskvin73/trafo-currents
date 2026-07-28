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
