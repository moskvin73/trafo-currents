// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxlLzTe1RnRLlhjpDuofIRtYx4t0LR1-12WlGXuz21E-mucmebm-ZB59-a94ccKjn6H9A/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);

/**
 * Продвинутый менеджер реляционной локальной БД ТКЗ
 */
class LocalDBManager {
    constructor(webAppUrl) {
        this.webAppUrl = webAppUrl;
        this.pendingRequests = new Map(); // Защита от параллельных fetch одной таблицы
    }

    /**
     * ПРИВАТНЫЙ МЕТОД: Гарантирует наличие таблицы в localStorage.
     * Если таблицы нет, скачивает её целиком с сервера.
     * @private
     */
    async _ensureTable(tableName) {
        const localData = localStorage.getItem(tableName);
        if (localData) {
            try {
                return JSON.parse(localData);
            } catch (e) {
                localStorage.removeItem(tableName);
            }
        }

        if (this.pendingRequests.has(tableName)) {
            return this.pendingRequests.get(tableName);
        }

        const actionName = tableName.startsWith('get_') ? tableName : `get_${tableName}`;
        const url = `${this.webAppUrl}?action=${actionName}`;

        const requestPromise = fetch(url)
            .then(response => {
                if (!response.ok) throw new Error(`Ошибка сети при загрузке таблицы ${tableName}`);
                return response.json();
            })
            .then(result => {
                if (result && result.success === false) {
                    throw new Error(result.error || 'Ошибка сервера Google');
                }
                const actualData = (result && result.data !== undefined) ? result.data : result;
                if (!Array.isArray(actualData)) {
                    throw new Error(`Данные таблицы ${tableName} должны быть массивом`);
                }

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
     * ПРОДВИНУТЫЙ АСИНХРОННЫЙ SELECT (JOIN, WHERE, ORDER BY, GROUP BY)
     * @param {string} mainTable - Имя основной таблицы (например, 'cable_catalog')
     * @param {Object} [options] - Конфигурация SQL-запроса
     */
    async select(mainTable, options = {}) {
        // Гарантируем, что основная таблица загружена
        let result = await this._ensureTable(mainTable);
        // Создаем глубокую копию, чтобы не испортить исходный кэш при модификациях
        result = JSON.parse(JSON.stringify(result));

        // 1. СИСТЕМА JOIN (Реляционное объединение таблиц)
        // options.join = { table: 'group_catalog', on: 'groupId', as: 'groupDetails' }
        // Или массив джоинов: options.join = [ { ... }, { ... } ]
        if (options.join) {
            const joins = Array.isArray(options.join) ? options.join : [options.join];
            
            for (const joinConfig of joins) {
                const { table: foreignTable, on: joinKey, as: alias } = joinConfig;
                
                // Докачиваем связанную таблицу, если её нет в памяти
                const foreignData = await this._ensureTable(foreignTable);
                
                // Создаем хэш-карту для сверхбыстрого сопоставления строк (O(N) вместо O(N^2))
                const foreignMap = new Map();
                foreignData.forEach(row => {
                    if (row[joinKey] !== undefined) {
                        foreignMap.set(String(row[joinKey]).trim(), row);
                    }
                });

                // Объединяем данные
                result = result.map(mainRow => {
                    const matchKey = String(mainRow[joinKey] || '').trim();
                    const matchedRow = foreignMap.get(matchKey);
                    
                    if (alias) {
                        // Помещаем связанную строку в отдельный объект-свойство (в стиле NoSQL)
                        mainRow[alias] = matchedRow ? { ...matchedRow } : null;
                    } else {
                        // Или сливаем поля в плоскую строку (в стиле классического SQL)
                        Object.assign(mainRow, matchedRow || {});
                    }
                    return mainRow;
                });
            }
        }

        // 2. СИСТЕМА WHERE (Фильтрация строк)
        if (options.where) {
            if (typeof options.where === 'function') {
                result = result.filter(options.where);
            } else if (typeof options.where === 'object') {
                result = result.filter(row => {
                    return Object.entries(options.where).every(([key, value]) => {
                        if (row[key] === undefined) return false;
                        return String(row[key]).trim() === String(value).trim();
                    });
                });
            }
        }

        // 3. СИСТЕМА ORDER BY (Сортировка)
        if (options.orderBy) {
            const field = options.orderBy;
            const direction = options.order === 'desc' ? -1 : 1;
            result.sort((a, b) => {
                const valA = a[field];
                const valB = b[field];
                if (typeof valA === 'number' && typeof valB === 'number') return (valA - valB) * direction;
                return String(valA || '').localeCompare(String(valB || '')) * direction;
            });
        }

        // 4. СИСТЕМА GROUP BY (Группировка)
        if (options.groupBy) {
            const field = options.groupBy;
            const grouped = {};
            result.forEach(row => {
                const key = row[field] !== undefined ? row[field] : 'undefined';
                if (!grouped[key]) grouped[key] = [];
                grouped[key].push(row);
            });
            return grouped; // Возвращает объект групп
        }

        return result; // Возвращает плоский массив строк
    }

    /**
     * ПРИНУДИТЕЛЬНОЕ ОБНОВЛЕНИЕ ТАБЛИЦЫ С СЕРВЕРА
     */
    async refreshTable(tableName) {
        localStorage.removeItem(tableName);
        return await this._ensureTable(tableName);
    }

    // Временные заглушки для локальных операций, как вы просили
    insertLocal(tableName, newRow) {
        const data = JSON.parse(localStorage.getItem(tableName) || '[]');
        data.push(newRow);
        localStorage.setItem(tableName, JSON.stringify(data));
        return data;
    }
    updateLocal(tableName, where, fields) { /* Оставляем как было */ }
    deleteLocal(tableName, where) { /* Оставляем как было */ }
}

const db = new LocalDBManager(AppConfig.GOOGLE_WEB_APP_URL);