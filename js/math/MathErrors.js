export class ErrorMath extends TypeError {
    constructor(message) {
        super(message);
        this.name = "ErrorMath";

        // Защита от создания экземпляра самого базового класса
        if (new.target === ErrorMath) {
            throw new TypeError('Нельзя создавать экземпляры базового класса "ErrorMath" напрямую.');
        }
    }

    createMessages(funcGetTypeNameString) {
        if (funcGetTypeNameString === 'function')
            return this.interanlcreateMessages(funcGetTypeNameString); 
        return this.message; 
    }

    // Виртуальный метод, который должен быть переопределен в локальных классах
    internalCreateMessages(funcGetTypeNameString) {
        throw new Error('Метод internalCreateMessages() должен быть переопределен в подклассе.');
    }    
}