import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, size = 'md' }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose?.() }
    if (open) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null
  const sizes = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl', full: 'max-w-6xl' }

  return (
    <div className="modal-overlay">
      <div className={`modal w-full ${sizes[size] || sizes.md}`}>
        {title && (
          <div className="modal-title">
            <span>{title}</span>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-brand-red transition-colors text-xl leading-none">x</button>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
