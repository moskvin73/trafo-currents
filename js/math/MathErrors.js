export class ErrorMath extends TypeError {
    constructor(message) {
        super(message);
        this.currentClassName = currentClassName;
        this.name = "ErrorMath";
    }

    createMessages(funcGetTypeNameString) {
        if (funcGetTypeNameString === 'function')
            return interanlcreateMessages(funcGetTypeNameString); 
        return ''; 
    }
}

export class ErrorCastMathTypeNoValue extends TypeError {
    constructor(message, currentClassName) {
        super(message);
        this.currentClassName = currentClassName;
        this.name = "ErrorCastMathTypeNoValue";
    }
}