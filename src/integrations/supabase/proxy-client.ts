// Клиент бэкенда через собственный прокси на VPS (api.neyromarket.com).
// Базовый URL указывает на прокси, ключ — публичный anon-ключ из окружения.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const PROXY_URL = 'https://api.neyromarket.com';
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
