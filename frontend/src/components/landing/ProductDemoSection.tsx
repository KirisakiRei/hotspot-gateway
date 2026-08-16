import { ContainerScroll } from "./ContainerScroll";
import { CheckCircle, Wifi, Clock } from "lucide-react";
import { motion } from "framer-motion";

const ProductDemoSection = () => (
  <section className="bg-background">
    <ContainerScroll
      titleComponent={
        <>
          <h2 className="text-4xl font-semibold text-foreground">
            Pengalaman Login WiFi yang <br />
            <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none text-primary">
              Mulus & Cepat
            </span>
          </h2>
          <p className="mt-4 text-xl text-muted-foreground max-w-2xl mx-auto">
            User connect ke WiFi → Nonton Iklan Video (15s) → Internet Terhubung.
          </p>
        </>
      }
      phoneMode
    >
      {/* Phone screen: Login Success UI */}
      <div className="h-full w-full bg-white flex flex-col items-center justify-center px-6 py-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          whileInView={{ scale: 1 }}
          viewport={{ once: true }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.3 }}
        >
          <CheckCircle className="text-green-500 mx-auto mb-4" size={64} strokeWidth={1.5} />
        </motion.div>

        <h3 className="text-2xl font-bold text-slate-900 mb-1">Terhubung!</h3>
        <p className="text-sm text-slate-500 mb-6">
          Anda sekarang terhubung ke WiFi Gratis.
        </p>

        {/* Status Box */}
        <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Wifi size={16} className="text-green-500" />
              <span>Status</span>
            </div>
            <span className="text-sm font-semibold text-green-600">Online</span>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Clock size={16} className="text-primary" />
              <span>Sisa Waktu</span>
            </div>
            <span className="text-sm font-semibold text-slate-900">60 Menit</span>
          </div>
        </div>

        {/* Action Button */}
        <button className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors">
          Lanjut Browsing
        </button>

        <p className="text-[10px] text-slate-400 mt-6">
          Powered by <span className="font-semibold text-slate-500">Wifi Ads Tech</span>
        </p>
      </div>
    </ContainerScroll>
  </section>
);

export default ProductDemoSection;
