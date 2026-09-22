export class ErrorBase extends Error {
    constructor(message, options) {
        super(message, options);
        this.name = "ErrorBase";
    }
}

export class ErrorMath extends ErrorBase {
    constructor(message, options) {
        super(message, options);
        this.name = "ErrorMath";

        // Защита от создания экземпляра самого базового класса
        if (new.target === ErrorMath) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "ErrorMath" напрямую.');
        }
    }

    createMessages(funcGetTypeNameString) {
        if (funcGetTypeNameString === 'function')
            return this.getMes(funcGetTypeNameString); 
        return this.message; 
    }

    // Виртуальный метод, который должен быть переопределен в локальных классах
    getMes(_funcGetTypeNameString) {
        throw new Error('Метод getMes() должен быть переопределен в подклассе.');
    }    
}