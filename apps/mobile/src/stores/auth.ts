import { create } from 'zustand';
import type { MeResponse } from '@cymetric/types';

// Single source of truth for session state. Persistence lives in
// expo-secure-store (see lib/storage.ts); this store mirrors just enough
// to drive routing and render the bell / avatar without re-fetching /me.

type Status = 'unknown' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  me: MeResponse | null;
  setAuthenticated: (me: MeResponse) => void;
  setUnauthenticated: () => void;
  setMe: (me: MeResponse) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'unknown',
  me: null,
  setAuthenticated: (me) => set({ status: 'authenticated', me }),
  setUnauthenticated: () => set({ status: 'unauthenticated', me: null }),
  setMe: (me) => set({ me }),
}));
