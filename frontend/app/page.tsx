import React from 'react';
import HeroSection from '../components/landing/HeroSection';
import ProblemSection from '../components/landing/ProblemSection';
import SolutionSection from '../components/landing/SolutionSection';
import HowItWorks from '../components/landing/HowItWorks';
import Testimonial from '../components/landing/Testimonial';
import FAQ from '../components/landing/FAQ';
import CTAFooter from '../components/landing/CTAFooter';

export default function LandingPage() {
  return (
    <div className="w-full min-h-screen flex flex-col bg-white">
      <HeroSection />
      <ProblemSection />
      <SolutionSection />
      <HowItWorks />
      <Testimonial />
      <FAQ />
      <CTAFooter />
    </div>
  );
}
