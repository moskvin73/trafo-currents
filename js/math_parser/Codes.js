import BoolValue from '../math/BoolValue.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';
import { restoreLocation } from './CompilerErrors.js';
import { dispatcher } from './SemanticDispatcher.js';
import { SYM_UNDEFINED, SYM_VARIABLE, SYM_BUILTIN } from './SymbolTableContext.js';
import VarableCode from '../varables/VarableCode.js';

export class EvaluateError extends Error {
  constructor(message, processed) {
    super(message);
    this.name = "EvaluateError";
    this.processed = processed;
  }
}

export class Code {
    constructor() {}

    error(context, msg) { throw new Error(msg); }

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
                context.error(msg, loc ?? this.loc, "Runtime");
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

function regCode(ClassRef) {
  registerDataType(ClassRef.dataTypeName, ClassRef.fromJSON);
}

export class LocationCode extends Code {
    constructor(loc) {
        super();
        this.loc = loc;
    }

    internal_evaluate(context) {
        context.evaluate_loc = loc;
    }
}

export class ReportCode extends Code {
    constructor(astNode) {
        super();
        this.astNode = astNode;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const len = stack.length;
        if (len > 0) {
            context.createReportRecord(this.astNode, stack[len - 1]);
        }
    }
}

export class ErrorCode extends Code {
    constructor(msg) {
        super();
        this.msg = msg;
    }

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
    return new ErrorCode(
      data.msg,
      restoreLocation(data.loc),
      restoreDataType(data.astNode)
    );
  }
}
regCode(ErrorCode);

export class IF_Code extends Code {
    constructor(len_code_false) {
        super();
        this.len_code_false = len_code_false;
    }

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
        return new IF_Code(
            data.len_code_false,
        );
    }  
}
regCode(IF_Code);

export class Goto_Code extends Code {
    constructor(len_code) {
        super();
        this.len_code = len_code;
    }

    internal_evaluate(context) {
        context.index_code += this.len_code;
    }
}

export class DefineVarableCodeNode extends Code {
    constructor(funcId, statements, paramsCount, localsCount) {
        super();
        this.funcId = funcId;
        this.statements = statements;
        this.paramsCount = paramsCount;
        this.localsCount = localsCount;
    }

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
}

export class PushCodeConst extends Code {
    constructor(value) {
        this.value = value;
    }

    internal_evaluate(context) {
        context.evaluate_stack.push(value);
    }
}


function checkSymbol(sym) {
    if (sym === null) throw new Error(`Символ не опредилён.`);
    const name = sym.name;
    if (sym.type === SYM_UNDEFINED) {
        throw new Error(`Переменная "${name}" не инициализирована.`);
    }
    else if (sym.type !== SYM_VARIABLE) {
       throw new Error(context, `Идентификатор "${name}" не является переменной.`);
    }
}

function checkSymbolAll(sym) {
    if (sym === null) throw new Error(`Символ не опредилён.`);
    checkSymbol(sym);
}

export class PushCodeVarbleLocal extends Code {
    constructor(id_name) {
        this.id_name = id_name;
    }

    internal_evaluate(context) {
        sym = context.scope_context.getSymbolById(this.id_name);
        checkSymbolAll(sym);
        context.evaluate_stack.push(sym.value);
    }
}

export class PushCodeVarbleGlobal extends Code {
    constructor(sym) {
        if (sym === null) {
            this.error(context, `Идентификатор "${this.name}" не опредилён.`);
        }
        this.symbol = sym;
    }

    internal_evaluate(context) {
        checkSymbol(his.symbo);
        context.evaluate_stack.push(sym.value);
    }
}

//#region CONST_VAR 
export class OpValue {
    getValue(context) { throw new Error("[Code]: Метод value() не реализован."); }

    createCodePush() { throw new Error("[Code]: Метод createCodePush() не реализован."); }
}
 
export class OpConst extends OpValue {
    constructor(value) {
        super();
        this.value = value;
    }

    getValue(context) { return value; }

    createCodePush() { return new PushCodeConst(this.value); }

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

    getSymbol(context) { throw new Error("[Code]: Метод getSymbol() не реализован."); }

    getValue(context) {
        const sym = getSymbol(context); 
        if (sym === null) {
            this.error(context, `Идентификатор "${this.name}" не опредилён.`);
        }
        else if (sym.type === SYM_UNDEFINED) {
            this.error(context, `Переменная "${this.name}" не инициализирована.`);
            //return this.errorValue();
        }
        else if (sym.type !== SYM_VARIABLE) {
            this.error(context, `Идентификатор "${this.name}" не является переменной.`);
            //return this.errorValue();
        }
        else {
            return sym.value;
        }
    }
}

