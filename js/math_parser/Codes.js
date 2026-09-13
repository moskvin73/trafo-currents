import BoolValue from '../math/BoolValue.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';
import { restoreLocation } from './CompilerErrors.js';
import { dispatcher } from './SemanticDispatcher.js';

class EvaluateError extends Error {
  constructor(message) {
    super(message);
    this.name = "EvaluateError";
  }
}

export class Code {
    constructor(loc, astNode = null) {
        this.astNode = astNode;
        this.loc = loc;
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
      loc: this.loc, 
      astNode: this.astNode
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
regAST(ErrorCode);

export class IF_Code extends Code {
    constructor(len_code_false, loc, astNode = null) {
        super(loc, astNode);
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
            restoreLocation(data.loc),
            restoreDataType(data.astNode)
        );
    }  
}
regAST(IF_Code);

export class OpValue {
    getValue() { throw new Error("[Code]: Метод value() не реализован."); }
}

export class OpConst extends Code {
    constructor(value, loc, astNode = null) {
        super(loc, astNode);
        this.value = value;
    }
    getValue(context) { return value; }
}

export class OpVarable extends Code {
    constructor(loc, astNode = null) {
        super(loc, astNode);
    }

    getSymbol() { throw new Error("[Code]: Метод getSymbol() не реализован."); }

    getValue(context) {
        const sym = getSymbol(); 
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
    constructor(id_name, loc, astNode = null) {
        super(loc, astNode);
        this.id_name = id_name;
    }
    getValue(context) {
        const sym = context.scope_context.getSymbolById(this.id_name); 
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

export class OpVarableGlobal extends OpVarable {
    constructor(sym, loc, astNode = null) {
        super(loc, astNode);
        this.symbol = sym;
    }
    getValue(context) {
        const sym = this.symbol;
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

class BaseBinCode extends Code {
    constructor(loc, astNode = null) {
        super(loc, astNode);
    }

    operator(l, r) { throw new Error("[Code]: Метод operator(l. r) не реализован."); }
}

class BinCodeValueValue extends BaseBinCode {
    constructor(l_value, r_value, loc, astNode = null) {
        super(loc, astNode);
        this.l_value = l_value;
        this.r_value = r_value;
    }

    internal_evaluate(context) {
        const { l, r } = dispatcher.promoteTypes(this.l_value.getValue(context), this.r_value.getValue(context));
        stack.push(operator(l, r));
    }    
}

class BinCodeOpValue extends BaseBinCode {
    constructor(value, loc, astNode = null) {
        super(loc, astNode);
        this.value = value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const l_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(l_op, this.value.getValue(context));
        stack.push(operator(l, r));
    }    
}

class BinCodeValueOp extends BaseBinCode {
    constructor(value, loc, astNode = null) {
        super(loc, astNode);
        this.value = value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const r_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(this.value.getValue(context), r_op);
        stack.push(operator(l, r));
    }    
}    

class BinCodeOpOp extends BaseBinCode {
    constructor(loc, astNode = null) {
        super(loc, astNode);
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack;
        const r_op = stack.pop();
        const l_op = stack.pop(); 
        const { l, r } = dispatcher.promoteTypes(l_op, r_op);
        stack.push(operator(l, r));
    }    
}    

class AddCodeValueValue extends BinCodeValueValue {
    constructor(l_value, r_value, loc, astNode = null) {
        super(l_value, r_value, loc, astNode);
    }
    
    operator(l, r) { return l.add(r) }
}    

class AddCodeOpValue extends BinCodeOpValue {
    constructor(value, loc, astNode = null) {
        super(value, loc, astNode);
    }
    
    operator(l, r) { return l.add(r) }
}    

class AddCodeValueOp extends BinCodeValueOp {
    constructor(value, loc, astNode = null) {
        super(value, loc, astNode);
    }
    
    operator(l, r) { return l.add(r) }
}    

class AddCodeOpOp extends BinCodeOpOp {
    constructor(loc, astNode = null) {
        super(loc, astNode);
    }
    
    operator(l, r) { return l.add(r) }
}    

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
    return (operator << 8) + (l_operand << 4) + r_operand,
}

SubstitutionTableBin = new Map([
    [
        getBinKey(OperationCode.ADD, OperandsType.CONST, OperandsType.CONST),
        ([l_o, r_o, loc, astNode]) => {
            const { l, r } = dispatcher.promoteTypes(l_op.getValue(), r_o.getValue()); 
            return new OpConst(l.add(r)); 
        }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VARABLE, OperandsType.CONST),
        ([l_o, r_o, loc, astNode]) => { return [new AddCodeValueValue(l_o, r_o, loc, astNode)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.CONST, OperandsType.VARABLE),
        ([l_o, r_o, loc, astNode]) => { return [new AddCodeValueValue(l_o, r_o, loc, astNode)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VARABLE, OperandsType.VARABLE),
        ([l_o, r_o, loc, astNode]) => { return [new AddCodeValueValue(l_o, r_o, loc, astNode)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATE, OperandsType.VALUE),
        ([l_o, r_o, loc, astNode]) => { return [...l_o, new AddCodeOpValue(r_o, loc, astNode)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VALUE, OperandsType.EVALUATE),
        ([l_o, r_o, loc, astNode]) => { return [new AddCodeValueOp(l_o, loc, astNode), ...r_o]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATES, OperandsType.EVALUATE),
        ([l_o, r_o, loc, astNode]) => { return [...l_o, ...r_o, new AddCodeOpOp(loc, astNode)]; }
    ],
]);

function getOperandType(op) {
    if (l_op instanceof OpValue) return OperandType.VALUE;
    else if (Array.isArray(op) && op.every(item => item instanceof Code) return OperandType.EVALUATES;
    throw new Error(`[Code]: Неизвестны тип опранда ${op}`);
}

export function createBinCode(operator, l_op, r_o, loc, astNode = null) {
    const lop_type = getOperandType(l_op);
    const rop_type = getOperandType(r_op);
    return SubstitutionTableBin.get(getBinKey(operator, lop_type, rop_type))(l_op, r_o, loc, astNode);
}