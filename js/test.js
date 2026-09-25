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
import { TYPE_REGISTRY } from './math_parser/SemanticDispatcher.js';
import { Stack } from './math/util.js';
import { MathParser } from './math_parser/MathParser.js';

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

function getFirstStackTraceLine(err) {
  if (!err || !err.stack) return '';
  
  // Разбиваем стек на отдельные строки
  const lines = err.stack.split('\n');
  
  // Ищем первую строку, которая содержит двоеточие со строкой/колонкой (типично для путей файлов)
  // и при этом НЕ является заголовком ошибки (исключаем строки без структуры вызова)
  for (let line of lines) {
    line = line.trim();
    // Проверяем наличие паттерна ссылки (например, .js:237:11 или html:1160)
    if (/\.(js|ts|html?|php)[^:\n]*:\d+/i.test(line) || line.includes('://')) {
      return line;
    }
  }
  
  return '';
}

function getFirstStackTraceLinkRef(err) {
  if (!err || !err.stack) return '';
  
  const lines = err.stack.split('\n');
  
  // Регулярное выражение ищет сам путь и номера строк/колонок
  // Оно захватывает всё, начиная от протокола (http://) или диска (C:\) / корня (/) 
  // и заканчивая цифрами двоеточий
  const linkRegex = /((?:https?|file):\/\/[^\s)]+|(?:\/|[A-Z]:\\)[^\s)]+:\d+:\d+)/i;

  for (let line of lines) {
    const match = line.match(linkRegex);
    if (match) {
      return match[1]; // Возвращаем только то, что попало в круглые скобки
    }
  }
  
  return '';
}

export function test3() {

  const loc = (line, col =  1) => {
    const loc_data = {
      locType: "IndependentLoc",
      start: 0,
      end: 0,
      line: line,
      startLineIdx: 0,
      endLine: 1,
      endLineIdx: 0,
      column: col,
      endColumn: 1
    };
    return new IndependentSourceLocation(loc_data);
  };
  
  const incLoc = (loc) => {
    loc.line++;
    const loc_data = {
      locType: "IndependentLoc",
      start: 0,
      end: 0,
      line: loc.line,
      startLineIdx: 0,
      endLine: 1,
      endLineIdx: 0,
      column: loc.column,
      endColumn: 1
    };
    return new IndependentSourceLocation(loc_data);
  };

  // Снимаем квалификацию с помощью деструктуризации
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
    evaluate_stack: new Stack(),
    // Значение локации команды выполненя ((Измняется командами))
    evaluate_loc: null,
    // Текущий индекс командв (Измняется командами)
    index_comm: 0,
    // Ткущий набор выполняемых команд (Измняется командами)
    _commandsChanged: false,
    _commands: null,
    get commands() { return this._commands; },
    set commands(v) {
      if (!Code.is_comands(v)) throw new Error('Значение не является последовательность команд');
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
        if (!cmds || cmds.length == 0) return;

        const isDebug = this.DEBUG;
        let len_code = cmds.length;
        this.is_evaluate = true;
        this._commandsChanged = false;

        if (isDebug) console.log('***start evaluate***');

        const stack = this.evaluate_stack;
        const ctx = this.scope_context;
        try {
          let idx = this.index_comm;

          while (idx < len_code) {
            const com = cmds[idx++];

            if (isDebug) console.log(`${idx - 1}: ${com.toString(ctx)}`);

            this.index_comm = idx;
            com.evaluate(this);

            if (this.DEBUG) {
              if (com.modifiesStack)
                console.log(` st[top] = ${stack.peek()}`);
            }

            // Предпологается что при изминени кода меняется и индекс
            if (this._commandsChanged) {
              cmds = this._commands;
              len_code = cmds.length;
              this._commandsChanged = false;
            }
            idx = this.index_comm;
          }
        } catch(err) {
          if (err instanceof Code.EvaluateError) {
            let str_ref = getFirstStackTraceLinkRef(err);
            if (str_ref && str_ref.length > 0) str_ref = '\n' + str_ref;
            console.log(`[Runtime error]: [${err?.location ?? 'Unknown location'}] ${err?.message ?? 'No message'}${str_ref}`);
          }
          else throw err;
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
          const report = { node, value };
          this.report.push(report);
          console.log(`Отчёт: ${report.node} = ${report.value}`);
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

  const contextError = {
    errors: [],
    error(message, loc, err = null, severity = 'error') {
      let str_ref = getFirstStackTraceLinkRef(err);
      if (str_ref && str_ref.length > 0) str_ref = '\n' + str_ref;
      console.log(`[${severity}]: [${loc ?? 'Unknown location'}] ${message}${str_ref}`);
    },
  };

  const parse = (text) => {
    const p = new MathParser(text, symbols);
    return p.testParse();
  };

  const source_code = `
    A = (C = 10) - 11;
    B = [1, +2, -3];
    A = A - (10 - -B);
    `;
  const builder = parse(source_code);

  builder.foldConstants(source_code);
  console.log(`Исходный код:\n${source_code}`);
  if (builder.isConstant) {
    console.log(`Код отсутсвет константное занчение: ${builder.constant}`);
  } else {
    executor.commands = builder.build();
    console.log('***Коммады кода***');
    console.log(executor.toStringCommands());
    try {
      executor.evaluate();
    } catch(err) {
      console.log(`throw: ${err} ${err.stack}`);  
    } finally {
      console.log(`Состояние стека после выполнения кода ${executor.evaluate_stack.peek()}`);
      console.log(`Последнее значение, извлеченное из стека ${executor.last_popped}`);
    }
  }
}