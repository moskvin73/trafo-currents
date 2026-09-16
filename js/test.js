import BoolValue from './math/BoolValue.js';
import RealNumber from './math/RealNumber.js';
import ComplexNumber from './math/ComplexNumber.js';
import Matrix from './math/Matrix.js';
import { restoreDataType, debugRegistry } from './DataTypeRegistry.js';
import { SymbolTableContext } from './math_parser/SymbolTableContext.js';
import { IndependentSourceLocation } from './math_parser/CompilerErrors.js';
import * as AST from './math_parser/ASTNodes.js';
import VarableCode from './varables/VarableCode.js';
import * as Code from './math_parser/Codes.js';

export function test(data) {
    console.log("=== Старт тестирования сериализации ===");

    console.log("Зарегистрированные типы:", debugRegistry());

  try {
    /*
    // Имитируем работу сессии №1: Пользователь создал глобальную переменную и записал туда матрицу
    const context = new SymbolTableContext();
    const id = context.acquireId("myMatrix");

    // Допустим, интерпретатор записал в эту переменную вашу новую рабочую матрицу
    context.varSymbols[id - context.CD].value = new Matrix([[new BoolValue(true)]]);*/

    // Сохраняем глобальный контекст в LocalStorage

    const loc_data = {
      locType: "IndependentLoc",
      start: 0,
      end: 0,
      line: 1,
      startLineIdx: 0,
      endLine: 1,
      endLineIdx: 0,
      column: 1,
      endColumn: 1
    };
    const loc = new IndependentSourceLocation(loc_data);
    const nn = new AST.NumberNode(new ComplexNumber(1, 1), loc);
    const node = new AST.AddNode(new AST.UnaryOpNodeMinus(nn, loc), nn, loc);
    const p_node = new AST.PrintNode(["XXX", node], loc);

    //const savedState = context.serializeGlobalContext();
    const jsonResult = JSON.stringify(p_node);
    console.log(jsonResult);

    const rawData = JSON.parse(jsonResult);
    const restoredTree = restoreDataType(rawData);
    console.log(restoredTree.toString());
    //localStorage.setItem("global_symbol_table", savedState);


    // --- ПЕРЕЗАГРУЗКА СТРАНИЦЫ (Сессия №2) ---


    // Создаем абсолютно чистый контекст
    //const newContext = new SymbolTableContext();

    // Загружаем состояние из LocalStorage
    //const storedState = localStorage.getItem("global_symbol_table");
    /*newContext.deserializeGlobalContext(storedState);

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
    console.log("Тип автоматически сменился на SYM_VARIABLE?", newContext.varSymbols[variableIndex].type);*/
  } catch (error) {
    console.error("Критическая ошибка в тесте:", error);
  }    
}

export function test2() {
    console.log("=== Старт тестирования сериализации ===");

    console.log("Зарегистрированные типы:", debugRegistry());

  try {

    // Имитируем работу сессии №1: Пользователь создал глобальную переменную и записал туда матрицу
    const context = new SymbolTableContext();
    const id_var = context.acquireId("Varable");
    context.varSymbols[id_var - context.CD].value = new RealNumber(3.14);
    const var_sym = context.varSymbols[id_var - context.CD];
    let id = context.acquireId("myCode");

    context.subscribeIndexRenumbering((_source, lastIdx, newIndex) => {
      if (lastIdx === id) id = newIndex;
    });

    // Допустим, интерпретатор записал в эту переменную вашу новую рабочую матрицу
    const codes = [ new Code.OpVarableGlobal(context.varSymbols[id_var - context.CD]) ];
    context.varSymbols[id - context.CD].value = new VarableCode(codes, 0, 0, null);

    context.deleteGlobalForName("Varable");

    const savedState = context.serializeGlobalContext();
    localStorage.setItem("global_symbol_table", savedState);
    // --- ПЕРЕЗАГРУЗКА СТРАНИЦЫ (Сессия №2) ---

    // Создаем абсолютно чистый контекст
    const newContext = new SymbolTableContext();

    // Загружаем состояние из LocalStorage
    const storedState = localStorage.getItem("global_symbol_table");
    newContext.deserializeGlobalContext(storedState);

    // ПРОВЕРКА №1: Проверяем, что хэш-таблица имен восстановилась
    const restoredId = newContext.acquireId("myCode"); 
    console.log("ID совпадает со старым?", restoredId === id); // true

    // ПРОВЕРКА №2: Проверяем, что матрица внутри переменной ожила со всеми методами
    const variableIndex = restoredId - newContext.CD;
    const codeInstance = newContext.varSymbols[variableIndex].value;
    //console.log("Это экземпляр Matrix?", matrixInstance instanceof Matrix); // true
    //console.log("ТеХ матрицы работает?", matrixInstance.toTeX()); // Выведет TeX вашей матрицы
    newContext.varSymbols[id_var - newContext.CD].value = new ComplexNumber(1, 1);

    // ПРОВЕРКА №3: Проверяем, что реактивность (сеттер) не сломалась
    newContext.varSymbols[variableIndex].value = 42; // пишем примитив
    console.log("Тип автоматически сменился на SYM_VARIABLE?", newContext.varSymbols[variableIndex].type);
    
  } catch (error) {
    console.error("Критическая ошибка в тесте:", error);
  }    
}

export function test3() {
  // Снимаем квалификацию с помощью деструктуризации
  const { ASSIGN, OR, XOR, AND, ADD, SUB, MUL, DIV, POW } = Code.OperatorBinType;

  // Создаём выполнитель
    const executor = {
      report: [],
      evaluate_stack: [],
      evaluate_loc: null,
      code: in_code,
      index_code: 0,
      evaluate: () => {
        while (this.index_code < this.code.length) {
          const com = this.code[this.index_code++];
          com.evaluate(this);
    }}};

    const symbols = new SymbolTableContext();
    const acquireVar = (name) => { return symbols.getParseSymbolById(symbols.context.acquireId(name)); };
    const sym_pi = acquireVar("pi");
    const operand_v = (sym) => { return new Code.OpVarableGlobal(sym); };
    const operand_c = (value) => { return new new Code.OpConst(value); };

    const c0 = Code.createBinCode(ASSIGN, operand_v(sym_pi), operand_c(Math.POW));
    const c1 = Code.createBinCode(ADD, operand_v(sym_pi), operand_c(1));
    const c3 = Code.createBinCode(ASSIGN, operand_v(sym_pi), c1);
    const codes = [
      ...c0,
      ...c1,
      ...c3,
    ];
    console.log(sym_pi.value);
    executor.evaluate(codes);
    console.log(sym_pi.value);
}