import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";

type AppRole = "admin" | "manager" | "agent";

type AuthContextType = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  role: AppRole | null;
  roleLoading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<AppRole | null>(null);
  const [roleLoading, setRoleLoading] = useState(false);
  const authSyncId = useRef(0);
  const currentUserIdRef = useRef<string | null>(null);
  const didInitRef = useRef(false);

  const loadUserMeta = async (uid: string): Promise<AppRole | null> => {
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid);
    if (error) {
      console.error("[auth] loadUserMeta error", error);
      return null;
    }
    const availableRoles = (roles ?? []).map((entry) => entry.role as AppRole);
    if (availableRoles.includes("admin")) return "admin";
    if (availableRoles.includes("manager")) return "manager";
    if (availableRoles.includes("agent")) return "agent";
    return null;
  };

  useEffect(() => {
    const triggerRoleLoad = async (uid: string | null) => {
      const syncId = ++authSyncId.current;
      if (!uid) {
        setRole(null);
        setRoleLoading(false);
        return;
      }
      setRoleLoading(true);
      try {
        const nextRole = await loadUserMeta(uid);
        if (syncId !== authSyncId.current) return;
        setRole(nextRole);
      } finally {
        if (syncId !== authSyncId.current) return;
        setRoleLoading(false);
        if (didInitRef.current) {
          setLoading(false);
        }
      }
    };

    const applySession = (nextSession: Session | null) => {
      const nextUserId = nextSession?.user?.id ?? null;
      const userChanged = nextUserId !== currentUserIdRef.current;
      currentUserIdRef.current = nextUserId;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.access_token) {
        setRole(null);
        setRoleLoading(false);
        if (didInitRef.current) {
          setLoading(false);
        }
        return;
      }
      // Перезапрашиваем роль только если реально сменился пользователь
      // или если её ещё нет — это убирает гонку на custom-домене,
      // когда onAuthStateChange срабатывает несколько раз подряд при refresh-токене.
      if (userChanged) {
        setRole(null);
        void triggerRoleLoad(nextUserId);
      } else if (nextUserId && role === null && !roleLoading) {
        void triggerRoleLoad(nextUserId);
      } else if (didInitRef.current) {
        setLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      didInitRef.current = true;
      applySession(session);
      if (!session?.access_token) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error: error ? new Error(error.message) : null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? new Error(error.message) : null };
  };

  const signInWithGoogle = async () => {
    await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
  };

  const signOut = async () => {
    didInitRef.current = true;
    authSyncId.current += 1;
    currentUserIdRef.current = null;
    setSession(null);
    setUser(null);
    setRole(null);
    setRoleLoading(false);
    setLoading(false);
    // ВАЖНО: глобальный signOut, чтобы инвалидировать refresh-токен на сервере.
    // Иначе при следующем входе через Google сохраняется «зомби»-сессия,
    // и SDK тратит лишние секунды на обновление токена на custom-домене.
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[auth] signOut error", e);
    }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-") || k.includes("supabase"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {}
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error ? new Error(error.message) : null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, role, roleLoading, signUp, signIn, signInWithGoogle, signOut, resetPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
