"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Seccion =
  | "dashboard"
  | "citas"
  | "recargas"
  | "configuracion"
  | "simulador"
  | "admin-clientes"
  | "admin-tarifas"
  | "admin-metricas"
  | "admin-flujo"
  | "admin-config";

interface SesionUsuario {
  id: string;
  email: string;
  role: "cliente" | "admin";
  businessName: string | null;
  businessPhone: string | null;
  isVerified: boolean;
  isSuspended: boolean;
  twilioSubaccountSid: string | null;
}

interface SesionState {
  usuario: SesionUsuario | null;
  seccion: Seccion;
  walletVersion: number;
  setUsuario: (u: SesionUsuario | null) => void;
  setSeccion: (s: Seccion) => void;
  refreshWallet: () => void;
  logout: () => void;
}

export const useAppStore = create<SesionState>()(
  persist(
    (set) => ({
      usuario: null,
      seccion: "dashboard",
      walletVersion: 0,
      setUsuario: (u) => set({ usuario: u }),
      setSeccion: (s) => set({ seccion: s }),
      refreshWallet: () => set((state) => ({ walletVersion: state.walletVersion + 1 })),
      logout: () => set({ usuario: null, seccion: "dashboard" }),
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
              twilioSubaccountSid: state.usuario.twilioSubaccountSid,
            }
          : null,
        seccion: state.seccion,
      }),
    }
  )
);
