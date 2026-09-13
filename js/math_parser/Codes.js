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
    constructor(value) {
        this.value = value;
    }
    getValue(context) { return value; }
}

export class OpVarableLocal extends Code {
    #value;
    constructor(id_name) {
        this.id_name = id_name;
    }
    getValue(context) {
        const sym = context.scope_context.getSymbolById(this.id_name); 
        if (sym === null) {
        this.error(context, `Идентификатор "${this.name}" не опредилён.`);
        }
        else if (sym.type === SYM_UNDEFINED) {
        this.error(context, `Переменная "${this.name}" не инициализирована.`);
        return this.errorValue();
        }
        else if (sym.type !== SYM_VARIABLE) {
        this.error(context, `Идентификатор "${this.name}" не является переменной.`);
        return this.errorValue();
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

class BinCodeOpValue extends BaseBinCode {
    constructor(value, loc, astNode = null) {
        super(loc, astNode);
        this.value = value;
    }

    internal_evaluate(context) {
        const stack = context.evaluate_stack; 
        const l_op = stack.pop();
        const { l, r } = dispatcher.promoteTypes(l_op, value);
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
        const { l, r } = dispatcher.promoteTypes(value, r_op);
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

class SubCodeOpValue extends BinCodeOpValue {
    constructor(value, loc, astNode = null) {
        super(value, loc, astNode);
    }
    
    operator(l, r) { return l.sub(r) }
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
    VALUE       0,
    EVALUATE    1,
    EVALUATES   2
};

function getBinKey(operator, l_operand, r_operand) {
    return (operator << 8) + (l_operand << 2) + r_operand,
}

SubstitutionTableBin = new Map([
    [
        getBinKey(OperationCode.ADD, OperandsType.VALUE, OperandsType.VALUE),
        ([l_o, r_o, loc, astNode]) => { const { l, r } = dispatcher.promoteTypes(l_op, r_o); return new OpConst(l.add(r)); }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATE, OperandsType.VALUE),
        ([l_o, r_o, loc, astNode]) => { return new AddCodeOpValue(r_o, loc, astNode); }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATES, OperandsType.VALUE),
        ([l_o, r_o, loc, astNode]) => { return [...l_o, new AddCodeOpValue(r_o, loc, astNode)]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VALUE, OperandsType.EVALUATE),
        ([l_o, r_o, loc, astNode]) => { return new AddCodeValueOp(l_o, loc, astNode); }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.VALUE, OperandsType.EVALUATES),
        ([l_o, r_o, loc, astNode]) => { return [new AddCodeValueOp(l_o, loc, astNode), ...r_o]; }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATE, OperandsType.EVALUATE),
        ([l_o, r_o, loc, astNode]) => { return new AddCodeOpOp(loc, astNode); }
    ],
    [
        getBinKey(OperationCode.ADD, OperandsType.EVALUATES, OperandsType.EVALUATES),
        ([l_o, r_o, loc, astNode]) => { return [...l_o, ...r_o, new AddCodeOpOp(loc, astNode)]; }
    ],
]);

function getOperandType(op) {
    if (l_op instanceof OpValue) return OperandType.VALUE;
    else if (l_op instanceof Code ) return OperandType.EVALUATE;
    else if (Array.isArray(op) && op.every(item => item instanceof Code) return OperandType.EVALUATES;
    throw new Error(`[Code]: Неизвестны тип опранда ${op}`);
}

export function createBinCode(operator, l_op, r_o, loc, astNode = null) {
    const lop_type = getOperandType(l_op);
    const rop_type = getOperandType(r_op);
    return SubstitutionTableBin.get(getBinKey(operator, lop_type, rop_type))(l_op, r_o);
}