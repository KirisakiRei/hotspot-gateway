import { useState, useRef, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Message = { from: "bot" | "user"; text: string };
type Screen = "closed" | "categories" | "sub" | "answer";

const categories = [
  { label: "Pendaftaran", key: "pendaftaran" },
  { label: "Harga & Biaya", key: "harga" },
  { label: "Teknis", key: "teknis" },
  { label: "Lainnya", key: "lainnya" },
];

const subQuestions: Record<string, { label: string; answer: string }[]> = {
  pendaftaran: [
    { label: "Bagaimana cara mendaftar?", answer: "Klik tombol 'Daftar' di halaman utama, isi data Anda, pilih peran (Pengiklan atau Mitra), dan selesaikan onboarding. Prosesnya kurang dari 2 menit!" },
    { label: "Apakah ada biaya pendaftaran?", answer: "Tidak ada biaya pendaftaran sama sekali. Anda bisa mendaftar dan menjelajahi platform secara gratis." },
    { label: "Dokumen apa yang diperlukan?", answer: "Untuk Pengiklan: KTP & NPWP perusahaan. Untuk Mitra: KTP pemilik lokasi. Dokumen bisa diunggah setelah registrasi." },
  ],
  harga: [
    { label: "Berapa biaya per view?", answer: "Biaya iklan dimulai dari Rp 50 per view untuk paket UMKM. Transparan dan bisa dipantau real-time di dashboard Anda." },
    { label: "Ada paket berlangganan?", answer: "Ya! Kami menyediakan paket Starter (Rp 1jt/bln), Growth (Rp 5jt/bln), dan Enterprise (custom). Hubungi sales untuk detail." },
    { label: "Bagaimana cara pembayaran?", answer: "Kami menerima Transfer Bank, Virtual Account, dan E-Wallet (OVO, GoPay, Dana). Invoice otomatis dikirim via email." },
  ],
  teknis: [
    { label: "Perangkat apa yang dibutuhkan?", answer: "Untuk Mitra: router khusus kami (disediakan gratis). Untuk Pengiklan: cukup akses dashboard via browser, tidak perlu install apapun." },
    { label: "Bagaimana sistem anti-fraud?", answer: "AI kami mendeteksi bot, klik palsu, dan traffic tidak wajar secara real-time. Anda hanya membayar untuk view asli dari pengguna nyata." },
    { label: "Apakah ada API?", answer: "Ya, REST API tersedia untuk integrasi dengan sistem Anda. Dokumentasi lengkap bisa diakses setelah mendaftar sebagai Pengiklan." },
  ],
  lainnya: [
    { label: "Bagaimana menghubungi support?", answer: "Anda bisa menghubungi kami via email hello@wifiadstech.com, WhatsApp di +62 812-xxxx-xxxx, atau melalui halaman Kontak di website." },
    { label: "Apakah tersedia di luar Jawa?", answer: "Ya! Jaringan kami sudah mencakup Sumatera, Kalimantan, Sulawesi, dan Bali. Kami terus berekspansi ke seluruh Indonesia." },
  ],
};

const FAQWidget = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [screen, setScreen] = useState<Screen>("closed");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const addBotMessage = (text: string, delay = 500) => {
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text }]);
    }, delay);
  };

  const handleOpen = () => {
    setOpen(true);
    setScreen("categories");
    setMessages([{ from: "bot", text: "Halo! 👋 Selamat datang di Wifi Ads Tech. Ada yang bisa saya bantu?" }]);
    setTimeout(() => {
      setMessages((prev) => [...prev, { from: "bot", text: "Pilih topik bantuan:" }]);
    }, 600);
  };

  const handleCategory = (cat: typeof categories[0]) => {
    setMessages((prev) => [...prev, { from: "user", text: cat.label }]);
    setActiveCategory(cat.key);
    setScreen("sub");
    addBotMessage(`Baik, apa yang ingin Anda ketahui tentang ${cat.label}?`);
  };

  const handleSubQuestion = (q: { label: string; answer: string }) => {
    setMessages((prev) => [...prev, { from: "user", text: q.label }]);
    setScreen("answer");
    addBotMessage(q.answer);
  };

  const handleBack = () => {
    setMessages((prev) => [...prev, { from: "user", text: "Kembali ke Menu" }]);
    setActiveCategory(null);
    setScreen("categories");
    addBotMessage("Pilih topik bantuan:");
  };

  const handleClose = () => {
    setOpen(false);
    setScreen("closed");
    setMessages([]);
    setActiveCategory(null);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="absolute bottom-16 right-0 w-[350px] h-[500px] bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="bg-primary/95 backdrop-blur-md px-4 py-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary-foreground/20 flex items-center justify-center text-primary-foreground text-sm font-bold">
                CS
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-foreground">Wifi Ads Support</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span className="text-xs text-primary-foreground/70">Online</span>
                </div>
              </div>
              <button onClick={handleClose} className="text-primary-foreground/80 hover:text-primary-foreground">
                <X size={18} />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                      msg.from === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Options */}
            <div className="border-t border-border p-3">
              {screen === "categories" && (
                <div className="flex flex-wrap gap-2">
                  {categories.map((cat) => (
                    <button
                      key={cat.key}
                      onClick={() => handleCategory(cat)}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              )}
              {screen === "sub" && activeCategory && (
                <div className="flex flex-wrap gap-2">
                  {subQuestions[activeCategory]?.map((q) => (
                    <button
                      key={q.label}
                      onClick={() => handleSubQuestion(q)}
                      className="px-3 py-1.5 text-xs font-medium rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors text-left"
                    >
                      {q.label}
                    </button>
                  ))}
                  <button
                    onClick={handleBack}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-border text-muted-foreground hover:bg-muted transition-colors"
                  >
                    ← Kembali
                  </button>
                </div>
              )}
              {screen === "answer" && (
                <div className="flex gap-2">
                  <button
                    onClick={handleBack}
                    className="px-3 py-1.5 text-xs font-medium rounded-full border border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    Kembali ke Menu Utama
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger */}
      <button
        onClick={() => (open ? handleClose() : handleOpen())}
        className="w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:shadow-xl transition-all"
      >
        {open ? (
          <X size={24} />
        ) : (
          <span className="relative">
            <MessageCircle size={24} />
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full animate-pulse" />
          </span>
        )}
      </button>
    </div>
  );
};

export default FAQWidget;
