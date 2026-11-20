import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Cafe } from '../types';

interface CafeMapProps {
  cafes: Cafe[];
  selectedCafeId: string | null;
  onSelectCafe: (id: string) => void;
  claimedCafeIds: string[];
}

export default function CafeMap({
  cafes,
  selectedCafeId,
  onSelectCafe,
  claimedCafeIds,
}: CafeMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Initialize map if not already done
    if (!mapRef.current) {
      // Setup initial view matching Slovak/Salzkammergut requests perfectly
      mapRef.current = L.map(mapContainerRef.current, {
        center: [47.7000, 13.5000], // Stred Salzkammergut
        zoom: 11, // Zoom pre celú oblasť jazier
        maxZoom: 18,
        minZoom: 10,
        zoomControl: false, // Custom position below
      });

      // Add elegant styled tiles (CartoDB Voyager matches our warm cream/rustic Austrian café aesthetic perfectly)
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
      }).addTo(mapRef.current);

      // Add zoom control at top-right
      L.control.zoom({
        position: 'topright'
      }).addTo(mapRef.current);
    }

    const map = mapRef.current;

    // Re-create or update markers
    // Clear old markers first to avoid duplicates
    (Object.values(markersRef.current) as L.Marker[]).forEach(marker => marker.remove());
    markersRef.current = {};

    cafes.forEach((cafe) => {
      if (!cafe || !cafe.location || isNaN(cafe.location[0]) || isNaN(cafe.location[1])) {
        return; // Skip invalid indices isNaN protection
      }

      const isSelected = selectedCafeId === cafe.id;
      const isClaimed = claimedCafeIds.includes(cafe.id);

      // Generate custom SVGs inside divIcon to avoid relative asset path failures in Vite compilation
      const pinColor = isSelected ? '#D4AF37' : (isClaimed ? '#8a8a7e' : '#5A5A40');
      const accentColor = isSelected ? '#ffffff' : (isClaimed ? '#f5f5f0' : '#fafaf8');
      const textBadge = isClaimed ? '✓' : cafe.reward;

      const customIcon = L.divIcon({
        className: 'custom-cafe-badge',
        html: `
          <div class="relative flex flex-col items-center justify-center" style="width: 50px; height: 50px;">
            ${isSelected ? `
              <div class="absolute -inset-1 rounded-full bg-[#D4AF37] opacity-25 animate-ping" style="animation-duration: 1.5s;"></div>
            ` : ''}
            
            <!-- Pin Body -->
            <div class="relative flex flex-col items-center shadow-md transition-transform duration-300 ${isSelected ? 'scale-110' : 'hover:scale-105'}" style="transform-origin: bottom center;">
              <!-- Reward Tag Header -->
              <div class="px-2 py-0.5 text-[10px] font-bold text-center rounded-t-md border-x border-t whitespace-nowrap shadow-xs"
                   style="
                     background-color: ${isClaimed ? '#fafaf8' : '#ffffff'};
                     color: ${isClaimed ? '#8a8a7e' : '#5A5A40'};
                     border-color: ${isSelected ? '#D4AF37' : '#e2e2d8'};
                     font-family: 'JetBrains Mono', 'Courier New', monospace;
                   ">
                ${isClaimed ? 'Získané' : cafe.reward}
              </div>
              
              <!-- Core Circle Anchor -->
              <div class="w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-semibold shadow-xs -mt-[1px]"
                   style="
                     background-color: ${pinColor};
                     color: ${accentColor};
                     border-color: ${isSelected ? '#ffffff' : (isClaimed ? '#e2e2d8' : '#f0f0e8')};
                   ">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                  <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                  <line x1="6" x2="14" y1="2" y2="2"/>
                </svg>
              </div>
              <div class="w-2 h-2 rotate-45 -mt-[5px]" style="background-color: ${pinColor};"></div>
            </div>
          </div>
        `,
        iconSize: [50, 50],
        iconAnchor: [25, 45],
      });

      const marker = L.marker(cafe.location, { icon: customIcon })
        .addTo(map)
        .on('click', () => {
          onSelectCafe(cafe.id);
        });

      markersRef.current[cafe.id] = marker;
    });

    // Handle flying to selected cafe
    if (selectedCafeId) {
      const selectedCafe = cafes.find(c => c.id === selectedCafeId);
      if (selectedCafe && selectedCafe.location && !isNaN(selectedCafe.location[0]) && !isNaN(selectedCafe.location[1])) {
        try {
          const size = map.getSize();
          if (size && size.x > 0 && size.y > 0) {
            map.flyTo(selectedCafe.location, 14, {
              animate: true,
              duration: 1.2
            });
          } else {
            map.setView(selectedCafe.location, 14);
          }
        } catch (e) {
          console.warn("FlyTo calculation failure, using precise setView fallback:", e);
          map.setView(selectedCafe.location, 14);
        }
      }
    }

    return () => {
      // Map cleanup occurs on total component destruction
    };
  }, [cafes, selectedCafeId, claimedCafeIds]);

  // If selected cafe changes, make sure map pans there
  const handleResetView = () => {
    if (mapRef.current) {
      const target: [number, number] = [47.7000, 13.5000];
      try {
        const size = mapRef.current.getSize();
        if (size && size.x > 0 && size.y > 0) {
          mapRef.current.flyTo(target, 11, {
            animate: true,
            duration: 1.2
          });
        } else {
          mapRef.current.setView(target, 11);
        }
      } catch (e) {
        console.warn("FlyTo reset calculation failure, using precise setView fallback:", e);
        mapRef.current.setView(target, 11);
      }
    }
  };

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden shadow-md border border-amber-900/10">
      {/* Leaflet Container */}
      <div id="leaflet-map" ref={mapContainerRef} className="w-full h-full z-10 bg-stone-100" />

      {/* Control Overlay Buttons */}
      <div className="absolute bottom-4 left-4 z-20 flex flex-col gap-2">
        <button
          onClick={handleResetView}
          className="flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white text-stone-800 rounded-lg shadow-md border border-[#e2e2d8] hover:bg-stone-50 active:scale-95 transition-all"
        >
          <svg className="w-4 h-4 text-[#D4AF37]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.497 4.895-3.41c.483-.337.77-.887.77-1.473V4.41a1.25 1.25 0 0 0-2.003-1.002L15.3 6.76c-.461.322-.729.843-.729 1.396v9.066c0 .548-.266 1.066-.722 1.387l-4.593 3.238a1.25 1.25 0 0 1-2.003-1.001l-.001-9.06c0-.555-.27-.107-.735-.43l-4.526-3.152A1.25 1.25 0 0 1 4.542 6.5l4.461 3.1c.465.323.737.844.737 1.401v9.06c0 .544.264 1.058.715 1.38l4.528 3.24a1.25 1.25 0 0 0 2.023-.996Z" />
          </svg>
          Celá oblasť (Zresetovať stred)
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute top-4 left-4 z-20 bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-md border border-[#e2e2d8] text-stone-800 text-[11px] max-w-[200px] flex flex-col gap-1.5 animate-fade-in">
        <div className="font-bold text-stone-950 border-b border-[#e2e2d8] pb-1 mb-1 font-serif-elegant italic">Legenda mapy</div>
        
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-[#5A5A40] border border-[#e2e2d8] flex items-center justify-center text-[8px] text-white">★</span>
          <span>Hľadaná kaviareň (Sage)</span>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-[#8a8a7e] border border-[#e2e2d8] flex items-center justify-center text-[7px] text-[#f5f5f0]">✓</span>
          <span>Navštívená kaviareň</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full bg-[#D4AF37] border border-white ring-2 ring-[#D4AF37]/50 flex items-center justify-center text-[7px] text-white animate-pulse">●</span>
          <span className="font-medium text-[#5A5A40]">Aktuálne vybratá</span>
        </div>
      </div>
    </div>
  );
}
