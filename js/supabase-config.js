const SUPABASE_URL = 'https://kyjylgqzybayehjsdbik.supabase.co';
const SUPABASE_KEY = 'sb_publishable_goynOzJba2lzpINvxbUbWw_mwIJo5WR';

// Переменная, в которой храниться единственный экземпляр клиента
let instance = null;

/**
 * Функция для получения клиента Supabase (Singleton)
 * Если клиент уже создан — вернет его, если нет — создаст заново.
 */
function getSupabaseClient() {
  if (!instance) {
    if (typeof supabase === 'undefined') {
      console.error('Ошибка: Библиотека Supabase CDN не подключена в HTML выше этого скрипта!');
      return null;
    }
    instance = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  }
  return instance;
}

// Экспортируем функцию в глобальную видимость window, 
// чтобы другие обычные скрипты на сайте могли её вызвать
window.getSupabaseClient = getSupabaseClient;