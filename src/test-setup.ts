import '@testing-library/jest-dom'
import { clearCache } from './lib/cache'

// cachedFetch mantém cache em memória no nível do módulo (TTL 10min).
// Sem reset, o catálogo do primeiro teste vaza para os seguintes do mesmo arquivo.
beforeEach(() => {
  clearCache()
})
