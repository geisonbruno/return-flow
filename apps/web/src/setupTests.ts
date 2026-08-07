import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// This project doesn't set `test.globals: true`, so Testing Library's
// automatic per-test cleanup (which relies on detecting a global
// `afterEach`) never registers on its own — without this, DOM from earlier
// tests in the same file accumulates and later `getBy*` queries start
// matching more than one element.
afterEach(() => {
  cleanup()
})
