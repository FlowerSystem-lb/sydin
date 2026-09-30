# SydIN — Field Operations Module
### Brief, data model, layout samples and integration notes

**Audience:** the coding agent working on the SydIN SaaS (Next.js, Vercel).
**Purpose:** samples and inspiration, not final specs. Read the domain, review the layouts, then produce your own implementation plan and pick the layouts you think are best.
**Language:** built English-first, but every user-facing string must support Arabic + RTL (see §7 — the hardest part, do not leave it to the end).

---

## 1. What this module is

SydIN today answers *what do we own and where is it*. This module answers **who is doing what, where, when, and with which vehicle and equipment** — and closes the loop back to inventory.

It is the operations layer for any business that sends people and equipment out to job sites: installation and service crews, construction and fit-out, catering and events, cleaning and facilities, moving and logistics, rental companies, maintenance contractors, agricultural and survey teams.

Typical scale of a target tenant: 5–50 workers, 2–10 vehicles, 2–20 active jobs at once. Small enough that the owner currently runs it from a paper notebook, a WhatsApp group, or a spreadsheet — and large enough that reassignments cause real losses.

**The core problems it solves:**

1. **Multi-site work orders.** One job is not one location. A single project spans several sites, on different days, each with its own crew, arrival time, and scope. Nothing off-the-shelf models this well.
2. **Double-booking.** Crews and vehicles get reassigned mid-week. A worker or a truck assigned to two overlapping jobs is the single most expensive mistake these businesses make, and it is invisible on paper.
3. **The field has no information.** Workers show up not knowing the address, the time, who else is on the crew, or what the job actually looks like.
4. **Stock walks out the door and doesn't come back.** Equipment and materials leave on a truck and nobody records what returned, what broke, or what's still sitting on a site.
5. **Paper parity.** Timesheets, transport logs, delivery receipts, and job sheets are legal and accounting records. The system has to generate them in the exact printed format the business already uses.

---

## 2. Core concepts

Keep the vocabulary generic in the schema. Let each tenant rename things in their own language — the same structure covers a wedding florist, an HVAC contractor, and a catering company.

| Entity | What it is | Tenant might call it |
|---|---|---|
| **Project** | A work order / client engagement spanning one or more days and sites | Job, event, order, contract, ticket |
| **Site** | A physical location where work happens | Venue, property, unit, branch, address |
| **Job** | A unit of work at a site on a date, with crew + vehicle | Task, visit, shift, call-out, run |
| **Job type** | Tenant-configurable enum | setup, install, service, strike, prep, cleaning, delivery, pickup, survey |
| **Crew member** | A named worker | Tech, florist, driver, operative |
| **Helper** | Anonymous day labour, counted not named | Casual, AA, temp |
| **Vehicle** | A truck, van, or car with capacity | Unit, rig, truck |

**Two design decisions to make early, and both matter:**

- **`job_type` must be a tenant-configurable enum, not a hardcoded list.** A florist's "strike" and an HVAC firm's "callback" are the same shape. Seed sensible defaults per industry at onboarding, let the tenant edit the labels in both languages.
- **`helper_count` is separate from `crew_ids[]`.** Anonymous day labour is counted and billed by headcount, never named. Almost every system in this space gets this wrong and forces fake user accounts.

---

## 3. Data model (suggested)

```
Tenant (existing SydIN tenant)
│
├── Worker            id, name{en,ar}, role, phone, hourly_rate, active
│                     role: manager | supervisor | crew | driver
│
├── Vehicle           id, name, kind(truck|van|car), size, capacity_note,
│                     default_driver_id, active
│
├── Client            id, name, contact_name, phone, email, notes
│
├── Project           id, code, client_id, title, start_date, end_date,
│                     status(draft|confirmed|in_progress|done|cancelled),
│                     value, notes
│
├── Site              id, project_id, type, name{en,ar}, address,
│                     google_maps_url, contact_name, contact_phone, sort_order
│
├── Job               id, project_id, site_id(nullable), date, job_type,
│                     start_time, end_time, supervisor_id, crew_ids[],
│                     helper_count, vehicle_id, status, notes
│
├── JobStep           id, job_id, order, time(nullable), text{en,ar}, done_at
│
├── JobBrief          id, site_id, spec fields (tenant-configurable),
│                     quantities, measurements, requirements, notes
│
├── JobAsset          id, site_id, image_url, caption, kind(reference|progress|final)
│
├── JobItem           id, job_id, item_id → inventory, qty_out,
│                     qty_returned, qty_damaged, checked_out_at, returned_at
│
├── TimesheetEntry    id, date, worker_id, project_id, task, from_time, to_time,
│                     hours(computed), rate, cost(computed), approved_at
│
├── TransportEntry    id, date, vehicle_id, project_id, load_time, depart,
│                     return, distance, cost, notes
│
└── Document          id, kind(template|generated), title, file_url, locale,
                      project_id?
```

