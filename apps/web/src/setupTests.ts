import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
import { vi } from 'vitest'
import { createElement } from 'react'

// Chart internals are not the product contract and are expensive/noisy in
// jsdom. Dashboard tests assert the transformed text and surrounding
// semantics instead of Recharts' generated SVG structure.
vi.mock('recharts', () => {
  const component = (name: string) => ({ children }: { children?: unknown }) =>
    createElement('div', { 'data-chart-component': name }, children as never)
  return {
    ResponsiveContainer: component('ResponsiveContainer'),
    AreaChart: component('AreaChart'), Area: component('Area'),
    BarChart: component('BarChart'), Bar: component('Bar'),
    PieChart: component('PieChart'), Pie: component('Pie'), Cell: component('Cell'),
    CartesianGrid: component('CartesianGrid'), XAxis: component('XAxis'), YAxis: component('YAxis'), Tooltip: component('Tooltip'),
  }
})

// This project doesn't set `test.globals: true`, so Testing Library's
// automatic per-test cleanup (which relies on detecting a global
// `afterEach`) never registers on its own — without this, DOM from earlier
// tests in the same file accumulates and later `getBy*` queries start
// matching more than one element.
afterEach(() => {
  cleanup()
})
