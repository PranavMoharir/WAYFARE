import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plane,
  Hotel,
  MapPin,
  Clock,
  Wallet,
  ArrowLeft,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Tag,
  Star,
  ChevronRight,
} from 'lucide-react';
import Logo from '../components/Logo';
import { useTripStore } from '../store/useTripStore';
import type { Flight, Hotel as HotelType, Activity } from '../types';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatINR(value: number | string | undefined): string {
  if (value === undefined || value === null) return 'N/A';
  const n = typeof value === 'string'
    ? parseFloat(value.replace(/[^0-9.]/g, ''))
    : value;
  if (isNaN(n)) return String(value);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function getNights(dates: string): number {
  const found = dates.match(/\d{4}-\d{2}-\d{2}/g);
  if (!found || found.length < 2) return 1;
  const diff = new Date(found[1]).getTime() - new Date(found[0]).getTime();
  return Math.max(Math.round(diff / 86400000), 1);
}

function formatDateRange(dates: string): string {
  const found = dates.match(/\d{4}-\d{2}-\d{2}/g);
  if (!found || found.length < 2) return dates;
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(found[0])} – ${fmt(found[1])}`;
}

const CATEGORY_COLORS: Record<string, string> = {
  Museum: 'bg-blue-50 text-blue-700 border-blue-100',
  Park: 'bg-green-50 text-green-700 border-green-100',
  Landmark: 'bg-amber-50 text-amber-700 border-amber-100',
  'Historic Landmark': 'bg-orange-50 text-orange-700 border-orange-100',
  'Religious Site': 'bg-purple-50 text-purple-700 border-purple-100',
  'Local Experience': 'bg-pink-50 text-pink-700 border-pink-100',
  Nature: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  Attraction: 'bg-cyan-50 text-cyan-700 border-cyan-100',
};

// ─── Sub-components ───────────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">
      {children}
    </p>
  );
}

function FlightCard({ flight, label }: { flight: Flight; label: string }) {
  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-6">
          {/* Origin */}
          <div className="text-center">
            <p className="text-2xl font-bold">{flight.origin || '—'}</p>
            {flight.departure_time && (
              <p className="text-xs text-muted-foreground mt-0.5">{flight.departure_time}</p>
            )}
          </div>
          {/* Arrow */}
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <div className="w-12 h-px bg-border" />
              <Plane className="w-4 h-4" />
              <div className="w-12 h-px bg-border" />
            </div>
            {flight.duration && (
              <p className="text-xs text-muted-foreground">{flight.duration}</p>
            )}
          </div>
          {/* Destination */}
          <div className="text-center">
            <p className="text-2xl font-bold">{flight.destination || '—'}</p>
            {flight.arrival_time && (
              <p className="text-xs text-muted-foreground mt-0.5">{flight.arrival_time}</p>
            )}
          </div>
        </div>
        {/* Price + airline */}
        <div className="text-right">
          <p className="text-2xl font-bold">{formatINR(flight.price)}</p>
          {flight.airline && (
            <p className="text-xs text-muted-foreground mt-0.5">{flight.airline}</p>
          )}
          {flight.flight_number && (
            <p className="text-xs text-muted-foreground">{flight.flight_number}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function HotelCard({ hotel, nights }: { hotel: HotelType; nights: number }) {
  const pricePerNight = typeof hotel.price_per_night === 'string'
    ? parseFloat((hotel.price_per_night as string).replace(/[^0-9.]/g, ''))
    : hotel.price_per_night ?? 0;
  const totalHotelCost = pricePerNight * nights;

  return (
    <div className="bg-white border border-border rounded-2xl p-5">
      <SectionLabel>Accommodation</SectionLabel>
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold">{hotel.name || 'Hotel'}</h3>
          {hotel.location && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5" />
              {hotel.location}
            </p>
          )}
          {hotel.rating !== undefined && (
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${i < Math.round(hotel.rating!) ? 'fill-amber-400 text-amber-400' : 'text-border'}`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">{hotel.rating}/5</span>
            </div>
          )}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {hotel.amenities.slice(0, 5).map((a) => (
                <span key={a} className="text-xs bg-secondary text-muted-foreground rounded-full px-3 py-1">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-2xl font-bold">{formatINR(pricePerNight)}</p>
          <p className="text-xs text-muted-foreground">per night</p>
          <div className="mt-2 pt-2 border-t border-border">
            <p className="text-sm font-semibold">{formatINR(totalHotelCost)}</p>
            <p className="text-xs text-muted-foreground">{nights} night{nights !== 1 ? 's' : ''} total</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActivityCard({ activity, index }: { activity: Activity; index: number }) {
  const colorClass = CATEGORY_COLORS[activity.category] || 'bg-secondary text-foreground border-border';
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35, delay: index * 0.05 }}
      className="bg-white border border-border rounded-2xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-foreground leading-snug">{activity.name}</h3>
        <span className={`shrink-0 text-xs font-medium border rounded-full px-2.5 py-0.5 ${colorClass}`}>
          {activity.category}
        </span>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{activity.reason}</p>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-auto pt-2 border-t border-border">
        <Clock className="w-3.5 h-3.5" />
        {activity.estimated_duration}
      </div>
    </motion.div>
  );
}

