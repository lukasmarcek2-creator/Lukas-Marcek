/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coffee, 
  Cookie, 
  Cake, 
  Crown, 
  MapPin, 
  Compass, 
  CheckCircle, 
  RotateCcw, 
  Coins, 
  Navigation, 
  HelpCircle, 
  History, 
  Clock, 
  Sparkles,
  Trophy,
  ArrowRight,
  Info,
  Camera,
  Eye,
  Instagram,
  Share2
} from 'lucide-react';

import { CAFES, REWARD_GOALS } from './data';
import { Cafe, VisitLog, CafeRewardGoal } from './types';
import CafeMap from './components/CafeMap';
import MissionCamera from './components/MissionCamera';

export default function App() {
  // --- Persistent States ---
  const [claimedCafeIds, setClaimedCafeIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('claimed_cafe_ids');
    return saved ? JSON.parse(saved) : [];
  });

  const [visitLog, setVisitLog] = useState<VisitLog[]>(() => {
    const saved = localStorage.getItem('visit_log');
    return saved ? JSON.parse(saved) : [];
  });

  const [unlockedGoals, setUnlockedGoals] = useState<string[]>(() => {
    const saved = localStorage.getItem('unlocked_goals');
    return saved ? JSON.parse(saved) : [];
  });

  const [selectedCafeId, setSelectedCafeId] = useState<string | null>('wallner');

  // --- UI feedback states ---
  const [gpsSimStep, setGpsSimStep] = useState<number>(0);
  const [isSimulatingGps, setIsSimulatingGps] = useState<boolean>(false);
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [showInstagramDialog, setShowInstagramDialog] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<{ message: string; sub: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [confettiParticles, setConfettiParticles] = useState<{ id: number; x: number; y: number; color: string }[]>([]);

  // Cache coordinates and values
  useEffect(() => {
    localStorage.setItem('claimed_cafe_ids', JSON.stringify(claimedCafeIds));
  }, [claimedCafeIds]);

  useEffect(() => {
    localStorage.setItem('visit_log', JSON.stringify(visitLog));
  }, [visitLog]);

  useEffect(() => {
    localStorage.setItem('unlocked_goals', JSON.stringify(unlockedGoals));
  }, [unlockedGoals]);

  // Toast auto-dismissal
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [showToast]);

  const activeCafe = CAFES.find(c => c.id === selectedCafeId) || CAFES[0];

  // --- Financial Calculations ---
  const lifetimeEarnings = claimedCafeIds.reduce((sum, id) => {
    const cafe = CAFES.find(c => c.id === id);
    return sum + (cafe ? cafe.rewardAmount : 0);
  }, 0);

  const totalSpent = unlockedGoals.reduce((sum, id) => {
    const goal = REWARD_GOALS.find(g => g.id === id);
    return sum + (goal ? goal.cost : 0);
  }, 0);

  const walletBalance = parseFloat((lifetimeEarnings - totalSpent).toFixed(2));

  // --- Helpers ---
  const triggerConfetti = () => {
    const colors = ['#D4AF37', '#2E5A44', '#B8860B', '#F59E0B', '#10B981', '#3B82F6'];
    const newParticles = Array.from({ length: 45 }).map((_, i) => ({
      id: Date.now() + i,
      x: Math.random() * 80 + 10, // vertical starting zone %
      y: Math.random() * 20 + 80, // bottom starting line %
      color: colors[Math.floor(Math.random() * colors.length)],
    }));
    setConfettiParticles(newParticles);
    setTimeout(() => setConfettiParticles([]), 2500);
  };

  const handleClaimReward = (cafeId: string) => {
    if (claimedCafeIds.includes(cafeId)) return;

    const targetCafe = CAFES.find(c => c.id === cafeId);
    if (!targetCafe) return;

    setIsSimulatingGps(true);
    setGpsSimStep(1); // 'Spúšťam GPS vyhľadávanie...'

    // Phase 1 GPS setup
    setTimeout(() => {
      setGpsSimStep(2); // 'Synchronizujem polohu so satelitom...'
    }, 800);

    // Phase 2 coordinates matching
    setTimeout(() => {
      setGpsSimStep(3); // 'Overujem presnosť polohy [47.7..., 13.5...]...'
    }, 1600);

    // Phase 3 claim success
    setTimeout(() => {
      setIsSimulatingGps(false);
      setGpsSimStep(0);

      // Mutate states
      setClaimedCafeIds(prev => [...prev, cafeId]);
      
      const newVisit: VisitLog = {
        id: `visit-${Date.now()}`,
        cafeId: targetCafe.id,
        cafeName: targetCafe.name,
        amount: targetCafe.rewardAmount,
        instagramStatus: 'not_uploaded',
        date: new Date().toLocaleDateString('sk-SK', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
      };
      
      setVisitLog(prev => [newVisit, ...prev]);
      setShowToast({
        message: 'Odmena úspešne získaná!',
        sub: `Na Váš účet bolo pripísaných ${targetCafe.reward} z ${targetCafe.name}.`,
        type: 'success'
      });
      triggerConfetti();
    }, 2500);
  };

  const handleMissionCaptureSuccess = (photoUrl: string) => {
    if (claimedCafeIds.includes(activeCafe.id)) return;

    setClaimedCafeIds(prev => [...prev, activeCafe.id]);
    
    const newVisit: VisitLog = {
      id: `visit-${Date.now()}`,
      cafeId: activeCafe.id,
      cafeName: activeCafe.name,
      amount: activeCafe.rewardAmount,
      photoUrl,
      instagramStatus: 'not_uploaded',
      date: new Date().toLocaleDateString('sk-SK', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
    };
    
    setVisitLog(prev => [newVisit, ...prev]);
    setIsCameraOpen(false);
    setShowInstagramDialog(true);
    setShowToast({
      message: 'Misia splnená úspešne!',
      sub: `Zachytená kaviarenská fotografia bola overená so súradnicami. Získali ste ${activeCafe.reward}!`,
      type: 'success'
    });
    triggerConfetti();
  };

  const handleUploadInstagramScreenshot = (logId: string, screenshotUrl: string) => {
    setVisitLog(prev => prev.map(log => {
      if (log.id === logId) {
        return {
          ...log,
          instagramScreenshotUrl: screenshotUrl,
          instagramStatus: 'verified'
        };
      }
      return log;
    }));

    setShowToast({
      message: 'Screenshot úspešne overený!',
      sub: 'Instagram screenshot bol odoslaný. Výplata odmeny je definitívne schválená ✓',
      type: 'success'
    });
    triggerConfetti();
  };

  const handleUnlockGoal = (goal: CafeRewardGoal) => {
    if (unlockedGoals.includes(goal.id)) {
      setShowToast({
        message: 'Túto dobrotu už máš odomknutú!',
        sub: 'Vychutnaj si jej pravú rakúsku chuť.',
        type: 'info'
      });
      return;
    }

    if (walletBalance < goal.cost) {
      setShowToast({
        message: 'Nedostatok prostriedkov vo finančnej peňaženke',
        sub: `Potrebuješ ešte ${(goal.cost - walletBalance).toFixed(2)} € vyzbieraním ďalších odmien.`,
        type: 'error'
      });
      return;
    }

    setUnlockedGoals(prev => [...prev, goal.id]);
    setShowToast({
      message: 'Dobrota kúpená!',
      sub: `Tradičná cukrovinka "${goal.nameSlovak}" bola odomknutá z tvojich odmien.`,
      type: 'success'
    });
    triggerConfetti();
  };

  const handleReset = () => {
    if (window.confirm('Naozaj si prajete vymazať všetok pokrok, peňaženku a začať znova?')) {
      setClaimedCafeIds([]);
      setVisitLog([]);
      setUnlockedGoals([]);
      setShowToast({
        message: 'Cesta bola reštartovaná',
        sub: 'Vaša kaviarenská knižka bola vyčistená.',
        type: 'info'
      });
    }
  };

  const getGoalIcon = (iconName: string) => {
    const cls = "w-5 h-5 text-[#5A5A40]";
    switch(iconName) {
      case 'Coffee': return <Coffee className={cls} />;
      case 'Cookie': return <Cookie className={cls} />;
      case 'Cake': return <Cake className={cls} />;
      case 'Crown': return <Crown className={cls} />;
      default: return <Sparkles className={cls} />;
    }
  };

  // Percent explored
  const explorePercent = Math.round((claimedCafeIds.length / CAFES.length) * 100);

  return (
    <div className="relative min-h-screen font-sans bg-[#f5f5f0] text-[#2c2c2c] pb-16 antialiased selection:bg-[#5A5A40]/20 overflow-x-hidden">
      
      {/* Natural Tones Ambient Background Textures */}
      <div className="absolute inset-x-0 top-0 h-[850px] pointer-events-none opacity-40 bg-natural-dots" />
      <div className="absolute top-1/4 left-1/3 w-64 h-32 bg-[#b8c9bc] rounded-full blur-3xl opacity-50 transform rotate-12 pointer-events-none" />
      <div className="absolute top-2/3 right-1/4 w-80 h-48 bg-[#9fb1a5] rounded-full blur-3xl opacity-30 transform -rotate-45 pointer-events-none" />

      {/* Toast notifications */}
      <AnimatePresence>
        {showToast && (
          <motion.div 
            initial={{ opacity: 0, y: -30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 left-1/2 -translate-x-1/2 z-[9999] w-[90%] max-w-md p-4 rounded-[20px] shadow-xl border backdrop-blur-md flex items-start gap-3.5 transition-all
              ${showToast.type === 'success' 
                ? 'bg-emerald-50/95 border-emerald-200 text-emerald-900 shadow-emerald-950/5' 
                : showToast.type === 'error'
                ? 'bg-rose-50/95 border-rose-200 text-rose-900 shadow-rose-950/5'
                : 'bg-stone-50/95 border-[#e2e2d8] text-stone-900 shadow-stone-950/5'
              }`}
          >
            <div className={`mt-0.5 p-1 rounded-full ${showToast.type === 'success' ? 'bg-emerald-100 text-emerald-700' : showToast.type === 'error' ? 'bg-rose-100 text-rose-700' : 'bg-stone-100 text-[#5A5A40]'}`}>
              {showToast.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <Info className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-sm leading-tight font-serif-elegant italic">{showToast.message}</h4>
              <p className="text-xs mt-1 text-stone-600 font-medium leading-relaxed">{showToast.sub}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confetti canvas visual feedback simulation */}
      <div className="fixed inset-0 pointer-events-none z-[999] overflow-hidden">
        {confettiParticles.map((p, idx) => (
          <motion.div
            key={p.id}
            initial={{ 
              opacity: 1, 
              scale: Math.random() * 0.4 + 0.6,
              x: `${p.x}vw`, 
              y: '100vh',
              rotation: 0
            }}
            animate={{ 
              y: '0vh', 
              x: `${p.x + (Math.sin(idx) * 10)}vw`,
              opacity: 0,
              rotate: 360 * (Math.random() > 0.5 ? 1 : -1)
            }}
            transition={{
              duration: Math.random() * 1.5 + 1.2,
              ease: "easeOut"
            }}
            className="absolute w-3.5 h-3.5 rounded-sm"
            style={{ backgroundColor: p.color }}
          />
        ))}
      </div>

      {/* --- Elegant Header --- */}
      <header className="relative border-b border-[#e2e2d8] bg-white shadow-xs px-4 py-8 lg:py-10 z-10">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#8a8a7e]">
              <Compass className="w-4 h-4 text-[#5A5A40] animate-spin-slow" />
              <span>Cestovateľský Denník &amp; Kaviarenský Pas</span>
            </div>
            <h1 className="text-3.5xl md:text-5xl font-serif italic text-[#5A5A40] leading-none mb-1">
              Salzkammergut Café Reward Map
            </h1>
            <p className="text-xs text-[#8a8a7e] max-w-xl font-medium leading-relaxed">
              Zaznamenajte svoje návštevy slávnych kaviarní v oblasti rakúskych jazier Wolfgangsee, Bad Ischl a Hallstatt. Zbierajte hotovostné odmeny za splnené GPS návštevy a odomykajte kultové dobroty v salzkammergutskej virtuálnej cukrárni.
            </p>
          </div>

          {/* Wallet and stats block */}
          <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
            
            {/* Wallet Cash Balance Card */}
            <div className="bg-[#fafaf8] p-4 rounded-[24px] border border-[#e2e2d8] shadow-sm flex items-center gap-4 min-w-[210px]">
              <div className="p-3 bg-white border border-[#e2e2d8] rounded-[18px] text-[#5A5A40] ring-4 ring-[#5A5A40]/5">
                <Coins className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <div className="text-[9px] uppercase font-bold text-[#8a8a7e] tracking-wider">Aktívna Peňaženka</div>
                <div className="text-2xl font-black text-[#5A5A40] font-serif flex items-baseline">
                  {walletBalance.toFixed(2)} <span className="text-xs font-bold text-[#8a8a7e] ml-1">€</span>
                </div>
                <div className="text-[10px] text-[#8a8a7e] font-medium">Celkový zisk: {lifetimeEarnings.toFixed(2)} €</div>
              </div>
            </div>

            {/* Visit Progress Tracker Card */}
            <div className="bg-[#fafaf8] p-4 rounded-[24px] border border-[#e2e2d8] shadow-sm flex flex-col justify-center min-w-[210px]">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[9px] uppercase font-bold text-[#8a8a7e] tracking-wider">Preskúmané</span>
                <span className="text-[10px] font-bold font-mono text-[#5A5A40] bg-white border border-[#e2e2d8] px-2 py-0.5 rounded-[12px]">
                  {claimedCafeIds.length}/{CAFES.length}
                </span>
              </div>
              <div className="w-full bg-[#e2e2d8] rounded-full h-2 overflow-hidden">
                <div 
                  className="bg-[#5A5A40] h-2 rounded-full transition-all duration-700"
                  style={{ width: `${explorePercent}%` }}
                />
              </div>
              <div className="text-[10px] text-[#8a8a7e] mt-1.5 font-medium flex justify-between">
                <span>{explorePercent}% kompletné</span>
                <span>Ostávajú: {CAFES.length - claimedCafeIds.length}</span>
              </div>
            </div>

          </div>

        </div>
      </header>

      {/* --- Main Dashboard Container --- */}
      <main className="max-w-7xl mx-auto px-4 mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 z-10 relative">
        
        {/* LEFT COLUMN: Cafe Lists, Details & Shop (7 Columns on large screens) */}
        <div className="lg:col-span-7 space-y-8 flex flex-col">
          
          {/* Section: List of Cafés to Select */}
          <div className="bg-white rounded-[24px] border border-[#e2e2d8] p-5 shadow-xs">
            <h3 className="text-base font-bold text-[#5A5A40] mb-4 flex items-center gap-2 font-serif-elegant italic">
              <span className="w-1.5 h-6 bg-[#5A5A40] rounded-full"></span>
              Zoznam kaviarní v regióne
            </h3>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {CAFES.map((cafe) => {
                const isSelected = cafe.id === selectedCafeId;
                const isClaimed = claimedCafeIds.includes(cafe.id);
                return (
                  <button
                    key={cafe.id}
                    onClick={() => setSelectedCafeId(cafe.id)}
                    className={`relative p-4 rounded-2xl border text-left transition-all duration-200 flex flex-col justify-between overflow-hidden cursor-pointer h-[135px]
                      ${isSelected 
                        ? 'border-[#5A5A40] bg-[#fafaf8] ring-2 ring-[#5A5A40]/10 shadow-xs' 
                        : 'border-[#f0f0e8] bg-white hover:border-[#8a8a7e]/50 hover:bg-[#fafaf8]'
                      }`}
                  >
                    {/* Badge showing claimed/unclaimed states */}
                    <div className="flex justify-between items-start w-full gap-1">
                      <span className={`text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider
                        ${isClaimed 
                          ? 'bg-[#8a8a7e]/15 text-[#8a8a7e]' 
                          : 'bg-[#5A5A40]/10 text-[#5A5A40]'
                        }`}>
                        {isClaimed ? 'Navštívené' : 'Odmena'}
                      </span>
                      <span className="text-xs font-bold text-[#5A5A40] font-mono whitespace-nowrap">
                        {isClaimed ? '✓ Pripísané' : cafe.reward}
                      </span>
                    </div>

                    {/* Cafe Name and Region Info */}
                    <div className="mt-3">
                      <h4 className="text-xs font-bold text-[#2c2c2c] line-clamp-2 leading-relaxed">
                        {cafe.name.replace(' (St. Wolfgang)', '').replace(' (Bad Ischl)', '')}
                      </h4>
                      <p className="text-[10px] text-[#8a8a7e] font-serif italic mt-0.5">
                        {cafe.id === 'wallner' ? 'St. Wolfgang' : cafe.id === 'hofzuckerbaeckerei' ? 'Bad Ischl' : 'Hallstatt'}
                      </p>
                    </div>

                    {/* Selected state bar */}
                    {isSelected && (
                      <div className="absolute right-0 bottom-0 top-0 w-1 bg-[#5A5A40]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section: Cafe Details Visualizer Panel with simulation */}
          <div className="bg-white rounded-[24px] border border-[#e2e2d8] shadow-xs overflow-hidden">
            
            {/* Split layout: Photo and Details */}
            <div className="grid grid-cols-1 md:grid-cols-12">
              
              {/* Photo Area with visual tags */}
              <div className="md:col-span-5 relative min-h-[220px] md:h-auto bg-stone-100">
                <img 
                  src={activeCafe.imageUrl} 
                  alt={activeCafe.name}
                  className="w-full h-full object-cover select-none"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-stone-950/80 via-stone-900/30 to-transparent"></div>
                
                {/* Overlay Address info */}
                <div className="absolute bottom-4 left-4 right-4 text-white">
                  <div className="flex items-center gap-1.5 text-xs text-[#fafaf8] mb-1">
                    <MapPin className="w-3.5 h-3.5 text-[#D4AF37] fill-[#D4AF37]/20" />
                    <span className="font-semibold text-[10px] truncate">{activeCafe.address}</span>
                  </div>
                  <h3 className="text-base font-bold font-serif leading-tight text-white">{activeCafe.name}</h3>
                </div>

                {/* Badge Indicator Coordinate */}
                <span className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm shadow-xs py-1 px-2.5 rounded-full text-[9px] font-bold text-[#5A5A40] font-mono border border-[#e2e2d8]">
                  GPS: {activeCafe.location[0].toFixed(4)}, {activeCafe.location[1].toFixed(4)}
                </span>
              </div>

              {/* Description and GPS Checkin button */}
              <div className="md:col-span-7 p-6 flex flex-col justify-between bg-white">
                <div>
                  <div className="flex items-center justify-between gap-2 border-b border-[#f0f0e8] pb-3.5 mb-3.5">
                    <div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-[#8a8a7e] block">Charakteristika &amp; História</span>
                      <h4 className="text-sm font-bold text-[#2c2c2c] leading-tight font-serif italic">Základné informácie</h4>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-[#8a8a7e] uppercase tracking-wider block">Výška odmeny</span>
                      <span className="text-lg font-bold text-[#5A5A40] font-mono">{activeCafe.reward}</span>
                    </div>
                  </div>

                  <p className="text-xs text-[#8a8a7e] font-medium leading-relaxed mb-4">
                    {activeCafe.description}
                  </p>

                  <div className="bg-[#fafaf8] p-3.5 rounded-[20px] border border-[#e2e2d8] mb-5">
                    <span className="text-[9px] font-bold uppercase text-[#5A5A40] tracking-wide block">Gurmánska špecialita podniku</span>
                    <div className="flex items-start gap-2 mt-1.5">
                      <Cake className="w-4.5 h-4.5 text-[#5A5A40] shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-[#2c2c2c] leading-tight">{activeCafe.specialtySlovak}</p>
                        <p className="text-[10px] text-[#8a8a7e] italic mt-0.5">({activeCafe.specialty})</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Claiming Logic & Verification State */}
                <div className="pt-3 border-t border-[#f0f0e8]">
                  {claimedCafeIds.includes(activeCafe.id) ? (
                    <div className="flex items-center gap-3.5 px-4 py-3 bg-[#fafaf8] rounded-xl border border-[#e2e2d8] text-stone-700">
                      <div className="p-1.5 bg-[#e2e2d8] rounded-full text-[#5A5A40]">
                        <CheckCircle className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-[#2c2c2c]">Návšteva overená! Odmena už pripísaná</p>
                        <p className="text-[10px] text-[#8a8a7e] font-medium">Bolo vám úspešne doručených {activeCafe.reward} na váš pas.</p>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {isSimulatingGps ? (
                        <div className="bg-[#fafaf8] rounded-xl border border-[#e2e2d8] p-4 space-y-3">
                          <div className="flex items-center justify-between text-xs font-bold">
                            <span className="text-[#5A5A40] animate-pulse flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-[#5A5A40] animate-ping"></span>
                              {gpsSimStep === 1 ? 'Pripájam GPS k Salzkammergut...' : gpsSimStep === 2 ? 'Overujem rakúske súradnice...' : 'Vkladám kaviarenskú odmenu...'}
                            </span>
                            <span className="text-[10px] text-[#8a8a7e] font-mono">
                              {gpsSimStep === 1 ? '15%' : gpsSimStep === 2 ? '60%' : '90%'}
                            </span>
                          </div>
                          <div className="w-full bg-[#e2e2d8] rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-[#5A5A40] h-2 rounded-full transition-all duration-300"
                              style={{ width: gpsSimStep === 1 ? '20%' : gpsSimStep === 2 ? '65%' : '90%' }}
                            />
                          </div>
                          <p className="text-[10px] text-[#8a8a7e] italic">
                            Porovnávam GPS polohu zariadenia so súradnicami podniku [{activeCafe.location.join(', ')}]...
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row gap-3">
                          <button
                            onClick={() => setIsCameraOpen(true)}
                            className="flex-1 mt-1 bg-[#5A5A40] border border-[#5A5A40] hover:bg-[#484833] hover:border-[#484833] text-white py-3 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md active:scale-[0.98] cursor-pointer"
                          >
                            <Camera className="w-4 h-4 fill-white text-[#D4AF37]" strokeWidth="2.5" />
                            Zahájiť kamerovú misiu
                          </button>
                          
                          <button
                            onClick={() => handleClaimReward(activeCafe.id)}
                            className="mt-1 bg-[#fafaf8] border border-[#e2e2d8] hover:bg-stone-50 text-stone-700 py-3 px-4 rounded-xl font-bold text-[11px] flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] cursor-pointer"
                          >
                            <Navigation className="w-3.5 h-3.5 text-[#8a8a7e]" />
                            Rýchle GPS overenie
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>

          {/* Section: UNLOCK PASTRIES (Spent digital coins context) */}
          <div className="bg-[#fafaf8] rounded-[24px] border border-[#e2e2d8]/80 p-5">
            <div className="flex items-center justify-between border-b border-[#f0f0e8] pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#5A5A40] flex items-center gap-2 font-serif-elegant italic">
                  <Trophy className="w-5 h-5 text-[#D4AF37] shrink-0" />
                  Sladký kútik Salzkammergutu
                </h3>
                <p className="text-[11px] text-[#8a8a7e] font-medium">
                  Vychutnajte si tradičné špeciality. Vymeňte svoje získané eurá za dobroty!
                </p>
              </div>

              <span className="text-xs font-bold bg-white px-3 py-1 rounded-full border border-[#e2e2d8] flex items-center gap-1.5 shadow-5xs">
                <Coins className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span className="font-mono text-[#5A5A40] font-black">{walletBalance.toFixed(2)} €</span>
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {REWARD_GOALS.map((goal) => {
                const isUnlocked = unlockedGoals.includes(goal.id);
                const canAfford = walletBalance >= goal.cost;
                
                return (
                  <div 
                    key={goal.id}
                    className={`p-4 rounded-xl border bg-white flex flex-col justify-between transition-all duration-200 relative overflow-hidden
                      ${isUnlocked 
                        ? 'border-[#5A5A40]/40 shadow-6xs bg-[#fafaf8]/50' 
                        : 'border-[#e2e2d8] hover:border-[#5A5A40]/50 shadow-xs'
                      }`}
                  >
                    {isUnlocked && (
                      <div className="absolute -top-6 -right-6 w-12 h-12 bg-[#5A5A40] rotate-45 flex items-end justify-center pb-1 text-white text-[10px] font-bold">
                        ✓
                      </div>
                    )}

                    <div className="space-y-1.5 mb-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`p-2 rounded-lg border 
                            ${isUnlocked 
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                              : 'bg-[#fafaf8] text-[#5A5A40] border-[#e2e2d8]'
                            }`}>
                            {getGoalIcon(goal.icon)}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-[#c2c2c] leading-tight block">
                              {goal.nameSlovak}
                            </h4>
                            <span className="text-[10px] text-[#8a8a7e] font-serif leading-none italic block mt-0.5">
                              {goal.name}
                            </span>
                          </div>
                        </div>

                        <span className={`text-xs font-mono font-black py-0.5 px-1.5 rounded-md text-[11px] border
                          ${isUnlocked 
                            ? 'text-[#8a8a7e] bg-[#fafaf8] border-[#e2e2d8]' 
                            : 'text-[#5A5A40] bg-[#fafaf8] border-[#e2e2d8]'
                          }`}>
                          {goal.cost.toFixed(2)} €
                        </span>
                      </div>
                      
                      <p className="text-[11px] text-[#8a8a7e] font-medium leading-normal">
                        {goal.descriptionSlovak}
                      </p>
                    </div>

                    <button
                      onClick={() => handleUnlockGoal(goal)}
                      disabled={isUnlocked}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold transition-all duration-150 flex items-center justify-center gap-1 cursor-pointer
                        ${isUnlocked 
                          ? 'bg-[#fafaf8] text-[#8a8a7e] cursor-default border border-[#e2e2d8] font-medium' 
                          : canAfford
                          ? 'bg-[#5A5A40] hover:bg-[#484833] text-white shadow-xs'
                          : 'bg-[#fafaf8] text-stone-400 border border-[#e2e2d8]/60'
                        }`}
                    >
                      {isUnlocked ? (
                        <>Už si si pochutnal</>
                      ) : (
                        <>
                          Vymeniť za {goal.cost.toFixed(2)} €
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Interactive Leaflet Map and Visit History logs */}
        <div className="lg:col-span-5 space-y-8 flex flex-col">
          
          {/* Section: MAP AREA (Fixed 400px tall interactive box mapping precisely the requested specs) */}
          <div className="bg-white rounded-[24px] border border-[#e2e2d8] shadow-xs p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-base font-bold text-[#5A5A40] flex items-center gap-2 font-serif-elegant italic">
                  <MapPin className="w-4.5 h-4.5 text-[#5A5A40] shrink-0" />
                  Interaktívna Salzkammergut mapa
                </h3>
                <p className="text-[11px] text-[#8a8a7e] font-medium">
                  Kliknutím na špendlík presuniete stred a zobrazíte detaily.
                </p>
              </div>
            </div>

            <div className="h-[380px] w-full relative">
              <CafeMap
                cafes={CAFES}
                selectedCafeId={selectedCafeId}
                onSelectCafe={setSelectedCafeId}
                claimedCafeIds={claimedCafeIds}
              />
            </div>
          </div>

          {/* Section: HISTORY VÝLETOV LOG */}
          <div className="bg-white rounded-[24px] border border-[#e2e2d8] shadow-xs p-5">
            <div className="flex items-center justify-between border-b border-[#f0f0e8] pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-[#5A5A40] flex items-center gap-2 font-serif-elegant italic">
                  <History className="w-4.5 h-4.5 text-[#8a8a7e]" />
                  Kniha návštev (História)
                </h3>
                <p className="text-[11px] text-[#8a8a7e] font-medium">Hronologický zoznam vašich overených výletov.</p>
              </div>

              {visitLog.length > 0 && (
                <button
                  onClick={handleReset}
                  className="text-[10px] font-bold text-red-700 hover:text-red-800 hover:underline flex items-center gap-1 cursor-pointer transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reštartovať hru
                </button>
              )}
            </div>

            {visitLog.length === 0 ? (
              <div className="text-center py-10 px-4 bg-[#fafaf8] rounded-xl border border-dashed border-[#e2e2d8]">
                <Compass className="w-8 h-8 text-[#8a8a7e]/40 mx-auto mb-2 animate-bounce" />
                <p className="text-xs font-bold text-[#5A5A40] font-serif italic">Doteraz žiadne overené návštevy</p>
                <p className="text-[10px] text-[#8a8a7e] mt-1">Zvoľte kaviareň zo zoznamu vyššie a simulujte overenie polohy kliknutím na GPS tlačidlo.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                {visitLog.map((log) => {
                  const isVerified = log.instagramStatus === 'verified';
                  return (
                    <div 
                      key={log.id}
                      className="p-3.5 bg-[#fafaf8] rounded-xl border border-[#f0f0e8] flex flex-col gap-2.5 hover:bg-white transition-all text-xs"
                      id={`visit-card-${log.id}`}
                    >
                      <div className="flex justify-between items-center gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          {log.photoUrl ? (
                            <img 
                              src={log.photoUrl} 
                              alt={log.cafeName} 
                              className="w-10 h-10 object-cover rounded-lg border border-[#e2e2d8] shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-[#e2e2d8]/40 flex items-center justify-center text-[#8a8a7e] shrink-0">
                              <Coffee className="w-5 h-5 text-[#5A5A40]" />
                            </div>
                          )}
                          
                          <div className="min-w-0">
                            <h4 className="font-bold text-[#2c2c2c] leading-tight truncate">
                              {log.cafeName}
                            </h4>
                            <p className="text-[9px] text-[#8a8a7e] flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3 text-[#8a8a7e]" />
                              {log.date}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-mono font-bold text-[#5A5A40] bg-white border border-[#e2e2d8] px-2.5 py-0.5 rounded-md text-[10px]">
                            +{log.amount.toFixed(2)} €
                          </span>
                        </div>
                      </div>

                      {/* Verification segment for Instagram screenshot */}
                      <div className="bg-white rounded-lg p-2.5 border border-[#e2e2d8]/60 flex items-center justify-between gap-3 mt-0.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Instagram className={`w-4 h-4 shrink-0 ${isVerified ? 'text-emerald-700' : 'text-[#8a8a7e]'}`} />
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-[#5A5A40]">
                              Instagram tag @{log.cafeId === 'wallner' ? 'cafewallner' : log.cafeId === 'hofzuckerbaeckerei' ? 'kuk_hofzuckerbaeckerei' : 'seecafe_hallstatt'}
                            </p>
                            <p className="text-[8px] text-[#8a8a7e] truncate">
                              {isVerified ? 'Screenshot bol úspešne nahraný a overený' : 'Nahrajte screenshot príbehu pre výplatu'}
                            </p>
                          </div>
                        </div>

                        {isVerified ? (
                          <div className="flex items-center gap-1.5 shrink-0">
                            {log.instagramScreenshotUrl && (
                              <img 
                                src={log.instagramScreenshotUrl} 
                                alt="IG Screenshot" 
                                className="w-7 h-7 object-cover rounded border border-[#e2e2d8]"
                              />
                            )}
                            <span className="text-[9px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                              OVERENÉ ✓
                            </span>
                          </div>
                        ) : (
                          <label 
                            className="bg-[#5A5A40] hover:bg-[#484833] text-white px-2.5 py-1 rounded text-[9px] font-bold cursor-pointer transition-all active:scale-95"
                            id={`upload-ig-label-${log.id}`}
                          >
                            <span>Nahrať screenshot</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              className="hidden" 
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const r = new FileReader();
                                  r.onload = (evt) => {
                                    if (evt.target?.result) {
                                      handleUploadInstagramScreenshot(log.id, evt.target.result as string);
                                    }
                                  };
                                  r.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Guidelines box about physical coordinates requested */}
          <div className="bg-[#fafaf8] text-stone-700 px-4 py-3.5 rounded-[24px] border border-[#e2e2d8] flex gap-3 text-xs leading-normal">
            <Info className="w-5 h-5 text-[#5A5A40] shrink-0 mt-0.5" />
            <div>
              <h4 className="font-serif font-bold italic text-[#5A5A40]">Salzkammergut Súradnice (Koordináty)</h4>
              <p className="text-[11px] text-[#8a8a7e] mt-0.5 leading-relaxed font-medium">
                Tento digitálny pas sleduje reálne Salzkammergut súradnice zadané pre Café Wallner (St. Wolfgang - 13.4475 V, 47.7385 S), K.u.K. Hofzuckerbäckerei (Bad Ischl - 13.6210 V, 47.7125 S) a Seecafe Hallstatt (13.6490 V, 47.5620 S). Mapa Salzkammergut je prednastavená na optimálny zoom 11.0 pre celé Alpské jazero Wolfgangsee a Hallstättersee.
              </p>
            </div>
          </div>

        </div>

      </main>

      {/* Elegant minimalist footer */}
      <footer className="max-w-7xl mx-auto px-4 mt-20 pt-6 border-t border-[#e2e2d8] flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[#8a8a7e] font-medium z-10 relative">
        <p>© 2026 Salzkammergut Café Reward Pas. Tradičné rodinné pekarne s rakúskym dedičstvom.</p>
        <div className="flex gap-4">
          <span className="hover:text-stone-600 cursor-pointer">St. Wolfgang</span>
          <span>•</span>
          <span className="hover:text-stone-600 cursor-pointer">Bad Ischl</span>
          <span>•</span>
          <span className="hover:text-stone-600 cursor-pointer">Hallstatt</span>
        </div>
      </footer>

      {isCameraOpen && (
        <MissionCamera
          cafe={activeCafe}
          onCaptureSuccess={handleMissionCaptureSuccess}
          onClose={() => setIsCameraOpen(false)}
        />
      )}

      {/* Elegant Instagram Instructional Dialog Modal */}
      {showInstagramDialog && (
        <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4 bg-stone-900/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-[24px] border border-[#e2e2d8] shadow-2xl p-6 relative overflow-hidden text-center flex flex-col items-center">
            
            {/* Design circle badge with warm sunset Instagram theme styling */}
            <div className="w-16 h-16 rounded-full bg-linear-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7] text-white flex items-center justify-center mb-4.5 shadow-md">
              <Instagram className="w-8 h-8 stroke-[1.8]" />
            </div>

            <h3 className="text-xl font-bold text-[#5A5A40] font-serif italic mb-2">
              Skvelá fotka!
            </h3>

            <p className="text-xs text-[#8a8a7e] font-medium leading-relaxed mb-6 px-2">
              Teraz otvor Instagram, vlož fotku, pridaj tag <span className="text-[#ee2a7b] font-bold">@{activeCafe.id === 'wallner' ? 'cafewallner' : activeCafe.id === 'hofzuckerbaeckerei' ? 'kuk_hofzuckerbaeckerei' : 'seecafe_hallstatt'}</span> a nahraj screenshot sem pre výplatu.
            </p>

            <div className="w-full space-y-2.5">
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 bg-linear-to-r from-[#8a3ab9] via-[#e95950] to-[#fccc63] text-white rounded-xl text-xs font-bold transition-all hover:scale-102 hover:shadow-md active:scale-98 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Share2 className="w-4 h-4" />
                Otvoriť Instagram
              </a>

              <button
                onClick={() => setShowInstagramDialog(false)}
                className="w-full py-2.5 border border-[#e2e2d8] hover:bg-[#fafaf8] text-stone-700 rounded-xl text-xs font-bold transition-all active:scale-98 cursor-pointer"
              >
                Rozumiem (OK)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
