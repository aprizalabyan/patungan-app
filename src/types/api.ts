/**
 * Types mirroring the Patungan backend (FastAPI) Pydantic schemas in
 * `patungan-service/app/schemas/*`. UUIDs, dates and datetimes arrive as strings.
 * Money is always integer Rupiah.
 */

export type UUID = string
/** ISO date, `YYYY-MM-DD`. */
export type ISODate = string
/** ISO 8601 datetime. */
export type ISODateTime = string

export type EventStatus = 'active' | 'completed'
export type EventPaymentMode = 'paid_only' | 'track_status'
/** Set by the backend only: `pending` until a payment is recorded, `paid` after. There is nothing in between. */
export type PaymentStatus = 'pending' | 'paid'
export type PaymentAccountType = 'bank' | 'e_wallet' | 'cash'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface PageParams {
  page?: number
  page_size?: number
}

// --- Auth --------------------------------------------------------------------

export interface LoginRequest {
  email: string
  password: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  /** Token lifetime in seconds. */
  expires_in: number
}

export interface User {
  id: UUID
  name: string
  email: string
  created_at: ISODateTime
}

// --- Friends -----------------------------------------------------------------

export interface Friend {
  id: UUID
  name: string
  nickname: string | null
  phone: string | null
  created_at: ISODateTime
}

export interface FriendBrief {
  id: UUID
  name: string
  nickname: string | null
}

export interface FriendCreate {
  name: string
  nickname?: string | null
  phone?: string | null
}

/** `name` may be omitted but must not be null. */
export interface FriendUpdate {
  name?: string
  nickname?: string | null
  phone?: string | null
}

export interface FriendListParams extends PageParams {
  search?: string
}

// --- Events ------------------------------------------------------------------

export interface Event {
  id: UUID
  title: string
  description: string | null
  event_date: ISODate | null
  target_amount: number | null
  status: EventStatus
  payment_mode: EventPaymentMode
  is_public: boolean
  created_by: UUID
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface EventCreate {
  title: string
  description?: string | null
  event_date?: ISODate | null
  target_amount?: number | null
  status?: EventStatus
  payment_mode?: EventPaymentMode
  is_public?: boolean
}

/** `title`, `status`, `is_public` may be omitted but must not be null. */
export type EventUpdate = Partial<EventCreate>

export interface EventListParams extends PageParams {
  status?: EventStatus
}

/** The eight fields shared by the treasurer and the public summary. */
export interface PublicEventSummary {
  event_id: UUID
  total_participants: number
  paid_count: number
  pending_count: number
  /** Legacy alias of `total_received`. */
  total_collected: number
  /** Still owed: the bills of the pending contributions. */
  total_pending: number
  target_amount: number | null
  /** floor(received*100/target), not capped at 100, null when the target is missing or zero. */
  progress_percent: number | null
}

/** One row of the per-account receipts breakdown; identity is the account's *current* one. */
export interface SummaryPaymentAccount {
  id: UUID
  provider_name: string
  type: PaymentAccountType
  total_received: number
}

/**
 * Treasurer-only summary. Every figure is computed by the backend;
 * `total_contributions == total_received + total_pending`.
 */
export interface EventSummary extends PublicEventSummary {
  /** Sum of all contribution bills. */
  total_contributions: number
  /** Sum of the bills of the paid contributions. */
  total_received: number
  payment_accounts: SummaryPaymentAccount[]
  /** Received through paid contributions that have no account (legacy data). */
  unassigned_total: number
}

// --- Contributions -----------------------------------------------------------

export interface Contribution {
  id: UUID
  event_id: UUID
  friend_id: UUID
  friend: FriendBrief
  /** The bill. A paid contribution's payment always equals this amount. */
  amount: number
  payment_status: PaymentStatus
  /** Set only while paid. */
  paid_at: ISODateTime | null
  /** Snapshot of the account taken when paid; null while pending (and for legacy paid data). */
  payment_account: PaymentAccountSnapshot | null
  payment_notes: string | null
  notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ContributionCreate {
  friend_id: UUID
  amount: number
  notes?: string | null
  /** Required by the backend for paid_only events; rejected for track_status. */
  payment_account_id?: UUID
  paid_at?: ISODateTime
  payment_notes?: string | null
}

/**
 * `amount` may be omitted but must not be null. Paid amount edits are allowed only for paid_only events.
 * Send only changed fields. The app never sends `payment_status` (422 when it differs).
 */
export interface ContributionUpdate {
  amount?: number
  notes?: string | null
}

export interface ContributionListParams extends PageParams {
  payment_status?: PaymentStatus
}

// --- Payment accounts ---------------------------------------------------------

/** A treasurer-owned bank / e-wallet account. `provider_name` is free text (BRI, DANA, ...). */
export interface PaymentAccount {
  id: UUID
  type: PaymentAccountType
  provider_name: string
  account_name: string
  /** A string so leading zeros survive; `null` for cash accounts, which have no number. */
  account_number: string | null
  label: string | null
  is_active: boolean
  created_at: ISODateTime
  updated_at: ISODateTime
}

/**
 * `bank` / `e_wallet` need `provider_name` and `account_number`. `cash` needs only `account_name` (the
 * holder): the backend fixes the provider to "Cash" and rejects a number, so the app sends neither.
 */
export interface PaymentAccountCreate {
  type: PaymentAccountType
  provider_name?: string
  account_name: string
  account_number?: string
  label?: string | null
}

/** All fields optional; send only what changed. `label` may be cleared with null. */
export type PaymentAccountUpdate = Partial<PaymentAccountCreate>

export interface PaymentAccountListParams {
  is_active?: boolean
  type?: PaymentAccountType
}

/** Body of `PUT /events/{id}/payment-accounts`: replaces the whole set. */
export interface EventPaymentAccountsUpdate {
  payment_account_ids: UUID[]
}

// --- Contribution payment (one per contribution) -------------------------------

/** Account details frozen onto the contribution at the moment it was paid. */
export interface PaymentAccountSnapshot {
  id: UUID
  type: PaymentAccountType
  provider_name: string
  account_name: string
  /** `null` for cash. */
  account_number: string | null
  label: string | null
}

/** Body of `PATCH /contributions/{id}/payment`. There is deliberately no amount: it is the bill. */
export interface ContributionPaymentRecord {
  payment_account_id: UUID
  /** Must be timezone-aware (e.g. `2026-11-15T14:00:00+07:00`). Defaults to now on the backend. */
  paid_at?: ISODateTime
  notes?: string | null
}

/** Body of `POST /contributions/{id}/payment/cancel`; the whole body is optional. */
export interface ContributionPaymentCancel {
  reason?: string
}

// --- Public (allow-listed, unauthenticated) ----------------------------------

export interface PublicEvent {
  id: UUID
  title: string
  description: string | null
  event_date: ISODate | null
  target_amount: number | null
  status: EventStatus
}

/** Only the display name and status are public. No amounts, phones or notes. */
export interface PublicParticipant {
  name: string
  payment_status: PaymentStatus
}

export interface PublicEventDetail extends PublicEvent {
  participants: PublicParticipant[]
}

export interface PublicEventListParams extends PageParams {
  status?: EventStatus
}

// --- Errors ------------------------------------------------------------------

export interface ApiValidationDetail {
  field: string
  message: string
}

/** Every backend error is `{"error": {code, message, details}}`. */
export interface ApiErrorBody {
  error: {
    code: string
    message: string
    details: unknown
  }
}
