# WAYFARE Frontend Implementation Plan

This document outlines the architecture and implementation steps to build a stunning, premium frontend for the Wayfare AI trip planner, seamlessly connected to the LangGraph backend.

## 1. Tech Stack
- **Framework**: React + TypeScript (Vite - already initialized)
- **Styling**: Tailwind CSS
- **Component Libraries**: 
  - **Shadcn UI** (for accessible, clean base components like forms, inputs, and dialogs)
  - **Aceternity UI / Magic UI** (for wow-factor micro-animations, glassmorphism, and premium visual excellence)
- **State Management & Data Fetching**: Zustand (for global state if needed) + React Query (for handling the backend API requests, loading states, and caching)
- **Routing**: React Router (for navigation between landing page, form, and results)

## 2. Backend Integration & Data Model
The backend exposes a LangGraph workflow that returns a `TravelState`. The frontend will need to interact with an endpoint (e.g., POST `/plan-trip`) on the FastAPI server (`backend/main.py` needs to be updated to expose the graph execution).

### Expected Input (Request Payload)
```json
{
  "origin": "New York",
  "destination": "Paris",
  "dates": "2026-09-15 to 2026-09-18",
  "budget": 2000,
  "preferences": ["sightseeing", "local food", "art"]
}
```

### Expected Output (Response payload mapping to LangGraph's `TravelState`)
We need to handle two main scenarios based on the backend's `budget_enforcer_node`:

**Success Scenario (`budget_check_passed` = true):**
- Show `current_proposal` containing:
  - `flight`: Best flight option.
  - `hotel`: Best hotel option.
  - `activities`: List of curated activities (museums, landmarks, etc.).
  - `total_cost`: Combined cost.

**Infeasible Scenario (`budget_infeasible` = true):**
- Show failure gracefully.
- Explain the `floor_cost` (cheapest flight + hotel) and the `shortfall`.

## 3. UI/UX Design System (The "Wow" Factor)
- **Aesthetics**: Sleek Dark Mode with vibrant gradient accents (e.g., deep purples, blues, and neon pinks for interactions).
- **Glassmorphism**: Transparent, blurred backgrounds for cards (Flights, Hotels, Activities) to give depth.
- **Micro-animations**: Hover effects on cards, smooth transitions when loading. The backend can take 20-90 seconds (Wikipedia RAG), so the **loading state must be an experience in itself** (e.g., Aceternity's Multi-Step Loader or a dynamic globe/plane animation).
- **Typography**: `Inter` or `Outfit` for a modern, geometric look.

## 4. Component Architecture
1. **`LandingHero`**: A visually striking hero section with animated text (Aceternity UI) explaining the AI agent's capabilities.
2. **`TripForm`**:
   - Auto-expanding, sleek form fields (Shadcn UI).
   - Multi-select for `preferences` using badges.
   - Date picker for `dates`.
3. **`LoadingExperience`**: 
   - A multi-stage loading screen. E.g., "Researching Flights...", "Curating Wikipedia...", "Enforcing Budget...".
4. **`ProposalDashboard`**: The results page.
   - **Cost Summary Widget**: A sticky or prominent display of `total_cost` vs `budget`.
   - **FlightCard & HotelCard**: Glassmorphic components displaying transport and lodging.
   - **ActivityTimeline/Grid**: A masonry or timeline layout for `activities` showing descriptions and estimated durations.
5. **`InfeasibleAlert`**: A beautifully designed fallback state when the budget is too low, gently nudging the user to increase their budget.

## 5. Step-by-Step Implementation Steps

### Phase 1: Setup & Styling Foundation
- [ ] Initialize Tailwind CSS in the Vite project (if not fully configured).
- [ ] Install Shadcn UI and initialize (`npx shadcn-ui@latest init`).
- [ ] Set up global CSS tokens (colors, gradients, glassmorphism utilities) in `index.css`.
- [ ] Add fonts (e.g., Google Fonts `Outfit`).

### Phase 2: Core Routing & API Service
- [ ] Install `axios`.
- [ ] Create an API service file `src/services/api.ts` to call the FastAPI backend.
- [ ] Note: We will also need to add a `/plan-trip` endpoint in `backend/main.py` since it currently only has `/`.

### Phase 3: Building the UI Components
- [ ] Build the `TripForm` using Shadcn inputs and forms.
- [ ] Integrate Aceternity UI /Shadcn UI components for the `LandingHero` and `LoadingExperience`.
- [ ] Build the result cards (`FlightCard`, `HotelCard`, `ActivityCard`).

### Phase 4: Integration & Polish
- [ ] Wire the form submission to React Query.
- [ ] Handle the complex loading state.
- [ ] Map the LangGraph response to the Result cards.
- [ ] Add final layout micro-animations (Framer Motion).
