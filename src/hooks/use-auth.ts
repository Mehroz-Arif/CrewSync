import { authClient } from "@/lib/auth-client.ts";

export function useAuth() {
  const { data: session, isPending, error } = authClient.useSession();

  return {
    isAuthenticated: !!session,
    isLoading: isPending,
    error: error,
    user: session?.user,
    signinRedirect: async () => {
      // In Better Auth we will redirect to /login
      window.location.href = "/login";
    },
    removeUser: async () => authClient.signOut(),
  };
}

export function useUser() {
  const { data: session, isPending } = authClient.useSession();
  return {
    user: session?.user,
    isLoading: isPending,
  };
}
