import React from 'react';
import { motion } from 'framer-motion';
import { Shield, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const PrivacyPolicy: React.FC = () => {
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
            <Shield className="text-[#F27D26]" size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter">Privacy Policy</h1>
        </div>

        <div className="space-y-6 text-slate-600 dark:text-slate-400 leading-relaxed">
          <p className="font-bold text-black dark:text-white">Last Updated: April 11, 2026</p>
          
          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly to us when you create an account, such as your name, email address, and profile picture. We also collect data about your interactions with the app, including quotes you like, download, or comment on.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to provide, maintain, and improve our services, to personalize your experience, and to communicate with you about updates and features.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">3. Data Storage and Security</h2>
            <p>Your data is stored securely using Firebase (Google Cloud). We implement industry-standard security measures to protect your personal information from unauthorized access.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">4. Third-Party Services</h2>
            <p>We use third-party services like Firebase and ImageKit to provide our services. These services have their own privacy policies regarding how they handle your data.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">5. Your Rights</h2>
            <p>You have the right to access, update, or delete your personal information at any time through your profile settings.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-black dark:text-white mb-3">6. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at ig.mukesh12@gmail.com.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
