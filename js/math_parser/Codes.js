import BoolValue from '../math/BoolValue.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';
import { BaseLocation, restoreLocation } from './CompilerErrors.js';
import { dispatcher } from './SemanticDispatcher.js';
import { SymbolTableContext, SYM_UNDEFINED, SYM_VARIABLE, SYM_BUILTIN } from './SymbolTableContext.js';
import VarableCode from '../varables/VarableCode.js';

export class EvaluateError extends Error {
  constructor(message, processed) {
    super(message);
    this.name = "EvaluateError";
    this.processed = processed;
  }
}

export class Command {
    constructor() {
        // Защита от создания экземпляра самого базового класса (опционально)
        if (new.target === Command) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "Command" напрямую.');
        }

        // Проверяем, переопределен ли метод в дочернем классе
        if (this.toString === Command.prototype.toString) {
            throw new TypeError(`Класс "${new.target.name}" должен переопределить метод toString(context).`);
        }

        // Проверяем количество аргументов (сигнатуру)
        if (this.toString.length !== 1) {
            throw new TypeError(`Метод toString в классе "${new.target.name}" должен принимать ровно 1 аргумент (context).`);
        }        
    }

    // Дефолтная реализация (можно оставить пустой или выкидывать ошибку)
    toString(_context) {
        throw new Error("Метод toString(context) должен быть реализован.");
    }    

    evaluate(context) {
        try
        {
            return this.internal_evaluate(context);
        }
        catch(err)
        {
            const msg = err.toString();
            const loc = context.evaluate_loc;
            if (loc) {
                context.error(msg, loc, "Runtime");
                throw new EvaluateError(msg, true);
            }
            else throw new EvaluateError(msg, false);
        }
    }
 
    internal_evaluate(context) {
        throw new Error("[Code]: Метод evaluate() не реализован.");
    }

    toJSON() {
        return {
            dataType: this.constructor.dataTypeName,
        };
    }
}

export class Commands {
    constructor(listCode = []) {
        if (Array.isArray(listCode) && listCode.every(item => item instanceof Command)) {
            this.listCode = listCode;
        }
        else throw new Error(`Недопустимые входные данные в конструкторе класса Codes ${listCode}`);
    }

    toJSON() {
        return {
            dataType: this.constructor.dataTypeName,
            list_code: this.listCode
        };
    }

    static get dataTypeName() { return "Codes"; }

    static fromJSON(data) {
        // Проверка на валидность входящих данных
        if (!data || !Array.isArray(data.list_code)) {
            return new Commands([]);
        }
        const context = data.context;   
        const listCode = data.list_code.map(savedCode => {
            if (!savedCode) return null;
            // 3. Безопасно передаем context, создавая новый объект (без мутации data)
            const codeWithContext = { ...savedCode, context };             
            // Предполагается, что функция restoreDataType объявлена глобально или импортирована
            return restoreDataType(codeWithContext);
        }).filter(Boolean);
        return new Commands(listCode);
    }
}
registerDataType(Commands.dataTypeName, Commands.fromJSON);

function regCode(ClassRef) {
  registerDataType(ClassRef.dataTypeName, ClassRef.fromJSON);
}

function assertInteger(value, paramName, context) {
  if (!Number.isInteger(value)) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен быть целым числом. Получено: ${value}`);
  }
}

function assertCommands(value, paramName, context) {
  if (!(Array.isArray(value) && value.every(item => item instanceof Command))) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен быть массивом комммад типа 'Command'. Получено: ${value}`);
  }
}

