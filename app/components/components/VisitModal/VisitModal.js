import { mountVisitModal } from '@/utils/visitModal'

// The modal markup self-mounts wherever the partial is included; it opens on any
// [data-visit-create] trigger on the page (visits panel button, calendar cells…).
export default (root) => mountVisitModal(root)
