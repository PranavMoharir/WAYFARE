import { useEffect, useState } from 'react';
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
  Users,
  Download,
  Loader2,
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

// The backend flight object carries no origin/destination and names its times
// `departure` / `arrival` (full ISO datetimes) with `duration_minutes`. Derive
// display strings here, falling back to the trip's route for the endpoints.
function formatFlightTime(iso?: string): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatFlightDuration(flight: Flight): string | undefined {
  if (flight.duration) return flight.duration;
  const m = flight.duration_minutes;
  if (typeof m === 'number' && m > 0) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    return h ? `${h}h ${min}m` : `${min}m`;
  }
  return undefined;
}

function FlightCard({
  flight,
  label,
  origin,
  destination,
}: {
  flight: Flight;
  label: string;
  origin?: string;
  destination?: string;
}) {
  const departureTime = formatFlightTime(flight.departure) ?? flight.departure_time;
  const arrivalTime = formatFlightTime(flight.arrival) ?? flight.arrival_time;
  const duration = formatFlightDuration(flight);
  const from = flight.origin || origin || '—';
  const to = flight.destination || destination || '—';

  return (
    <div className="bg-white border border-border rounded-2xl p-4 sm:p-5">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-bold">{from}</p>
            {departureTime && (
              <p className="text-xs text-muted-foreground mt-0.5">{departureTime}</p>
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            <div className="flex items-center gap-1 text-muted-foreground">
              <div className="w-8 sm:w-12 h-px bg-border" />
              <Plane className="w-4 h-4" />
              <div className="w-8 sm:w-12 h-px bg-border" />
            </div>
            {duration && (
              <p className="text-xs text-muted-foreground">{duration}</p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xl sm:text-2xl font-bold">{to}</p>
            {arrivalTime && (
              <p className="text-xs text-muted-foreground mt-0.5">{arrivalTime}</p>
            )}
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-xl sm:text-2xl font-bold">{formatINR(flight.price)}</p>
          <p className="text-xs text-muted-foreground">per person</p>
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

function HotelCard({ hotel, nights, people }: { hotel: HotelType; nights: number; people: number }) {
  const pricePerNight = typeof hotel.price_per_night === 'string'
    ? parseFloat((hotel.price_per_night as string).replace(/[^0-9.]/g, ''))
    : hotel.price_per_night ?? 0;
  const totalHotelCost = pricePerNight * nights;

  return (
    <div className="bg-white border border-border rounded-2xl p-4 sm:p-5">
      <SectionLabel>Accommodation</SectionLabel>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-bold">{hotel.name || 'Hotel'}</h3>
          {hotel.location && (
            <p className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              {hotel.location}
            </p>
          )}
          {hotel.rating !== undefined && (
            // Backend ratings use Booking.com's 0–10 scale; halve to map onto the
            // 5-star widget so the fill and the label are both correct (e.g. a
            // 9.8 backend rating renders as ~5 filled stars and "4.9/5", not "9.8/5").
            <div className="flex items-center gap-1 mt-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${i < Math.round(hotel.rating! / 2) ? 'fill-amber-400 text-amber-400' : 'text-border'}`}
                />
              ))}
              <span className="text-xs text-muted-foreground ml-1">{(hotel.rating / 2).toFixed(1)}/5</span>
            </div>
          )}
          {hotel.amenities && hotel.amenities.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {hotel.amenities.slice(0, 4).map((a) => (
                <span key={a} className="text-xs bg-secondary text-muted-foreground rounded-full px-3 py-1">
                  {a}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-xl sm:text-2xl font-bold">{formatINR(pricePerNight)}</p>
          <p className="text-xs text-muted-foreground">per night · {people > 1 ? `shared, ${people} guests` : '1 guest'}</p>
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
      className="bg-white border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-3"
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
  const [isPrinting, setIsPrinting] = useState(false);

  function handleExportPdf() {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 100);
  }

  useEffect(() => {
    if (!response) navigate('/');
  }, [response, navigate]);

  if (!response || !request) return null;

  const {
    current_proposal,
    budget_check_passed,
    budget_infeasible,
    data_incomplete,
    incomplete_reason,
    destination,
    dates,
    budget,
    num_people,
  } = response;
  const nights = getNights(dates);
  const proposal = current_proposal;
  const peopleCount = num_people ?? request.num_people ?? 1;

  const flightPriceRaw = proposal?.flight
    ? typeof proposal.flight.price === 'string'
      ? parseFloat((proposal.flight.price as string).replace(/[^0-9.]/g, ''))
      : (proposal.flight.price as number) ?? 0
    : 0;
  const totalFlightCost = flightPriceRaw * peopleCount;

  function handlePlanAgain() {
    reset();
    navigate('/plan');
  }

  return (
    <>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #wayfare-print-area, #wayfare-print-area * { visibility: visible; }
          #wayfare-print-area { position: absolute; left: 0; top: 0; width: 100%; }
          /* Force the banner/tint background colors to render in the exported PDF */
          #wayfare-print-area, #wayfare-print-area * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          @page { margin: 15mm; }
        }
      `}</style>

      <div className="min-h-screen bg-background text-foreground">
        <nav className="no-print sticky top-0 z-50 bg-background/90 backdrop-blur-md border-b border-border">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2">
            <button onClick={() => navigate('/')} className="hover:opacity-90 transition-opacity shrink-0">
              <Logo variant="dark" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-3">
              <button
                onClick={() => navigate('/plan', { state: request })}
                className="hidden sm:flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Edit trip
              </button>
              <button
                id="export-pdf-btn"
                onClick={handleExportPdf}
                disabled={isPrinting}
                className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-full px-3 sm:px-4 py-2 transition-colors disabled:opacity-60 shadow-sm"
              >
                {isPrinting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{isPrinting ? 'Preparing…' : 'Export PDF'}</span>
                <span className="sm:hidden">PDF</span>
              </button>
              <button
                onClick={handlePlanAgain}
                className="flex items-center gap-1.5 bg-foreground text-background text-sm font-semibold rounded-full px-3 sm:px-4 py-2 hover:opacity-90 transition-opacity"
              >
                <span className="hidden sm:inline">New Trip</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>
        </nav>

        <div id="wayfare-print-area" className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-10">

          {/* Trip Header */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="mb-6 sm:mb-8">
            <p className="text-sm text-muted-foreground mb-1">Your trip to</p>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">{destination}</h1>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5"><MapPin className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />{request.origin} → {destination}</span>
              <span className="flex items-center gap-1.5"><Clock className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />{formatDateRange(dates)} · {nights} night{nights !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1.5"><Users className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />{peopleCount} traveller{peopleCount !== 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1.5"><Wallet className="w-3.5 sm:w-4 h-3.5 sm:h-4 shrink-0" />Budget: {formatINR(budget)}</span>
            </div>
          </motion.div>

          {/* Budget Banner */}
          {proposal && (
            <motion.div
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
              className={`flex items-start gap-3 rounded-2xl p-4 mb-5 border ${budget_infeasible ? 'bg-red-50 border-red-200' : budget_check_passed ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}
            >
              {budget_infeasible ? <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" /> : budget_check_passed ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" /> : <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                {budget_infeasible ? (
                  <><p className="font-semibold text-red-700">Trip is over budget</p><p className="text-xs sm:text-sm text-red-600 mt-0.5">The cheapest available flight + hotel ({formatINR(proposal.floor_cost)}) exceeds your budget of {formatINR(budget)} by {formatINR((proposal.shortfall ?? 0))}.</p></>
                ) : data_incomplete ? (
                  <><p className="font-semibold text-amber-700">Incomplete Trip Data</p><p className="text-xs sm:text-sm text-amber-600 mt-0.5">{incomplete_reason || "We couldn't find some travel data for this route. Showing available options."}</p></>
                ) : budget_check_passed ? (
                  <><p className="font-semibold text-green-700">Fits within your budget</p><p className="text-xs sm:text-sm text-green-600 mt-0.5">Total cost {formatINR(proposal.total_cost)} — {formatINR(budget - proposal.total_cost)} under budget.</p></>
                ) : (
                  <><p className="font-semibold text-amber-700">Best available plan</p><p className="text-xs sm:text-sm text-amber-600 mt-0.5">Total cost {formatINR(proposal.total_cost)} — slightly over budget. Activities trimmed to get as close as possible.</p></>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-base sm:text-lg font-bold">{formatINR(proposal.total_cost)}</p>
                <p className="text-xs text-muted-foreground">total estimate</p>
              </div>
            </motion.div>
          )}

          {/* Cost Summary */}
          {proposal && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.15 }} className="bg-white border border-border rounded-2xl p-4 sm:p-5 mb-5">
              <SectionLabel>Cost Summary · {peopleCount} traveller{peopleCount !== 1 ? 's' : ''}</SectionLabel>
              <div className="space-y-3">
                {proposal.flight && (
                  <div className="flex items-start justify-between text-sm gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Plane className="w-4 h-4 shrink-0" />
                      <span>Flight{peopleCount > 1 && <span className="text-xs ml-1">({formatINR(flightPriceRaw)} × {peopleCount})</span>}</span>
                    </span>
                    <span className="font-semibold text-right">{formatINR(peopleCount > 1 ? totalFlightCost : flightPriceRaw)}</span>
                  </div>
                )}
                {proposal.hotel && (
                  <div className="flex items-start justify-between text-sm gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground">
                      <Hotel className="w-4 h-4 shrink-0" />
                      <span>Hotel ({nights} night{nights !== 1 ? 's' : ''}){peopleCount > 1 && <span className="text-xs ml-1">— shared</span>}</span>
                    </span>
                    <span className="font-semibold text-right">
                      {formatINR(typeof proposal.hotel.price_per_night === 'string'
                        ? parseFloat((proposal.hotel.price_per_night as string).replace(/[^0-9.]/g, '')) * nights
                        : (proposal.hotel.price_per_night ?? 0) * nights)}
                    </span>
                  </div>
                )}
                {proposal.activities.length > 0 && (
                  <div className="flex items-center justify-between text-sm gap-2">
                    <span className="flex items-center gap-2 text-muted-foreground"><Tag className="w-4 h-4 shrink-0" />Activities ({proposal.activities.length})</span>
                    <span className="font-semibold">{formatINR(proposal.total_cost - proposal.floor_cost)}</span>
                  </div>
                )}
                <div className="pt-3 border-t border-border flex items-center justify-between">
                  <div>
                    <span className="font-semibold">Total estimate</span>
                    {peopleCount > 1 && <p className="text-xs text-muted-foreground">≈ {formatINR(proposal.total_cost / peopleCount)} per person</p>}
                  </div>
                  <span className="text-lg sm:text-xl font-bold">{formatINR(proposal.total_cost)}</span>
                </div>
                <div className="pt-1">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5"><span>Spent</span><span>Budget: {formatINR(budget)}</span></div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${budget_infeasible ? 'bg-red-500' : budget_check_passed ? 'bg-green-500' : 'bg-amber-500'}`} style={{ width: `${Math.min((proposal.total_cost / budget) * 100, 100)}%` }} />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Flight */}
          {proposal?.flight && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }} className="mb-4">
              <FlightCard flight={proposal.flight} label={`Flight · per person${peopleCount > 1 ? ` (×${peopleCount})` : ''}`} origin={request?.origin} destination={destination} />
            </motion.div>
          )}

          {/* Hotel */}
          {proposal?.hotel && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.25 }} className="mb-5">
              <HotelCard hotel={proposal.hotel} nights={nights} people={peopleCount} />
            </motion.div>
          )}

          {/* Activities */}
          {proposal && proposal.activities.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.3 }} className="mb-10">
              <div className="bg-white border border-border rounded-2xl p-4 sm:p-5">
                <SectionLabel>Things To Do in {destination} · {proposal.activities.length} experiences</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                  {proposal.activities.map((a, i) => (
                    <ActivityCard key={`${a.name}-${i}`} activity={a} index={i} />
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* No proposal */}
          {!proposal && (
            <div className="text-center py-20">
              <AlertTriangle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-semibold">No plan generated</p>
              <p className="text-muted-foreground mt-1 mb-6">We couldn't build a plan with the given details. Try adjusting your dates or budget.</p>
              <button onClick={handlePlanAgain} className="flex items-center gap-2 bg-foreground text-background rounded-full px-6 py-3 text-sm font-semibold mx-auto hover:opacity-90 transition-opacity">
                Try Again <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Plan Again CTA */}
          {proposal && (
            <div className="no-print border-t border-border pt-8 sm:pt-10 pb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-center sm:text-left">
                <p className="font-semibold">Not quite right?</p>
                <p className="text-sm text-muted-foreground">Adjust your preferences and plan again.</p>
              </div>
              <button onClick={handlePlanAgain} className="flex items-center gap-2 bg-foreground text-background rounded-full px-6 py-3 text-sm font-semibold hover:opacity-90 transition-opacity">
                Plan a new trip <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
