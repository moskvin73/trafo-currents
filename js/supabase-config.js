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

/**
 * Универсальная функция для получения роли текущего пользователя.
 * Возвращает: 'admin', 'engineer' или 'guest'
 */
async function getCurrentUserRole() {
  const supabase = window.getSupabaseClient();
  if (!supabase) return 'guest';

  // 1. Проверяем, есть ли вообще активная сессия в Supabase
  const { data: { session } } = await supabase.auth.getSession();
  
  // Если сессии нет, проверяем, выбрал ли пользователь гостевой режим
  if (!session) {
    const isLocalGuest = localStorage.getItem('user_is_guest') === 'true';
    return isLocalGuest ? 'guest' : 'guest'; // В любом случае возвращаем гостя
  }

  try {
    // 2. Если сессия есть, запрашиваем роль из таблицы профилей
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('role, is_active')
      .eq('id', session.user.id)
      .single();

    if (error || !profile || !profile.is_active) {
      // Если профиль не найден или заблокирован — разлогиниваем
      await supabase.auth.signOut();
      return 'guest';
    }

    return profile.role; // Вернет 'admin' или 'engineer'

  } catch (err) {
    console.error('Ошибка при определении роли:', err);
    return 'guest';
  }
}

// Экспортируем в глобальную видимость window
window.getCurrentUserRole = getCurrentUserRole;