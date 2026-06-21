// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyJGGzg_31Mp2Xd6K5LSEDas55driJNapTI7jrwgQuo5BB8S7ZlMFRt9b8PDHC75FdTHw/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);