// ─── Results Page ─────────────────────────────────────────────────────────────
export default function ResultsPage() {
  const navigate = useNavigate();
  const { request, response, reset } = useTripStore();

  useEffect(() => {
    if (!response) navigate('/');
  }, [response, navigate]);

  if (!response || !request) return null;

  const { current_proposal, budget_check_passed, budget_infeasible, destination, dates, budget } = response;
  const nights = getNights(dates);
  const proposal = current_proposal;

  function handlePlanAgain() {
    reset();
    navigate('/plan');
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="hover:opacity-90 transition-opacity"
          >
            <Logo variant="dark" />
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/plan', { state: request })}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Edit trip
            </button>
            <button
              onClick={handlePlanAgain}
              className="flex items-center gap-1.5 bg-foreground text-background text-sm font-semibold rounded-full px-4 py-2 hover:opacity-90 transition-opacity"
            >
              New Trip
            </button>
          </div>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-10">
        {/* ── Trip Header ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <p className="text-sm text-muted-foreground mb-1">Your trip to</p>
          <h1 className="text-4xl font-bold mb-2">{destination}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4" />
              {request.origin} → {destination}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" />
              {formatDateRange(dates)} · {nights} night{nights !== 1 ? 's' : ''}
            </span>
            <span className="flex items-center gap-1.5">
              <Wallet className="w-4 h-4" />
              Budget: {formatINR(budget)}
            </span>
          </div>
        </motion.div>

        {/* ── Budget Status Banner ─────────────────────────────────── */}
        {proposal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className={`flex items-start gap-3 rounded-2xl p-4 mb-6 border ${
              budget_infeasible
                ? 'bg-red-50 border-red-200'
                : budget_check_passed
                ? 'bg-green-50 border-green-200'
                : 'bg-amber-50 border-amber-200'
            }`}
          >
            {budget_infeasible ? (
              <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            ) : budget_check_passed ? (
              <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              {budget_infeasible ? (
                <>
                  <p className="font-semibold text-red-700">Trip is over budget</p>
                  <p className="text-sm text-red-600 mt-0.5">
                    The cheapest available flight + hotel ({formatINR(proposal.floor_cost)}) exceeds
                    your budget of {formatINR(budget)} by {formatINR((proposal.shortfall ?? 0))}.
                    Consider increasing your budget or choosing different dates.
                  </p>
                </>
              ) : budget_check_passed ? (
                <>
                  <p className="font-semibold text-green-700">Fits within your budget</p>
                  <p className="text-sm text-green-600 mt-0.5">
                    Total estimated cost {formatINR(proposal.total_cost)} — {formatINR(budget - proposal.total_cost)} under your budget.
                  </p>
                </>
              ) : (
                <>
                  <p className="font-semibold text-amber-700">Best available plan</p>
                  <p className="text-sm text-amber-600 mt-0.5">
                    Total cost {formatINR(proposal.total_cost)} — slightly over budget. We trimmed activities to get as close as possible.
                  </p>
                </>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold">{formatINR(proposal.total_cost)}</p>
              <p className="text-xs text-muted-foreground">total estimate</p>
            </div>
          </motion.div>
        )}

        {/* ── Cost breakdown ──────────────────────────────────────── */}
        {proposal && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="bg-white border border-border rounded-2xl p-5 mb-6"
          >
            <SectionLabel>Cost Summary</SectionLabel>
            <div className="space-y-3">
              {proposal.flight && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Plane className="w-4 h-4" /> Flight
                  </span>
                  <span className="font-semibold">{formatINR(proposal.flight.price)}</span>
                </div>
              )}
              {proposal.hotel && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Hotel className="w-4 h-4" /> Hotel ({nights} nights)
                  </span>
                  <span className="font-semibold">
                    {formatINR(
                      typeof proposal.hotel.price_per_night === 'string'
                        ? parseFloat((proposal.hotel.price_per_night as string).replace(/[^0-9.]/g, '')) * nights
                        : (proposal.hotel.price_per_night ?? 0) * nights
                    )}
                  </span>
                </div>
              )}
              {proposal.activities.length > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="w-4 h-4" /> Activities ({proposal.activities.length})
                  </span>
                  <span className="font-semibold">
                    {formatINR(proposal.total_cost - (proposal.floor_cost))}
                  </span>
                </div>
              )}
              <div className="pt-3 border-t border-border flex items-center justify-between">
                <span className="font-semibold">Total estimate</span>
                <span className="text-xl font-bold">{formatINR(proposal.total_cost)}</span>
              </div>
              {/* Budget bar */}
              <div className="pt-1">
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <span>Spent</span>
                  <span>Budget: {formatINR(budget)}</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      budget_infeasible ? 'bg-red-500' : budget_check_passed ? 'bg-green-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${Math.min((proposal.total_cost / budget) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Flight ──────────────────────────────────────────────── */}
        {proposal?.flight && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mb-4"
          >
            <FlightCard flight={proposal.flight} label="Flight" />
          </motion.div>
        )}

        {/* ── Hotel ───────────────────────────────────────────────── */}
        {proposal?.hotel && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="mb-6"
          >
            <HotelCard hotel={proposal.hotel} nights={nights} />
          </motion.div>
        )}

        {/* ── Activities ──────────────────────────────────────────── */}
        {proposal && proposal.activities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="mb-10"
          >
            <div className="bg-white border border-border rounded-2xl p-5">
              <SectionLabel>
                Things To Do in {destination} · {proposal.activities.length} experiences
              </SectionLabel>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {proposal.activities.map((a, i) => (
                  <ActivityCard key={`${a.name}-${i}`} activity={a} index={i} />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── No proposal fallback ────────────────────────────────── */}
        {!proposal && (
          <div className="text-center py-20">
            <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-semibold">No plan generated</p>
            <p className="text-muted-foreground mt-1 mb-6">
              We couldn't build a plan with the given details. Try adjusting your dates or budget.
            </p>
            <button
              onClick={handlePlanAgain}
              className="flex items-center gap-2 bg-foreground text-background rounded-full px-6 py-3 text-sm font-semibold mx-auto hover:opacity-90 transition-opacity"
            >
              Try Again <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* ── Plan Again CTA ──────────────────────────────────────── */}
        {proposal && (
          <div className="border-t border-border pt-10 pb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold">Not quite right?</p>
              <p className="text-sm text-muted-foreground">Adjust your preferences and plan again.</p>
            </div>
            <button
              onClick={handlePlanAgain}
              className="flex items-center gap-2 bg-foreground text-background rounded-full px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Plan a new trip <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
