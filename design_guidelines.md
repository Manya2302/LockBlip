# LockBlip - Design Guidelines

## Design Approach

**Selected Approach:** Reference-Based with Custom Blockchain Identity

Drawing inspiration from modern messaging platforms (Telegram's fluidity, Signal's security-first aesthetics) while creating a unique blockchain-focused identity. The design emphasizes trust, security, and technological innovation through visual language.

**Core Principle:** Every visual element should reinforce the blockchain foundation - chain-linked interactions, cryptographic motifs, and immutable data visualization.

---

## Color Palette

### Dark Mode (Primary)
- **Background Gradient:** 11 16 32 → 27 31 58 (midnight gradient)
- **Surface:** 20 25 45 (elevated cards)
- **Surface Elevated:** 30 35 60 (chat bubbles, modals)

### Brand Colors
- **Primary (Swapgreen):** 165 85% 52% - Used for CTAs, active states, sender bubbles
- **Secondary (Coral):** 0 100% 71% - System messages, alerts, important indicators
- **Accent (Chain Blue):** 220 80% 60% - Links, blockchain indicators

### Functional Colors
- **Success:** 142 76% 45% (message delivered, chain validated)
- **Warning:** 45 93% 58% (pending validation)
- **Error:** 0 85% 65% (chain broken, invalid block)
- **Text Primary:** 0 0% 95%
- **Text Secondary:** 0 0% 70%
- **Text Muted:** 0 0% 50%

---

## Typography

**Font Families:**
- **Primary:** 'Inter' (via Google Fonts) - UI, body text, chat messages
- **Monospace:** 'JetBrains Mono' - Blockchain data, hashes, technical displays

**Scale & Usage:**
- Headings: font-bold, text-2xl to text-4xl
- Body: font-normal, text-base
- Chat Messages: text-sm to text-base
- Technical Data: text-xs, font-mono
- Timestamps: text-xs, text-muted

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24

**Layout Structure:**
- **Sidebar:** Fixed w-80, full height, chain status + contacts
- **Chat Area:** Flex-1, messages container + input bar
- **Message Bubbles:** max-w-md, rounded-2xl, p-4
- **Input Bar:** Fixed bottom, h-16, backdrop-blur

**Responsive Breakpoints:**
- Mobile: Sidebar slides over (z-50)
- Tablet: Sidebar collapsible
- Desktop: Three-column (sidebar + chat + info panel)

---

## Component Library

### Core UI Elements

**Chat Bubbles (Frosted Glass):**
- Sender: bg-swapgreen/10, backdrop-blur-xl, border-swapgreen/20
- Receiver: bg-surface-elevated, backdrop-blur-xl, border-white/10
- Rounded-2xl, drop-shadow-lg
- Include: Lock icon (encrypted), checkmarks (validated), timestamp

**Blockchain Indicators:**
- **Chain Status Badge:** Animated gradient border, shows block count
- **Hash Display:** Monospace, truncated with tooltip on hover
- **Validation Checkmark:** Animated appearance (scale + fade)

**Input Controls:**
- **Message Input:** bg-surface, rounded-full, p-3, focus:ring-swapgreen
- **Send Button:** Circular, bg-swapgreen, with ripple animation
- **Attachment Button:** Icon-only, ghost style

### Navigation

**Sidebar Navigation:**
- Contact list with avatar + last message preview
- Active contact: bg-swapgreen/20, border-l-4 border-swapgreen
- Search bar at top: backdrop-blur, rounded-lg

**Top Bar:**
- Contact info + blockchain status
- Settings icon (top-right)
- Network status indicator (animated pulse when syncing)

### Forms & Inputs

**Login/Register:**
- Centered card, max-w-md
- Gradient border effect
- Key generation visualization (animated)

**Settings Panel:**
- Tabs: Profile, Security, Blockchain, Theme
- Toggle switches with glow effect
- Export chain button (prominent, with download icon)

### Data Displays

**Blockchain Ledger Viewer:**
- Vertical timeline of blocks
- Each block: Card with index, hash (truncated), timestamp
- Visual chain connection (vertical line with nodes)
- Expandable for full block details

**Message Metadata:**
- Encryption status badge
- Block number link (opens ledger)
- Delivery timestamp

### Overlays & Modals

**Key Generation Modal:**
- Full-screen overlay, dark backdrop
- Animated key visualization
- Progress indicator
- Security tips sidebar

**Chain Validation Alert:**
- Toast notification, top-right
- Success: green with checkmark
- Error: coral with warning icon
- Auto-dismiss or user action

---

## Animations

**Message Send Flow:**
1. Input shake (prepare)
2. Ripple effect from send button
3. Bubble slides up with fade-in
4. Encryption lock animation (rotate + glow)
5. Chain link appears (connect to previous block)

**Message Receive:**
1. Notification pulse
2. Bubble slides in from left
3. Decrypt animation (unlock icon)
4. Validation checkmark (scale bounce)

**Blockchain Sync:**
- Progress bar with gradient animation
- Node connection visualization (pulsing dots)
- Chain integrity check (scanning line effect)

**Subtle Interactions:**
- Hover: scale-105, brightness-110
- Active: scale-95
- Focus: ring-2, ring-swapgreen/50

---

## Images

**Login/Landing Hero:**
- Abstract blockchain visualization (connected nodes, glowing lines)
- Dimensions: 1200x600px, gradient overlay
- Position: Full-width background, centered content overlay

**Empty States:**
- No messages: Illustrated lock + chain icon, 400x300px
- No contacts: People + blockchain graphic, 400x300px

**Blockchain Ledger:**
- Visual block icons (small, 48x48px) for each block type
- System blocks, user messages, validation nodes

---

## Key Visual Differentiators

1. **Chain Motif:** Subtle chain-link patterns in backgrounds
2. **Cryptographic Elements:** Lock icons, key symbols, hash displays
3. **Immutable Trail:** Visual history that can't be edited (strikethrough not allowed)
4. **Security-First Color:** Swapgreen indicates verified/secure states
5. **Glass Morphism:** Extensive use of backdrop-blur for depth
6. **Monospace Technical Data:** All hashes, addresses use JetBrains Mono

---

## Accessibility

- Maintain 4.5:1 contrast ratio for all text
- Focus indicators: 2px ring, swapgreen color
- Keyboard navigation: Full support with visible focus states
- Screen reader: ARIA labels for blockchain status, encryption indicators
- Color-blind friendly: Don't rely solely on color for validation status (use icons)