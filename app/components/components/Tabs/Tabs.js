import { mountTabs } from '@/utils/tabs'

// Generic auto-mount for a standalone `.tabs` block (data-module="Tabs").
// Components that own their tabs (Package, Visits…) call mountTabs themselves;
// this is for tabs placed directly on a page.
export default (root) => mountTabs(root)
