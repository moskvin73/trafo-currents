/**
 * Модуль парсинга CSV-данных из Google Таблиц.
 * Конвертирует сырой текст CSV в массив объектов JSON с заменой запятых на точки.
 * @param {string} csvText - Сырой текст из опубликованной таблицы
 * @returns {Array} Массив объектов с параметрами трансформаторов
 */
function csvToJSON(csvText) {
    const lines = csvText.split("\n");
    if (lines.length === 0) return [];

    // Получаем заголовки и убираем служебные символы переноса строк (\r) и лишние кавычки
    const headers = lines[0].split(",").map(h => h.trim().replace(/["\r]/g, ""));
    const result = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue; // Пропускаем пустые строки

        // Регулярное выражение корректно делит строку по запятым, игнорируя запятые внутри кавычек
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(",");
        const currentLine = matches.map(cell => cell.trim().replace(/^"|"$/g, ""));
        
        const obj = {};
        headers.forEach((header, index) => {
            let value = currentLine[index];
            
            if (value === "" || value === undefined || value === null) {
                value = null;
            } else if (header === "id" || header === "brand" || header === "manufacturer" || header === "schema" || value === "Z1") {
                value = value; // Текстовые поля и флаги оставляем строками
            } else {
                let cleanValue = value.replace(",", "."); // Заменяем русские запятые "0,4" на точки "0.4"
                value = !isNaN(cleanValue) ? Number(cleanValue) : value; // Конвертируем в JS-число
            }
            obj[header] = value;
        });
        result.push(obj);
    }
    return result;
}
