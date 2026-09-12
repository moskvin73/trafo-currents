import BoolValue from '../math/BoolValue.js';
import RealNumber from '../math/RealNumber.js';
import ComplexNumber from '../math/ComplexNumber.js';
import Matrix from '../math/Matrix.js';
import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';
import { restoreLocation } from './CompilerErrors.js';

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
