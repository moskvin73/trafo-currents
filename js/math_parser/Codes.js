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
  constructor(message, loc) {
    super(message);
    this.name = "EvaluateError";
    this.location = loc;
  }
}

class UserError extends Error {
  constructor(message) {
    super(message);
    this.name = "UserError";
  }
}

export class Command {
    constructor() {
        // Защита от создания экземпляра самого базового класса
        if (new.target === Command) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "Command" напрямую.');
        }

        /*
        // Проверяем, переопределен ли метод в дочернем классе
        if (this.toString === Command.prototype.toString) {
            throw new TypeError(`Класс "${new.target.name}" должен переопределить метод toString(context).`);
        }

        // Проверяем количество аргументов (сигнатуру)
        if (this.toString.length !== 1) {
            throw new TypeError(`Метод toString в классе "${new.target.name}" должен принимать ровно 1 аргумент (context).`);
        }        

        // Проверяем, переопределен ли метод в дочернем классе
        if (this.internal_evaluate === Command.prototype.internal_evaluate) {
            throw new TypeError(`Класс "${new.target.name}" должен переопределить метод internal_evaluate(context).`);
        }

        // Проверяем количество аргументов (сигнатуру)
        if (this.internal_evaluate.length !== 1) {
            throw new TypeError(`Метод internal_evaluate в классе "${new.target.name}" должен принимать ровно 1 аргумент (context).`);
        }*/        
    }

    // Дефолтная реализация
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
            throw new EvaluateError(err.message || String(err), context.evaluate_loc);
        }
    }
 
    internal_evaluate(context) {
        throw new Error("[Command]: Метод evaluate() не реализован.");
    }

    get pushStackCount() { throw new Error("[Command]: Геттер pushStackCount не реализован."); }

    get popStackCount() { throw new Error("[Command]: Геттер popStackCount не реализован."); }

    get modifiesStack() { return this.pushStackCount > 0 || this.popStackCount > 0; }

    foldConstants(optimizedCode, simulatedStack) { optimizedCode.push(this); }

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
  if (typeof value !== 'string') {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен быть строкой. Получено: ${value}`);
  }
}

export class LocationComm extends Command {
    constructor(loc) {
        super();
        if (!(loc instanceof BaseLocation)) 
            throw new TypeError(`Неверный тип пораметра класса LocationComm loc: ${loc}, пораметр loc должн экземпляром значения возвращающемого MathLexer.createLocation() лексера`);
        this.loc = loc;
    }

    toString(context) { return `location ${this.loc}`; }

    internal_evaluate(context) {
        context.evaluate_loc = this.loc;
    }

    get pushStackCount() { return 0; }

    get popStackCount() { return 0; }

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

//#region REPORT
class ReportCommConst extends Command {
    constructor(astNode, value) {
        super();
        this.astNode = astNode;
        this.value = value;
    }

    toString(context) { return `report ${this.astNode}, ${this.value}`; }

    internal_evaluate(context) {
        context.createReportRecord(this.astNode, this.value);
    }

    get pushStackCount() { return 0; }

    get popStackCount() { return 0; }

    toJSON() {
        return {
            ...super.toJSON(),
            astNode: this.astNode,
            value: this.value
        };
    }

    static get dataTypeName() { return "ReportCommConst"; }

    static fromJSON(data) {
        return new ReportCommConst(
            restoreDataType(data.astNode),
            restoreDataType(data.value)
        );
    }  
}
regCode(ReportCommConst);

class ReportComm extends Command {
    constructor(astNode) {
        super();
        this.astNode = astNode;
    }

    toString(context) { return `report ${this.astNode}, st[top]`; }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const len = stack.length;
        if (len > 0) {
            context.createReportRecord(this.astNode, stack.at(-1));
        }
    }

    foldConstants(optimizedCode, simulatedStack) {
        const st_top = simulatedStack.at(-1);
        if (st_top.type === 'const') {
            optimizedCode.push(new ReportCommConst(this.astNode, st_top.value));
        }
        else optimizedCode.push(this);
    }

    get pushStackCount() { return 0; }

    get popStackCount() { return 0; }

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
//#endregion REPORT

export class ErrorComm extends Command {
    constructor(msg) {
        super();
        assertString(msg, 'msg', 'ErrorComm');
        this.msg = msg;
    }

    toString(_context) { return `error "${this.msg}"`; }

    internal_evaluate(context) {
        throw new UserError(this.msg);
    }

    get pushStackCount() { return 0; }

    get popStackCount() { return 0; }

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

    get pushStackCount() { return 0; }

    get popStackCount() { return 1; }

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

    get pushStackCount() { return 0; }

    get popStackCount() { return 0; }

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

    get pushStackCount() { return 0; }

    get popStackCount() { return 0; }

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

    foldConstants(optimizedCode, simulatedStack) {
        const st_top = simulatedStack.pop();
        if (st_top.type !== 'const') optimizedCode.push(this);
    }

    get pushStackCount() { return 0; }

    get popStackCount() { return 1; }
   
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
class PushComm extends Command {

    get pushStackCount() { return 1; }

    get popStackCount() { return 0; }
}

export class PushCommConst extends PushComm {
    constructor(value) {
        super();
        this.value = value;
    }

    toString(_context) { return `push ${this.value}`; }

    internal_evaluate(context) {
        context.evaluate_stack.push(this.value);
    }

    foldConstants(optimizedCode, simulatedStack) {
        simulatedStack.push({type: 'const', value: this.value});
    }

    get pushStackCount() { return 1; }

    get popStackCount() { return 0; }

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

export class PushCommVarbleLocal extends PushComm {
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

    foldConstants(optimizedCode, simulatedStack) {
        simulatedStack.push({ type: 'unknown' });
        optimizedCode.push(this);
    }

    get pushStackCount() { return 1; }

    get popStackCount() { return 0; }
   
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

export class PushCommVarbleGlobal extends PushComm {
    constructor(sym) {
        checkSymbolNull(sym);
        this.symbol = sym;
    }

    toString(_context) { return `push ${this.symbol.name}`; }

    internal_evaluate(context) {
        checkSymbol(this.symbol);
        context.evaluate_stack.push(this.symbol.value);
    }

    foldConstants(optimizedCode, simulatedStack) {
        simulatedStack.push({ type: 'unknown' });
        optimizedCode.push(this);
    }

    get pushStackCount() { return 1; }

    get popStackCount() { return 0; }

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
export class OperandValue extends Command {
    constructor() {
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === OperandValue) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "OperandValue" напрямую.');
        }
    }

    get pushStackCount() { return 0; }

    get popStackCount() { return 0; }

    getValue(context) { throw new Error("[Code]: Метод value() не реализован."); }

    createCodePush() { throw new Error("[Code]: Метод createCodePush() не реализован."); }
}
 
function assertOperand(value, paramName, context) {
  if (!(value instanceof OperandValue)) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен экзепляром класса 'OperandValue'. Получено: ${value}`);
  }
}

