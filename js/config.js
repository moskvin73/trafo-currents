// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxlLzTe1RnRLlhjpDuofIRtYx4t0LR1-12WlGXuz21E-mucmebm-ZB59-a94ccKjn6H9A/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);

/**
 * Класс абстрактного менеджера локальной базы данных (на базе localStorage)
 * Автоматически запрашивает данные с сервера Google Apps Script, если их нет локально.
 */
class LocalDBManager {
    constructor(webAppUrl) {
        this.webAppUrl = webAppUrl;
        // Хранилище для активных сетевых запросов (защита от дублирования fetch)
        this.pendingRequests = new Map();
    }

    /**
     * Внутренний метод: асинхронная загрузка таблицы с сервера
     * Формирует URL вида: URL?action=get_имя_таблицы
     * @private
     */
    async _fetchTableFromServer(tableName) {
        if (this.pendingRequests.has(tableName)) {
            return this.pendingRequests.get(tableName);
        }

        const url = `${this.webAppUrl}?action=get_${tableName}`;
        
        const requestPromise = fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Ошибка сети при получении таблицы ${tableName}`);
                return response.json();
            })
            .then(result => {
                // Если сервер явно передал success: false или error
                if (result && result.success === false) {
                    throw new Error(result.error || 'Ошибка сервера без описания');
                }

                // Определяем, где лежат данные: в result.data или в самом result (для совместимости)
                const actualData = (result && result.data !== undefined) ? result.data : result;

                // Проверяем, что это массив строк (таблицу)
                if (!Array.isArray(actualData)) {
                    throw new Error(`Формат данных для таблицы ${tableName} должен быть массивом`);
                }

                // Сохраняем в localStorage только чистый массив данных!
                localStorage.setItem(tableName, JSON.stringify(actualData));
                this.pendingRequests.delete(tableName);
                return actualData;
            })
            .catch(error => {
                this.pendingRequests.delete(tableName);
                throw error;
            });

        this.pendingRequests.set(tableName, requestPromise);
        return requestPromise;
    }

    /**
     * Получить всю таблицу (из localStorage или асинхронно с сервера)
     * @param {string} tableName - Имя таблицы (ключ в localStorage)
     * @returns {Promise<Array>} - Массив объектов строк
     */
    async getTable(tableName) {
        const localData = localStorage.getItem(tableName);

        if (localData) {
            try {
                // Пытаемся распарсить локальные данные
                return JSON.parse(localData);
            } catch (e) {
                // Если JSON поврежден, очищаем запись
                localStorage.removeItem(tableName);
            }
        }

        // Если данных нет или JSON был битым — качаем с сервера
        return await this._fetchTableFromServer(tableName);
    }

    /**
     * SQL-подобный выбор данных (SELECT * WHERE ...)
     * @param {string} tableName - Имя таблицы
     * @param {Object|Function} [whereClause] - Объект с фильтрами {key: value} или функция-предикат
     * @returns {Promise<Array>} - Отфильтрованный массив строк
     */
    async select(tableName, whereClause) {
        const data = await this.getTable(tableName);

        // Если фильтр не передан, возвращаем всю таблицу
        if (!whereClause) return data;

        // Если передана функция фильтрации (например: row => row.price > 100)
        if (typeof whereClause === 'function') {
            return data.filter(whereClause);
        }

        // Если передан объект (например: { type: 'ВВГ', size: 2.5 })
        return data.filter(row => {
            return Object.entries(whereClause).every(([key, value]) => row[key] === value);
        });
    }

    /**
     * Добавление новой строки в локальную таблицу (INSERT)
     * @param {string} tableName - Имя таблицы
     * @param {Object} newRow - Объект новой строки данных
     * @returns {Promise<Array>} - Полный обновленный массив таблицы
     */
    async insert(tableName, newRow) {
        const data = await this.getTable(tableName);
        
        // Добавляем новую строку в массив
        data.push(newRow);
        
        // Сохраняем обновленный массив обратно в localStorage
        localStorage.setItem(tableName, JSON.stringify(data));
        return data;
    }

    /**
     * Обновление существующих строк в локальной таблице (UPDATE)
     * @param {string} tableName - Имя таблицы
     * @param {Object|Function} whereClause - Критерий поиска обновляемых строк (объект или функция)
     * @param {Object} updatedFields - Объект с новыми значениями полей
     * @returns {Promise<Array>} - Полный обновленный массив таблицы
     */
    async update(tableName, whereClause, updatedFields) {
        const data = await this.getTable(tableName);

        // Определяем функцию проверки на соответствие условию обновления
        const isMatch = typeof whereClause === 'function' 
            ? whereClause 
            : (row) => Object.entries(whereClause).every(([key, value]) => row[key] === value);

        // Проходим по всей таблице и обновляем подходящие строки
        const updatedData = data.map(row => {
            if (isMatch(row)) {
                // Сливаем старые поля строки и новые из updatedFields
                return { ...row, ...updatedFields };
            }
            return row;
        });

        localStorage.setItem(tableName, JSON.stringify(updatedData));
        return updatedData;
    }

    /**
     * Удаление строк из локальной таблицы (DELETE)
     * @param {string} tableName - Имя таблицы
     * @param {Object|Function} whereClause - Критерий поиска удаляемых строк (объект или функция)
     * @returns {Promise<Array>} - Полный массив таблицы после удаления строк
     */
    async delete(tableName, whereClause) {
        const data = await this.getTable(tableName);

        // Определяем функцию проверки (какие строки нужно ОСТАВИТЬ)
        const shouldKeep = typeof whereClause === 'function'
            ? (row) => !whereClause(row)
            : (row) => !Object.entries(whereClause).every(([key, value]) => row[key] === value);

        // Фильтруем массив, оставляя только те строки, которые НЕ подошли под критерий удаления
        const filteredData = data.filter(shouldKeep);

        localStorage.setItem(tableName, JSON.stringify(filteredData));
        return filteredData;
    }

    /**
     * Принудительное удаление кэша из localStorage и загрузка свежей таблицы с сервера
     * @param {string} tableName - Имя таблицы
     * @returns {Promise<Array>} - Свежий массив данных с сервера
     */
    async refreshTable(tableName) {
        localStorage.removeItem(tableName);
        return await this._fetchTableFromServer(tableName);
    }
}

// Создаем глобальный экземпляр менеджера базы данных.
// Он будет доступен на всех страницах под именем `db` сразу после config.js
const db = new LocalDBManager(AppConfig.GOOGLE_WEB_APP_URL);