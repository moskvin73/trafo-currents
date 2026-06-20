// Глобальные конфигурационные параметры инженерного комплекса ТКЗ
const AppConfig = {
    // Единая точка доступа к серверу Google Apps Script Web App
    GOOGLE_WEB_APP_URL: "https://script.google.com/macros/s/AKfycbxuiT7jgIkrYWwyHc4LPfJ4DU5OiYhf-hsTM_AwJvKer_vnXikbpFhQLbhhoNfFZXIx5A/exec"
};

// Замораживаем объект, чтобы исключить случайное изменение адреса из других скриптов
Object.freeze(AppConfig);