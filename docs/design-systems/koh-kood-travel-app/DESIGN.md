# Koh Kood Travel — Mobile App Design System

## 1. Product mood

**Theme:** premium tropical escape, calm discovery, local Thailand warmth.  
**Feeling:** clear sea, white sand, green island, golden sunset, boutique resort comfort.  
**Audience:** travelers planning a Koh Kood trip: couples, families, digital nomads, premium local travelers.

Design should feel:
- Calm, airy, immersive
- Travel-guide useful, not noisy OTA clutter
- Premium but friendly
- Image-led, with strong practical trip information

## 2. Brand keywords

- Turquoise sea
- Coconut green
- Sunset coral
- Warm sand
- Boutique island guide
- Slow travel
- Local confidence

## 3. Color tokens

```css
:root {
  /* Core */
  --kk-sea-900: #053B43;
  --kk-sea-700: #087C8C;
  --kk-sea-500: #16B8C7;
  --kk-sea-300: #7DE3E9;

  --kk-island-900: #123524;
  --kk-island-700: #1F6B45;
  --kk-island-500: #35A66B;
  --kk-island-300: #9BE3B9;

  --kk-sand-50: #FFF8EA;
  --kk-sand-100: #F7ECD2;
  --kk-sand-300: #E7C985;

  --kk-coral-400: #FF8A72;
  --kk-coral-500: #F66B55;
  --kk-sunset-400: #FDBA5A;

  /* Neutrals */
  --kk-ink: #102027;
  --kk-muted: #667A80;
  --kk-line: #D9E7E8;
  --kk-bg: #F7FBFA;
  --kk-white: #FFFFFF;

  /* Semantic */
  --color-primary: var(--kk-sea-700);
  --color-primary-soft: #E6FAFC;
  --color-accent: var(--kk-coral-500);
  --color-success: var(--kk-island-500);
  --color-warning: var(--kk-sunset-400);
  --color-surface: var(--kk-white);
  --color-screen-bg: var(--kk-bg);
}
```

## 4. Typography

Recommended fonts:
- **English/UI:** Inter, SF Pro, or Manrope
- **Thai:** Noto Sans Thai or IBM Plex Sans Thai

Scale:

| Token | Size | Weight | Usage |
|---|---:|---:|---|
| Display | 34 | 800 | Hero destination title |
| H1 | 28 | 800 | Screen title |
| H2 | 22 | 750 | Section title |
| H3 | 18 | 700 | Card title |
| Body | 15 | 400/500 | Normal content |
| Caption | 12 | 500 | Metadata, tags |
| Micro | 10 | 700 | badges |

Thai body should use slightly looser line-height: **1.45–1.6**.

## 5. Spacing & layout

Mobile base: **390 × 844** / iPhone 15 style.

- Screen horizontal padding: **20px**
- Section gap: **28px**
- Card gap: **14–16px**
- Card radius: **24px** for hero/cards, **16px** for chips/buttons
- Bottom nav height: **76px**
- Sticky CTA safe area aware

Use a soft vertical rhythm:
- Hero image takes 38–45% screen height on destination detail
- Content cards overlap hero by -28px for premium travel feel
- Lists should be scannable: image, title, rating/distance, price/time

## 6. Components

### 6.1 Destination hero

Purpose: immediate emotional pull.

Rules:
- Full-bleed image/card with gradient overlay
- Top-left location label: “Koh Kood, Trat”
- Large title: beach/waterfall/resort name
- Floating weather chip: `29°C · Sunny`
- Save/share action top-right

Style:
- Radius bottom: 32px when not full-screen
- Gradient: transparent → rgba(5,59,67,0.72)
- Text in white, shadow subtle

### 6.2 Search pill

Used on home and explore.

- Height: 52px
- Radius: 18px
- Background: white
- Border: #D9E7E8
- Icon left, placeholder: “ค้นหาที่เที่ยว คาเฟ่ รีสอร์ต...”
- Optional filter button right with sea color background

### 6.3 Category chips

Examples:
- Beaches
- Waterfalls
- Resorts
- Food
- Snorkeling
- Ferry

Style:
- Active bg: `--kk-sea-700`, text white
- Inactive bg: white, text ink, border line
- Height: 38px, radius 19px

### 6.4 Place card

Content:
- Image 96×96 or 120×140
- Title
- Area/distance
- Rating
- Best time tag
- Price/entry info if relevant

Card style:
- Background white
- Radius 22px
- Shadow soft: `0 10px 30px rgba(8,124,140,0.10)`
- Image radius 18px

### 6.5 Trip itinerary card

For “3D2N Koh Kood plan”.

- Day badge: `DAY 1`
- Timeline vertical line sea-300
- Items with time + activity
- CTA: “ดูแผนทั้งหมด”

