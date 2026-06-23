// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzCgkIoPTaIgTVDlnSAbgeAYPVSRyZ9PPcdx0EBhWdBqIm7K7zrZX940cpPo6FU02XtgQ/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);
