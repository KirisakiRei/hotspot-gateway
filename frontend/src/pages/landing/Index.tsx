import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import ProductDemoSection from "@/components/landing/ProductDemoSection";
import WhatIsSection from "@/components/landing/WhatIsSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import ServicesSection from "@/components/landing/ServicesSection";
import MapSection from "@/components/landing/MapSection";
import Footer from "@/components/landing/Footer";
import FAQWidget from "@/components/landing/FAQWidget";

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <HeroSection />
    <ProductDemoSection />
    <WhatIsSection />
    <FeaturesSection />
    <ServicesSection />
    <MapSection />
    <Footer />
    <FAQWidget />
  </div>
);

export default Index;
