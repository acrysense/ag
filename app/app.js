import 'virtual:svg-icons-register'
import '@/assets/styles/main.scss'
import { mount, unmount } from '@/core/mount'
import { autosize } from '@/utils/autosize'

// hide the initial-load overlay once styles + sprite are in and the app mounted
function hideAppLoader() {
	const loader = document.querySelector('[data-app-loader]')
	if (!loader) return
	requestAnimationFrame(() => {
		loader.classList.add('is-hidden')
		loader.addEventListener('transitionend', () => loader.remove(), { once: true })
		setTimeout(() => loader.remove(), 700)
	})
}

function init() {
	mount(document)
	autosize(document)

	const lifecycleObserver = new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			mutation.removedNodes.forEach((node) => {
				// A relocated node reports a removal too, but it's still in the document
				// under its new parent — don't dispose it (mount() then skips it as
				// already-mounted, so a move is a no-op). Only truly detached nodes
				// unmount. Lets a component move in the DOM without re-initialising.
				if (node instanceof Element && !node.isConnected) unmount(node)
			})
			mutation.addedNodes.forEach((node) => {
				if (node instanceof Element) mount(node)
			})
		}
	})

	lifecycleObserver.observe(document.body, { childList: true, subtree: true })

	hideAppLoader()
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
