import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';

class EvaluateError  extends Error {
  constructor(message, loc) {
    super(message);
    this.name = "EvaluateError";
    this.loc = loc;
  }
}

export class Code {
    constructor(astNode = null, loc = null) {
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
}

function regCode(ClassRef) {
  registerDataType(ClassRef.dataTypeName, ClassRef.fromJSON);
}

export class ErrorCode extends ASTNode {
    constructor(msg) {
        super(null);
        this.msg = msg;
    }

  internal_evaluate(context) {
    throw this.msg;
  }
}

