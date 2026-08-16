import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import ScrollReveal from "./ScrollReveal";

const ROICalculator = () => {
  const [budget, setBudget] = useState([5000000]);
  const [visitors, setVisitors] = useState([200]);

  const estViews = Math.round(budget[0] / 500);
  const estReach = Math.round(estViews * 0.7);
  const estIncome = Math.round(visitors[0] * 30 * 150);

  const formatNum = (n: number) => n.toLocaleString("id-ID");

  return (
    <section id="kalkulator" className="py-20 bg-muted/50">
      <div className="container mx-auto px-4 lg:px-8">
        <ScrollReveal>
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground">
              Kalkulator <span className="text-primary">ROI</span>
            </h2>
            <p className="text-muted-foreground mt-3 max-w-md mx-auto">
              Hitung potensi keuntungan Anda secara real-time.
            </p>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className="max-w-2xl mx-auto bg-card rounded-2xl shadow-lg border border-border p-6 md:p-8">
            <Tabs defaultValue="pengiklan">
              <TabsList className="grid grid-cols-2 mb-6">
                <TabsTrigger value="pengiklan">Simulasi Pengiklan</TabsTrigger>
                <TabsTrigger value="mitra">Simulasi Mitra</TabsTrigger>
              </TabsList>

              <TabsContent value="pengiklan" className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Budget Iklan: Rp {formatNum(budget[0])}
                  </label>
                  <Slider
                    value={budget}
                    onValueChange={setBudget}
                    min={1000000}
                    max={50000000}
                    step={500000}
                    className="mt-3"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <ResultCard label="Estimasi Views" value={formatNum(estViews)} />
                  <ResultCard label="Estimasi Reach" value={formatNum(estReach)} />
                </div>
              </TabsContent>

              <TabsContent value="mitra" className="space-y-6">
                <div>
                  <label className="text-sm font-medium text-foreground">
                    Pengunjung Harian: {visitors[0]}
                  </label>
                  <Slider
                    value={visitors}
                    onValueChange={setVisitors}
                    min={50}
                    max={2000}
                    step={10}
                    className="mt-3"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4">
                  <ResultCard label="Potensi Income Bulanan" value={`Rp ${formatNum(estIncome)}`} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
};

const ResultCard = ({ label, value }: { label: string; value: string }) => (
  <div className="bg-accent rounded-xl p-4 text-center">
    <p className="text-xs text-muted-foreground mb-1">{label}</p>
    <p className="text-2xl font-bold text-accent-foreground">{value}</p>
  </div>
);

export default ROICalculator;
