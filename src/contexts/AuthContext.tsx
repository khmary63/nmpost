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

  const loadUserMeta = async (uid: string): Promise<AppRole | null> => {
    const { data: roles, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .limit(1);
    if (error) {
      console.error("[auth] loadUserMeta error", error);
      setRole(null);
      return null;
    }
    if (roles && roles.length > 0) {
      return roles[0].role as AppRole;
    }
    return null;
  };

  useEffect(() => {
    let lastUserId: string | null = null;

    const applySession = (nextSession: Session | null) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
    };

    const fetchRole = async (uid: string) => {
      const syncId = ++authSyncId.current;
      setRoleLoading(true);
      const nextRole = await loadUserMeta(uid);
      if (syncId !== authSyncId.current) return;
      setRole(nextRole);
      setRoleLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      applySession(nextSession);
      const uid = nextSession?.user?.id ?? null;
      // Загружаем роль только когда сменился пользователь, а не на каждый refresh токена
      if (uid && uid !== lastUserId) {
        lastUserId = uid;
        void fetchRole(uid);
      } else if (!uid) {
        lastUserId = null;
        authSyncId.current += 1;
        setRole(null);
        setRoleLoading(false);
      }
    });

    void supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
      if (session?.user) {
        const uid = session.user.id;
        if (uid !== lastUserId) {
          lastUserId = uid;
          void fetchRole(uid);
        }
      } else {
        setRoleLoading(false);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
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
    authSyncId.current += 1;
    setSession(null);
    setUser(null);
    setRole(null);
    setRoleLoading(false);
    setLoading(false);
    try {
      void supabase.auth.signOut({ scope: "local" } as any).catch((e) => {
        console.error("[auth] signOut error", e);
      });
    } catch (e) {
      console.error("[auth] signOut error", e);
    }
    // Принудительно чистим всё локальное состояние и storage,
    // даже если refresh-токен уже невалидный на сервере.
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
