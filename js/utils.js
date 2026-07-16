/**
 * Создает безопасный валидатор для перечислений, защищенный от сжатия кода.
 */
export function createEnumReader(enumObject, defaultValue, enumName) {
    return function(key) {
        if (key in enumObject) {
            return enumObject[key];
        }
        // Ошибка не сожмется при минификации, так как enumName — это строка
        console.error(`[Enum Error]: Ключ "${key}" не найден в перечислении ${enumName}. Возвращено значение по умолчанию: ${defaultValue}`);
        return defaultValue;
    };
}