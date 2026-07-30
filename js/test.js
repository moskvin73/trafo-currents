import BoolValue from './math/BoolValue.js';
import RealNumber from './math/RealNumber.js';
import ComplexNumber from './math/ComplexNumber.js';
import Matrix from './math/Matrix.js';
import { restoreDataType, debugRegistry } from './DataTypeRegistry.js';
import { SymbolTableContext } from './math_parser/SymbolTableContext.js';

export function test(data) {
    console.log("=== Старт тестирования сериализации ===");

    console.log("Зарегистрированные типы:", debugRegistry());

  try {
    // Имитируем работу сессии №1: Пользователь создал глобальную переменную и записал туда матрицу
    const context = new SymbolTableContext();
    const id = context.acquireId("myMatrix");

    // Допустим, интерпретатор записал в эту переменную вашу новую рабочую матрицу
    context.varSymbols[id - context.CD].value = new Matrix([[new BoolValue(true)]]);

    // Сохраняем глобальный контекст в LocalStorage
    const savedState = context.serializeGlobalContext();
    localStorage.setItem("global_symbol_table", savedState);


    // --- ПЕРЕЗАГРУЗКА СТРАНИЦЫ (Сессия №2) ---


    // Создаем абсолютно чистый контекст
    const newContext = new SymbolTableContext();

    // Загружаем состояние из LocalStorage
    const storedState = localStorage.getItem("global_symbol_table");
    newContext.deserializeGlobalContext(storedState);

    // ПРОВЕРКА №1: Проверяем, что хэш-таблица имен восстановилась
    const restoredId = newContext.acquireId("myMatrix"); 
    console.log("ID совпадает со старым?", restoredId === id); // true

    // ПРОВЕРКА №2: Проверяем, что матрица внутри переменной ожила со всеми методами
    const variableIndex = restoredId - newContext.CD;
    const matrixInstance = newContext.varSymbols[variableIndex].value;
    console.log("Это экземпляр Matrix?", matrixInstance instanceof Matrix); // true
    console.log("ТеХ матрицы работает?", matrixInstance.toTeX()); // Выведет TeX вашей матрицы

    // ПРОВЕРКА №3: Проверяем, что реактивность (сеттер) не сломалась
    newContext.varSymbols[variableIndex].value = 42; // пишем примитив
    console.log("Тип автоматически сменился на SYM_VARIABLE?", newContext.varSymbols[variableIndex].type);
  } catch (error) {
    console.error("Критическая ошибка в тесте:", error);
  }    
}
