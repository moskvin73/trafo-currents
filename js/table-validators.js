/**
 * Библиотека валидаторов для компонента EditableTable
 */
window.TableValidators = {
    // 1. Проверка ГОСТ и ГОСТ Р (Примеры: "ГОСТ 31565-2012", "ГОСТ Р 53769-2010")
    validateGost: function(value) {
        if (!value) return null;
        
        // Регулярное выражение проверяет:
        // ^ГОСТ( Р)? — Слово ГОСТ, за которым может идти " Р"
        // \s\d+(-\d+)?$ — пробел, затем номер стандарта, и через дефис год (опционально)
        const gostRegex = /^ГОСТ( Р)?\s\d+([\d-]*\d+)?$/i;
        
        if (!gostRegex.test(value.trim())) {
            return "Неверный формат ГОСТ. Примеры: 'ГОСТ 31565-2012' или 'ГОСТ Р 53315'";
        }
        return null;
    },

    // 2. Проверка стандартов МЭК / IEC (Примеры: "МЭК 60502-1", "IEC 60332")
    validateMek: function(value) {
        if (!value) return null;

        // Поддерживает русское "МЭК" или английское "IEC", затем пробел и цифры с дефисами
        const mekRegex = /^(МЭК|IEC)\s\d+([\d-]*\d+)?$/i;

        if (!mekRegex.test(value.trim())) {
            return "Неверный формат МЭК/IEC. Примеры: 'МЭК 60502-1' или 'IEC 60332'";
        }
        return null;
    },

    // 3. Проверка Технических условий ТУ (Примеры: "ТУ 16.К71-335-2004")
    // Код ТУ для кабелей обычно имеет сложную структуру через точки и дефисы
    validateTu: function(value) {
        if (!value) return null;

        // Проверяет слово ТУ, пробел, а затем цифры, разделенные точками и дефисами
        const tuRegex = /^ТУ\s\d+[\d\.\-]*\d+$/i;

        if (!tuRegex.test(value.trim())) {
            return "Неверный формат ТУ. Пример: 'ТУ 16.К71-335-2004'";
        }
        return null;
    },

    // 4. УНИВЕРСАЛЬНЫЙ валидатор стандартов (Если в одном поле разрешен любой документ)
    validateAnyStandard: function(value) {
        if (!value) return null;

        const cleanValue = value.trim();
        
        // Пытаемся по очереди запустить каждый из базовых валидаторов
        if (window.TableValidators.validateGost(cleanValue) === null) return null;
        if (window.TableValidators.validateMek(cleanValue) === null) return null;
        if (window.TableValidators.validateTu(cleanValue) === null) return null;

        return "Строка не соответствует ни одному стандарту (ГОСТ, МЭК, IEC, ТУ)";
    },

    // ВАШ ПРОШЛЫЙ ВАЛИДАТОР: Запрет цифр (например, для чистых буквенных марок)
    validateNoDigits: function(value) {
        if (!value) return null;
        return /\d/.test(value) ? "Цифры в данном поле запрещены" : null;
    }
};