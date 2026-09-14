import BoolValue from '../math/BoolValue.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';
import { restoreLocation } from './CompilerErrors.js';
import { dispatcher } from './SemanticDispatcher.js';
import { SYM_UNDEFINED, SYM_VARIABLE, SYM_BUILTIN } from './SymbolTableContext.js';

class EvaluateError extends Error {
  constructor(message) {
    super(message);
    this.name = "EvaluateError";
  }
}

export class Code {
    constructor() {
    }

    error(context, msg, loc) {
        context.error(msg, loc ?? this.loc, "Runtime");
    }

    evaluate(context) {
        try
        {
            return this.internal_evaluate(context);
        }
        catch(err)
        {
            this.error(context, err.toString());
        }
    }
 
    /** Внутренний метод вычисляет значение узла, возвращая экземпляр MathType (ComplexNumber/Matrix) */
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

export class ErrorCode extends Code {
    constructor(msg, loc, astNode = null) {
        super(loc, astNode);
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

export class PushCodeConst extends Code {
    constructor(value) {
        this.value = value;
    }

    internal_evaluate(context) {
        context.evaluate_stack.push(value);
    }
}

export class PushCodeVarbleLocal extends Code {
    constructor(id_name) {
        this.id_name = id_name;
    }

    internal_evaluate(context) {
        sym = context.scope_context.getSymbolById(this.id_name);
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
            context.evaluate_stack.push(sym.value);
        }
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
        if (this.symbol === SYM_UNDEFINED) {
            this.error(context, `Переменная "${this.name}" не инициализирована.`);
        }
        else if (this.symbol !== SYM_VARIABLE) {
            this.error(context, `Идентификатор "${this.name}" не является переменной.`);
        }
        else {
            context.evaluate_stack.push(sym.value);
        }
    }
}

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

    createCodePush() { new PushCodeConst(this.value); }

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

    createCodePush() { new PushCodeVarbleLocal(this.id_name); }

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
    }

    getSymbol(context) { return this.symbol; }

    createCodePush() { new PushCodeVarbleGlobal(this.symbol); }
}
//#endregion CONST_VAR 

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

export const OperatorBinType {
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

export const OperandType {
    CONST       0,
    VARABLE     1,
    EVALUATE    2,
};

function getBinKey(operator, l_operand, r_operand) {
    return (operator << 8) + (l_operand << 4) + r_operand;
}

const SubstitutionTableBin = new Map([
    // ASSIGN
    [
        getBinKey(OperationCode.ASSIGN, OperandsType.VARABLE, OperandsType.CONST),
        ([l_o, r_o]) => { return [new AssignCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperationCode.ASSIGN, OperandsType.VARABLE, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [new AssignCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VARABLE, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [new AssignCodeValueOp(l_o), ...r_o]; }
    ],

    // ADD
    [
        getBinKey(OperationCode.ADD, OperandsType.CONST, OperandsType.CONST),
        ([l_o, r_o]) => {
            const { l, r } = dispatcher.promoteTypes(l_op.getValue(), r_o.getValue()); 
            return new OpConst(l.add(r)); 
        }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VARABLE, OperandsType.CONST),
        ([l_o, r_o]) => { return [new AddCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.CONST, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [new AddCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VARABLE, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [new AddCodeValueValue(l_o, r_o)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATE, OperandsType.CONST),
        ([l_o, r_o]) => { return [...l_o, new AddCodeOpValue(r_o)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.CONST, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [new AddCodeValueOp(l_o), ...r_o]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATE, OperandsType.VARABLE),
        ([l_o, r_o]) => { return [...l_o, new AddCodeOpValue(r_o)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VARABLE, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [new AddCodeValueOp(l_o), ...r_o]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATES, OperandsType.EVALUATE),
        ([l_o, r_o]) => { return [...l_o, ...r_o, new AddCodeOpOp()]; }
    ],

]);

export function getOperandType(op) {
    if (op instanceof OpConst) return OperandType.CONST;
    else if (op instanceof OpVarable) return OperandType.VARABLE;
    else if (Array.isArray(op) && op.every(item => item instanceof Code) return OperandType.EVALUATES;
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