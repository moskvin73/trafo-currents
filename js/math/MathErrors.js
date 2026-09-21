export class ErrorCastMathTypeNoValue extends TypeError {
    constructor(message, currentClassName) {
        super(message);
        this.currentClassName = currentClassName;
        this.name = "ErrorCastMathTypeNoValue";
    }
}