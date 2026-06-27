/**
 * Библиотека валидаторов для компонента EditableTable
 */
window.TableValidators = {
    // 1. Проверка ГОСТ и ГОСТ Р (Примеры: "ГОСТ 31565-2012", "ГОСТ Р 53769-2010")
    validateGost: function(value) {
        if (!value) return null;
        
        // ^ГОСТ(\sР)? — Начинается с ГОСТ или ГОСТ Р
        // \s\d+[\d\.\-]*\d+$ — пробел, номер, допускающий любые точки и дефисы внутри, заканчивается цифрой
        const gostRegex = /^ГОСТ(\sР)?\s\d+[\d\.\-]*\d+$/i;
        
        if (!gostRegex.test(value.trim())) {
            return "Неверный формат ГОСТ. Примеры: 'ГОСТ 31565-2012' или 'ГОСТ Р 53769-2010'";
        }
        return null;
    },

    // 2. Проверка стандартов МЭК / IEC, включая ГОСТ IEC и ГОСТ Р МЭК 
    // (Примеры: "ГОСТ IEC 60332-1-2-2011", "МЭК 60502-1", "IEC 60332", "ГОСТ Р МЭК 60502")
    validateMek: function(value) {
        if (!value) return null;

        // ^(ГОСТ\s)?(Р\s)?(МЭК|IEC) — Опционально ГОСТ, опционально Р, затем МЭК или IEC
        // \s\d+[\d\.\-]*\d+$ — Номер стандарта любой длины с дефисами и точками
        const mekRegex = /^(ГОСТ\s)?(Р\s)?(МЭК|IEC)\s\d+[\d\.\-]*\d+$/i;

        if (!mekRegex.test(value.trim())) {
            return "Неверный формат МЭК/IEC. Примеры: 'ГОСТ IEC 60332-1-2-2011' или 'МЭК 60502-1'";
        }
        return null;
    },

    // 3. Проверка Технических условий ТУ (Примеры: "ТУ 16.К71-335-2004", "ТУ 16-705.499-2010")
    validateTu: function(value) {
        if (!value) return null;

        // ^ТУ\s\d+ — Начинается с ТУ, пробел, цифра
        // [\w\.\-]*\d+$ — Разрешает цифры, буквы (например, К), точки и дефисы в структуре ТУ
        const tuRegex = /^ТУ\s\d+[\w\.\-]*\d+$/i;

        if (!tuRegex.test(value.trim())) {
            return "Неверный формат ТУ. Пример: 'ТУ 16.К71-335-2004'";
        }
        return null;
    },

    // 4. УНИВЕРСАЛЬНЫЙ валидатор стандартов (Вызывает обновленные правила)
    validateAnyStandard: function(value) {
        if (!value) return null;

        const cleanValue = value.trim();
        
        if (window.TableValidators.validateGost(cleanValue) === null) return null;
        if (window.TableValidators.validateMek(cleanValue) === null) return null;
        if (window.TableValidators.validateTu(cleanValue) === null) return null;

        return "Строка не соответствует ни одному стандарту (ГОСТ, ГОСТ IEC, МЭК, ТУ)";
    },

    validateNoDigits: function(value) {
        if (!value) return null;
        return /\d/.test(value) ? "Цифры в данном поле запрещены" : null;
    },

    // Асинхронная проверка статуса ГОСТа через открытые реестры
    checkGostStatusOnline: function(value, currentRow) {
        if (!value) return null;

        // ИСПРАВЛЕНО: Извлекаем только чистые цифры номера ГОСТ (например, из "ГОСТ 31565-2012" заберем "31565")
        const matches = value.match(/\d+/);
        if (!matches) return null;
        const gostNumber = matches[0]; // Берем первый найденный элемент массива совпадений

        // Используем бесплатный CORS-прокси allorigins для отправки запроса из браузера
        return fetch(`https://allorigins.win{encodeURIComponent('https://etr-torgi.ru' + gostNumber)}`)
            .then(response => {
                if (!response.ok) throw new Error("Ошибка сети");
                return response.json();
            })
            .then(data => {
                // allorigins возвращает HTML-код страницы в свойстве data.contents
                const htmlString = data.contents ? data.contents.toLowerCase() : "";
                
                if (htmlString.includes('отменен') || htmlString.includes('заменен')) {
                    return "Внимание: Этот ГОСТ отменен или заменен в реестре!";
                }
                
                if (!htmlString.includes('действует') && !htmlString.includes('действующий')) {
                    return "Стандарт не найден в базе данных актуальных документов.";
                }
                
                return null; // Документ найден и он действует, ошибок нет
            })
            .catch((err) => {
                // Если сторонний сайт упал или прокси недоступен, мягко пропускаем проверку
                console.warn("Не удалось проверить статус ГОСТа онлайн:", err.message);
                return null; 
            });
    },
    
};