import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  MapPin,
  Calendar,
  Wallet,
  Users,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import Logo from '../components/Logo';
import { planTrip } from '../services/api';
import { useTripStore } from '../store/useTripStore';

// ─── Constants ───────────────────────────────────────────────────────────────
const PREFERENCE_OPTIONS = [
  { value: 'sightseeing', emoji: '🏛', label: 'Sightseeing' },
  { value: 'local food', emoji: '🍜', label: 'Local Food' },
  { value: 'art', emoji: '🎨', label: 'Art' },
  { value: 'history', emoji: '📜', label: 'History' },
  { value: 'nature', emoji: '🌿', label: 'Nature' },
  { value: 'adventure', emoji: '🏕', label: 'Adventure' },
  { value: 'shopping', emoji: '🛍', label: 'Shopping' },
  { value: 'beaches', emoji: '🏖', label: 'Beaches' },
  { value: 'architecture', emoji: '🏛', label: 'Architecture' },
  { value: 'nightlife', emoji: '🎶', label: 'Nightlife' },
  { value: 'museums', emoji: '🖼', label: 'Museums' },
  { value: 'religious sites', emoji: '⛪', label: 'Religious Sites' },
];

const LOADING_STEPS = [
  { title: 'Searching for flights…', sub: 'Checking live availability on your exact dates' },
  { title: 'Finding the best hotels…', sub: 'Comparing options near the heart of your destination' },
  { title: 'Discovering local experiences…', sub: 'Curating activities based on your interests' },
  { title: 'Optimising for your budget…', sub: 'Making sure everything fits within what you set' },
  { title: 'Almost there…', sub: 'Putting together your complete itinerary' },
];

// ─── Shared Nav ───────────────────────────────────────────────────────────────
function Nav({ onBack }: { onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
      <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
          )}
          <button
            onClick={() => navigate('/')}
            className="hover:opacity-90 transition-opacity"
          >
            <Logo variant="dark" />
          </button>
        </div>
      </div>
    </nav>
  );
}

