import { useCallback } from 'react'
import { useToast } from '@/components/ui/Toast'
import { copyText } from '@/utils/clipboard'

export function useCopyToClipboard() {
  const toast = useToast()
  return useCallback(
    async (text: string, successMessage: string) => {
      try {
        await copyText(text)
        toast.success(successMessage)
      } catch {
        toast.error('Gagal menyalin. Silakan salin secara manual.')
      }
    },
    [toast],
  )
}