export class OpVarableLocal extends OpVarable {
    constructor(id_name) {
        super();
        this.id_name = id_name;
    }

    getSymbol(context) { return context.scope_context.getSymbolById(this.id_name); }

    createCodePush() { return new PushCodeVarbleLocal(this.id_name); }

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
        this.symbol = sym;
        if (sym.name === null) throw new Error("Локальная преременная в OpVarableGlobal");
    }

    getSymbol(context) { return this.symbol; }

    createCodePush() { return new PushCodeVarbleGlobal(this.symbol); }

    toJSON() {
        // Пока просто проеряем
        const context = this.symbol.context;
        if (context) {
            // Переменная присутсвует в контексте
            const id = context.getIdByName(sym.name);
            if (id === null) throw new Error("OpVarableGlobal id = null toJSON()");
            return {
                ...super.toJSON(),
                present_in_contex: true,
                id_name: id
            };
        } else throw new Error("OpVarableGlobal ontext = null toJSON()");
    }

    static get dataTypeName() { return "OpVarableGlobal"; }

    static fromJSON(data) {
        if (data.present_in_contex) {
            const context = data.context;
            const id = data.id;
            const sym = context.getParseSymbolById(id);
            return new OpVarableGlobal(sym);
        }
        else throw new Error("OpVarableGlobal ata.present_in_contex = false fromJSON(data)");
    }
}
//#endregion CONST_VAR 

export class MatrixCode extends Code {
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
class BaseBinCode extends Code {
    constructor() {
        super();
    }

    operator(l, r) { throw new Error("[Code]: Метод operator(l. r) не реализован."); }
}

class BinCodeValueValue extends BaseBinCode {
    constructor(l_value, r_value) {
        super();
        this.l_value = l_value;
        this.r_value = r_value;
    }

