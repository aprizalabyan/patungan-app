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
export type PaymentStatus = 'pending' | 'paid'

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
  is_public?: boolean
}

/** `title`, `status`, `is_public` may be omitted but must not be null. */
export type EventUpdate = Partial<EventCreate>

export interface EventListParams extends PageParams {
  status?: EventStatus
}

/**
 * Backend-computed aggregates. `total_collected` counts paid contributions only.
 * `progress_percent` is floor(collected*100/target), not capped at 100, and null
 * when the target is missing or zero.
 */
export interface EventSummary {
  event_id: UUID
  total_participants: number
  paid_count: number
  pending_count: number
  total_collected: number
  total_pending: number
  target_amount: number | null
  progress_percent: number | null
}

// --- Contributions -----------------------------------------------------------

export interface Contribution {
  id: UUID
  event_id: UUID
  friend_id: UUID
  friend: FriendBrief
  amount: number
  payment_status: PaymentStatus
  paid_at: ISODateTime | null
  notes: string | null
  created_at: ISODateTime
  updated_at: ISODateTime
}

export interface ContributionCreate {
  friend_id: UUID
  amount: number
  notes?: string | null
}

/** `amount` and `payment_status` may be omitted but must not be null. */
export interface ContributionUpdate {
  amount?: number
  payment_status?: PaymentStatus
  notes?: string | null
}

export interface ContributionListParams extends PageParams {
  payment_status?: PaymentStatus
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
