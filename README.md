# Zoo Journal 🐾

<p align="center">
  <img src="public/app-icon-192-v2.png" alt="Zoo Journal red panda icon" width="120" />
</p>

<p align="center">
  A cosy shared journal for planning animal dates, discovering new places and keeping every memory together.
</p>

<p align="center">
  <a href="https://ons-zoo-dagboek.vercel.app/"><strong>Open the live app</strong></a>
</p>

Zoo Journal is a responsive bilingual web app and installable PWA for two people. It combines a zoo and animal-place explorer with trip planning, shared reviews, rankings, memories and a journey map. The interface is inspired by pastel watercolour illustrations and a warm scrapbook aesthetic.

## Features

- Explore zoos, aquariums, petting zoos and other animal places in the Netherlands, Belgium and Germany
- Search, filter and sort the animal-place catalogue
- View locations on an interactive map
- Save places to a shared wishlist
- Register visits with a date, departure point and travelled distance
- Plan dates with an itinerary, budget, tickets and packing list
- Send a plan to your partner for approval
- Create separate reviews and compare combined rankings
- Add, edit and remove shared memories with photos
- Use the app in Dutch or English
- Install the app on iPhone, Android and desktop as a PWA

## Shared accounts and privacy

Each person signs in with their own email address. One person creates a journal and receives a pairing code. The second person uses that code to join the same journal.

The source code in this repository is public, but personal journal data is not. Supabase Row Level Security ensures that trips, visits, reviews, memories and uploaded photos are only available to members of the linked journal.

## Tech stack

- Next.js 16
- React 19 and TypeScript
- Supabase Authentication, PostgreSQL and Storage
- OpenStreetMap and Leaflet
- Wikidata for the live animal-place catalogue
- Vercel for hosting

## Run locally

### Requirements

- Node.js 22.13 or newer
- A Supabase project

### Installation

```bash
git clone https://github.com/Hawchi/Zoo-Journal.git
cd Zoo-Journal
npm install
```

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Run these migrations in the Supabase SQL editor, in order:

1. `supabase/migrations/202610210001_zoo_journal.sql`
2. `supabase/migrations/202610210002_fix_invite_code.sql`

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Supabase authentication

Add the following URLs to the redirect allow list in Supabase Authentication:

```text
http://localhost:3000/auth/callback
https://your-domain.vercel.app/auth/callback
```

For production, set the site URL to your deployed domain. Email sign-in must be enabled in the Supabase authentication providers.

## Deploy on Vercel

1. Import this GitHub repository into Vercel.
2. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as environment variables.
3. Deploy the project.
4. Add the production callback URL to Supabase.

## Commands

```bash
npm run dev      # Start the development server
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Check the code
npm test         # Build and run the tests
```

## Nederlands

Zoo Journal is een gedeeld dierendagboek voor twee personen. Jullie kunnen samen dierenplekken ontdekken, uitjes plannen, bezoeken registreren, aparte beoordelingen schrijven, ranglijsten vergelijken en herinneringen met foto's bewaren. De app is volledig te gebruiken in het Nederlands en Engels.

## Credits

Animal-place data is enriched with public information from Wikidata and OpenStreetMap contributors. Prices, opening hours, deals and availability can change, so always verify important details with the official location or ticket provider before travelling.
