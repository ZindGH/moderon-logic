// @ts-check

// Script run within the webview itself.
(function () {

	// Get a reference to the VS Code webview api.
	// We use this API to post messages back to our extension.

	// @ts-ignore
	const vscode = acquireVsCodeApi();


	const varsContainer = /** @type {HTMLElement} */ (document.querySelector('.tvars'));

	const addButtonContainer = document.querySelector('.add-button');

	// @ts-ignore
	addButtonContainer.querySelector('button').addEventListener('click', () => {
		vscode.postMessage({
			type: 'add'
		});
	})

	const errorContainer = document.createElement('div');
	document.body.appendChild(errorContainer);
	errorContainer.className = 'error'
	errorContainer.style.display = 'none'

	/**
	 * Render the document in the webview.
	 */
	function updateContent(/** @type {string} */ text) {
		let json;
		try {
			if (!text) {
				text = '{}';
			}
			json = JSON.parse(text);
		} catch {
			varsContainer.style.display = 'none';
			errorContainer.innerText = 'Error: Document is not valid json';
			errorContainer.style.display = '';
			return;
		}
		varsContainer.style.display = '';
		errorContainer.style.display = 'none';

		// Render the scratches
		varsContainer.innerHTML = '';
		for (const tvar of json.vars || []) {
			const element = document.createElement('div');
			element.className = 'tvar';
			varsContainer.appendChild(element);

			const text = document.createElement('div');
			text.className = 'text';
			const textContent = document.createElement('span');
			textContent.innerText = tvar.text;
			text.appendChild(textContent);
			element.appendChild(text);

			const created = document.createElement('div');
			created.className = 'created';
			created.innerText = new Date(tvar.created).toUTCString();
			element.appendChild(created);

			const deleteButton = document.createElement('button');
			deleteButton.className = 'delete-button';
			deleteButton.addEventListener('click', () => {
				vscode.postMessage({ type: 'delete', id: tvar.id, });
			});
			element.appendChild(deleteButton);
		}

		// @ts-ignore
		varsContainer.appendChild(addButtonContainer);
	}

	// Handle messages sent from the extension to the webview
	window.addEventListener('message', event => {
		const message = event.data; // The json data that the extension sent
		switch (message.type) {
			case 'update':
				const text = message.text;

				// Update our webview's content
				updateContent(text);

				// Then persist state information.
				// This state is returned in the call to `vscode.getState` below when a webview is reloaded.
				vscode.setState({ text });

				return;
		}
	});

	// Webviews are normally torn down when not visible and re-created when they become visible again.
	// State lets us save information across these re-loads
	const state = vscode.getState();
	if (state) {
		updateContent(state.text);
	}
}());
