// ReviewTrigger is intentionally empty.
// Trial users are gated at the analyze step (REVIEW_REQUIRED code from the API).
// Paid users are prompted at the renewal checkout (pricing page).
// No ambient modals are needed.
export function ReviewTrigger(_props: { userEmail: string; userName?: string }) {
  return null
}
