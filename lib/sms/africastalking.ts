/**
 * Africa's Talking SMS client (minimal REST wrapper).
 *
 * Docs: https://developers.africastalking.com/docs/sms/sending/bulk
 * Live API base: https://api.africastalking.com/version1
 * Sandbox:       https://api.sandbox.africastalking.com/version1
 */

const SANDBOX_USERNAME = 'sandbox'

function getBaseUrl(username: string): string {
  return username === SANDBOX_USERNAME
    ? 'https://api.sandbox.africastalking.com/version1'
    : 'https://api.africastalking.com/version1'
}

export interface SendSmsResult {
  ok: boolean
  status?: string
  messageId?: string
  errorMessage?: string
}

/**
 * Send a single SMS via Africa's Talking.
 * Expects AFRICASTALKING_USERNAME and AFRICASTALKING_API_KEY env vars.
 * Optional AFRICASTALKING_SENDER_ID for branded shortcode/alphanumeric sender.
 */
export async function sendSms(to: string, message: string): Promise<SendSmsResult> {
  const username = process.env.AFRICASTALKING_USERNAME
  const apiKey = process.env.AFRICASTALKING_API_KEY
  const senderId = process.env.AFRICASTALKING_SENDER_ID

  if (!username || !apiKey) {
    return { ok: false, errorMessage: 'AFRICASTALKING_USERNAME / AFRICASTALKING_API_KEY not configured' }
  }

  const body = new URLSearchParams({
    username,
    to,
    message,
  })
  if (senderId) body.append('from', senderId)

  try {
    const res = await fetch(`${getBaseUrl(username)}/messaging`, {
      method: 'POST',
      headers: {
        apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: body.toString(),
    })

    const json: any = await res.json().catch(() => null)
    const recipient = json?.SMSMessageData?.Recipients?.[0]

    if (!res.ok || !recipient || recipient.status !== 'Success') {
      return {
        ok: false,
        status: recipient?.status,
        errorMessage: recipient?.statusCode?.toString() || json?.SMSMessageData?.Message || `HTTP ${res.status}`,
      }
    }

    return { ok: true, status: recipient.status, messageId: recipient.messageId }
  } catch (error: any) {
    return { ok: false, errorMessage: error?.message || 'Network error' }
  }
}