    internal_evaluate(context) {
        const { l, r } = dispatcher.promoteTypes(this.l_value.getValue(context), this.r_value.getValue(context));
        stack.push(operator(l, r));
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

class BinCodeOpValue extends BaseBinCode {
    constructor(value) {
        super();
        this.value = value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const l_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(l_op, this.value.getValue(context));
        stack.push(operator(l, r));
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

class BinCodeValueOp extends BaseBinCode {
    constructor(value) {
        super();
        this.value = value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const r_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(this.value.getValue(context), r_op);
        stack.push(operator(l, r));
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

class BinCodeOpOp extends BaseBinCode {
    constructor() {
        super(loc, astNode);
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const r_op = stack.pop();
        const l_op = stack.pop(); 
        const { l, r } = dispatcher.promoteTypes(l_op, r_op);
        stack.push(operator(l, r));
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

//#rigion ASSIGN
class AssignCodeValueValue extends Code {
    constructor(let_value, value) {
        super();
        this.let_value = let_value;
        this.value = value;
    }
    
    internal_evaluate(context) {
        const sym = this.let_value.getSymbol(context);
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
        return new AssignCodeValueValue(
            restoreDataType(data.let_value),
            restoreDataType(data.value)
        );
     }    
}
regCode(AssignCodeValueValue);

class AssignCodeValueOp extends Code {
    constructor(let_value) {
        super();
        this.let_value = let_value;
    }

    internal_evaluate(context) {
        const sym = this.let_value.getSymbol(context);
        const value = stack.pop();
        context.evaluate_stack.push(sym.value = value);
    }

     toJSON() {
        return {
        ...super.toJSON(),
        let_value: this.let_value
        };
    }
   
    static get dataTypeName() { return "AssignCodeValueOp"; }

    static fromJSON(data) {
        return new AssignCodeValueOp(
            restoreDataType(data.let_value)
        );
     }    
}
regCode(AssignCodeValueOp);
//#endrigion ASSIGN

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

//#region INDEXING
export class IndexRowCode extends Code {
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

export class AssignIndexRowCode extends Code {
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

export class IndexMatrixCode extends Code {
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

export class AssignIndexMatrixCode extends Code {
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
class AddCodeValueValue extends BinCodeValueValue {
    constructor(l_value, r_value) {
        super(l_value, r_value);
    }
    
    operator(l, r) { return l.add(r) }

    static get dataTypeName() { return "AddCodeValueValue"; }

    static fromJSON(data) { return BinCodeValueValue.create(AddCodeValueValue, data); }
}
regCode(AddCodeValueValue);

class AddCodeOpValue extends BinCodeOpValue {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.add(r) }
  
    static get dataTypeName() { return "AddCodeOpValue"; }

    static fromJSON(data) { return BinCodeOpValue.create(AddCodeOpValue, data); }    
}
regCode(AddCodeOpValue);     

class AddCodeValueOp extends BinCodeValueOp {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.add(r) }
}    

class AddCodeOpOp extends BinCodeOpOp {
    constructor() {
        super();
    }
    
    operator(l, r) { return l.add(r) }

    static get dataTypeName() { return "AddCodeOpOp"; }

    static fromJSON(data) { return BinCodeOpOp.create(AddCodeOpOp, data); }    
}
regCode(AddCodeOpOp);
//#endregion ADD

//#region SUB
class SubCodeValueValue extends BinCodeValueValue {
    constructor(l_value, r_value) {
        super(l_value, r_value);
    }
    
    operator(l, r) { return l.subtract(r) }

    static get dataTypeName() { return "SubCodeValueValue"; }

    static fromJSON(data) { return BinCodeValueValue.create(SubCodeValueValue, data); }
}
regCode(SubCodeValueValue);    

class SubCodeOpValue extends BinCodeOpValue {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.subtract(r) }
  
    static get dataTypeName() { return "SubCodeOpValue"; }

    static fromJSON(data) { return BinCodeOpValue.create(SubCodeOpValue, data); }    
}
regCode(SubCodeOpValue);     

class SubCodeValueOp extends BinCodeValueOp {
    constructor(value) {
        super(value);
    }
    
    operator(l, r) { return l.subtract(r) }
}    

class SubCodeOpOp extends BinCodeOpOp {
    constructor() {
        super();
    }
    
    operator(l, r) { return l.subtract(r) }

    static get dataTypeName() { return "SubCodeOpOp"; }

    static fromJSON(data) { return BinCodeOpOp.create(SubCodeOpOp, data); }    
}
regCode(SubCodeOpOp);       
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
        ([l_o, r_o]) => { return [new AssignCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ASSIGN, OperandsType.VARABLE, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [new AssignCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.VARABLE, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [new AssignCodeValueOp(l_o), ...r_o]; }
    ],

    // ADD
    [
        getBinKey(OperatorBinType.ADD, OperandsType.CONST, OperandsType.CONST),
        ([l_o, r_o]) => {
            const { l, r } = dispatcher.promoteTypes(l_op.getValue(), r_o.getValue()); 
            return new OpConst(l.add(r)); 
        }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.VARABLE, OperandsType.CONST),
        ([l_o, r_o]) => { return [new AddCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.CONST, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [new AddCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.VARABLE, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [new AddCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.EVALUATE, OperandsType.CONST),
        ([l_o, r_o]) => { return [...l_o, new AddCodeOpValue(r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.CONST, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [new AddCodeValueOp(l_o), ...r_o]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.EVALUATE, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [...l_o, new AddCodeOpValue(r_o)]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.VARABLE, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [new AddCodeValueOp(l_o), ...r_o]; }
    ],
    [
        getBinKey(OperatorBinType.ADD, OperandsType.EVALUATES, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [...l_o, ...r_o, new AddCodeOpOp()]; }
    ],

]);

function getOperandType(op) {
    if (op instanceof OpConst) return OperandsType.CONST;
    else if (op instanceof OpVarable) return OperandsType.VARABLE;
    else if (Array.isArray(op) && op.every(item => item instanceof Code)) return OperandsType.EVALUATES;
    throw new TypeError(`[Code]: Неизвестны тип опранда ${op}`);
}

export function operandImplementСode(op) {
    if (op instanceof OpConst || op instanceof OpVarable) return [op.createCodePush()];
    else if (Array.isArray(op) && op.every(item => item instanceof Code)) return op;
    throw new TypeError(`[Code]: Неизвестны тип опранда ${op}`); 
} 

export function createBinCode(operator, l_op, r_o) {
    const lop_type = getOperandType(l_op);
    const rop_type = getOperandType(r_op);
    const key = getBinKey(operator, lop_type, rop_type);
    if (!SubstitutionTableBin.has(key)) {
        throw new Error(`Операция не поддерживается: не найден обработчик для ключа "${key}"`);
    }
    const processFn = SubstitutionTableBin.get(key);
    return processFn(l_op, r_o);
}