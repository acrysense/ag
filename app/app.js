import 'virtual:svg-icons-register'
import '@/assets/styles/main.scss'
import { mount, unmount } from '@/core/mount'
import { autosize } from '@/utils/autosize'

function init() {
	mount(document)
	autosize(document)

	const lifecycleObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			mutation.removedNodes.forEach((node) => {
				if (node instanceof Element) unmount(node)
			})
			mutation.addedNodes.forEach((node) => {
				if (node instanceof Element) mount(node)
			})
		}
	})

	lifecycleObserver.observe(document.body, { childList: true, subtree: true })
}

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', init, { once: true })
} else {
	init()
}

document.addEventListener('ui:mount', (event) => {
	mount(event.detail?.root || document)
})

document.addEventListener('ui:unmount', (event) => {
	unmount(event.detail?.root || document)
})
