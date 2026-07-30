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

export function test(data) {
    console.log("=== Старт тестирования сериализации ===");

  try {
    // 1. Создаем сложную вложенную матрицу
    const subMatrix = new Matrix([
      [new BoolValue(true), new BoolValue(false)]
    ]);
    const rootMatrix = new Matrix([
      [new BoolValue(true), subMatrix]
    ]);

    // 2. Тестируем СЕРИАЛИЗАЦИЮ
    const jsonString = JSON.stringify(rootMatrix);
    console.log("1. Сгенерированный JSON для LocalStorage:\n", jsonString);

    // 3. Тестируем ДЕСЕРИАЛИЗАЦИЮ
    const rawData = JSON.parse(jsonString);
    const restored = restoreDataType(rawData);

    console.log("2. Объект успешно восстановлен?", restored instanceof Matrix);
    console.log("3. Проверка TeX вложенной матрицы:", restored.rows[0][1].toTeX());

  } catch (error) {
    console.error("Критическая ошибка в тесте:", error);
  }    
}
