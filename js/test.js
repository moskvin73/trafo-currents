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
  const symbols = new SymbolTableContext();

  // Создаём выполнитель
  const executor = {
    // Список отчётов ((Измняется командами))
    report: [],
    // Хранит последнее значение, извлеченное из стека evaluate_stack методом pop
    last_popped : null,
    // Контекст символов перименных
    scope_context: symbols,
    // Стек выполнения
    evaluate_stack: [],
    // Значение локации команды выполненя ((Измняется командами))
    evaluate_loc: null,
    // Текущий индекс командв (Измняется командами)
    index_comm: 0,
    // Ткущий набор выполняемых команд (Измняется командами)
    _commandsChanged: false,
    _commands: null,
    get commands() { return this._commands; },
    set commands(v) { 
      this._commands= v;
      this.index_comm = 0;
      if (this.is_evaluate) {
        this._commandsChanged = true;
      }       
    },
    // Флаг выполнения
    is_evaluate: false,
    DEBUG: true,

    evaluate() {
        let cmds = this._commands;
        if (!cmds) return;

        const isDebug = this.DEBUG;
        let len_code = cmds.length;
        this.is_evaluate = true;
        this._commandsChanged = false;

        if (isDebug) console.log('***start evaluate***');

        const stack = this.evaluate_stack;
        let prev_stack_len = stack.length;
        const ctx = this.scope_context;
        try {
          let idx = this.index_comm;

          while (idx < len_code) {
            const com = cmds[idx++];

            if (isDebug) console.log(`${idx - 1}: ${com.toString(ctx)}`);

            this.index_comm = idx;
            com.evaluate(this);

            // Предпологается что при изминени кода меняется и индекс
            if (this._commandsChanged) {
              cmds = this._commands;
              len_code = cmds.length;
              this._commandsChanged = false;
            }
            idx = this.index_comm;

            if (this.DEBUG) {
              const current_len = stack.length;
              if (current_len > prev_stack_len || com.modifiesStack)
                console.log(` st[top] = ${stack[current_len - 1]}`);
              prev_stack_len = current_len;
            }
          }
        } finally {
          if (isDebug) console.log('***end evaluate***');
          this.is_evaluate = false;
        }
      },

      toStringCommands() {
        if (!this.commands) return '';
        const ctx = this.scope_context;
        return this.commands.map((com, index) => `${index}: ${com.toString(ctx)}`).join('\n');
      },

      createReportRecord(node, value) {
        if (value !== undefined && value !== null) {
        this.report.push({ node, value });
      }
    }
  };

  const getSymbol = (source, id) => {
    if (executor.is_evaluate)
      return source.getSymbolById(id);
    else  
      return source.getParseSymbolById(id);
  };
  const out_updte_sym = (sym) => {
    console.log(` set varable: ${sym.name} = ${sym.value}`);
  };
  symbols.subscribeAddVarable((source, id) => {
    const new_sym = getSymbol(source, id);
    new_sym.subscribeUpdateVarable(out_updte_sym);
  });
  symbols.subscribeDeleteVarable((source, id) => {
    const del_sym = getSymbol(source, id);
    del_sym.unsubscribeUpdateVarable(out_updte_sym);
  });
  const acquireVar = (name) => { return symbols.getParseSymbolById(symbols.acquireId(name)); };
  const op_v = (sym) => { return new Code.OpVarableGlobal(sym); };
  const op_n = (name) => { return new Code.OpVarableGlobal(acquireVar(name)); };
  const op_c = (value) => { return new Code.OpConst(value); };

  const builder = new Code.CommandBuilder();
  const command = builder
  .assign(op_n("pi"), op_c(Math.PI))
  .pop()
  .add(op_c(10), op_c(1))       // 10 + 1 = 11
  .add(Code.self, op_c(-100))   // 10 + 1 + -100 = 89
  .add(op_n("pi"), Code.self)   // pi + 89
  .assign(op_n("pi"), Code.self) // pi = pi + 89
  .pop()
  .build();

  executor.commands = command;
  console.log('***Коммады кода***');
  console.log(executor.toStringCommands());
  executor.evaluate();
  console.log(`Состояние стека после выполнения кода ${executor.evaluate_stack}`);
  console.log(`Последнее значение, извлеченное из стека ${executor.last_popped}`);
}