function assertString(value, paramName, context) {
  if (!Number.isInteger(typeof value !== 'string')) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен быть строкой. Получено: ${value}`);
  }
}

export class LocationComm extends Command {
    constructor(loc) {
        super();
        if (!(loc instanceof BaseLocation)) throw new TypeError(`Неверный тип пораметра класса LocationComm loc: ${loc}, пораметр loc должн экземпляром значения возвращающемого MathLexer.createLocation() лексера`);
        this.loc = loc;
    }

    toString(context) { return `location ${this.loc}`; }

    internal_evaluate(context) {
        context.evaluate_loc = loc;
    }

    toJSON() {
        return {
            ...super.toJSON(),
            loc: this.loc
        };
    }

    static get dataTypeName() { return "LocationCode"; }

    static fromJSON(data) {
        return new LocationComm(
            restoreLocation(data.loc)
        );
    }  
}
regCode(LocationComm);

export class ReportComm extends Command {
    constructor(astNode) {
        super();
        this.astNode = astNode;
    }

    toString(context) { return `report ${this.astNode}, st[top]`; }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const len = stack.length;
        if (len > 0) {
            context.createReportRecord(this.astNode, stack[len - 1]);
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            astNode: this.astNode
        };
    }

    static get dataTypeName() { return "ReportCode"; }

    static fromJSON(data) {
        return new ReportComm(
            restoreDataType(data.astNode)
        );
    }  
}
regCode(ReportComm);

export class ErrorComm extends Command {
    constructor(msg) {
        super();
        assertString(msg, 'msg', 'ErrorComm');
        this.msg = msg;
    }

    toString(_context) { return `error "${this.msg}"`; }

    internal_evaluate(context) {
        throw new EvaluateError(this.msg);
    }

    toJSON() {
        return {
        ...super.toJSON(),
        msg: this.msg
        };
    }

    static get dataTypeName() { return "ErrorCode"; }

    static fromJSON(data) {
        return new ErrorComm(
        data.msg,
        restoreLocation(data.loc),
        restoreDataType(data.astNode)
        );
    }
}
regCode(ErrorComm);

export class IFComm extends Command {
    constructor(len_code_false) {
        super();
    
        assertInteger(len_code_false, 'len_code_false', 'IFComm');

        this.len_code_false = len_code_false;
    }

    toString(_context) { return `if_jmp st[op], "${this.len_code_false}"`; }

    internal_evaluate(context) {
        const if_result = context.evaluate_stack.pop();
        const b_value = BoolValue.from(if_result).value;
        if (!b_value) {
            context.index_code += this.len_code_false;
        }
    }

    toJSON() {
        return {
            ...super.toJSON(),
            len_code_false: this.len_code_false
        };
    }

    static get dataTypeName() { return "IF_Code"; }

    static fromJSON(data) {
        return new IFComm(
            data.len_code_false,
        );
    }  
}
regCode(IFComm);

export class GotoComm extends Command {
    constructor(len_code) {
        super();

        assertInteger(len_code, 'len_code', 'IGotoComm');

        this.len_code = len_code;
    }

    toString(_context) { return `goto "${this.len_code}"`; }

    internal_evaluate(context) {
        context.index_code += this.len_code;
    }
    toJSON() {
        return {
            ...super.toJSON(),
            len_code: this.len_code
        };
    }

    static get dataTypeName() { return "Goto_Code"; }

    static fromJSON(data) {
        return new GotoComm(
            data.len_code,
        );
    }  
}
regCode(GotoComm);

export class DefineVarableComm extends Command {
    constructor(funcId, commands, paramsCount, localsCount) {
        super();
        assertInteger(funcId, 'funcId', 'DefineVarableComm');
        assertCommands(command, 'command', 'DefineVarableComm');
        assertInteger(paramsCount, 'paramsCount', 'DefineVarableComm');
        assertInteger(localsCount, 'localsCount', 'DefineVarableComm');
        this.funcId = funcId;
        this.statements = commands;
        this.paramsCount = paramsCount;
        this.localsCount = localsCount;
    }

    toString(context) { return `def_var "${context.getNameById(this.funcId)}"`; }

    internal_evaluate(context) {
        const scopeCtrl = context.scope_context;

        // Находим живой кадр, в котором мы СЕЙЧАС находимся (кадр родителя)
        const currentLiveFrame = scopeCtrl.currentScope;

        // Создаем замыкание, передавая ему жесткий указатель на этот кадр
        const closure = new VarableCode(this.statements, this.paramsCount, this.localsCount, currentLiveFrame);

        // Записываем это замыкание в символ функции
        const funcSymbol = scopeCtrl.getSymbolById(this.funcId);
        funcSymbol.value = closure;
    }

    toJSON() {
            return {
            ...super.toJSON(),
            funcId: this.funcId,
            statements: this.statements,
            paramsCount: this.paramsCount,
            localsCount: this.localsCount,
        };
    }

    static get dataTypeName() { return "DefineVarableCode"; }

    static fromJSON(data) {
            return new DefineVarableComm(
            data.funcId,
            restoreDataType(data.statements),
            data.paramsCount,
            data.localsCount,
        );
    }
}
regCode(DefineVarableComm);

export class PopComm extends Command {
    constructor(value) {
        super();
    }

    toString(_context) { return `pop st[top]`; }

    internal_evaluate(context) {
        context.last_popped = context.evaluate_stack.pop();
    }

    toJSON() {
        return {
            ...super.toJSON(),
        };
    }

    static get dataTypeName() { return "PopCode"; }

    static fromJSON(data) {
        return new PopComm();
    }    
}
regCode(PopComm);

//#region PUSH
export class PushCommConst extends Command {
    constructor(value) {
        super();
        this.value = value;
    }

    toString(_context) { return `push ${this.value}`; }

    internal_evaluate(context) {
        context.evaluate_stack.push(value);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value
        };
    }

    static get dataTypeName() { return "PushCodeConst"; }

    static fromJSON(data) {
        return new PushCommConst(
            restoreDataType(data.value)
        );
    }    
}
regCode(PushCommConst);

function checkSymbolNull(sym) { if (sym === null) throw new Error(`Символ не опредилён.`); }

function checkSymbol(sym) {
    const name = sym.name;
    if (sym.type === SYM_UNDEFINED) {
        throw new Error(`Переменная "${name}" не инициализирована.`);
    }
    else if (sym.type !== SYM_VARIABLE) {
       throw new Error(context, `Идентификатор "${name}" не является переменной.`);
    }
}

function checkSymbolAll(sym) {
    checkSymbolNull(sym)
    checkSymbol(sym);
}

export class PushCommVarbleLocal extends Command {
    constructor(id_name) {
        assertInteger(id_name, 'id_name', 'PushCommVarbleLocal');
        this.id_name = id_name;
    }

    toString(context) { return `push ${context.getNameById(this.id_name)}`; }

    internal_evaluate(context) {
        sym = context.scope_context.getSymbolById(this.id_name);
        checkSymbolAll(sym);
        context.evaluate_stack.push(sym.value);
    }

    toJSON() {
        return {
            ...super.toJSON(),
            id_name: this.id_name
        };
    }

    static get dataTypeName() { return "PushCodeVarbleLocal"; }

    static fromJSON(data) {
        return new PushCommVarbleLocal(
            data.id_name,
        );
    }
}
regCode(PushCommVarbleLocal);

export class PushCommVarbleGlobal extends Command {
    constructor(sym) {
        checkSymbolNull(sym);
        this.symbol = sym;
    }

    internal_evaluate(context) {
        checkSymbol(this.symbol);
        context.evaluate_stack.push(this.symbol.value);
    }

    toJSON() {
        const sym_data = SymbolTableContext.dataToJSON(this.symbol); 
        return {
            ...super.toJSON(),
            sym_data: sym_data
        };
    }

    static get dataTypeName() { return "PushCodeVarbleGlobal"; }

    static fromJSON(data) {
        const data_restore = data.context.dataFromJSON(data.sym_data);
        if ('callback' in data_restore) {
            const instance = new PushCommVarbleGlobal(data_restore.proxyPlaceholder);
            data_restore.callback = (realSymbol) => { instance.symbol = realSymbol; };
            return instance;
        }
        else return new PushCommVarbleGlobal(data_restore);
    }
}
regCode(PushCommVarbleGlobal);
//#endregion PUSH

//#region CONST_VAR 
export class OpValue extends Command {
    getValue(context) { throw new Error("[Code]: Метод value() не реализован."); }

    createCodePush() { throw new Error("[Code]: Метод createCodePush() не реализован."); }
}
 
export class OpConst extends OpValue {
    constructor(value) {
        super();
        this.value = value;
    }

    getValue(_context) { return this.value; }

    createCodePush() { return new PushCommConst(this.value); }

    toJSON() {
        return {
            ...super.toJSON(),
            value: this.value
        };
    }

    static get dataTypeName() { return "OpConst"; }

    static fromJSON(data) {
        return new OpConst(
            restoreDataType(data.value),
        );
    }
}
regCode(OpConst);

class OpVarable extends OpValue {
    constructor() {
        super();
    }

    getSymbol(_context) { throw new Error("[Code]: Метод getSymbol() не реализован."); }

    getSymbolNoCheck(_context) { throw new Error("[Code]: Метод getSymbolNoCheck() не реализован."); }

    getValue(context) { return this.getSymbol(context).value; }
}

export class OpVarableLocal extends OpVarable {
    constructor(id_name) {
        super();
        this.id_name = id_name;
    }

    getSymbol(context) {
        const sym = context.scope_context.getSymbolById(this.id_name);
        checkSymbolAll(sym); 
        return sym; 
    }

    getSymbolNoCheck(context) {
        const sym = context.scope_context.getSymbolById(this.id_name);
        checkSymbolNull(sym);
        return sym; 
    }

    createCodePush() { return new PushCommVarbleLocal(this.id_name); }

    toJSON() {
        return {
        ...super.toJSON(),
        id_name: this.id_name
        };
    }

    static get dataTypeName() { return "OpVarableLocal"; }

    static fromJSON(data) {
        return new OpVarableLocal(
        data.id_name,
        );
    }
}
regCode(OpVarableLocal);

export class OpVarableGlobal extends OpVarable {
    constructor(sym) {
        super();
        checkSymbolNull(sym);
        this.symbol = sym;
    }

    createCodePush() { return new PushCommVarbleGlobal(this.symbol); }

    getSymbol(_context) { 
        checkSymbol(this.symbol); 
        return this.symbol; 
    }

    getSymbolNoCheck(_context) { return this.symbol; }

    toJSON() {
        const sym_data = SymbolTableContext.dataToJSON(this.symbol); 
        return {
            ...super.toJSON(),
            sym_data: sym_data
        };
    }

    static get dataTypeName() { return "OpVarableGlobal"; }

    static fromJSON(data) {
        const data_restore = data.context.dataFromJSON(data.sym_data);
        if ('callback' in data_restore) {
            const instance = new OpVarableGlobal(data_restore.proxyPlaceholder);
            data_restore.callback = (realSymbol) => { instance.symbol = realSymbol; };
            return instance;
        }
        else return new OpVarableGlobal(data_restore);
    }
}
regCode(OpVarableGlobal);
//#endregion CONST_VAR 

export class MatrixComm extends Command {
    constructor(cont_row, count_col) {
        super();
        this.cont_row = cont_row;
        this.count_col = count_col;
    }

    internal_evaluate(context) {
        const evaluatedElements = []; 
        for (let i = 0; i < this.cont_row; i++) {
            const row = []; 
            for (let j = 0; j < this.count_col; j++) {
                const value = context.evaluate_stack.pop();
                row.push(value);
            }
            evaluatedElements.push(row); 
        }

        // Сначала найдём базовый "эталонный" тип, к которому нужно привести всю матрицу.
        // Мы просто пройдёмся по всем элементам и будем последовательно вызывать promoteTypes.
        // За стартовую точку возьмём самый первый элемент матрицы [0][0].
        let targetSample = evaluatedElements[0][0];

        for (const row of evaluatedElements) {
            for (const cell of row) {
                // Вызываем ваш диспетчер. Он посмотрит на ранги внутри своего приватного #registry,
                // сам выполнит cast сильного типа и вернёт нам нормализованную пару!
                const { l } = dispatcher.promoteTypes(targetSample, cell);
                targetSample = l; // Запоминаем текущий самый сильный объект-эталон
            }
        }

        // Теперь, когда targetSample гарантированно имеет самый высокий ранг в этой матрице,
        // приводим ВСЕ элементы к его типу через promoteTypes
        const finalElements = evaluatedElements.map(row =>
            row.map(cell => {
                const { r } = dispatcher.promoteTypes(targetSample, cell);
                return r; // r — это наш cell, подтянутый диспетчером до уровня targetSample!
            })
        );
        context.evaluate_stack.push(new Matrix(finalElements));
    }
}

//#region BaseBinCode
class BaseBinComm extends Command {
    constructor() {
        super();
    }

    operator(l, r) { throw new Error("[Code]: Метод operator(l. r) не реализован."); }
}

class BinCommValueValue extends BaseBinComm {
    constructor(l_value, r_value) {
        super();
        this.l_value = l_value;
        this.r_value = r_value;
    }

    internal_evaluate(context) {
        const { l, r } = dispatcher.promoteTypes(this.l_value.getValue(context), this.r_value.getValue(context));
        context.evaluate_stack.push(this.operator(l, r));
    }
   
  toJSON() {
    return {
      ...super.toJSON(),
      l_value: this.l_value,
      r_value: this.r_value,
    };
  }

  static create(ClassRef, data) {
     return new ClassRef(
      restoreDataType(data.l_value),
      restoreDataType(data.r_value)
    );   
  }
}

class BinCommOpValue extends BaseBinComm {
    constructor(value) {
        super();
        this.value = value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const l_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(l_op, this.value.getValue(context));
        stack.push(this.operator(l, r));
    }

  toJSON() {
    return {
      ...super.toJSON(),
      value: this.value,
    };
  }

  static create(ClassRef, data) {
     return new ClassRef(
      restoreDataType(data.value)
    );   
    }
}

class BinCommValueOp extends BaseBinComm {
    constructor(value) {
        super();
        this.value = value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const r_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(this.value.getValue(context), r_op);
        stack.push(this.operator(l, r));
    }    

    toJSON() {
        return {
        ...super.toJSON(),
        value: this.value,
        };
    }

    static create(ClassRef, data) {
        return new ClassRef(
        restoreDataType(data.value)
        );   
    }
}    

class BinCommOpOp extends BaseBinComm {
    constructor() {
        super(loc, astNode);
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const r_op = stack.pop();
        const l_op = stack.pop(); 
        const { l, r } = dispatcher.promoteTypes(l_op, r_op);
        stack.push(this.operator(l, r));
    }
    
    toJSON() {
        return {
        ...super.toJSON(),
        };
    }

    static create(ClassRef, data) {
        return new ClassRef(
        );       
    }
}    
//#endregion BaseBinCode

//#region ASSIGN
class AssignCommValueValue extends Command {
    constructor(let_value, value) {
        super();
        this.let_value = let_value;
        this.value = value;
    }
    
    internal_evaluate(context) {
        const sym = this.let_value.getSymbolNoCheck(context);
        const value = this.value.getValue(context);
        context.evaluate_stack.push(sym.value = value);
    }
  
     toJSON() {
        return {
        ...super.toJSON(),
        let_value: this.let_value,
        value: this.value
        };
    }
   
    static get dataTypeName() { return "AssignCodeValueValue"; }

    static fromJSON(data) {
        return new AssignCommValueValue(
            restoreDataType(data.let_value),
            restoreDataType(data.value)
        );
     }    
}
regCode(AssignCommValueValue);

class AssignCommValueOp extends Command {
    constructor(let_value) {
        super();
        this.let_value = let_value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const sym = this.let_value.getSymbolNoCheck(context);
        const value = stack.pop();
        stack.push(sym.value = value);
    }

     toJSON() {
        return {
        ...super.toJSON(),
        let_value: this.let_value
        };
    }
   
    static get dataTypeName() { return "AssignCodeValueOp"; }

    static fromJSON(data) {
        return new AssignCommValueOp(
            restoreDataType(data.let_value)
        );
     }    
}
regCode(AssignCommValueOp);
//#endregion ASSIGN

//#region INDEXING
function isNumberType(obj) {
    if (!obj) return false;
    
    // Проверяем примитив number
    if (typeof obj === 'number') {
        return Number.isFinite(obj); // Проверит и на NaN, и на Infinity
    }
    
    // Проверяем кастомный класс RealNumber
    if (obj instanceof RealNumber) {
        return Number.isFinite(obj.value);
    }
    
    return false;
}

export class IndexRowComm extends Command {
    constructor() {
        super();
    }

    internal_evaluate(context) {
        const matrixObj = context.evaluate_stack.pop();
        const rNum = context.evaluate_stack.pop();

        const MATRIX_SYMBOL = Symbol.for('Math.Matrix');
        if (!matrixObj || matrixObj.constructor.typeId !== MATRIX_SYMBOL) {
        throw new TypeError("Операция индексации [,] применима только к матрицам и векторам.");
        }

        if (!isNumberType(rNum)) {
            throw new TypeError("Идексы матрицы должны иметь тип real.");      
        }

        // Извлекаем примитивные целые числа. 
        // ВНИМАНИЕ: Пользователи калькулятора обычно считают с 1 (1-indexed), 
        // а внутри JS массивы с 0 (0-indexed). Вычитаем 1 для удобства человека!
        const rowIndex = Math.floor(rNum.value ?? Number(rNum)) - 1;
        
        // проверяем, что это вектор
        if (matrixObj.isVector) {
            // Если это вектор-строка, то индекс означает столбец, если столбец — то строку
            if (matrixObj.rowCount === 1) {
                evaluate_command(context, matrixObj, 0, rowIndex);
            } else {
                evaluate_command(context, matrixObj, rowIndex, 0);
            }
        } else {
            throw new RangeError("Для двумерной матрицы необходимо указать два индекса [строка, столбец].");
        }
    }

    evaluate_command(context, matrixObj, rowIndex, colIndex) {
        context.evaluate_stack.push(matrixObj.get(rowIndex, colIndex));
    }
}

export class AssignIndexRowComm extends Command {
    constructor() {
        super();
    }

    evaluate_command(context, matrixObj, rowIndex, colIndex) {
        const op = context.evaluate_stack.pop();
        const elm = matrixObj.get(0, 0);
        const { l } = dispatcher.promoteTypes(op, elm);
        matrixObj.set(rowIndex, colIndex, l);
        context.evaluate_stack.push(l);
    }
}

export class IndexMatrixComm extends Command {
    constructor() {
        super();
    }

    internal_evaluate(context) {
        const matrixObj = context.evaluate_stack.pop();
        const rNum = context.evaluate_stack.pop();
        const cNum = context.evaluate_stack.pop();

        const MATRIX_SYMBOL = Symbol.for('Math.Matrix');
        if (!matrixObj || matrixObj.constructor.typeId !== MATRIX_SYMBOL) {
            throw new TypeError("Операция индексации [,] применима только к матрицам и векторам.");
        }
        
        if (!isNumberType(rNum) || !isNumberType(cNum)) {
            throw new TypeError("Идексы матрицы должны иметь тип real.");
        }

        // Извлекаем примитивные целые числа. 
        // ВНИМАНИЕ: Пользователи калькулятора обычно считают с 1 (1-indexed), 
        // а внутри JS массивы с 0 (0-indexed). Вычитаем 1 для удобства человека!
        const rowIndex = Math.floor(rNum.value ?? Number(rNum)) - 1;
        const colIndex = Math.floor(cNum.value ?? Number(cNum)) - 1;

        evaluate_command(context, matrixObj, rowIndex, colIndex)
    }

    evaluate_command(context, matrixObj, rowIndex, colIndex) {
        context.evaluate_stack.push(matrixObj.get(rowIndex, colIndex));
    }
}

export class AssignIndexMatrixComm extends Command {
    constructor() {
        super();
    }

    evaluate_command(context, matrixObj, rowIndex, colIndex) {
        const let_value = context.evaluate_stack.pop();
        const elm = matrixObj.get(0, 0);
        const { l } = dispatcher.promoteTypes(let_value, elm);
        matrixObj.set(rowIndex, colIndex, l);
        context.evaluate_stack.push(l);
    }
}
//#endregion INDEXING

//#region ADD
class AddCommValueValue extends BinCommValueValue {
    constructor(l_value, r_value) {
        super(l_value, r_value);
    }
    
    operator(l, r) { return l.add(r) }

    static get dataTypeName() { return "AddCodeValueValue"; }

    static fromJSON(data) { return BinCommValueValue.create(AddCommValueValue, data); }
}
regCode(AddCommValueValue);

class AddCommOpValue extends BinCommOpValue {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.add(r) }
  
    static get dataTypeName() { return "AddCodeOpValue"; }

    static fromJSON(data) { return BinCommOpValue.create(AddCommOpValue, data); }    
}
regCode(AddCommOpValue);     

class AddCommValueOp extends BinCommValueOp {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.add(r) }
}    

class AddCommOpOp extends BinCommOpOp {
    constructor() {
        super();
    }
    
    operator(l, r) { return l.add(r) }

    static get dataTypeName() { return "AddCodeOpOp"; }

    static fromJSON(data) { return BinCommOpOp.create(AddCommOpOp, data); }    
}
regCode(AddCommOpOp);
//#endregion ADD

//#region SUB
class SubCommValueValue extends BinCommValueValue {
    constructor(l_value, r_value) {
        super(l_value, r_value);
    }
    
    operator(l, r) { return l.subtract(r) }

    static get dataTypeName() { return "SubCodeValueValue"; }

    static fromJSON(data) { return BinCommValueValue.create(SubCommValueValue, data); }
}
regCode(SubCommValueValue);    

class SubCommOpValue extends BinCommOpValue {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.subtract(r) }
  
    static get dataTypeName() { return "SubCodeOpValue"; }

    static fromJSON(data) { return BinCommOpValue.create(SubCommOpValue, data); }    
}
regCode(SubCommOpValue);     

class SubCommValueOp extends BinCommValueOp {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.subtract(r) }
}    

class SubCommOpOp extends BinCommOpOp {
    constructor() {
        super();
    }
    
    operator(l, r) { return l.subtract(r) }

    static get dataTypeName() { return "SubCodeOpOp"; }

    static fromJSON(data) { return BinCommOpOp.create(SubCommOpOp, data); }    
}
regCode(SubCommOpOp);       
//#endregion SUB 

export const OperatorBinType = {
    ASSIGN:     0,
    OR:         1,
    XOR:        2,
    AND:        3,
    RELATIONAL: 4,
    IS:         5,  
    ADD:        6,
    SUB:        7,    
    MUL:        8,
    DIV:        9,
    POW:        10,
};

const OperandsType = {
    CONST:       0,
    VARABLE:     1,
    EVALUATE:    2,
};

function getBinKey(operator, l_operand, r_operand) {
    return (operator << 8) + (l_operand << 4) + r_operand;
}

const SubstitutionTableBin = new Map([
    // ASSIGN
    [
        getBinKey(OperatorBinType.ASSIGN, OperandsType.VARABLE, OperandsType.CONST),
        (l_o, r_o) => { return [new AssignCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ASSIGN, OperandsType.VARABLE, OperandsType.VARABLE),
        (l_o, r_o) => { return [new AssignCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ASSIGN, OperandsType.VARABLE, OperandsType.EVALUATE),
        (l_o, r_o) => { return [...r_o, new AssignCommValueOp(l_o)]; }
    ],

    // ADD
    [
        getBinKey(OperatorBinType.ADD, OperandsType.CONST, OperandsType.CONST),
        (l_o, r_o) => {
            const { l, r } = dispatcher.promoteTypes(l_o.getValue(), r_o.getValue()); 
            return new OpConst(l.add(r)); 
        }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.VARABLE, OperandsType.CONST),
        (l_o, r_o) => { return [new AddCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.CONST, OperandsType.VARABLE),
        (l_o, r_o) => { return [new AddCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.VARABLE, OperandsType.VARABLE),
        (l_o, r_o) => { return [new AddCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.EVALUATE, OperandsType.CONST),
        (l_o, r_o) => { return [...l_o, new AddCommOpValue(r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.CONST, OperandsType.EVALUATE),
        (l_o, r_o) => { return [...r_o, new AddCommValueOp(l_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.EVALUATE, OperandsType.VARABLE),
        (l_o, r_o) => { return [...l_o, new AddCommOpValue(r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.VARABLE, OperandsType.EVALUATE),
        (l_o, r_o) => { return [...r_o, new AddCommValueOp(l_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.EVALUATE, OperandsType.EVALUATE),
        (l_o, r_o) => { return [...l_o, ...r_o, new AddCommOpOp()]; }
    ],

]);

function getOperandType(op) {
    if (op instanceof OpConst) return OperandsType.CONST;
    else if (op instanceof OpVarable) return OperandsType.VARABLE;
    else if (Array.isArray(op) && op.every(item => item instanceof Command)) return OperandsType.EVALUATE;
    throw new TypeError(`[Code]: Неизвестны тип опранда ${op}`);
}

export function operandImplementСode(op) {
    if (op instanceof OpConst || op instanceof OpVarable) return [op.createCodePush()];
    else if (Array.isArray(op) && op.every(item => item instanceof Command)) return op;
    throw new TypeError(`[Code]: Неизвестны тип опранда ${op}`); 
} 

export function createBinCode(operator, l_op, r_op) {
    const lop_type = getOperandType(l_op);
    const rop_type = getOperandType(r_op);
    const key = getBinKey(operator, lop_type, rop_type);
    if (!SubstitutionTableBin.has(key)) {
        throw new Error(`Операция не поддерживается: не найден обработчик для ключа "${key}"`);
    }
    const processFn = SubstitutionTableBin.get(key);
    return processFn(l_op, r_op);
}