export class OpConst extends OperandValue {
    constructor(value) {
        super();
        this.value = value;
    }

    toString(_context) { return `${this.value}`; }

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

function assertOperandConst(value, paramName, context) {
  if (!(value instanceof OpConst)) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен экзепляром класса 'OperandValue'. Получено: ${value}`);
  }
}

class OpVarable extends OperandValue {
    constructor() {
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === OpVarable) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "OpVarable" напрямую.');
        }
    }

    getSymbol(_context) { throw new Error("[Code]: Метод getSymbol() не реализован."); }

    getSymbolNoCheck(_context) { throw new Error("[Code]: Метод getSymbolNoCheck() не реализован."); }

    getValue(context) { return this.getSymbol(context).value; }
}

function assertOperandVarable(value, paramName, context) {
  if (!(value instanceof OperandValue)) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен экзепляром класса 'OperandValue'. Получено: ${value}`);
  }
}

export class OpVarableLocal extends OpVarable {
    constructor(id_name) {
        super();
        assertInteger(id_name, 'id_name', 'OpVarableLocal');
        this.id_name = id_name;
    }

    toString(context) { return `${context.getNameById(this.id_name)}`; }

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

function assertOperandVarableLocal(value, paramName, context) {
  if (!(value instanceof OpVarableLocal)) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен экзепляром класса 'OperandValue'. Получено: ${value}`);
  }
}

export class OpVarableGlobal extends OpVarable {
    constructor(sym) {
        super();
        checkSymbolNull(sym);
        this.symbol = sym;
    }

    toString(_context) { return `${this.symbol.name}`; }

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

function assertOperandVarableGlobal(value, paramName, context) {
  if (!(value instanceof OpVarableGlobal)) {
    throw new TypeError(`[${context}] Параметр "${paramName}" должен экзепляром класса 'OperandValue'. Получено: ${value}`);
  }
}
//#endregion CONST_VAR 

export class MatrixComm extends Command {
    constructor(cont_row, count_col) {
        super();
        assertInteger(cont_row, 'cont_row', 'MatrixComm');
        assertInteger(count_col, 'count_col', 'MatrixComm');
        this.cont_row = cont_row;
        this.count_col = count_col;
    }

    toString(_context) { return `create_matrix ${this.cont_row}, ${this.count_col}`; }

    operand(stack) {
        const evaluatedElements = []; 
        for (let i = 0; i < this.cont_row; i++) {
            const row = []; 
            for (let j = 0; j < this.count_col; j++) {
                const value = stack.pop();
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
        return new Matrix(finalElements);
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        stack.push(this.operand(stack));
    }

    foldConstants(optimizedCode, simulatedStack) {
        // читаем элименты из стека
        const c = popStackCount;
        let all_constnts = true;
        const constnts = [];
        while (c--) { 
            const st_top = simulatedStack.pop();
            if (st_top.type === 'const') {
                constnts.push(st_top.value);
            } else {
                all_constnts = false;
                break;
            }
        }
        if (c > 0) while (c--) simulatedStack.pop();
        if (all_constnts) {
            simulatedStack.push({type: 'const', value: this.operand(constnts)});   
        } else {
            simulatedStack.push({ type: 'unknown' });
            optimizedCode.push(this);
        }
    }

    get pushStackCount() { return 1; }

    get popStackCount() { return this.cont_row * this.count_col; }

    toJSON() {
        return {
            ...super.toJSON(),
            cont_row: this.cont_row,
            count_col: this.count_col
        };
    }

    static get dataTypeName() { return "MatrixComm"; }

    static fromJSON(data) {
        return new MatrixComm(data.cont_row, data.count_col);
    }    
}

//#region BaseUnCode
class BaseUnComm extends Command {
    constructor() {
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === BaseUnComm) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BaseBinComm" напрямую.');
        }
    }

    operator(op) { throw new Error("[BaseUnComm]: Метод operator(op) не реализован."); }

    commandName() { throw new Error("[BaseUnComm]: Метод commandName() не реализован."); }

    get pushStackCount() { return 1; }
}

class UnCommValue extends BaseUnComm {
    constructor(value) {
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === BinCommValueValue) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BinCommValueValue" напрямую.');
        }
        assertOperand(value, 'value', `${new.target.name}`);
        this.value = value;
    }

    toString(context) { return `${this.commandName()} ${this.value}`; }

    internal_evaluate(context) {
        context.evaluate_stack.push(this.operator(this.value.getValue(context)));
    }

    foldConstants(optimizedCode, simulatedStack) {
        if (this.value instanceof OpConst) {
            simulatedStack.push({type: 'const', value: this.operator(this.value.value)});
        } else {
            simulatedStack.push({ type: 'unknown' });
            optimizedCode.push(this);
        }
    }

    get popStackCount() { return 0; }
   
    toJSON() {
        return {
        ...super.toJSON(),
        value: this.value,
        };
    }

    static create(ClassRef, data) {
        return new ClassRef(
        restoreDataType(data.value),
        );   
    }
}

class UnCommOp extends BaseUnComm {
    constructor() {
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === UnCommOp) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BinCommOpOp" напрямую.');
        }
    }

    toString(context) { return `${this.commandName()} st[top]`; }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const op = stack.pop();
        stack.push(this.operator(op));
    }

    foldConstants(optimizedCode, simulatedStack) {
        const st_top = simulatedStack.pop();
        if (st_top.type === 'const') {
            const calc_v = this.operator(st_top.value);
            simulatedStack.push({type: 'const', value: calc_v});
        } else {
            simulatedStack.push({ type: 'unknown' });
        }
    }

    get popStackCount() { return 1; }
    
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
//#endregion BaseUnCode

//#region PLUS
class PlusCommValue extends UnCommValue {
    constructor(value) {
        super(value);
    }
    
    commandName() { return 'plus'; }

    operator(op) { return op; }

    static get dataTypeName() { return "PlusCommValue"; }

    static fromJSON(data) { return UnCommValue.create(PlusCommValue, data); }
}
regCode(PlusCommValue);

class PlusCommOp extends UnCommOp {
    constructor() {
        super();
    }
    
    commandName() { return 'plus'; }

    operator(op) { return op; }

    static get dataTypeName() { return "PlusCommOp"; }

    static fromJSON(data) { return UnCommOp.create(PlusCommOp, data); }    
}
regCode(PlusCommOp);
//#endregion PLUS

//#region NEG
class NegCommValue extends UnCommValue {
    constructor(value) {
        super(value);
    }
    
    commandName() { return 'neg'; }

    operator(op) { return op.negate(); }

    static get dataTypeName() { return "NegCommValue"; }

    static fromJSON(data) { return UnCommValue.create(NegCommValue, data); }
}
regCode(NegCommValue);

class NegCommOp extends UnCommOp {
    constructor() {
        super();
    }
    
    commandName() { return 'neg'; }

    operator(op) { return op.negate(); }

    static get dataTypeName() { return "NegCommOp"; }

    static fromJSON(data) { return UnCommOp.create(NegCommOp, data); }    
}
regCode(NegCommOp);
//#endregion NEG

//#region NOT
class NotCommValue extends UnCommValue {
    constructor(value) {
        super(value);
    }
    
    commandName() { return 'not'; }

    operator(op) { return op.not(); }

    static get dataTypeName() { return "NotCommValue"; }

    static fromJSON(data) { return UnCommValue.create(NotCommValue, data); }
}
regCode(NotCommValue);

class NotCommOp extends UnCommOp {
    constructor() {
        super();
    }
    
    commandName() { return 'not'; }

    operator(op) { return op.not(); }

    static get dataTypeName() { return "NotCommOp"; }

    static fromJSON(data) { return UnCommOp.create(NotCommOp, data); }    
}
regCode(NotCommOp);
//#endregion NOT

//#region BaseBinCode
class BaseBinComm extends Command {
    constructor() {
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === BaseBinComm) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BaseBinComm" напрямую.');
        }
    }

    operator(l, r) { throw new Error("[Command]: Метод operator(l. r) не реализован."); }

    commandName() { throw new Error("[Command]: Метод commandName() не реализован."); }

    recreateCommValueValue(l_value, r_value) { throw new Error("[Command]: Метод recreateCommValueValue() не реализован."); }

    recreateCommOpValue(value) { throw new Error("[Command]: Метод recreateCommValueValue() не реализован."); }

    recreateCommValueOp(value) { throw new Error("[Command]: Метод recreateCommValueValue() не реализован."); }

    get pushStackCount() { return 1; }
}

class BinCommValueValue extends BaseBinComm {
    constructor(l_value, r_value) {
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === BinCommValueValue) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BinCommValueValue" напрямую.');
        }
        assertOperand(l_value, 'l_value', `${new.target.name}`);
        assertOperand(r_value, 'r_value', `${new.target.name}`);
        this.l_value = l_value;
        this.r_value = r_value;
    }

    toString(context) { return `${this.commandName()} ${this.l_value}, ${this.r_value}`; }

    internal_evaluate(context) {
        const { l, r } = dispatcher.promoteTypes(this.l_value.getValue(context), this.r_value.getValue(context));
        context.evaluate_stack.push(this.operator(l, r));
    }

    foldConstants(optimizedCode, simulatedStack) {
        if (this.l_value instanceof OpConst && this.r_value instanceof OpConst) {
            const { l, r } = dispatcher.promoteTypes(this.l_value.value, this.r_value.value);
            simulatedStack.push({type: 'const', value: this.operator(l, r)});
        } else {
            simulatedStack.push({ type: 'unknown' });
            optimizedCode.push(this);
        }
    }

    get popStackCount() { return 0; }
   
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
        // Защита от создания экземпляра самого базового класса
        if (new.target === BinCommOpValue) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BinCommOpValue" напрямую.');
        }
        assertOperand(value, 'value', `${new.target.name}`);
        this.value = value;
    }

    toString(context) { return `${this.commandName()} st[top], ${this.value}`; }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const l_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(l_op, this.value.getValue(context));
        stack.push(this.operator(l, r));
    }

    foldConstants(optimizedCode, simulatedStack) {
        const st_top = simulatedStack.pop();
        if (st_top.type === 'const' && this.value instanceof OpConst)
        {
            const { l, r } = dispatcher.promoteTypes(st_top.value, this.value.value);
            const calc_v = this.operator(l, r);
            simulatedStack.push({type: 'const', value: calc_v});   
        }
        else if (st_top.type === 'const') {
            // Нужно перессоздать BinCommValueValue
            optimizedCode.push(this.recreateCommValueValue(new OpConst(st_top.value), this.value));
            simulatedStack.push({ type: 'unknown' });
        } else {
            optimizedCode.push(this);
            simulatedStack.push({ type: 'unknown' });
        } 
    }

    get popStackCount() { return 1; }

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
        // Защита от создания экземпляра самого базового класса
        if (new.target === BinCommValueOp) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BinCommValueOp" напрямую.');
        }
        assertOperand(value, 'value', `${new.target.name}`);
        this.value = value;
    }

    toString(context) { return `${this.commandName()} ${this.value}, st[top]`; }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const r_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(this.value.getValue(context), r_op);
        stack.push(this.operator(l, r));
    }    

    foldConstants(optimizedCode, simulatedStack) {
        const st_top = simulatedStack.pop();
        if (st_top.type === 'const' && this.value instanceof OpConst)
        {
            const { l, r } = dispatcher.promoteTypes(this.value.value, st_top.value);
            const calc_v = this.operator(l, r);
            simulatedStack.push({type: 'const', value: calc_v});   
        }
        else if (st_top.type === 'const') {
            // Нужно перессоздать BinCommValueValue
            optimizedCode.push(this.recreateCommValueValue(this.value, new OpConst(st_top.value)));
            simulatedStack.push({ type: 'unknown' });
        } else {
            optimizedCode.push(this);
            simulatedStack.push({ type: 'unknown' });
        } 
    }

    get popStackCount() { return 1; }

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
        super();
        // Защита от создания экземпляра самого базового класса
        if (new.target === BinCommOpOp) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "BinCommOpOp" напрямую.');
        }
    }

    toString(context) { return `${this.commandName()} st[top - 1], st[top]`; }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const r_op = stack.pop();
        const l_op = stack.pop(); 
        const { l, r } = dispatcher.promoteTypes(l_op, r_op);
        stack.push(this.operator(l, r));
    }

    foldConstants(optimizedCode, simulatedStack) {
        const st_r = simulatedStack.pop();
        const st_l = simulatedStack.pop();
        if (st_l.type === 'const' && st_r.type === 'const') {
            const { l, r } = dispatcher.promoteTypes(st_l.value, st_r.value);
            const calc_v = this.operator(l, r);
            simulatedStack.push({type: 'const', value: calc_v});
        } else if (st_l.type === 'const') {
            // Пересоздать BinCommValueOp
            optimizedCode.push(this.recreateCommValueOp(new OpConst(st_l.value)));
            simulatedStack.push({ type: 'unknown' });
        } else if (st_r.type === 'const') {
            // Пересоздать BinCommOpValue
            optimizedCode.push(this.recreateCommOpValue(new OpConst(st_r.value)));
            simulatedStack.push({ type: 'unknown' });
        } else {
            optimizedCode.push(this);
            simulatedStack.push({ type: 'unknown' });
        }
    }

    get popStackCount() { return 2; }
    
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
        assertOperandVarable(let_value, 'let_value', 'AssignCommValueValue');
        assertOperand(value, 'value', 'AssignCommValueValue');
        this.let_value = let_value;
        this.value = value;
    }
    
    toString(context) { return `let ${this.let_value.toString(context)}, ${this.value.toString(context)}`; }

    internal_evaluate(context) {
        const sym = this.let_value.getSymbolNoCheck(context);
        const value = this.value.getValue(context);
        context.evaluate_stack.push(sym.value = value);
    }

    foldConstants(optimizedCode, simulatedStack) {
        /*if (this.value instanceof OpConst) {
            simulatedStack.push({type: 'const', value: this.value.value});
        }
        else simulatedStack.push({ type: 'unknown' });*/
        simulatedStack.push({ type: 'unknown' });
        optimizedCode.push(this);        
    }

    get pushStackCount() { return 1; }

    get popStackCount() { return 0; }
    
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
        assertOperandVarable(let_value, 'let_value', 'AssignCommValueValue');
        this.let_value = let_value;
    }

    toString(context) { return `let ${this.let_value.toString(context)}, st[top]`; }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const sym = this.let_value.getSymbolNoCheck(context);
        const value = stack.pop();
        stack.push(sym.value = value);
    }

    foldConstants(optimizedCode, simulatedStack) {
        const st_top = simulatedStack.pop();
        if (st_top.type === 'const') {
            optimizedCode.push(new AssignCommValueValue(this.let_value, new OpConst(st_top)));
        } else {
            optimizedCode.push(this);
        }
        simulatedStack.push({ type: 'unknown' });
    }

    get pushStackCount() { return 1; }

    get popStackCount() { return 1; }

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

    get pushStackCount() { return 1; }

    get popStackCount() { return 2; }
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

    get pushStackCount() { return 1; }

    get popStackCount() { return 3; }   
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

    get pushStackCount() { return 1; }

    get popStackCount() { return 3; }   
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

    get pushStackCount() { return 1; }

    get popStackCount() { return 4; }   
}
//#endregion INDEXING

//#region ADD
class AddCommValueValue extends BinCommValueValue {
    constructor(l_value, r_value) {
        super(l_value, r_value);
    }
    
    commandName() { return 'add'; }

    operator(l, r) { return l.add(r) }

    static get dataTypeName() { return "AddCodeValueValue"; }

    static fromJSON(data) { return BinCommValueValue.create(AddCommValueValue, data); }
}
regCode(AddCommValueValue);

class AddCommOpValue extends BinCommOpValue {
    constructor(value) {
        super(value);
    }
    
    commandName() { return 'add'; }

    operator(l, r) { return l.add(r) }
  
    static get dataTypeName() { return "AddCodeOpValue"; }

    static fromJSON(data) { return BinCommOpValue.create(AddCommOpValue, data); }    
}
regCode(AddCommOpValue);     

class AddCommValueOp extends BinCommValueOp {
    constructor(value) {
        super(value);
    }
    
    commandName() { return 'add'; }

    operator(l, r) { return l.add(r) }
}    

class AddCommOpOp extends BinCommOpOp {
    constructor() {
        super();
    }
    
    commandName() { return 'add'; }

    operator(l, r) { return l.add(r) }

    static get dataTypeName() { return "AddCodeOpOp"; }

    static fromJSON(data) { return BinCommOpOp.create(AddCommOpOp, data); }    
}
regCode(AddCommOpOp);

const recreateMethodsAdd = {
    recreateCommValueValue(l_value, r_value) { return new AddCommValueValue(l_value, r_value); },
    recreateCommOpValue(value) { return new AddCommOpValue(value); },
    recreateCommValueOp(value) { return new AddCommValueOp(value); }
};

const classesToExtendAdd = [AddCommValueValue, AddCommOpValue, AddCommValueOp, AddCommOpOp];
for (const cls of classesToExtendAdd) {
    Object.assign(cls.prototype, recreateMethodsAdd);
}
//#endregion ADD

//#region SUB
class SubCommValueValue extends BinCommValueValue {
    constructor(l_value, r_value) {
        super(l_value, r_value);
    }
    
    commandName() { return 'sub'; }

    operator(l, r) { return l.subtract(r) }

    static get dataTypeName() { return "SubCodeValueValue"; }

    static fromJSON(data) { return BinCommValueValue.create(SubCommValueValue, data); }
}
regCode(SubCommValueValue);    

class SubCommOpValue extends BinCommOpValue {
    constructor(value) {
        super(value);
    }
    
    commandName() { return 'sub'; }

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
    
    commandName() { return 'sub'; }

    operator(l, r) { return l.subtract(r) }

    static get dataTypeName() { return "SubCodeOpOp"; }

    static fromJSON(data) { return BinCommOpOp.create(SubCommOpOp, data); }    
}
regCode(SubCommOpOp);

const recreateMethodsSub = {
    recreateCommValueValue(l_value, r_value) { return new SubCommValueValue(l_value, r_value); },
    recreateCommOpValue(value) { return new SubCommOpValue(value); },
    recreateCommValueOp(value) { return new SubCommValueOp(value); }
};

const classesToExtendSub = [SubCommValueValue, SubCommOpValue, SubCommValueOp, SubCommOpOp];
for (const cls of classesToExtendSub) {
    Object.assign(cls.prototype, recreateMethodsSub);
}
//#endregion SUB 

const OperatorUnType = {
    PLUS: 0,
    NEG:  1,
    NOT:  2,
};

const OperatorBinType = {
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

function getUnKey(operator, operand) {
    return (operator << 8) + operand;
}

const SubstitutionTableUn = new Map([
    // PLUS
    [
        getUnKey(OperatorUnType.PLUS, OperandsType.CONST),
        (op) => { return [new PlusCommValue(op)]; }
    ],
    [
        getUnKey(OperatorUnType.PLUS, OperandsType.VARABLE),
        (op) => { return [new PlusCommValue(op)]; }
    ],
    [
        getUnKey(OperatorUnType.PLUS, OperandsType.EVALUATE),
        (op) => { return [...op, new PlusCommOp()]; }
    ],

    // NEG
    [
        getUnKey(OperatorUnType.NEG, OperandsType.CONST),
        (op) => { return [new NegCommValue(op)]; }
    ],
    [
        getUnKey(OperatorUnType.NEG, OperandsType.VARABLE),
        (op) => { return [new NegCommValue(op)]; }
    ],
    [
        getUnKey(OperatorUnType.NEG, OperandsType.EVALUATE),
        (op) => { return [...op, new NegCommOp()]; }
    ],

    // NOT
    [
        getUnKey(OperatorUnType.NOT, OperandsType.CONST),
        (op) => { return [new NotCommValue(op)]; }
    ],
    [
        getUnKey(OperatorUnType.NOT, OperandsType.VARABLE),
        (op) => { return [new NotCommValue(op)]; }
    ],
    [
        getUnKey(OperatorUnType.NOT, OperandsType.EVALUATE),
        (op) => { return [...op, new NotCommOp()]; }
    ],
]);

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
        (l_o, r_o) => { return [new AddCommValueValue(l_o, r_o)]; }
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

    // SUB
    [
        getBinKey(OperatorBinType.SUB, OperandsType.CONST, OperandsType.CONST),
        (l_o, r_o) => { return [new SubCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.VARABLE, OperandsType.CONST),
        (l_o, r_o) => { return [new SubCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.CONST, OperandsType.VARABLE),
        (l_o, r_o) => { return [new SubCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.VARABLE, OperandsType.VARABLE),
        (l_o, r_o) => { return [new SubCommValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.EVALUATE, OperandsType.CONST),
        (l_o, r_o) => { return [...l_o, new SubCommOpValue(r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.CONST, OperandsType.EVALUATE),
        (l_o, r_o) => { return [...r_o, new SubCommValueOp(l_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.EVALUATE, OperandsType.VARABLE),
        (l_o, r_o) => { return [...l_o, new SubCommOpValue(r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.VARABLE, OperandsType.EVALUATE),
        (l_o, r_o) => { return [...r_o, new SubCommValueOp(l_o)]; }
    ],
    [
        getBinKey(OperatorBinType.SUB, OperandsType.EVALUATE, OperandsType.EVALUATE),
        (l_o, r_o) => { return [...l_o, ...r_o, new SubCommOpOp()]; }
    ],

]);

export function is_comands(comands) {
    return Array.isArray(comands) && comands.every(item => item instanceof Command);
}

function getOperandType(op) {
    if (op instanceof OpConst) return OperandsType.CONST;
    else if (op instanceof OpVarable) return OperandsType.VARABLE;
    else if (Array.isArray(op) && op.every(item => item instanceof Command)) return OperandsType.EVALUATE;
    throw new TypeError(`[Code]: Неизвестны тип опранда ${op}`);
}

export function operandImplementСode(op) {
    if (op instanceof OperandValue) return [op.createCodePush()];
    else if (op instanceof Command) return [op];
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

export function createUnCode(operator, op) {
    const op_type = getOperandType(op);
    const key = getUnKey(operator, op_type);
    if (!SubstitutionTableUn.has(key)) {
        throw new Error(`Операция не поддерживается: не найден обработчик для ключа "${key}"`);
    }
    const processFn = SubstitutionTableUn.get(key);
    return processFn(op);
}

function unionCommands(...args) {
    if (args.length < 2) {
        throw new TypeError(`[Code]: Число параметров функции unionCode должно быть минимум 2`); 
    }
    let totalStackCount = 0;

    const commands = args.map(arg => {
        // Вызываем исходную функцию для каждого аргумента
        const implemented = operandImplementСode(arg);
        
        // Если это был OpConst или OpVarable, то operandImplementСode 
        // вернула массив, содержащий результат op.createCodePush()
        if (arg instanceof OperandValue) {
            // Берем созданный push-объект и прибавляем его stack count к общей сумме
            const codePushObj = implemented[0];
            totalStackCount += codePushObj.pushStackCount - codePushObj.popStackCount;
        }

        return implemented;
    }).flat(Infinity);

    // Возвращаем объект, содержащий и массив, и сумму
    return {
        commands,
        totalStackCount
    };   
    //return args.map(operandImplementСode).flat(Infinity);
}

export const self = null;
export class CommandBuilder {
	#currentCode;
    #countStack;   

    constructor() {
        // Храним текущий накопленный код
        this.#currentCode = null;
        this.#countStack = 0;
    }

    get isConstant() { return this.#currentCode instanceof OpConst; }

    get constant() {
        if (this.isConstant) return this.#currentCode.value;
        throw new Error(`[CommandBuilder] Код не содержит кнстантное значение`);
    }

    get countStack() { return this.#countStack; }

    #checkCountStack() { 
        if (this.#countStack < 0) throw new Error(`[CommandBuilder] Неверный набор каоманд. Отрицательный стек`); 
    }

    // Вспомогательный метод для объединения текущего кода с новым
    #append(newCode) {
        if (this.#currentCode === null) {
            this.#currentCode = newCode;
        } else {
            const result = unionCommands(this.#currentCode, newCode);
            this.#currentCode = result.commands;
            this.#countStack += result.totalStackCount;
            this.#checkCountStack();
        }
    }

    #checkOperand(op) {
        if (op instanceof OperandValue || op === self) return { op, st_c: 0 };
        if (op instanceof CommandBuilder) return { op: op.build(), st_c: op.countStack };
        throw new Error(`[CommandBuilder] Недопустимый операнд ${op}`);
    }
	
    #checkCountStackCommand(comm, add = 0) {
        const oper = Array.isArray(comm) ? comm.at(-1) : comm;
        this.#countStack += oper.pushStackCount - oper.popStackCount + add;
        this.#checkCountStack(); 
        return comm;
    }

	#creatorBin(operand, l_op, r_op) {
        const { op: l, st_c:l_sc } = this.#checkOperand(l_op);
        const { op: r, st_c:r_sc } = this.#checkOperand(r_op);
		if (l === self && r === self) {
            this.#currentCode = 
                this.#checkCountStackCommand(createBinCode(operand, this.#currentCode, this.#currentCode), this.#countStack);
        }
		else if (l === self) {
            this.#currentCode = 
                this.#checkCountStackCommand(createBinCode(operand, this.#currentCode, r), r_sc);
        }
		else if (r === self) {
            this.#currentCode = 
                this.#checkCountStackCommand(createBinCode(operand, l, this.#currentCode), l_sc);
		} else {
            this.#append(this.#checkCountStackCommand(createBinCode(operand, l, r), l_sc + r_sc));
		}
		return this;
	}

 	#creatorUn(operand, op) {
        const { op: l, st_c:l_sc } = this.#checkOperand(op);
		if (l === self) {
            this.#currentCode = 
                this.#checkCountStackCommand(createUnCode(operand, this.#currentCode));
		} else {
            this.#append(this.#checkCountStackCommand(createUnCode(operand, l), l_sc));
		}
		return this;
	}
   
    location(loc) {
        this.#append(this.#checkCountStackCommand(new LocationComm(loc)));
        return this;
    }

    report(astNode) {
        this.#append(this.#checkCountStackCommand(new ReportComm(astNode)));
        return this;
    }

    error(msg) {
        this.#append(this.#checkCountStackCommand(new ErrorComm(msg)));
        return this;
    }

    //#region UN
    plus(op) {
        return this.#creatorUn(OperatorUnType.PLUS, op);
    }    

    neg(op) {
        return this.#creatorUn(OperatorUnType.NEG, op);
    }    

    not(op) {
        return this.#creatorUn(OperatorUnType.NOR, op);
    }
    //#endregion UN    

    //#region BIN
    assign(l_op, r_op) {
		return this.#creatorBin(OperatorBinType.ASSIGN, l_op, r_op);
    }

    add(l_op, r_op) {
		return this.#creatorBin(OperatorBinType.ADD, l_op, r_op);
    }

    sub(l_op, r_op) {
		return this.#creatorBin(OperatorBinType.SUB, l_op, r_op);
    }
    //#endregion BIN

    // Команда POP
    pop() {
        // На всякий случай
        this.#append(this.#checkCountStackCommand(new PopComm()));
        return this;
    }

    // Финальный метод, который возвращает готовый результат
    build() {
        return this.isConstant ? [] : this.#currentCode;
    }
    
    foldConstants() {
        if (!this.#currentCode || this.isConstant) return;
        const optimizedCode = [];
        const simulatedStack = [];

        for (const comm of this.#currentCode) {
            comm.foldConstants(optimizedCode, simulatedStack);
        }
        this.#currentCode = optimizedCode;
        if (this.#currentCode.length === 0) {
            const v_top = simulatedStack.at(-1);
            if (v_top.type === 'const') this.#append(new OpConst(v_top.value));
        }
        else this.removeDuplicateLocations();    
    }

    removeDuplicateLocations() {
        if (!this.#currentCode || this.isConstant) return;
        this.#currentCode = this.#currentCode.filter((item, index, arr) => {
            // Если это не целевой тип, просто оставляем элемент
            if (!(item instanceof LocationComm)) return true; 
            return !(arr[index - 1] instanceof LocationComm);
        });
    }
}