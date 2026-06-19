// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxkMLx-MmiFsDf1mSmyncl2NzZ4crvwHKgZ3pY71IGmdvtJMbYiMMb-Xt7oKCcMR5AZ9w/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);