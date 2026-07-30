const DATA_TYPE_STRING_LOOKUP = new Map();

/**
 * Метод для саморегистрации классов
 * @param {string} dataTypeName - Строковое имя типа (например, "Matrix")
 * @param {Function} fromJsonFunc - Функция восстановления
 */
export function registerDataType(dataTypeName, fromJsonFunc) {
  DATA_TYPE_STRING_LOOKUP.set(dataTypeName, fromJsonFunc);
}

/**
 * Универсальный восстановитель
*/
export function restoreDataType(data) {
  if (!data || typeof data !== 'object') return data;

  // Ищем функцию восстановления по безопасной строке dataType
  const loader = DATA_TYPE_STRING_LOOKUP.get(data.dataType);
  if (!loader) {
    throw new Error(`[Data] Неизвестный тип данных для восстановления: "${data.dataType}"`);
  }

  return loader(data);
}

// Вспомогательный метод для отладки — покажет, кто зарегистрирован
export function debugRegistry() {
  return Array.from(DATA_TYPE_STRING_LOOKUP.keys());
}
