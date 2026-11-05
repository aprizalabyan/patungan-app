import '@testing-library/jest-dom/vitest'
import { session } from '@/services/session'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  session.clear()
})
