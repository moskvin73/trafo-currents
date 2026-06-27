/**
 * Библиотека корректоров данных для компонента EditableTable
 */
window.TableCorrectors = {
    // 1. Полное удаление ВСЕХ пробелов из строки вообще
    stripAllSpaces: function(rawValue) {
        if (!rawValue) return "";
        return rawValue.replace(/\s+/g, '');
    },

    // 2. Перевод всей строки в ВЕРХНИЙ РЕГИСТР
    toUpperCase: function(rawValue) {
        if (!rawValue) return "";
        return rawValue.toUpperCase();
    },

    // 3. Перевод всей строки в нижний регистр
    toLowerCase: function(rawValue) {
        if (!rawValue) return "";
        return rawValue.toLowerCase();
    },

    // 4. Очистка лишних пробелов (trim по краям + схлопывание множественных внутри в один)
    cleanExtraSpaces: function(rawValue) {
        if (!rawValue) return "";
        return rawValue.trim().replace(/\s{2,}/g, ' ');
    },

    // 5. Первая буква заглавная, остальные строчные (Капитализация текста)
    capitalize: function(rawValue) {
        if (!rawValue) return "";
        const cleaned = rawValue.trim();
        if (cleaned.length === 0) return "";
        return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
    },

    // 6. КОМБИНИРОВАННЫЙ (Пример: убираем лишние пробелы + делаем верхний регистр)
    // Идеально подойдет для вашей маркировки кабелей (из "  вв   г  " сделает "ВВ Г")
    cleanAndUpper: function(rawValue) {
        if (!rawValue) return "";
        const clean = rawValue.trim().replace(/\s{2,}/g, ' ');
        return clean.toUpperCase();
    }
};