**Relationships worth getting right**

- A `Job` may belong to a project **and** a site, or a project with no site (depot/workshop prep), or neither (general purchasing, maintenance).
- A single physical location can serve two roles in one project. Allow a `Site` to carry multiple types, or link sites.
- Sites are reused across jobs within a project — the same address appears in a Monday install and a Friday collection. Never duplicate the location record.
- `JobStep` is an ordered movement plan, not just a start time. Real field work is *"finish site A → go strike site B → come back to A"*, and *"leave one person behind to move the equipment after the event."* Systems that only store a start time cannot express this, and the crew ends up on WhatsApp again.

---

## 4. Layout samples

Wireframes only. Pick, merge, or replace — but keep the information density. Managers need to see conflicts at a glance; field workers need a dead-simple mobile view.

### 4.1 Week board — primary manager screen

```
┌──────────────────────────────────────────────────────────────────────────┐
│  ◀  Week of 3 – 5 Sep 2026        [4 projects]    + New job   + Project  │
├──────────────────────────────────────────────────────────────────────────┤
│           │ THU 03/09     │ FRI 04/09          │ SAT 05/09               │
│───────────┼───────────────┼────────────────────┼─────────────────────────│
│ Depot /   │ ● Prep        │ ● Prep             │                         │
│ Workshop  │   3 crew      │   3 crew           │                         │
│           │ ● Cleaning    │ ● Accessories      │                         │
│           │   2 helpers   │   1 crew           │                         │
│───────────┼───────────────┼────────────────────┼─────────────────────────│
│ Project   │               │ ● Setup 17:00      │ ● Setup 06:00           │
│ #1041     │               │   Site A           │   Site B                │
│           │               │   Lead +1 · Truck 2│   Lead +2 · Truck 1  ⚠  │
│           │               │                    │ ↳ then strike Site A    │
│───────────┼───────────────┼────────────────────┼─────────────────────────│
│ Project   │               │                    │ ● Install 11:00         │
│ #1042     │               │                    │   Site C                │
│           │               │                    │   Lead +3 · Truck 3     │
│───────────┼───────────────┼────────────────────┼─────────────────────────│
│ Project   │               │                    │ ● Delivery 12:00        │
│ #1043     │               │                    │   3 crew +1 · Truck 3 ⚠ │
└──────────────────────────────────────────────────────────────────────────┘
  ⚠  Truck 3 double-booked 11:00 and 12:00 — resolve
  ⚠  Worker "Ammar" assigned to two overlapping jobs Sat 05/09
```

Rows are projects plus a pinned Depot row. Columns are days. Cards are jobs.

**Conflict detection on crew and vehicles is the feature that earns this module its keep.** Overlaps must be flagged inline on the board, not buried in a report. Implement it as a server-side check on every write plus a cheap client-side pass on the loaded week — a manager dragging cards around needs instant feedback, but the source of truth must be the write path so scheduled/API changes are caught too.

Drag a card to another day or crew to reassign. Every reassignment writes to an audit trail (§4.6).

### 4.2 Project detail — sites as tabs

```
┌──────────────────────────────────────────────────────────────────────────┐
│  #1041 · Client name          03 – 05 Sep 2026              [Confirmed ▾]│
├──────────────────────────────────────────────────────────────────────────┤
│  ▸ Site A   ▸ Site B   ▸ Site C   ▸ Site D              + Add site       │
├──────────────────────────────────────────────────────────────────────────┤
│  SITE B — name                                                           │
│  📍 Open in Maps                      Contact: ——        Phone: ——       │
│                                                                          │
│  Jobs at this site                                                       │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │ Sat 05/09  06:00   Setup    Lead + 2 helpers    Truck 1            │  │
│  │ Sat 05/09  ——      Strike   Lead + 2 helpers    Truck 1            │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  Brief / spec                              Photos                        │
│  Quantities  ——                            ┌────┐┌────┐┌────┐┌────┐      │
│  Measurements ——                           │    ││    ││    ││ +  │      │
│  Requirements ——                           └────┘└────┘└────┘└────┘      │
│                                            reference · progress · final  │
└──────────────────────────────────────────────────────────────────────────┘
```