// ─── Form Input Row ───────────────────────────────────────────────────────────
function FormField({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-foreground">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
}

// ─── Loading Overlay ─────────────────────────────────────────────────────────
function LoadingOverlay({ visible }: { visible: boolean }) {
  const [stepIdx, setStepIdx] = useState(0);

  useEffect(() => {
    if (!visible) { setStepIdx(0); return; }
    const id = setInterval(() => setStepIdx((i) => (i + 1) % LOADING_STEPS.length), 7000);
    return () => clearInterval(id);
  }, [visible]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center gap-8 px-6"
        >
          {/* Spinner */}
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-border" />
            <div className="absolute inset-0 rounded-full border-4 border-t-foreground border-r-transparent border-b-transparent border-l-transparent animate-spin" />
            <div className="absolute inset-3 rounded-full bg-foreground flex items-center justify-center">
              <Plane className="w-5 h-5 text-background rotate-45" />
            </div>
          </div>

          {/* Cycling text */}
          <AnimatePresence mode="wait">
            <motion.div
              key={stepIdx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              className="text-center max-w-sm"
            >
              <p className="text-xl font-bold text-foreground mb-2">
                {LOADING_STEPS[stepIdx].title}
              </p>
              <p className="text-sm text-muted-foreground">
                {LOADING_STEPS[stepIdx].sub}
              </p>
            </motion.div>
          </AnimatePresence>

          {/* Step dots */}
          <div className="flex gap-2">
            {LOADING_STEPS.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  i === stepIdx ? 'w-6 bg-foreground' : 'w-1.5 bg-border'
                }`}
              />
            ))}
          </div>

          <p className="text-xs text-muted-foreground">
            This can take up to 60 seconds — we're working on the real data.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Plan Page ────────────────────────────────────────────────────────────────
interface LocationState {
  origin?: string;
  destination?: string;
  checkin?: string;
  checkout?: string;
  budget?: string;
}

export default function PlanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const prefill = (location.state || {}) as LocationState;
  const store = useTripStore();

  // Form state — pre-fill from landing page hero if available
  const [origin, setOrigin] = useState(prefill.origin || '');
  const [destination, setDestination] = useState(prefill.destination || '');
  const [checkin, setCheckin] = useState(prefill.checkin || '');
  const [checkout, setCheckout] = useState(prefill.checkout || '');
  const [budget, setBudget] = useState(prefill.budget || '');
  const [numPeople, setNumPeople] = useState(1);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [errors, setErrors] = useState<Partial<Record<string, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  function togglePref(value: string) {
    setPreferences((prev) =>
      prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]
    );
  }

  function validate(): boolean {
    const e: Partial<Record<string, string>> = {};
    if (!origin.trim()) e.origin = 'Please enter your origin city';
    if (!destination.trim()) e.destination = 'Please enter a destination';
    if (!checkin) e.checkin = 'Please select a check-in date';
    if (!checkout) e.checkout = 'Please select a check-out date';
    if (checkin && checkout && checkout <= checkin)
      e.checkout = 'Check-out must be after check-in';
    if (!budget || Number(budget) <= 0) e.budget = 'Please enter a valid budget';
    if (numPeople < 1) e.numPeople = 'At least 1 person required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setApiError(null);
    setIsSubmitting(true);
    try {
      const dates = `${checkin} to ${checkout}`;
      const request = {
        origin: origin.trim(),
        destination: destination.trim(),
        dates,
        budget: Number(budget),
        num_people: numPeople,
        preferences: preferences.length ? preferences : ['sightseeing', 'local food'],
      };
      store.setRequest(request);
      const result = await planTrip(request);
      store.setResponse(result);
      navigate('/results');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  // min date for the date inputs
  const today = new Date().toISOString().split('T')[0];

  return (
    <>
      <LoadingOverlay visible={isSubmitting} />

      <div className="min-h-screen bg-background text-foreground">
        <Nav onBack={() => navigate('/')} />

        <div className="max-w-2xl mx-auto px-6 py-14">
          {/* Page heading */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Plan your trip
            </h1>
            <p className="text-muted-foreground">
              Fill in the details below and we'll handle flights, hotels, and
              things to do — all within your budget.
            </p>
          </motion.div>

          <form onSubmit={handleSubmit} noValidate>
            {/* ── Section 1: Route ─────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="bg-white border border-border rounded-2xl p-6 mb-4"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
                Route
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Flying from" error={errors.origin}>
                  <div className={`flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3 transition-colors focus-within:bg-white focus-within:border focus-within:border-foreground border ${errors.origin ? 'border-red-300' : 'border-transparent'}`}>
                    <Plane className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={origin}
                      onChange={(e) => { setOrigin(e.target.value); setErrors((p) => ({ ...p, origin: undefined })); }}
                      placeholder="e.g. Mumbai"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                  </div>
                </FormField>
                <FormField label="Going to" error={errors.destination}>
                  <div className={`flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3 transition-colors focus-within:bg-white focus-within:border focus-within:border-foreground border ${errors.destination ? 'border-red-300' : 'border-transparent'}`}>
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="text"
                      value={destination}
                      onChange={(e) => { setDestination(e.target.value); setErrors((p) => ({ ...p, destination: undefined })); }}
                      placeholder="e.g. Paris"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                    />
                  </div>
                </FormField>
              </div>
            </motion.div>

            {/* ── Section 2: Dates ─────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="bg-white border border-border rounded-2xl p-6 mb-4"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
                Travel Dates
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Check-in" error={errors.checkin}>
                  <div className={`flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3 transition-colors focus-within:bg-white focus-within:border focus-within:border-foreground border ${errors.checkin ? 'border-red-300' : 'border-transparent'}`}>
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="date"
                      value={checkin}
                      min={today}
                      onChange={(e) => { setCheckin(e.target.value); setErrors((p) => ({ ...p, checkin: undefined })); }}
                      className="flex-1 bg-transparent text-sm text-foreground outline-none"
                    />
                  </div>
                </FormField>
                <FormField label="Check-out" error={errors.checkout}>
                  <div className={`flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3 transition-colors focus-within:bg-white focus-within:border focus-within:border-foreground border ${errors.checkout ? 'border-red-300' : 'border-transparent'}`}>
                    <Calendar className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="date"
                      value={checkout}
                      min={checkin || today}
                      onChange={(e) => { setCheckout(e.target.value); setErrors((p) => ({ ...p, checkout: undefined })); }}
                      className="flex-1 bg-transparent text-sm text-foreground outline-none"
                    />
                  </div>
                </FormField>
              </div>
            </motion.div>

            {/* ── Section 3: Budget & People ─────────────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="bg-white border border-border rounded-2xl p-6 mb-4"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-5">
                Budget & Travellers
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField
                  label="Total trip budget (in INR)"
                  error={errors.budget}
                >
                  <div className={`flex items-center gap-2 bg-secondary rounded-xl transition-colors focus-within:bg-white focus-within:border focus-within:border-foreground border ${errors.budget ? 'border-red-300' : 'border-transparent'}`}>
                    <span className="pl-4 text-sm font-semibold text-muted-foreground select-none">₹</span>
                    <input
                      type="number"
                      value={budget}
                      onChange={(e) => { setBudget(e.target.value); setErrors((p) => ({ ...p, budget: undefined })); }}
                      placeholder="e.g. 80000"
                      min="0"
                      className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none py-3 pr-4"
                    />
                    <div className="flex items-center gap-1.5 pr-4">
                      <Wallet className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    We'll find options that fit within this amount.
                  </p>
                </FormField>
                <FormField label="Number of travellers" error={errors.numPeople}>
                  <div className={`flex items-center gap-2.5 bg-secondary rounded-xl px-4 py-3 transition-colors focus-within:bg-white focus-within:border focus-within:border-foreground border ${errors.numPeople ? 'border-red-300' : 'border-transparent'}`}>
                    <Users className="w-4 h-4 text-muted-foreground shrink-0" />
                    <input
                      type="number"
                      value={numPeople}
                      onChange={(e) => { setNumPeople(Math.max(1, parseInt(e.target.value) || 1)); setErrors((p) => ({ ...p, numPeople: undefined })); }}
                      min="1"
                      max="20"
                      className="flex-1 bg-transparent text-sm text-foreground outline-none"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Budget will be calculated per person.
                  </p>
                </FormField>
              </div>
            </motion.div>

            {/* ── Section 4: Preferences ───────────────────── */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="bg-white border border-border rounded-2xl p-6 mb-6"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">
                What do you love? <span className="normal-case font-normal">(optional)</span>
              </p>
              <p className="text-sm text-muted-foreground mb-5">
                Select your travel styles — we'll use these to recommend the best local experiences.
              </p>
              <div className="flex flex-wrap gap-2">
                {PREFERENCE_OPTIONS.map((pref) => {
                  const selected = preferences.includes(pref.value);
                  return (
                    <button
                      key={pref.value}
                      type="button"
                      onClick={() => togglePref(pref.value)}
                      className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium border transition-all duration-150 ${
                        selected
                          ? 'bg-foreground text-background border-foreground'
                          : 'bg-secondary text-foreground border-transparent hover:border-foreground/20'
                      }`}
                    >
                      <span>{pref.emoji}</span>
                      {pref.label}
                    </button>
                  );
                })}
              </div>
            </motion.div>

            {/* API Error */}
            {apiError && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4 mb-6"
              >
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Something went wrong</p>
                  <p className="text-sm text-red-600 mt-0.5">{apiError}</p>
                </div>
              </motion.div>
            )}

            {/* Submit */}
            <motion.button
              id="plan-submit-btn"
              type="submit"
              disabled={isSubmitting}
              whileHover={!isSubmitting ? { scale: 1.02 } : {}}
              whileTap={!isSubmitting ? { scale: 0.98 } : {}}
              className="w-full flex items-center justify-center gap-2 bg-foreground text-background font-semibold rounded-2xl py-4 text-base hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Building your trip…
                </>
              ) : (
                <>
                  Plan My Trip
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </motion.button>
          </form>
        </div>
      </div>
    </>
  );
}
