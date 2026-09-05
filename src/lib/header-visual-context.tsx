import { createContext, useContext, useState, type ReactNode } from "react";

// El header de /explore flota transparente sobre la foto del hero de Manual
// (ver SiteHeader.tsx). Como el modo Agéntico no tiene esa foto, el header
// necesita saber si hay un hero oscuro detrás para no quedar en blanco sobre
// blanco — explore.tsx avisa esto acá en vez de que SiteHeader adivine por
// scroll o por ruta, que no distingue entre los dos modos de la misma página.
//
// `footerVisible` sigue el mismo patrón: el modo Agéntico oculta el footer del
// sitio (como un producto de chat real, no una página con secciones debajo) y
// así el panel del chat puede ocupar el alto real que deja el viewport en vez
// de competir por espacio con él.
interface HeaderVisualContextValue {
  heroVisible: boolean;
  setHeroVisible: (v: boolean) => void;
  footerVisible: boolean;
  setFooterVisible: (v: boolean) => void;
}

const HeaderVisualContext = createContext<HeaderVisualContextValue | null>(null);

export function HeaderVisualProvider({ children }: { children: ReactNode }) {
  const [heroVisible, setHeroVisible] = useState(false);
  const [footerVisible, setFooterVisible] = useState(true);
  return (
    <HeaderVisualContext.Provider
      value={{ heroVisible, setHeroVisible, footerVisible, setFooterVisible }}
    >
      {children}
    </HeaderVisualContext.Provider>
  );
}

export function useHeaderVisual() {
  const ctx = useContext(HeaderVisualContext);
  if (!ctx) throw new Error("useHeaderVisual must be used within HeaderVisualProvider");
  return ctx;
}
