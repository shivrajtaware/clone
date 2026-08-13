// Print a standalone document without opening a new browser window. This works
// in browsers and in Tauri's WebView, where popup windows may be disabled.
export function printHtml(html, title = 'Document') {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe')
    frame.title = title
    frame.setAttribute('aria-hidden', 'true')
    Object.assign(frame.style, {
      position: 'fixed', width: '1px', height: '1px', border: '0',
      opacity: '0', pointerEvents: 'none', right: '0', bottom: '0',
    })

    const remove = () => {
      window.removeEventListener('afterprint', remove)
      if (frame.parentNode) frame.parentNode.removeChild(frame)
    }
    const fail = () => {
      remove()
      reject(new Error('The print dialog could not be opened.'))
    }

    frame.onload = async () => {
      try {
        const images = Array.from(frame.contentDocument?.images || [])
        await Promise.all(images.map(image => image.complete
          ? Promise.resolve()
          : new Promise(done => { image.onload = done; image.onerror = done })
        ))
        // Let WebView finish layout before its native print call.
        setTimeout(() => {
          try {
            window.addEventListener('afterprint', remove, { once: true })
            frame.contentWindow?.focus()
            frame.contentWindow?.print()
            setTimeout(remove, 60000)
            resolve()
          } catch (error) {
            fail(error)
          }
        }, 100)
      } catch (error) {
        fail(error)
      }
    }

    frame.srcdoc = html
    document.body.appendChild(frame)
  })
}
