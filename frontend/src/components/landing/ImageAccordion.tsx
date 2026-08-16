import { useState } from "react";
import cafeImg from "@/assets/accordion-cafe.jpg";
import officeImg from "@/assets/accordion-office.jpg";
import analyticsImg from "@/assets/accordion-analytics.jpg";
import usersImg from "@/assets/accordion-users.jpg";
import networkImg from "@/assets/accordion-network.jpg";

const panels = [
  { img: cafeImg, label: "Cafe & Restoran" },
  { img: officeImg, label: "Perkantoran" },
  { img: analyticsImg, label: "Analitik Real-time" },
  { img: usersImg, label: "Pengguna Puas" },
  { img: networkImg, label: "Infrastruktur" },
];

const ImageAccordion = () => {
  const [active, setActive] = useState(2);

  return (
    <div className="flex gap-2 h-[400px] lg:h-[480px] w-full">
      {panels.map((p, i) => (
        <div
          key={i}
          onMouseEnter={() => setActive(i)}
          className={`relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-500 ease-in-out ${
            active === i ? "flex-[4]" : "flex-[1]"
          }`}
        >
          <img
            src={p.img}
            alt={p.label}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-matte-950/40" />
          <div
            className={`absolute bottom-4 left-4 right-4 transition-opacity duration-300 ${
              active === i ? "opacity-100" : "opacity-0"
            }`}
          >
            <span className="bg-card/90 backdrop-blur-sm text-foreground text-sm font-semibold px-3 py-1.5 rounded-lg">
              {p.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default ImageAccordion;
