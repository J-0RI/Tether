# Tether · surgical care coordination (demo)

Fictional sample data only. No backend, no login, no real patients, no real messages or calls.

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # static build in dist/ (open with: npm run preview)
npm test           # status rules and data checks
```

- `src/mockData.ts`: the 12 fictional patients (fixed demo date: Nov 7, 2026)
- `src/calculateStatus.ts`: the Act now / Watch / On track rules
- `src/state.ts`: actions, demo scenarios and reset
- `src/components/DashboardWorkspace.tsx`: the four-region waitlist overview and expanded views
- `src/components/profile/`: the patient workspace (history, review, readiness, video follow-up)

## Demo controls

There is no on-screen demo button. Press **Alt+Shift+D** (**Option+Shift+D** on a Mac) to open the
demo panel: simulate an incoming check-in for any patient, or **Reset demo** to restore the original
data. Reset right before presenting.

Fonts are bundled locally, so the app works with no Wi-Fi once installed.
