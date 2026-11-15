import '@testing-library/jest-dom/vitest'
import { session } from '@/services/session'
import { cleanup, configure } from '@testing-library/react'
import { afterEach } from 'vitest'

// The first render in a test file pays the cold-import cost of the whole app, which exceeds
// the 1s default when several files run in parallel.
configure({ asyncUtilTimeout: 4000 })

afterEach(() => {
  cleanup()
  sessionStorage.clear()
  session.clear()
})
