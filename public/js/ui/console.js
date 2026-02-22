const MAX_LINES = 100

/**
 * Retro green console overlay controller.
 */
export function createConsole() {
  const container = document.getElementById('console-lines')

  /**
   * Append a line of text to the console overlay.
   * @param {string} text
   * @param {'normal'|'error'} type
   */
  function appendLine(text, type = 'normal') {
    const line = document.createElement('div')
    line.className = type === 'error' ? 'console-line error' : 'console-line'
    line.textContent = text
    container.appendChild(line)

    // Trim oldest lines
    while (container.childElementCount > MAX_LINES) {
      container.removeChild(container.firstChild)
    }

    // Auto-scroll to bottom
    container.scrollTop = container.scrollHeight
  }

  function clear() {
    container.replaceChildren()
  }

  return { appendLine, clear }
}
