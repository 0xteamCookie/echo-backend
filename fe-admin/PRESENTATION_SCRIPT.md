# Echo — Operator Console Demo Script (Hackathon)

> A page-by-page walkthrough of the **Echo Command** admin dashboard. Read the
> **SAY** lines out loud as you click; the **DO / SHOW** lines tell you where to
> click. Timings assume a ~5–6 minute demo — trim the *optional* bits if short.

**One-liner (memorize this):**
> "Echo is a real-time SOS mesh for disasters. When cell networks go down,
> victims' devices still broadcast distress over a local mesh — and this is the
> dispatcher's command console that turns that flood of signals into rescuers on
> the ground."

---

## 0. Cold open (15s) — before you click anything

**SAY:**
> "In a disaster, the first thing to fail is the network. Echo keeps working
> anyway — phones form a local mesh and relay SOS signals out. Everything you're
> about to see is **live data** streaming straight from that mesh into this
> console. No mock screens."

**DO:** Have the dashboard already open on the **Overview** page. Point at the
left sidebar — *Overview, Live Feed, Agentic Dispatch, Announcements, Operations
Map* — "five surfaces, one job: get help to people fast."

---

## 1. Overview — "the room at a glance" (45s)

**DO:** You're on `/`.

**SAY:**
> "This is what a dispatcher sees the moment they log in. Right at the top is the
> **latest public announcement** that's currently broadcast to the field."

**SHOW → the four stat tiles:**
> "Then four live counters — and these update in real time over a Firestore
> subscription, not a refresh button:
> - **Total incidents** — everything the mesh has picked up.
> - **Active SOS** — unresolved distress calls. This is the number that should
>   scare you.
> - **Assigned** — incidents that already have a rescuer en route.
> - **Resolved** — closed out."

**SHOW → the "Recent Dispatch" table + the Operations Map card:**
> "Below that, the most recent incidents with severity and status, and a
> one-click jump into the full map. The idea is: gauge the load here, then dive
> in."

*(Optional flex): "If a new SOS comes in mid-demo, you'll see these numbers tick
up on their own — no reload."*

---

## 2. Live Feed — "triage as it happens" (45s)

**DO:** Click **Live Feed** in the sidebar.

**SAY:**
> "This is the live triage workspace. On the left, the incident stream — every
> device report as it arrives from the mesh, with an incident ID, location,
> severity, and how long ago it came in."

**SHOW → the right-hand "Agentic Dispatch Recommendations" panel:**
> "On the right is where it gets interesting. For every incident, our agent —
> powered by **Gemini** — has already worked out *who* should respond. Look at
> each card: it picks the agency — **medical, fire, or police** — names a
> specific responder, gives an **ETA**, a **confidence score**, and a plain-English
> **rationale** for why."

**SHOW → the three mini-stats (Incidents / AI recommended / Fallback assigned):**
> "And crucially — see 'AI recommended' vs 'Fallback assigned'. When the model is
> confident, it recommends. When it isn't, deterministic guardrails take over and
> auto-assign, so we **never leave an incident unhandled** just because the AI was
> unsure. Some cards are flagged 'Escalate for supervisor review' — the system
> knows when to ask a human."

> "This panel is read-only — it's the *thinking*. To actually act on it, we go to
> the Dispatch console."

---

## 3. Agentic Dispatch — "the money shot" (90s) ⭐

**DO:** Click **Agentic Dispatch**. *This is your centerpiece — slow down here.*

**SAY:**
> "This is the end-to-end dispatch loop, and it's three steps."

**SHOW → the four metric tiles at top:**
> "Top line: incidents in scope, how many the AI assisted on, average ETA across
> the board, and pending escalations."

**STEP 1 — SHOW → left panel, the recommendation cards:**
> "**Step one — review.** Same AI recommendations, but now they're actionable. I
> can filter by agency or search an incident. Each card shows the recommended
> responder, their source system, ETA, coverage radius, and confidence."

**DO:** Click one recommendation card.

**SAY:**
> "The moment I pick one, watch the right side —"

**STEP 2 — SHOW → right panel, the QR code appears:**
> "**Step two — validate and issue.** Picking a recommendation *auto-generates a
> secure credential* for that exact responder — scoped to their role, agency, and
> a geographic radius — and renders it as a **QR code**. It's a short-lived JWT;
> see the expiry countdown. I review the rationale one more time, then hit
> **'Assign to Incident.'**"

**DO:** Click **Assign to Incident** → point at the green success banner.

