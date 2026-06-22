// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzNMayqH-rFFstBPfdBbEQzSZzI_nr6ZCkCXyR_V-b7uwPjHXeETDuRxZ7jeykzjT1i/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);