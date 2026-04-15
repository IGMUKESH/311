import React from 'react';
import { motion } from 'framer-motion';
import { FileText, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const TermsAndConditions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white dark:bg-black text-black dark:text-white p-6 md:p-12">
      <div className="max-w-3xl mx-auto">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-[#F27D26] font-bold mb-8 hover:opacity-80 transition-opacity"
        >
          <ChevronLeft size={20} /> Back
        </button>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-[#F27D26]/10 rounded-2xl">
            <FileText className="text-[#F27D26]" size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">Terms & Conditions</h1>
        </div>

        <div className="space-y-6 text-slate-600 dark:text-slate-400 leading-relaxed">
          <p className="font-bold text-black dark:text-white">Last Updated: April 11, 2026</p>
          
          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using MukeshApps, you agree to be bound by these Terms and Conditions. If you do not agree to all of these terms, do not use the application.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">2. User Content</h2>
            <p>You are responsible for the content you upload to the platform. You must not upload content that is illegal, offensive, or violates the rights of others.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">3. Intellectual Property</h2>
            <p>The application and its original content are and will remain the exclusive property of MukeshApps. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of MukeshApps.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">4. Limitation of Liability</h2>
            <p>In no event shall MukeshApps be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">5. Changes to Terms</h2>
            <p>We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will provide notice of any significant changes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">6. Governing Law</h2>
            <p>These Terms shall be governed and construed in accordance with the laws of India, without regard to its conflict of law provisions.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
