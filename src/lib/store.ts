"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Seccion =
  | "dashboard"
  | "citas"
  | "recargas"
  | "configuracion"
  | "simulador"
  | "salientes"
  | "admin-clientes"
  | "admin-tarifas"
  | "admin-metricas"
  | "admin-flujo"
  | "admin-ranking"
  | "admin-config";

interface SesionUsuario {
  id: string;
  email: string;
  role: "cliente" | "admin";
  businessName: string | null;
  businessPhone: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  telnyxChildAccountId: string | null;
  telnyxProvisioningStatus?: string;
  telnyxProvisioningError?: string | null;
}

interface SesionState {
  usuario: SesionUsuario | null;
  token: string | null;
  refreshToken: string | null;
  seccion: Seccion;
  walletVersion: number;
  setUsuario: (u: SesionUsuario | null) => void;
  setTokens: (token: string, refreshToken: string) => void;
  setSeccion: (s: Seccion) => void;
  refreshWallet: () => void;
  logout: () => void;
}

export const useAppStore = create<SesionState>()(
  persist(
    (set) => ({
      usuario: null,
      token: null,
      refreshToken: null,
      seccion: "dashboard",
      walletVersion: 0,
      setUsuario: (u) => set({ usuario: u }),
      setTokens: (token, refreshToken) => set({ token, refreshToken }),
      setSeccion: (s) => set({ seccion: s }),
      refreshWallet: () => set((state) => ({ walletVersion: state.walletVersion + 1 })),
      logout: () => set({ usuario: null, token: null, refreshToken: null, seccion: "dashboard" }),
    }),
    {
      name: "vozia-store",
      partialize: (state) => ({
        usuario: state.usuario
          ? {
              id: state.usuario.id,
              email: state.usuario.email,
              role: state.usuario.role,
              businessName: state.usuario.businessName,
              businessPhone: state.usuario.businessPhone,
              isVerified: state.usuario.isVerified,
              isSuspended: state.usuario.isSuspended,
              telnyxChildAccountId: state.usuario.telnyxChildAccountId,
              telnyxProvisioningStatus: state.usuario.telnyxProvisioningStatus,
              telnyxProvisioningError: state.usuario.telnyxProvisioningError,
            }
          : null,
        token: state.token,
        refreshToken: state.refreshToken,
        seccion: state.seccion,
      }),
    }
  )
);
