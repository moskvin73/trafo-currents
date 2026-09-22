export class ErrorBase extends Error {
    constructor(messageOrOptions, options) {
        // Если первый аргумент — это объект с полем cause (вызов без строки сообщения)
        if (typeof messageOrOptions === 'object' && messageOrOptions !== null && 'cause' in messageOrOptions) {
            super(messageOrOptions.message || "", messageOrOptions);
        } else {
            // Стандартный вызов: super(message, options)
            super(messageOrOptions, options);
        }        
        this.name = "ErrorBase";

        // Сохраняем оригинальный стек, сгенерированный V8 для этого инстанса
        // (убираем вызовы конструкторов из самого стека для чистоты)
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }

        // 2. Явно переопределяем свойство stack на самом экземпляре
        Object.defineProperty(this, 'stack', {
            get() {
                // Берем «родной» стек, который мы сохранили или который был создан при super()
                // Свойства, созданные captureStackTrace, лежат на самом объекте, поэтому временно 
                // скрываем геттер, чтобы получить оригинальную строку.
                // Но проще и надежнее сохранить оригинальный стек в скрытое поле при конструировании:
                return this.#getFullStack();
            },
            configurable: true,
            enumerable: false
        });        
    }
    
    // Приватный метод для сборки цепочки
    #getFullStack() {
        // Чтобы не зациклиться, берем дескриптор оригинального стека, 
        // но так как мы переопределили hidden поле, проще сразу сохранить его в конструкторе.
        // Ниже чистая реализация без скрытых полей, использующая shadow-копию:
        
        let currentStack = this.#getRawStack();
        let currentCause = this.cause;

        while (currentCause) {
            const causeStack = currentCause.stack || String(currentCause);
            currentStack += `\n\nCaused by: ${causeStack}`;
            currentCause = currentCause.cause;
        }

        return currentStack;
    }

    #getRawStack() {
        // Получаем чистый стек без учета нашего геттера
        const dummy = new Error();
        if (Error.captureStackTrace) {
            Error.captureStackTrace(dummy, this.constructor);
        }
        // Возвращаем стек, который был бы у ошибки по умолчанию
        return Object.getOwnPropertyDescriptor(this, '_rawStack')?.value || super.stack || '';
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