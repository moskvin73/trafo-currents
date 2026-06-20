// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbzWXTGrUz0b2iEiGqdwxVtj_Zc4FASWxaBqRH0-ZC-pyT8t7vx-7uzUmVTALN-tSIahwQ/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);