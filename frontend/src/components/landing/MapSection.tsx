import { useEffect, useRef } from "react";
import ScrollReveal from "./ScrollReveal";
import { MapPin } from "lucide-react";

// Generate 40 simulated partner points around Medan
const generateMedanPoints = () => {
  const names = [
    "Kopi Kenangan Merdeka", "WiFi Zone Pulo Brayan", "Digital Cafe Thamrin",
    "Net Spot Asia Mega", "Warung Online Johor", "Cowork Hub Helvetia",
    "Kedai Digital Sunggal", "Cafe Connect Marelan", "Smart Lounge Gatsu",
    "Hotspot Cafe Sei Putih", "Warkop Digital Amplas", "Kafe Nusantara Medan",
    "Spot WiFi Dr. Mansyur", "Kopi Setiabudi", "Cafe Kampus USU",
    "Digital Hub Petisah", "Warung Kopi Simpang", "Lounge Pajak",
    "Cafe Corner Iskandar", "Smart WiFi Binjai",
  ];
  const points: { name: string; lat: number; lng: number; status: string; totalAds: number }[] = [];

  for (let i = 0; i < 40; i++) {
    points.push({
      name: names[i % names.length] + (i >= names.length ? ` ${i}` : ""),
      lat: 3.5952 + (Math.random() - 0.5) * 0.15,
      lng: 98.6722 + (Math.random() - 0.5) * 0.15,
      status: Math.random() > 0.1 ? "Online" : "Offline",
      totalAds: Math.floor(Math.random() * 2000) + 100,
    });
  }
  return points;
};

const partnerPoints = generateMedanPoints();

const storeIconSvg = `<div style="width:32px;height:32px;background:hsl(217,91%,60%);border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7"/></svg></div>`;

const formatNumber = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;

const MapSection = () => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current || mapRef.current.children.length > 0) return;

    const loadMap = async () => {
      const L = await import("leaflet");

      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        link.crossOrigin = "";
        document.head.appendChild(link);
      }

      if (!document.getElementById("markercluster-css")) {
        const link1 = document.createElement("link");
        link1.id = "markercluster-css";
        link1.rel = "stylesheet";
        link1.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
        document.head.appendChild(link1);
        const link2 = document.createElement("link");
        link2.id = "markercluster-default-css";
        link2.rel = "stylesheet";
        link2.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
        document.head.appendChild(link2);
      }

      await import("leaflet.markercluster" as any).catch(() => {
        return new Promise<void>((resolve) => {
          if (document.getElementById("markercluster-js")) { resolve(); return; }
          const script = document.createElement("script");
          script.id = "markercluster-js";
          script.src = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js";
          script.onload = () => resolve();
          document.head.appendChild(script);
        });
      });

      await new Promise((r) => setTimeout(r, 300));

      const map = L.map(mapRef.current!, {
        scrollWheelZoom: false,
        zoomControl: true,
      }).setView([3.5952, 98.6722], 12);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const storeIcon = L.divIcon({
        html: storeIconSvg,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
        className: "",
      });

      // @ts-ignore
      const markers = L.markerClusterGroup({
        maxClusterRadius: 60,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let dim = 36;
          if (count > 20) dim = 48;
          else if (count > 10) dim = 42;

          return L.divIcon({
            html: `<div style="width:${dim}px;height:${dim}px;background:hsl(217,91%,60%);border-radius:50%;display:flex;align-items:center;justify-content:center;color:white;font-weight:700;font-size:${dim > 42 ? 14 : 12}px;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.25)">${count}</div>`,
            iconSize: [dim, dim],
            className: "",
          });
        },
      });

      partnerPoints.forEach((p) => {
        const marker = L.marker([p.lat, p.lng], { icon: storeIcon });
        const statusColor = p.status === "Online" ? "#22c55e" : "#ef4444";
        // Use tooltip (hover) instead of popup (click)
        marker.bindTooltip(`
          <div style="font-family:Inter,sans-serif;min-width:160px;padding:4px">
            <p style="font-weight:700;margin:0 0 4px;font-size:13px">${p.name}</p>
            <p style="margin:0;font-size:11px;color:#666;display:flex;align-items:center;gap:4px">
              <span style="width:7px;height:7px;border-radius:50%;background:${statusColor};display:inline-block"></span>
              ${p.status}
            </p>
            <p style="margin:4px 0 0;font-size:11px;color:#666">${formatNumber(p.totalAds)} Iklan Tayang</p>
          </div>
        `, { direction: "top", offset: [0, -16] });
        markers.addLayer(marker);
      });

      map.addLayer(markers);
    };

    loadMap();
  }, []);

  return (
    <section id="lokasi" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Jaringan <span className="text-primary">Mitra Kami</span>
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              Tersebar di seluruh Indonesia dan terus bertumbuh.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="relative rounded-2xl overflow-hidden border border-border shadow-lg">
            <div ref={mapRef} className="w-full h-[500px] z-0" />
            <div className="absolute top-4 left-4 bg-card/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-md border border-border">
              <div className="flex items-center gap-2">
                <MapPin className="text-primary" size={20} />
                <div>
                  <p className="text-2xl font-bold text-foreground">500+</p>
                  <p className="text-xs text-muted-foreground">Titik Mitra Aktif</p>
                </div>
              </div>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

export default MapSection;
