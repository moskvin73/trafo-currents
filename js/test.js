import BoolValue from './math/BoolValue.js';
import RealNumber from './math/RealNumber.js';
import ComplexNumber from './math/ComplexNumber.js';
import Matrix from './math/Matrix.js';
import { restoreDataType, debugRegistry } from './DataTypeRegistry.js';

export function test(data) {
    console.log("=== Старт тестирования сериализации ===");

    console.log("Зарегистрированные типы:", debugRegistry());

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