Sites are the folder structure. Each site owns its own photo gallery and its own brief/spec fields. The brief fields should be **tenant-configurable** — a field-service tenant wants serial numbers and fault codes where an events tenant wants guest counts and layouts. A JSON spec column with a per-tenant field definition beats a hundred nullable columns.

### 4.3 Job detail — the movement plan

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Setup — Site A                          Fri 04 Sep · 17:00              │
│  Supervisor  ——      Crew  —— , 1 helper       Vehicle  Truck 2          │
├──────────────────────────────────────────────────────────────────────────┤
│  Steps                                                      + Add step   │
│  1  17:00   Load leaves depot for Site A                          ☐      │
│  2  ——      Setup at Site A                                       ☐      │
│  3  ——      On finish, continue to Site D for the remaining items ☐      │
├──────────────────────────────────────────────────────────────────────────┤
│  Tools to take       ladder, cordless drill                              │
│  Stock checked out   4 × unit X · 20 × part Y            [Manage]        │
│  Notes               ——                                                  │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.4 Worker view — mobile, the only screen most users ever open

```
┌──────────────────────────┐
│  Hi ——           [AR|EN] │
├──────────────────────────┤
│  TOMORROW · Fri 04 Sep   │
│  ┌──────────────────────┐│
│  │ 17:00  Setup         ││
│  │ Site A               ││
│  │ Vehicle: Truck 2     ││
│  │ With: —— , 1 helper  ││
│  │ [ 📍 Open in Maps ]  ││
│  │ [ View photos    4 ] ││
│  │ [ Mark done        ] ││
│  └──────────────────────┘│
│                          │
│  SAT 05 SEP              │
│  ┌──────────────────────┐│
│  │ 06:00  Setup         ││
│  │ Site B               ││
│  │ Vehicle: Truck 1     ││
│  │ Bring: ladder        ││
│  └──────────────────────┘│
└──────────────────────────┘
```

Non-negotiable: opens fast on a cheap Android phone over 3G, works in Arabic RTL, Maps link is one tap, images load progressively. No editing beyond mark-done and uploading a progress photo. Assume poor connectivity — cache the current and next day.

### 4.5 Timesheet and transport log

Two separate tables. Businesses currently mix them onto one paper sheet and it does not work: worker rows need hours and cost, vehicle rows need load/depart/return times.

```
TIMESHEET — week of 3–5 Sep
# │ Date  │ Project │ Worker │ Task            │ From  │ To    │ Hrs │ Cost
1 │ 03/09 │ Depot   │ ——     │ Cleaning        │ 08:00 │ 16:00 │  8  │
2 │ 05/09 │ #1041   │ ——     │ Setup + strike  │ 07:00 │ 14:00 │  7  │
                                          Workers 6 · Hours 41 · Cost ——

TRANSPORT — week of 3–5 Sep
# │ Date  │ Vehicle │ Project      │ Load  │ Out   │ Back  │ Cost
1 │ 04/09 │ Truck 2 │ #1041        │ 16:00 │ 17:00 │ ——    │
2 │ 05/09 │ Truck 3 │ #1042, #1043 │ 10:00 │ 11:00 │ ——    │
```

Hours and cost computed, not typed. Both export to PDF matching the tenant's existing printed forms (§6).

### 4.6 Change log

Every week has reassignments, and on paper they are recorded as crossed-out words. Surface them:

```
CHANGES THIS WEEK
• Truck "Albert" moved from Project #1041 to #1043
• Sunday cleaning reassigned from —— to ——
• Monday prep cancelled — moved to Tuesday
```

Auto-generated from the audit trail on Job. Nobody types this.

### 4.7 Document library

Grid of templates (weekly schedule, timesheet, transport log, goods receipt, job sheet) plus the archive of generated documents, filterable by project and date. Every generated PDF is stored — printed copies are these businesses' historical and accounting record.

