import { useState, useEffect, useCallback } from "react"

const TOAST_LIMIT = 3
const TOAST_REMOVE_DELAY = 5000

let count = 0

function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

const toastTimeouts = new Map()

const addToRemoveQueue = (toastId, setToasts) => {
  if (toastTimeouts.has(toastId)) {
    return
  }

  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    setToasts((toasts) => toasts.filter((t) => t.id !== toastId))
  }, TOAST_REMOVE_DELAY)

  toastTimeouts.set(toastId, timeout)
}

export function useToast() {
  const [toasts, setToasts] = useState([])

  const toast = useCallback(
    ({ ...props }) => {
      const id = genId()

      const newToast = {
        ...props,
        id,
        open: true,
        onOpenChange: (open) => {
          if (!open) {
            setToasts((toasts) => toasts.filter((t) => t.id !== id))
          }
        },
      }

      setToasts((toasts) => [newToast, ...toasts].slice(0, TOAST_LIMIT))

      addToRemoveQueue(id, setToasts)

      return {
        id,
        dismiss: () => setToasts((toasts) => toasts.filter((t) => t.id !== id)),
      }
    },
    []
  )

  const dismiss = useCallback((toastId) => {
    setToasts((toasts) => toasts.filter((t) => t.id !== toastId))
  }, [])

  return {
    toasts,
    toast,
    dismiss,
  }
}
