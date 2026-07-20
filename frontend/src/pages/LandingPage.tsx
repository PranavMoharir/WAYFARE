import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plane, MapPin, Calendar, Wallet } from 'lucide-react';
import HeroBackground from '../components/HeroBackground';
import Logo from '../components/Logo';

// ─── Typewriter ───────────────────────────────────────────────────────────────
function useTypewriter(words: string[], speed = 85, pause = 2400) {
  const [displayed, setDisplayed] = useState('');
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const currentWord = words[wordIndex % words.length];
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          const next = currentWord.slice(0, displayed.length + 1);
          setDisplayed(next);
          if (next === currentWord) setTimeout(() => setIsDeleting(true), pause);
        } else {
          const next = currentWord.slice(0, displayed.length - 1);
          setDisplayed(next);
          if (next === '') {
            setIsDeleting(false);
            setWordIndex((i) => i + 1);
          }
        }
      },
      isDeleting ? speed / 2 : speed
    );
    return () => clearTimeout(timeout);
  }, [displayed, isDeleting, wordIndex, words, speed, pause]);

  return displayed;
}

// ─── How It Works step card ───────────────────────────────────────────────────
function StepCard({
  number,
  title,
  description,
  delay,
}: {
  number: string;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
      className="bg-white rounded-2xl border border-border p-7 flex flex-col gap-4"
    >
      <span className="text-xs font-bold tracking-widest text-muted-foreground uppercase">
        {number}
      </span>
      <h3 className="text-lg font-semibold text-foreground leading-snug">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </motion.div>
  );
}