**STEP 3 — SAY (point at the "Step 3" card):**
> "**Step three — the field responder scans that QR in the Echo responder app.**
> That instantly onboards them with the right permissions and location scope, and
> they start sending heartbeats back — which is how they then show up as a live
> rescuer on the map. No manual account setup, no radio call, in the middle of a
> disaster."

**THE LINE TO LAND:**
> "So in about ten seconds we went from a raw distress signal → an AI-ranked
> decision → a human sign-off → a credentialed rescuer on the ground. That whole
> loop is the product."

---

## 4. Announcements — "broadcast, in every language" (45s)

**DO:** Click **Announcements**.

**SAY:**
> "Rescue is one half; keeping people informed is the other. Here a dispatcher
> broadcasts public-safety messages tied to a precise location."

**SHOW → the map on the left with the orange circle:**
> "I pick a point straight off the live incident heatmap — the orange circle is
> the **1km delivery radius**, so the message only reaches people who actually
> need it, not the whole city."

**DO:** Type a short message, e.g. *"Evacuate low-lying areas near the river
immediately. Shelter open at Central School."* — point at Publish.

**SAY (the differentiator):**
> "And when I publish, the backend **auto-translates it into 10 languages** —
> English, Spanish, French, German, Chinese, Hindi, Arabic, Portuguese, Japanese,
> Korean — so every person in that radius gets the alert in *their* language.
> In a real disaster zone with tourists, migrants, mixed populations — that's the
> difference between an alert that works and one that doesn't."

**SHOW → the right "Nearby Announcements" panel:**
> "And to avoid spamming or duplicating, the panel on the right shows what's
> already been sent within 1km of that point."

---

## 5. Operations Map — "the full picture" (45s)

**DO:** Click **Operations Map**.

**SAY:**
> "And this ties it all together geospatially. Blue points are device reports,
> sized by triage weight and clustered by density — so a hotspot literally lights
> up as a cluster."

**SHOW → markers + the SOS panel (top-right):**
> "The colored markers are individual incidents — an **'A'** marker means it's
> already got a rescuer assigned, green means resolved. The panel here gives me
> a live count: active SOS, total reports, and how many are assigned."

**DO:** Click a point or a report card.

**SAY:**
> "Click any point and it focuses the incident and opens dispatch actions right
> there — so a dispatcher can work entirely from the map if they want. This is the
> single pane of glass for the whole operation."

---

## 6. Settings — *(optional, 15s — skip if short on time)*

**DO:** Click **Settings**.

**SAY:**
> "Quick note on the plumbing — this diagnostics page shows who you're signed in
> as, which agencies your role is allowed to see, and a live health check against
> the backend. Everything in this console is **role-scoped**: a medical
> dispatcher doesn't see police incidents, and only super-admins can issue
> responder credentials."

---

## 7. Close (20s)

**SAY:**
> "So — Echo: when the network dies, the mesh keeps SOS flowing. This console
> takes that flood, has an AI rank every incident, lets a human approve in one
> click, credentials a rescuer with a QR scan, and warns the whole affected area
> in ten languages — all in real time. That's the fastest path we could build
> from *'someone needs help'* to *'help is on the way.'* Thank you — happy to dig
> into the mesh layer or the agent in Q&A."

---

## Cheat sheet — talking points if you get cut off / for Q&A

| Ask | Punchy answer |
|---|---|
| **What's the hard part?** | Working *without* infrastructure — device mesh relays SOS when cell towers are down. |
| **Is the AI a gimmick?** | No — per-incident Gemini ranking with **deterministic guardrails + fallback**, so it degrades safely and never drops an incident. |
| **Real-time how?** | Direct Firestore `onSnapshot` subscriptions — no polling, tiles/feed/map update live. |
| **Security?** | Firebase Auth + role-based permissions; responder credentials are short-lived, scoped JWTs delivered by QR. |
| **Why the QR onboarding?** | Zero-friction, offline-friendly way to credential a rescuer in the field mid-disaster. |
| **Languages?** | Announcements auto-translated into 10 languages, delivered inside a 1km radius. |
| **Stack** | Next.js 16 / React 19 / Tailwind v4 frontend; talks directly to the backend with a Firebase ID token. |

## Demo prep checklist (do this 5 min before)
- [ ] Backend up and **Settings → Health = Online**.
- [ ] Seed data: on Dispatch, hit **"Reseed dummy rescuers"** so recommendations populate.
- [ ] Confirm at least a few incidents exist so Overview counters aren't zero.
- [ ] Log in as a **super_admin** so the QR / "Assign to Incident" buttons are enabled.
- [ ] Pre-pick the incident you'll click in Step 3 so the map/QR demo is snappy.
- [ ] Zoom the browser to ~110–125% so numbers read from the back of the room.
