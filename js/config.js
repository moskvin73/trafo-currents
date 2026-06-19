// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbyRs9Xdfn6ebUv0zRI5EOizTzTVf7c4oKPkrcaTcc1oL1m8f_DNGU6bu1aORA-r3L2jNQ/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);