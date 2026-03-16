import { useState, useEffect } from 'react'
import { tourSteps } from './tourSteps'

const TOUR_KEY = 'clubpal_tour_done'

export function useTour(user) {
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem(TOUR_KEY)
    if (!done && user?.onboarding_complete) {
      const t = setTimeout(() => setActive(true), 800)
      return () => clearTimeout(t)
    }
  }, [user?.onboarding_complete])

  function next() {
    if (step < tourSteps.length - 1) setStep(s => s + 1)
    else end()
  }

  function prev() {
    if (step > 0) setStep(s => s - 1)
  }

  function goTo(i) {
    setStep(i)
  }

  function end() {
    localStorage.setItem(TOUR_KEY, 'true')
    setActive(false)
    setStep(0)
  }

  return { active, step, next, prev, goTo, end }
}
