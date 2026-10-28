// src/lib/onboardingGate.js
// A locked self-service menu (Sidebar / Home card) was pressed while onboarding is not done:
// go fill the data. The hint toast is shown by the onboarding page itself (it owns its
// <Toaster/>; AppLayout's toaster unmounts on the way out), via location.state.lockedFrom.
export function goToOnboardingFromLocked(navigate, label) {
  navigate("/onboarding", { state: { lockedFrom: label || "บริการตนเอง" } })
}
