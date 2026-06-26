// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxlLzTe1RnRLlhjpDuofIRtYx4t0LR1-12WlGXuz21E-mucmebm-ZB59-a94ccKjn6H9A/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);