---

## 5. Roles and permissions

| Capability | Manager | Supervisor | Crew | Driver |
|---|---|---|---|---|
| Create/edit projects, sites, jobs | ✓ | | | |
| Assign crew and vehicles | ✓ | | | |
| View all projects | ✓ | ✓ | | |
| View own assignments | ✓ | ✓ | ✓ | ✓ |
| Upload photos, mark job done | ✓ | ✓ | ✓ | |
| View briefs and galleries | ✓ | ✓ | ✓ | |
| Check stock out / in against a job | ✓ | ✓ | | ✓ |
| Timesheets and costs | ✓ | | | |
| Generate/download documents | ✓ | ✓ | | |

Two roles would technically cover a 7-person tenant. Build four anyway — supervisor and driver diverge quickly, and adding a role later means re-auditing every query.

Least-privilege at the data layer: a crew member's API responses must not *contain* other projects' data, not merely hide it in the UI. Test this explicitly.

---

## 6. Document generation

These businesses run on printed forms with a fixed house style, and the workers and the accountant recognize the layout. Generated PDFs must match.

Typical house style: logo top-left, contact block opposite, horizontal rule, centered title, accent rule under the title, dark header rows with light text, alternating light body rows, totals row, signature lines, footer with company name and page number. Make the header block, logo, and accent color **tenant-branded settings**, not hardcoded.

Document set: weekly operations schedule, weekly timesheet, transport log, goods receipt / delivery note, job sheet.

All must render in Arabic RTL. Server-side generation on Vercel — pick a renderer that handles Arabic shaping and bidi correctly and **verify it with real Arabic strings before committing to it**. Headless-Chrome rendering of an RTL HTML template is the safest route; naive PDF libraries mangle Arabic.

---

## 7. Arabic + RTL — read this before writing any UI

Lessons already paid for on this project. Ignoring them costs days.

1. **Alignment must be start-relative, never physical.** In a bidi context "right" means *end*, which renders on the **left** in RTL. Use `text-align: start`, `margin-inline-start`, `padding-inline`, `border-inline-start`. Symptom of getting this wrong: headings and table cells hug the wrong edge while the page direction looks correct.

2. **Tables mirror as a whole.** Set direction on the table and keep the column array in logical order — the first column renders rightmost. Do not reverse the data array; you will double-flip.

3. **Isolate every Latin/numeric run inside Arabic text** — URLs, emails, phone numbers, times, codes, quantities like "2 AA". Without isolation `+961 03 181 295` renders as `295 181 03 961+`. Use `<bdi>` or `unicode-bidi: isolate`, or U+2066…U+2069 in generated text.

4. **Never build list numbering by string concatenation** (`"1. " + arabicText`). The marker lands at the wrong end. Use real list markup, or a dedicated numbered column in a table.

5. **Fonts.** Latin UI fonts carry no Arabic glyphs. Ship an Arabic webfont (Noto Naskh Arabic, Cairo, Amiri), give Arabic ~1.7 line-height and roughly 10% larger size than the Latin equivalent, and never apply letter-spacing to Arabic — it breaks the connected script.

6. **Store bilingual content as separate fields** (`name_en`, `name_ar`), never one field plus runtime translation. Proper nouns are transliterated by hand and tenants care about the spelling.

7. **Test with real Arabic content from day one.** Lorem ipsum hides every one of the above.

Target: the whole module flips correctly from a single `dir` attribute plus a locale switch, with zero hardcoded left/right in the CSS.

---

## 8. Notifications

Workers must be told when they're assigned and when something changes.

- **In-app feed** — build first. Reliable, free, no deliverability problems.
- **Email** — second. Works everywhere.
- **Web push is unreliable on PWAs**, especially iOS. Do not make it the primary channel.
- **WhatsApp** — how these teams actually communicate in this market. Evaluate the WhatsApp Business API or a provider like Twilio, but treat it as a later phase.

Events worth notifying on: assigned to a job, job time/date changed, job cancelled, vehicle changed, new photos on a site you're assigned to. **Batch them** — a manager rebuilding a week must not fire 30 notifications.

---

## 9. How this fits into SydIN

SydIN is an inventory management SaaS on Next.js. This module is a **field-operations vertical** on top of it that reuses what already exists.

