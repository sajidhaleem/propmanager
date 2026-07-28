// Exclude receiptData (base64 blob) from ordinary responses — the /receipt
// route serves it separately when actually needed
export const EXPENSE_LIST_SELECT = {
  id: true, date: true, category: true, description: true, amount: true,
  vendor: true, notes: true, month: true, year: true,
  receiptMimeType: true, receiptName: true,
  createdAt: true, updatedAt: true,
} as const