### 6.6 Transport info card

Must be practical and trustworthy.

Fields:
- Ferry pier
- Boat time
- Transfer duration
- Last boat warning
- Booking status

Use warning color for time-sensitive notes.

### 6.7 Bottom navigation

Tabs:
- Home
- Explore
- Trips
- Saved
- Profile

Style:
- Floating pill nav
- White background, 24px radius
- Active icon sea-700 with soft circular background

## 7. Screen templates

### Home

Sections:
1. Greeting + weather chip
2. Search pill
3. Hero: “Escape to Koh Kood”
4. Category chips
5. Top places
6. Ready-made itineraries
7. Travel essentials

### Explore

Sections:
1. Search + filter
2. Map/list toggle
3. Category chips
4. Place list cards
5. Bottom sheet for selected place

### Place detail

Sections:
1. Hero image
2. Title + rating + save
3. Quick facts: best time, duration, family-friendly, price
4. Description
5. Tips from locals
6. Nearby places
7. Sticky CTA: Add to trip

### Trip planner

Sections:
1. Date selector
2. Days tabs
3. Timeline cards
4. Ferry/transport alert
5. Export/share itinerary

### Travel essentials

Sections:
- How to get to Koh Kood
- Ferry schedule notes
- Best season
- What to pack
- Mobile signal / cash / safety

## 8. Imagery direction

Use:
- Clear turquoise sea
- Coconut trees / pier / wooden boat
- Warm sunset
- Boutique resort textures
- Local Thai food, seafood, quiet beaches

Avoid:
- Overcrowded beach stock photos
- Overly saturated neon tropical colors
- Generic airplane/travel clichés

Image treatment:
- Slight warm tone
- Deep teal shadows
- Soft grain optional
- Hero overlay for readability

## 9. Icons

Style:
- Rounded line icons
- 2px stroke
- Sea green active state
- Avoid overly playful cartoon icons

Recommended icon concepts:
- compass
- map-pin
- ferry
- palm
- wave
- calendar
- heart/save
- filter sliders

## 10. Interaction patterns

- Card tap opens detail
- Long press save optional
- Swipe horizontal categories and itinerary cards
- Sticky bottom CTA for high intent actions
- Map/list toggle for Explore
- Offline-friendly essential info screen

Microcopy style:
- Thai-first, warm and practical
- Short labels
- Avoid robotic OTA wording

Examples:
- “วันนี้เกาะกูดอากาศดี เหมาะกับหาดคลองเจ้า”
- “รอบเรือสุดท้ายควรเช็กก่อนออกเดินทาง”
- “เพิ่มเข้าทริป 3 วัน 2 คืน”

## 11. Accessibility

- Minimum body contrast AA
- Do not place thin white text on bright sea photo without overlay
- Tap target at least 44×44px
- Dynamic type tolerant cards
- Important ferry warnings must not rely on color alone

## 12. Do / Don’t

Do:
- Lead with atmosphere, then useful facts
- Keep screens calm and breathable
- Use practical local travel info
- Make CTAs obvious

Don’t:
- Overload with too many badges
- Use dark text directly over busy photos
- Make every card the same size if content hierarchy differs
- Copy resort/agency branding without permission

## 13. Agent prompt guide

When implementing this app, build a mobile-first travel guide for Koh Kood using a calm premium tropical design. Use turquoise sea, island green, coral sunset, and warm sand tokens. Prioritize image-led destination discovery, practical ferry/transport info, itinerary planning, and saved places. Keep UI spacious, rounded, Thai-friendly, and trustworthy.

---

## 14. Button system

### Button tokens

```css
--button-radius-sm: 14px;
--button-radius-md: 18px;
--button-radius-lg: 22px;
--button-height-sm: 36px;
--button-height-md: 48px;
--button-height-lg: 56px;
--button-padding-x-sm: 14px;
--button-padding-x-md: 18px;
--button-padding-x-lg: 22px;
```

### Primary button

Use for main action: booking, add to trip, confirm plan.

- Background: `--kk-sea-700`
- Text: white
- Height: 52–56px
- Radius: 18–22px
- Font: 15px / 700
- Shadow: `0 12px 28px rgba(8,124,140,0.22)`

Example labels:
- “เพิ่มเข้าทริป”
- “วางแผน 3 วัน 2 คืน”
- “ดูรอบเรือ”

### Accent button

Use for emotionally strong CTA.

- Background: `--kk-coral-500`
- Text: white
- Use sparingly for booking/high intent action

### Secondary button

- Background: white
- Border: `--kk-line`
- Text: `--kk-sea-700`
- Used for filters, share, “ดูรายละเอียด”

### Ghost button

