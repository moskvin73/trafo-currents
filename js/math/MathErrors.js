export class ErrorBase extends Error {
     // Приватное поле для хранения оригинального стека
    #rawStack = '';

    constructor(messageOrOptions, options) {
        // Если первый аргумент — это объект с полем cause (вызов без строки сообщения)
        if (typeof messageOrOptions === 'object' && messageOrOptions !== null && 'cause' in messageOrOptions) {
            super(messageOrOptions.message || "", messageOrOptions);
        } else {
            // Стандартный вызов: super(message, options)
            super(messageOrOptions, options);
        }        
        this.name = "ErrorBase";

        // Захватываем чистый стек вызовов для текущего места создания ошибки
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
            // captureStackTrace записывает стек в свойство `stack` текущего объекта.
            // Сохраняем его в приватное поле и удаляем из объекта, чтобы не мешать геттеру.
            this.#rawStack = this.stack;
            delete this.stack; 
        } else {
            this.#rawStack = this.stack || '';
        }

        // 3. Динамически переопределяем свойство stack
        Object.defineProperty(this, 'stack', {
            get() {
                return this.#getFullStack();
            },
            configurable: true,
            enumerable: false
        });
    }

    // Метод для сборки полной цепочки стека
    #getFullStack() {
        let currentStack = this.#rawStack;
        let currentCause = this.cause;

        // Рекурсивно обходим все вложенные причины (cause)
        while (currentCause) {
            let causeStack = '';
            
            if (currentCause instanceof Error) {
                // Если причина — стандартная или наша ошибка, берем её stack (включающий строки кода)
                causeStack = currentCause.stack;
            } else {
                // Если cause — это просто строка или другой тип
                causeStack = String(currentCause);
            }

            currentStack = `\n\nCaused by: ${causeStack}`;
            currentCause = currentCause?.cause;
        }

        return currentStack;
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