/**
 * Hands a generated file to the browser as a download. The object URL is
 * released on the next tick: revoking it in the same task can cancel the
 * download in Safari and Firefox before it starts.
 */
export const downloadBlob = (blob: Blob, filename: string) => {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
};
