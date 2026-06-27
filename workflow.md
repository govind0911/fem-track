# Saku Period Tracker - Development Workflow & Roadmap

## 1. Project Setup & Core Milestones

Saku's development is structured across distinct execution phases to transition from design to full implementation systematically.

```
PHASE 1: Project Setup & Frame Setup
  ├── Formulate directory structure
  ├── Establish CSS constants & reset definitions
  └── Configure responsive mobile shell layout

PHASE 2: Navigation & View States
  ├── Bottom menu navigation buttons
  └── Switch logic to show/hide sections

PHASE 3: Logging & Modal Dialogs
  ├── Modal overlay for status logging
  ├── Input components (moods, pain, symptoms chips, vitals, notes)
  └── Sync between cycle logs and date-specific parameters

PHASE 4: Predictive Engine & Analysis
  ├── Implement mathematical averages
  ├── Add outlier filters for cycle irregularities
  └── Integrate automatic consecutive bleed grouping

PHASE 5: Responsive Calendar Grid
  ├── Month navigation navigation buttons
  ├── Cell generation for previous/current/next months
  └── Render highlights (period, predicted bleeding, fertile, ovulation)

PHASE 6: Analytics & Settings
  ├── Render symptom frequency bar charts
  ├── Streak trackers and averages displays
  └── Alert configurations & system data wipe triggers
```

---

## 2. Testing & Quality Control Checklists

### Core Functionality Tests:
- [ ] **First-Time Load**: Verify app boots properly with standard default parameters (cycle length 28, period length 5) if local storage is blank.
- [ ] **Quick Log Today**: Log a period flow today. Confirm cycle day progress ring updates instantly on Home screen.
- [ ] **Dual-Syncing (Bleed grouping)**: Log 4 consecutive period days. Confirm they are grouped as a single historical cycle under the History tab.
- [ ] **Range Logger**: Log a historical cycle range (e.g. June 1 to June 5). Verify that calendar days June 1 through June 5 are automatically highlighted in solid pink.
- [ ] **Prediction Accuracy**: Change default cycle setting to 30. Confirm future predicted dates on home page and calendar adjust instantly.
- [ ] **Outlier Filtering**: Log a cycle length of 10 days (an outlier) and one of 28 days. Verify the prediction engine filters out the 10-day cycle to prevent distortion.

### Responsive Design Tests:
- [ ] **Mobile Touch targets**: Verify all buttons, calendar cells, and logging chips are easy to tap on viewport widths under 400px.
- [ ] **Desktop Centering Frame**: Verify the app wraps inside a beautiful centered phone mockup layout on screen widths above 500px.
- [ ] **Form Scrollability**: Open Quick Log. Verify the modal body scrolls correctly on short, landscape-oriented mobile displays.

---

## 3. Deployment Checklist

1. **Verify Asset Loading**: Ensure `index.html` references `./style.css` and `./script.js` with relative paths so that the files open correctly whether run locally or deployed behind a reverse proxy.
2. **Build and Validation**: Execute Vite compiler builds via `npm run build` to verify clean builds.
3. **Local Storage Sandboxing**: Verify that testing does not pollute user workspaces, and that `Clear Saved Logs` works.

---

## 4. Future Product Roadmap

Saku is designed for rapid expansion while retaining its offline, private nature.

### Version 1.1: Basal Body Temp (BBT) & Weight Analytics
- **Visual Trends**: Pure HTML/CSS line charts to visualize fluctuations in Basal Body Temperature (BBT) across cycle phases (detecting post-ovulation temperature spikes).
- **Weight Tracking Trends**: Progress chart reflecting fluid retention during the luteal phase.

### Version 1.2: Advanced Export, Import, & Reminders
- **Data Export**: Export tracked logs and cycles as structured CSV/JSON file formats for doctors.
- **Data Import**: Restore previously exported data into any browser.
- **Symptom Tagging Customize**: Allow users to type and add their own customized symptom chips to the selector.

### Version 2.0: Multi-User Sync & Local Encrypted Vault
- **Zero-Knowledge Cloud Sync**: Optional fully-encrypted remote backup using AES-256 client-side encryption. Data is encrypted locally before being backed up.
- **Biometric Lock**: Prompt for fingerprint/face identification on mobile devices using WebAuthn.
- **Partner Sync**: Shared viewing mode where partners receive notifications of upcoming phases via local encryption keys.
