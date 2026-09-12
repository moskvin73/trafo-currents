import { registerDataType, restoreDataType } from '../DataTypeRegistry.js';

class EvaluateError  extends Error {
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
            if (err instanceof EvaluateError) this.error(context, err.toString());
            else throw err;
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
    constructor(msg, loc) {
        super(null);
        this.msg = msg;
    }

  internal_evaluate(context) {
    throw this.msg;
  }
}

