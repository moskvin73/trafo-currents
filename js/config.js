// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbz9W9Z5ZCFGcmKEZJuu3oE4AyRBECYDj5SKhYr9bvjQQB3PR4UUfspRdoI-fkwpCeLhMQ/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);