// ─── Destination pill (decorative row) ───────────────────────────────────────
function DestPill({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 bg-white border border-border rounded-full px-4 py-1.5 text-sm font-medium text-foreground shadow-sm whitespace-nowrap">
      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
      {label}
    </span>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function LandingPage() {
  const navigate = useNavigate();

  // Hero search card controlled state
  const [heroOrigin, setHeroOrigin] = useState('');
  const [heroDest, setHeroDest] = useState('');
  const [heroCheckin, setHeroCheckin] = useState('');
  const [heroCheckout, setHeroCheckout] = useState('');
  const [heroBudget, setHeroBudget] = useState('');

  function handleHeroSearch() {
    navigate('/plan', {
      state: {
        origin: heroOrigin,
        destination: heroDest,
        checkin: heroCheckin,
        checkout: heroCheckout,
        budget: heroBudget,
      },
    });
  }

  const typewriterText = useTypewriter(
    ['Bali', 'Paris', 'Tokyo', 'Cape Town', 'Santorini', 'Kyoto', 'New York'],
    85,
    2400
  );

  const steps = [
    {
      number: '01',
      title: 'Tell us where you want to go',
      description:
        'Enter your origin, destination, travel dates, and a rough budget. Takes less than a minute.',
    },
    {
      number: '02',
      title: 'Choose what you love',
      description:
        'Pick from a list of travel styles — history, food, nature, art, adventure — or mix and match.',
    },
    {
      number: '03',
      title: 'Get a complete trip plan',
      description:
        'We search real flights and hotels, curate local experiences, and fit everything inside your budget automatically.',
    },
  ];

  const destinations = [
    'Paris', 'Tokyo', 'Bali', 'Cape Town', 'Rome', 'New York', 'Kyoto', 'Santorini',
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">

      {/* ── Navbar ────────────────────────────────────────────────── */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border"
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* Logo */}
          <Logo variant="dark" />

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium text-muted-foreground">
            <button
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-foreground transition-colors"
            >
              How it works
            </button>
            <button
              onClick={() => document.getElementById('destinations')?.scrollIntoView({ behavior: 'smooth' })}
              className="hover:text-foreground transition-colors"
            >
              Destinations
            </button>
          </div>

          {/* CTA */}
          <motion.button
            id="nav-plan-btn"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate('/plan')}
            className="flex items-center gap-1.5 bg-foreground text-background text-sm font-semibold rounded-full px-5 py-2.5 transition-opacity hover:opacity-90"
          >
            Plan a Trip
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </motion.nav>

      {/* ── Hero ──────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden w-full pt-28 pb-20">
        <HeroBackground />
        
        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center">
          {/* "New" badge */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="inline-flex items-center gap-2 mb-8"
          >
            <span className="badge-pill bg-white text-foreground">NEW</span>
            <span className="text-sm text-white/80">
              Plan your perfect trip in minutes, not hours
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-5xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6 text-white"
          >
            Travel smarter,
            <br />
            <em className="not-italic">explore</em>{' '}
            <span className="italic-accent">
              {typewriterText}
              <motion.span
                animate={{ opacity: [1, 0, 1] }}
                transition={{ duration: 0.75, repeat: Infinity, ease: 'linear' }}
                className="inline-block ml-0.5 align-baseline"
                style={{ width: 2, height: '0.8em', background: '#ffffff', verticalAlign: 'middle' }}
              />
            </span>
          </motion.h1>

          {/* Sub-headline */}
          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="text-lg text-white/90 max-w-xl mx-auto leading-relaxed mb-10"
          >
            Tell us where you want to go and your budget. We handle flights, hotels,
            and things to do — all in one beautifully organised plan.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-3"
          >
            <motion.button
              id="hero-plan-btn"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => navigate('/plan')}
              className="flex items-center gap-2 bg-white text-foreground font-semibold rounded-full px-8 py-3.5 text-base shadow-sm hover:opacity-90 transition-opacity"
            >
              Plan My Trip — Free
              <ArrowRight className="w-4 h-4" />
            </motion.button>
            <motion.button
              id="hero-how-btn"
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
              className="text-white/80 hover:text-white transition-colors font-medium text-base px-4 py-3.5"
            >
              See how it works
            </motion.button>
          </motion.div>

        {/* Hero search card — fully functional */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
            className="mt-16 bg-white border border-border rounded-2xl shadow-md p-6 max-w-2xl mx-auto text-left"
          >
            <p className="text-sm text-muted-foreground mb-5 font-medium">
              Where are you headed?
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3">
                <Plane className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={heroOrigin}
                  onChange={(e) => setHeroOrigin(e.target.value)}
                  placeholder="From — city or airport"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
              <div className="flex-1 flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3">
                <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  value={heroDest}
                  onChange={(e) => setHeroDest(e.target.value)}
                  placeholder="To — destination"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <div className="flex-1 flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={heroCheckin}
                  onChange={(e) => setHeroCheckin(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none"
                />
              </div>
              <div className="flex-1 flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3">
                <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={heroCheckout}
                  onChange={(e) => setHeroCheckout(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-foreground outline-none"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-3">
              <div className="flex-[2] flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3">
                <Wallet className="w-4 h-4 text-muted-foreground shrink-0" />
                <input
                  type="number"
                  value={heroBudget}
                  onChange={(e) => setHeroBudget(e.target.value)}
                  placeholder="Budget (₹)"
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  min="0"
                />
              </div>
              <motion.button
                id="hero-search-btn"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleHeroSearch}
                className="flex-1 bg-foreground text-background font-semibold rounded-xl px-6 py-3 text-sm hover:opacity-90 transition-opacity shrink-0"
              >
                Search →
              </motion.button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Destinations Scroll ────────────────────────────────────── */}
      <section id="destinations" className="py-12 border-y border-border overflow-hidden">
        <div className="flex gap-3 animate-[scroll_30s_linear_infinite] w-max">
          {[...destinations, ...destinations].map((d, i) => (
            <DestPill key={i} label={d} />
          ))}
        </div>
      </section>

      {/* ── How It Works ───────────────────────────────────────────── */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-6 py-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">
            How it works
          </p>
          <h2 className="text-4xl sm:text-5xl font-bold tracking-tight leading-tight">
            A complete trip plan,
            <br />
            in minutes.
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-3 gap-5">
          {steps.map((step, i) => (
            <StepCard key={step.number} {...step} delay={i * 0.1} />
          ))}
        </div>
      </section>

      {/* ── Trust / Features strip ─────────────────────────────────── */}
      <section className="bg-white border-y border-border py-16">
        <div className="max-w-6xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid sm:grid-cols-3 gap-10 text-center"
          >
            {[
              { stat: 'Real flights', label: 'Live pricing fetched for your exact dates' },
              { stat: 'Real hotels', label: 'Actual availability, not curated lists' },
              { stat: 'Budget-aware', label: 'We trim the plan to fit what you set' },
            ].map((item, i) => (
              <motion.div
                key={item.stat}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.4 }}
                className="flex flex-col items-center gap-2"
              >
                <p className="text-2xl font-bold text-foreground">{item.stat}</p>
                <p className="text-sm text-muted-foreground max-w-[200px]">{item.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-6 py-28 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="bg-foreground text-background rounded-3xl px-10 py-14 flex flex-col items-center gap-6"
        >
          <h2 className="text-3xl sm:text-4xl font-bold leading-tight">
            Ready to stop overthinking<br />and start exploring?
          </h2>
          <p className="text-background/70 text-base max-w-sm leading-relaxed">
            Enter your trip details and get a full plan — flights, hotels, and
            things to do — in one go.
          </p>
          <motion.button
            id="cta-plan-btn"
            whileHover={{ scale: 1.03, backgroundColor: '#2d2d4e' }}
            whileTap={{ scale: 0.97 }}
            onClick={() => navigate('/plan')}
            className="flex items-center gap-2 bg-background text-foreground font-semibold rounded-full px-8 py-3.5 text-base transition-colors"
          >
            Plan My Trip — Free
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </motion.div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <Logo variant="dark" className="scale-90 origin-left" />
          <p>© {new Date().getFullYear()} Wayfare. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