- Background: transparent or `rgba(255,255,255,0.16)` on photo
- Text/icon: white or sea-700
- Used on hero overlays

### Icon button

- Size: 40 / 44 / 48px
- Radius: circle or 16px
- Active bg: `--color-primary-soft`
- Icon stroke: `--kk-sea-700`

## 15. Spacing system

Use an 8px base scale with a few travel-app specific values.

| Token | Value | Usage |
|---|---:|---|
| `space-2xs` | 4 | icon/text micro gap |
| `space-xs` | 8 | tight chip/card internals |
| `space-sm` | 12 | card text gap |
| `space-md` | 16 | default component gap |
| `space-lg` | 20 | screen horizontal padding |
| `space-xl` | 24 | card padding / section internal |
| `space-2xl` | 32 | section separation |
| `space-3xl` | 40 | hero/content major gap |

Rules:
- Screen padding: 20px
- Component internal padding: 12–20px
- Section top margin: 24–32px
- Avoid dense OTA-style lists; travel content needs breathing room

## 16. Font system

### Font families

```css
--font-ui: Inter, Manrope, -apple-system, BlinkMacSystemFont, sans-serif;
--font-thai: "Noto Sans Thai", "IBM Plex Sans Thai", system-ui, sans-serif;
```

### Text styles

| Style | Size | Line height | Weight | Usage |
|---|---:|---:|---:|---|
| `display/hero` | 34 | 38 | 800 | hero destination title |
| `title/screen` | 28 | 34 | 800 | screen heading |
| `title/section` | 21 | 28 | 750 | section header |
| `title/card` | 16 | 22 | 700 | place card title |
| `body/default` | 15 | 23 | 400 | description |
| `body/strong` | 15 | 23 | 600 | useful fact |
| `label/chip` | 12 | 16 | 700 | category chips |
| `caption/meta` | 11 | 15 | 600 | rating, distance, ferry note |
| `micro/badge` | 10 | 13 | 800 | small tags |

Thai text guidance:
- Use line-height at least 1.45
- Avoid all-caps style for Thai labels
- Keep button labels short and action-first

## 17. Card system

### Base card

```css
--card-radius-sm: 18px;
--card-radius-md: 22px;
--card-radius-lg: 28px;
--card-border: 1px solid var(--kk-line);
--card-shadow-soft: 0 12px 30px rgba(8,124,140,0.09);
--card-shadow-floating: 0 20px 44px rgba(5,59,67,0.16);
```

### Place card

- Image: 94×94, radius 18
- Card height: 112–124
- Title: card title
- Meta: distance/type/rating
- Badge: best time or trip fit

### Feature card

Used for travel essentials.

- Icon bubble left
- Title + short explanation
- Height: 96–112
- Radius: 24

### Itinerary card

- Day label / timeline
- Vertical sea-300 line
- Time left, activity right
- Warning card above timeline if ferry-sensitive

### Floating info card

Used over hero/detail content.

- Radius: 28–30
- White surface
- Top overlaps hero by -28px
- Strong shadow, no heavy border

## 18. Icon system

Style:
- Rounded line icons
- 2px stroke
- 24px default canvas
- 20px in buttons/chips
- 28–32px for feature cards

Semantic icons:
- Search: magnifier
- Filter: sliders
- Save: heart
- Location: map-pin
- Ferry: ship/boat
- Weather: sun/cloud
- Trip: route/calendar
- Safety/notice: alert triangle
- Food: utensils
- Beach: wave/palm

Rules:
- Icons should support labels, not replace them for critical information
- Warning/ferry icons must include text
- Use filled emoji only in early mockups; production should use a consistent icon set

## 19. Banner system

### Destination hero banner

- Height: 300–360 on mobile home/detail
- Gradient overlay required
- Radius: bottom 32 if card-like
- Content bottom aligned
- Include location + weather + save/share

### Promo banner

Use for itinerary packages or seasonal content.

- Height: 130–170
- Radius: 26
- Background: sea gradient or warm sunset gradient
- Title 20–22px bold
- Short subtitle + CTA chip

### Alert banner

Use for ferry, weather, safety.

- Background: `#FFF5E6` or soft coral
- Icon left
- Title + one-line summary
- Optional action link
- Do not rely on red alone

### Local tip banner

Use for subtle guidance.

- Background: primary soft `#E6FAFC`
- Accent line sea-700
- Text: practical, Thai-first

Example:
“ทิปท้องถิ่น: หาดคลองเจ้าแสงสวยสุดช่วง 16:30–18:00”

## 20. Component hierarchy

Use priority order:
1. Hero / critical travel alert
2. Search / plan CTA
3. Top places or itinerary
4. Secondary categories
5. Local tips / essentials

Never let decorative cards compete with ferry/safety info.
