import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CreditCard, CheckCircle2, AlertCircle, ShieldCheck, Crown } from 'lucide-react';
import { db, auth, doc, getDoc, setDoc, addDoc, collection } from '../firebase';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      const docSnap = await getDoc(doc(db, 'settings', 'payment'));
      if (docSnap.exists()) {
        setSettings(docSnap.data());
      } else {
        setSettings({
          subscriptionPrice: 99,
          razorpayKeyId: 'rzp_test_Sdb9QzH1sFzGWW'
        });
      }
    };
    if (isOpen) fetchSettings();
  }, [isOpen]);

  const handlePayment = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Create Order on Server
      const response = await fetch('/api/payment/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: settings?.subscriptionPrice || 99,
          currency: 'INR',
          receipt: `receipt_${Date.now()}`
        })
      });

      const order = await response.json();

      // 2. Open Razorpay Checkout
      const options = {
        key: settings?.razorpayKeyId || 'rzp_test_Sdb9QzH1sFzGWW',
        amount: order.amount,
        currency: order.currency,
        name: "108 Counter",
        description: "Lifetime Premium Subscription",
        order_id: order.id,
        handler: async (response: any) => {
          // 3. Verify Payment on Server
          const verifyRes = await fetch('/api/payment/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature
            })
          });

          const verifyData = await verifyRes.json();

          if (verifyData.status === 'ok') {
            // 4. Update User Profile in Firestore
            const userRef = doc(db, 'users', auth.currentUser!.uid);
            await setDoc(userRef, {
              isSubscribed: true,
              subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000 * 10).toISOString(), // 10 years (lifetime)
              updatedAt: new Date().toISOString()
            }, { merge: true });

            // 5. Record Subscription
            await addDoc(collection(db, 'subscriptions'), {
              uid: auth.currentUser!.uid,
              email: auth.currentUser!.email,
              amount: settings?.subscriptionPrice || 99,
              orderId: response.razorpay_order_id,
              paymentId: response.razorpay_payment_id,
              status: 'success',
              createdAt: new Date().toISOString()
            });

            onSuccess();
            onClose();
          } else {
            setError("पेमेंट वेरिफिकेशन विफल रहा। कृपया सपोर्ट से संपर्क करें।");
          }
        },
        prefill: {
          name: auth.currentUser.displayName,
          email: auth.currentUser.email
        },
        theme: {
          color: "#F27D26"
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Payment Error:", err);
      setError("पेमेंट शुरू करने में विफल। कृपया पुनः प्रयास करें।");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white dark:bg-[#151619] border border-gray-200 dark:border-white/10 rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#F27D26]/10 blur-[50px] -z-10" />
            
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors z-10"
            >
              <X size={20} className="text-gray-500 dark:text-gray-400" />
            </button>

            <div className="flex flex-col items-center text-center space-y-6">
              <div className="w-20 h-20 bg-gradient-to-br from-[#F27D26]/20 to-yellow-500/20 rounded-3xl flex items-center justify-center text-[#F27D26]">
                <Crown size={40} fill="currentColor" />
              </div>

              <div className="space-y-2">
                <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#F27D26] to-yellow-500 tracking-tight">प्रीमियम अनलॉक करें</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                  आपके फ्री क्रेडिट्स खत्म हो गए हैं। सभी प्रीमियम फीचर्स का लाइफटाइम एक्सेस पाएं।
                </p>
              </div>

              <div className="w-full space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-800 dark:text-gray-200 bg-gradient-to-r from-[#F27D26]/10 to-yellow-500/10 p-4 rounded-2xl border border-[#F27D26]/30 shadow-sm">
                  <div className="bg-[#F27D26] rounded-full p-1 text-white">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="font-bold text-base text-left">अपनी फोटो और नाम के साथ अनलिमिटेड कोट्स</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl">
                  <CheckCircle2 size={18} className="text-green-500" />
                  <span className="font-medium text-left">अनलिमिटेड HD डाउनलोड और शेयर</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-white/5 p-3 rounded-2xl">
                  <CheckCircle2 size={18} className="text-green-500" />
                  <span className="font-medium text-left">बिना किसी वॉटरमार्क के</span>
                </div>
              </div>

              <div className="w-full pt-4">
                <div className="flex items-center justify-between mb-4 px-2">
                  <span className="text-gray-500 font-medium">लाइफटाइम एक्सेस</span>
                  <span className="text-2xl font-black text-black dark:text-white">₹{settings?.subscriptionPrice || 99}</span>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-xs text-left">
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                  </div>
                )}

                <button 
                  onClick={handlePayment}
                  disabled={loading}
                  className="w-full bg-[#F27D26] text-white py-4 rounded-2xl font-bold shadow-lg shadow-[#F27D26]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <CreditCard size={20} />
                      अभी पेमेंट करें
                    </>
                  )}
                </button>
                
                <div className="mt-4 flex items-center justify-center gap-2 text-[10px] text-gray-400 uppercase tracking-widest font-bold">
                  <ShieldCheck size={12} />
                  सुरक्षित पेमेंट (SSL)
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};