**Reuse as-is:** tenant model, auth and sessions, role system, design tokens, shadcn/ui components, Zustand stores, Framer Motion patterns, existing table and list primitives.

**The real synergy — and why this belongs inside SydIN rather than beside it:** a job consumes inventory. Equipment, materials, and tools leave the warehouse on a truck and come back afterwards.

```
Job starts   → checks out inventory items   → stock shows "out on job #1041"
Job ends     → returns items                → stock returns, damages logged
```

That gives SydIN something no generic inventory tool has: **stock that knows which job it is standing in.** It answers *"do we have 40 units free next Saturday?"* — a question currently answered by walking into the warehouse and looking. It also surfaces gaps before they bite: a spec calls for an item that turns out not to be in inventory at all.

This is also the commercial argument. Inventory SaaS is a crowded market. Inventory that is aware of scheduled jobs, crews, and vehicles is a much narrower and much stickier product, and it justifies a higher tier.

**Suggested integration shape:**

- New route group under the existing tenant shell, e.g. `/ops`, sharing layout and nav.
- New tables in the existing schema with tenant scoping identical to the inventory tables.
- `job_items (job_id, item_id, qty_out, qty_returned, qty_damaged)` joining to the existing item catalogue.
- **Extend the existing transaction/audit ledger rather than inventing a second one.** Job checkout and return must appear in the same movement history as every other stock transaction — this is the difference between a real integration and two apps in one URL.
- Availability query: stock on hand minus quantities committed to jobs in a date range.
- Feature-flag the module per tenant; not every SydIN customer runs field operations.

**What to decide and justify in the plan:** whether this ships as a first-class module inside the app or a separate app sharing auth and database; how much of the inventory link belongs in phase one; and which layouts to build first.

---

## 10. Suggested phasing

1. **Core** — projects, sites, jobs, workers, vehicles. Week board + project detail. Manager only.
2. **Field** — roles, worker mobile view, in-app + email notifications, mark-done and photos.
3. **Paper parity** — timesheets, transport log, Arabic PDF generation, document library. The point the notebook gets retired.
4. **Inventory link** — job checkout/return against the existing ledger, availability by date, damage logging.
5. **Briefs** — per-site configurable spec fields and galleries, client-facing preview.

---

## 11. Kickoff prompt

Paste this into the code session along with this file.

> You have a brief at `SYDIN-FIELD-OPS-MODULE-BRIEF.md` describing a new Field Operations module for SydIN — a scheduling and dispatch layer for businesses that send crews and vehicles to job sites, built on top of the existing inventory SaaS.
>
> Read it fully, then explore the existing SydIN codebase before proposing anything: the tenant and auth model, the role system, the inventory schema and its transaction/audit ledger, the design tokens, and the shared UI primitives.
>
> Then produce an implementation plan covering:
> 1. Where the module lives — module inside the app vs. separate app on shared auth/DB — with your reasoning.
> 2. The schema, as concrete migrations against the existing database, with tenant scoping matching the current convention. Include how you'd handle tenant-configurable job types and brief/spec fields without a hundred nullable columns.
> 3. Which layouts from §4 you'd build and why, including anything you'd design differently. The week board with crew/vehicle conflict detection is the highest-value screen — say exactly how you'd implement the conflict check on both the write path and the client.
> 4. The Arabic/RTL strategy — §7 lists failures already hit on this project. State concretely how i18n and direction handling will work end to end, including the PDF pipeline, and which library choices depend on it.
> 5. The inventory integration — how jobs check stock out and back in through the existing ledger rather than a parallel one, and how you'd compute availability for a future date.
> 6. Phasing, with what ships in phase one.
>
> Flag anything in the brief that conflicts with how SydIN is currently built, and say where you'd deviate. Do not write feature code until the plan is agreed — but read the codebase first so the plan is grounded in what's actually there.

---

## 12. Open questions

- Costing model: flat hourly rate per worker, per-role rates, or per-project rates?
- Are vehicles owned, or hired per job with an external contractor? This changes whether Vehicle is an asset or a supplier line.
- Are anonymous helpers ever tracked by name for payroll, or strictly a headcount?
- Do clients and sites persist across projects as reusable records, or stay free text per project?
- Currency — single, or dual display (e.g. USD + local)?
- Does any tenant need client-facing access (a portal showing schedule and progress photos), or is this strictly internal?
