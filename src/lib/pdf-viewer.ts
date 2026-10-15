/**
 * Embedded PDF previews show the page only: no toolbar, no thumbnail sidebar (the Download button
 * next to the preview is the one control). Honoured by Chrome and Edge; other viewers ignore it.
 */
export const pdfViewerSrc = (url: string): string => `${url}#toolbar=0&navpanes=0&view=FitH`;
