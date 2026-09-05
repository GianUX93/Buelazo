import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

export interface DestinoTopItem {
  code: string;
  city: string;
  foto: string;
  count: number;
}

const AUTOPLAY_MS = 4500;

// Autoplay + navegación manual (flechas/dots) — el autoplay se pausa apenas
// el usuario interactúa, para no pelearse con un cambio manual.
export function DestinosTopSlider({ destinos }: { destinos: DestinoTopItem[] }) {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

  useEffect(() => {
    if (!autoplay || destinos.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % destinos.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [autoplay, destinos.length]);

  function goTo(next: number) {
    setAutoplay(false);
    setIndex((next + destinos.length) % destinos.length);
  }

  if (destinos.length === 0) return null;
  const actual = destinos[index];

  return (
    <Link
      to="/explore"
      search={{ to: actual.code }}
      className="bento-card group relative block overflow-hidden rounded-[2rem] md:col-span-4 md:row-span-1"
    >
      {destinos.map((d, i) => (
        <img
          key={d.code}
          src={d.foto}
          alt={d.city}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
            i === index ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

      <div className="absolute bottom-6 left-6 text-white">
        <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-white/80">
          <MapPin className="h-3.5 w-3.5" /> Destino Top
        </div>
        <div className="font-display text-3xl font-bold">{actual.city}</div>
        <div className="mt-0.5 text-xs font-medium text-white/70">
          {actual.count} pasaje{actual.count === 1 ? "" : "s"} activo{actual.count === 1 ? "" : "s"}{" "}
          · Ver ofertas →
        </div>
      </div>

      {destinos.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goTo(index - 1);
            }}
            aria-label="Destino anterior"
            className="absolute left-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur-sm transition-opacity [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 hover:bg-white/25"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              goTo(index + 1);
            }}
            aria-label="Siguiente destino"
            className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-white/15 text-white opacity-0 backdrop-blur-sm transition-opacity [@media(hover:hover)_and_(pointer:fine)]:group-hover:opacity-100 hover:bg-white/25"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="absolute bottom-6 right-6 flex items-center gap-1.5">
            {destinos.map((d, i) => (
              <button
                key={d.code}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  goTo(i);
                }}
                aria-label={`Ver ${d.city}`}
                className={`h-1.5 rounded-full transition-all ${
                  i === index ? "w-5 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </Link>
  );
}
