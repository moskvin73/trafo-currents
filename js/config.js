// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbwpXs5XTqeyVcB5Ol0L5mN3ksH3abh9Tk1Df6b3Plcz-3RVZCQxn_4WpGRFokb42fBz1Q/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);