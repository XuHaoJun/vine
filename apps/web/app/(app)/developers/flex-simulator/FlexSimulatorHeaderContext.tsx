import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'

type FlexSimulatorHeaderContextValue = {
  resetHandler: (() => void) | null
  setResetHandler: (fn: (() => void) | null) => void
}

const FlexSimulatorHeaderContext = createContext<FlexSimulatorHeaderContextValue | null>(
  null,
)

export function FlexSimulatorHeaderProvider({ children }: { children: ReactNode }) {
  const [resetHandler, setResetHandler] = useState<(() => void) | null>(null)
  const value = useMemo(() => ({ resetHandler, setResetHandler }), [resetHandler])
  return (
    <FlexSimulatorHeaderContext.Provider value={value}>
      {children}
    </FlexSimulatorHeaderContext.Provider>
  )
}

export function useFlexSimulatorHeader() {
  const ctx = useContext(FlexSimulatorHeaderContext)
  if (!ctx) {
    throw new Error(
      'useFlexSimulatorHeader must be used within FlexSimulatorHeaderProvider',
    )
  }
  return ctx
}
