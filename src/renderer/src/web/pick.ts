/** Open the browser file picker and resolve with the chosen files ([] if cancelled). */
export function pickFiles(accept: string, multiple: boolean): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.multiple = multiple
    input.style.display = 'none'
    input.addEventListener('change', () => {
      resolve(Array.from(input.files ?? []))
      input.remove()
    }, { once: true })
    input.addEventListener('cancel', () => {
      resolve([])
      input.remove()
    }, { once: true })
    document.body.append(input)
    input.click()
  })
}
