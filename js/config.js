// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxPgtllvpZ20RUKpN2YhQuBrXVf8S4WPQX0Qxd8eqDQh2Ny_2-tAZslFcVCybMpMj--Ng/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);