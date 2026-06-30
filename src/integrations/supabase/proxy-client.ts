// Клиент бэкенда.
// ВРЕМЕННО: VPS-прокси api.neyromarket.com недоступен (зависает на TLS, не
// отвечает), поэтому ходим напрямую на бэкенд, чтобы сайт не висел и работала
// авторизация. Когда прокси починят — вернуть PROXY_URL обратно.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const PROXY_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Импортируйте клиент так:
// import { supabase } from "@/integrations/supabase/proxy-client";

export const supabase = createClient<Database>(PROXY_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    // Совпадает с ключом по умолчанию у авто-генерируемого клиента,
    // чтобы OAuth-сессия (устанавливается через lovable/index.ts) была общей.
    storageKey: 'sb-lyvpryyrztgjyrovdvqo-auth-token',
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});
