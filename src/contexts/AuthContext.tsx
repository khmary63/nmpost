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
  const roleRef = useRef<AppRole | null>(null);
  const roleLoadingRef = useRef(false);
  const sessionRecoveryRef = useRef<string | null>(null);

  const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms));

  const setRoleState = (nextRole: AppRole | null) => {
    roleRef.current = nextRole;
    setRole(nextRole);
  };

  const setRoleLoadingState = (nextValue: boolean) => {
    roleLoadingRef.current = nextValue;
    setRoleLoading(nextValue);
  };

  const loadUserMeta = async (uid: string): Promise<AppRole | null> => {
    const { error: ensureError } = await supabase.rpc("ensure_current_user_initialized");
    if (ensureError) {
      console.error("[auth] ensure_current_user_initialized error", ensureError);
    }

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
    const recoverSession = async (expectedUserId: string | null) => {
      if (!expectedUserId || sessionRecoveryRef.current === expectedUserId) return;

      sessionRecoveryRef.current = expectedUserId;
      const retryDelays = [250, 500, 1000, 1500, 2500];

      try {
        for (let attempt = 0; attempt < retryDelays.length; attempt += 1) {
          if (currentUserIdRef.current !== expectedUserId) return;

          const sessionResult = attempt === 0
            ? await supabase.auth.getSession()
            : await supabase.auth.refreshSession();

          const recoveredSession = sessionResult.data.session;
          if (recoveredSession?.access_token && recoveredSession.user?.id === expectedUserId) {
            setSession(recoveredSession);
            setUser(recoveredSession.user);
            setLoading(true);
            setRoleState(null);
            setRoleLoadingState(true);
            const nextRole = await loadUserMeta(expectedUserId);
            if (currentUserIdRef.current !== expectedUserId) return;
            setRoleState(nextRole);
            setRoleLoadingState(false);
            setLoading(false);
            return;
          }

          await wait(retryDelays[attempt]);
        }

        if (currentUserIdRef.current === expectedUserId) {
          setSession(null);
          setUser(null);
          setRoleState(null);
          setRoleLoadingState(false);
          setLoading(false);
        }
      } catch (error) {
        console.error("[auth] session recovery error", error);
        if (currentUserIdRef.current === expectedUserId) {
          setRoleLoadingState(false);
          setLoading(false);
        }
      } finally {
        if (sessionRecoveryRef.current === expectedUserId) {
          sessionRecoveryRef.current = null;
        }
      }
    };

    const triggerRoleLoad = async (uid: string | null) => {
      const syncId = ++authSyncId.current;
      if (!uid) {
        setRoleState(null);
        setRoleLoadingState(false);
        return;
      }
      setLoading(true);
      setRoleLoadingState(true);
      try {
        const nextRole = await loadUserMeta(uid);
        if (syncId !== authSyncId.current) return;
        setRoleState(nextRole);
      } finally {
        if (syncId !== authSyncId.current) return;
        setRoleLoadingState(false);
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
        setRoleState(null);
        setRoleLoadingState(false);
        if (nextUserId) {
          setLoading(true);
          void recoverSession(nextUserId);
          return;
        }
        if (didInitRef.current) {
          setLoading(false);
        }
        return;
      }
      // Перезапрашиваем роль только если реально сменился пользователь
      // или если её ещё нет — это убирает гонку на custom-домене,
      // когда onAuthStateChange срабатывает несколько раз подряд при refresh-токене.
      if (userChanged) {
        setLoading(true);
        setRoleState(null);
        void triggerRoleLoad(nextUserId);
      } else if (nextUserId && roleRef.current === null && !roleLoadingRef.current) {
        setLoading(true);
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
    setRoleState(null);
    setRoleLoadingState(false);
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
